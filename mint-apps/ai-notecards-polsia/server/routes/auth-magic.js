import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import pool from '../db/index.js';
import { USER_SELECT, respondWithSession } from './auth.js';
import { trackServerEvent } from '../services/analytics.js';
import { sendMagicLinkCode } from '../services/email.js';

const router = Router();

const requestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

function hmacHash(code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(code)).digest('hex');
}

router.post('/request', requestLimiter, async (req, res) => {
  const { email: rawEmail } = req.body ?? {};
  if (!rawEmail || typeof rawEmail !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const email = rawEmail.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    await pool.query(
      `UPDATE magic_link_codes SET used_at = NOW() WHERE email = $1 AND used_at IS NULL`,
      [email]
    );

    await pool.query(`DELETE FROM magic_link_codes WHERE expires_at < NOW() - INTERVAL '1 hour'`);

    const code = crypto.randomInt(100000, 999999);
    const codeHash = hmacHash(code);

    await pool.query(
      `INSERT INTO magic_link_codes (email, code_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [email, codeHash]
    );

    await sendMagicLinkCode(email, code);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Magic link request error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify', verifyLimiter, async (req, res) => {
  const { email: rawEmail, code } = req.body ?? {};
  if (!rawEmail || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  const email = rawEmail.toLowerCase().trim();
  const codeHash = hmacHash(code);

  try {
    const { rows: codeRows } = await pool.query(
      `SELECT id, attempts, expires_at
       FROM magic_link_codes
       WHERE email = $1 AND code_hash = $2 AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, codeHash]
    );

    const record = codeRows[0];
    if (!record) {
      return res.status(401).json({ error: 'Invalid code' });
    }
    if (record.attempts >= 5) {
      return res.status(429).json({ error: 'Too many attempts' });
    }
    if (new Date(record.expires_at) <= new Date()) {
      return res.status(401).json({ error: 'Code expired' });
    }

    await pool.query(
      `UPDATE magic_link_codes SET attempts = attempts + 1 WHERE id = $1`,
      [record.id]
    );

    await pool.query(
      `UPDATE magic_link_codes SET used_at = NOW() WHERE id = $1`,
      [record.id]
    );

    const existing = await pool.query(
      `SELECT ${USER_SELECT}
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    let user = existing.rows[0];
    if (!user) {
      const inserted = await pool.query(
        `INSERT INTO users (email, email_verified, plan, trial_ends_at)
         VALUES ($1, true, 'trial', NOW() + INTERVAL '7 days')
         RETURNING ${USER_SELECT}`,
        [email]
      );
      user = inserted.rows[0];
      trackServerEvent(user.id, 'magic_link_signed_up');
    } else {
      const updated = await pool.query(
        `UPDATE users
         SET email_verified = true
         WHERE id = $1
         RETURNING ${USER_SELECT}`,
        [user.id]
      );
      user = updated.rows[0];
      trackServerEvent(user.id, 'magic_link_logged_in');
    }

    return respondWithSession(req, res, user);
  } catch (err) {
    console.error('Magic link verify error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
