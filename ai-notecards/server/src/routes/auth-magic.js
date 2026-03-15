import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import pool from '../db/pool.js';
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
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [email, codeHash]
    );

    res.json({ ok: true });
    sendMagicLinkCode(email, code).catch(err => {
      console.error('Failed to send magic link email:', err);
    });
  } catch (err) {
    console.error('Magic link request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify', verifyLimiter, async (req, res) => {
  const { email: rawEmail, code: rawCode } = req.body ?? {};
  if (!rawEmail || !rawCode) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  const email = String(rawEmail).toLowerCase().trim();
  const code = String(rawCode).trim();

  try {
    const codeResult = await pool.query(
      `SELECT id, code_hash, attempts FROM magic_link_codes
       WHERE email = $1 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: 'Code expired or not found', code: 'AUTH_MAGIC_CODE_EXPIRED' });
    }

    const codeRow = codeResult.rows[0];

    if (codeRow.attempts >= 5) {
      await pool.query(`UPDATE magic_link_codes SET used_at = NOW() WHERE id = $1`, [codeRow.id]);
      return res.status(400).json({ error: 'Too many attempts. Request a new code.', code: 'AUTH_MAGIC_CODE_EXPIRED' });
    }

    await pool.query(`UPDATE magic_link_codes SET attempts = attempts + 1 WHERE id = $1`, [codeRow.id]);

    const inputHash = hmacHash(code);
    if (inputHash !== codeRow.code_hash) {
      return res.status(400).json({ error: 'Invalid code', code: 'AUTH_MAGIC_CODE_INVALID' });
    }

    const consumeResult = await pool.query(
      `UPDATE magic_link_codes SET used_at = NOW() WHERE id = $1 AND used_at IS NULL RETURNING id`,
      [codeRow.id]
    );
    if (consumeResult.rows.length === 0) {
      return res.status(400).json({ error: 'Code already used', code: 'AUTH_MAGIC_CODE_EXPIRED' });
    }

    const userResult = await pool.query(
      `SELECT ${USER_SELECT}, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    let user;
    let isNewUser = false;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];

      if (user.suspended) {
        return res.status(403).json({ error: 'Account suspended. Contact support.', code: 'AUTH_ACCOUNT_SUSPENDED' });
      }

      if (!user.email_verified) {
        await pool.query(`UPDATE users SET email_verified = true WHERE id = $1`, [user.id]);
        const updated = await pool.query(`SELECT ${USER_SELECT} FROM users WHERE id = $1`, [user.id]);
        user = updated.rows[0];
      }
    } else {
      const newUserResult = await pool.query(
        `INSERT INTO users (email, plan, trial_ends_at, email_verified)
         VALUES ($1, 'trial', NOW() + INTERVAL '7 days', true)
         RETURNING ${USER_SELECT}`,
        [email]
      );
      user = newUserResult.rows[0];
      isNewUser = true;
      trackServerEvent(user.id, 'signup_completed', { method: 'magic_link' });
    }

    await respondWithSession(req, res, { user, isNewUser });
  } catch (err) {
    console.error('Magic link verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
