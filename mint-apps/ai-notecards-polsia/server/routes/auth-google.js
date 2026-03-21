import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../db/index.js';
import { USER_SELECT, respondWithSession } from './auth.js';
import { trackServerEvent } from '../services/analytics.js';

const router = Router();

const googleLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

let oauthClient;
async function getOAuthClient() {
  if (!oauthClient) {
    const { OAuth2Client } = await import('google-auth-library');
    oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return oauthClient;
}

function isAppleRelayEmail(email) {
  return email.endsWith('@privaterelay.appleid.com') || /^apple-[a-z0-9]+@private\.relay$/i.test(email);
}

router.post('/', googleLimiter, async (req, res) => {
  const { idToken } = req.body ?? {};
  if (typeof idToken !== 'string' || !idToken) {
    return res.status(400).json({ error: 'ID token is required' });
  }

  try {
    const client = await getOAuthClient();
    const audience = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_IOS_CLIENT_ID].filter(Boolean);
    const ticket = await client.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();

    const { sub, email, name, email_verified } = payload;
    if (!email) {
      return res.status(400).json({ error: 'Google account has no email' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isRelay = isAppleRelayEmail(normalizedEmail);

    const existingByGoogle = await pool.query(
      `SELECT ${USER_SELECT}
       FROM users
       WHERE google_user_id = $1 AND deleted_at IS NULL`,
      [sub]
    );
    if (existingByGoogle.rows[0]) {
      const user = existingByGoogle.rows[0];
      trackServerEvent(user.id, 'google_logged_in');
      return respondWithSession(req, res, user);
    }

    const existingByEmail = await pool.query(
      `SELECT ${USER_SELECT}, google_user_id, apple_user_id
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [normalizedEmail]
    );

    if (existingByEmail.rows[0]) {
      const existing = existingByEmail.rows[0];
      if (existing.apple_user_id && isRelay) {
        return res.status(409).json({ error: 'This account already uses Apple Sign-In. Please continue with Apple.' });
      }
      const { rows } = await pool.query(
        `UPDATE users
         SET google_user_id = $1,
             display_name = COALESCE(display_name, $2),
             email_verified = email_verified OR $3
         WHERE id = $4
         RETURNING ${USER_SELECT}`,
        [sub, name || null, !!email_verified, existing.id]
      );
      const user = rows[0];
      trackServerEvent(user.id, 'google_linked');
      return respondWithSession(req, res, user);
    }

    const { rows } = await pool.query(
      `INSERT INTO users (email, google_user_id, display_name, email_verified, plan, trial_ends_at)
       VALUES ($1, $2, $3, $4, 'trial', NOW() + INTERVAL '7 days')
       RETURNING ${USER_SELECT}`,
      [normalizedEmail, sub, name || null, !!email_verified]
    );
    const user = rows[0];
    trackServerEvent(user.id, 'google_signed_up');
    return respondWithSession(req, res, user);
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(401).json({ error: 'Invalid Google token' });
  }
});

export default router;
