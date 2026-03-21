import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../db/pool.js';
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

    const normalizedEmail = email.toLowerCase();
    const googleAvatarUrl = payload.picture || null;

    const googleResult = await pool.query(
      `SELECT ${USER_SELECT} FROM users WHERE google_user_id = $1 AND deleted_at IS NULL`,
      [sub]
    );

    if (googleResult.rows.length > 0) {
      const user = googleResult.rows[0];
      if (user.suspended) {
        return res.status(403).json({ error: 'Account suspended. Contact support.', code: 'AUTH_ACCOUNT_SUSPENDED' });
      }
      if (googleAvatarUrl) {
        await pool.query('UPDATE users SET google_avatar_url = $1 WHERE id = $2', [googleAvatarUrl, user.id]);
        user.google_avatar_url = googleAvatarUrl;
      }
      return await respondWithSession(req, res, { user, isNewUser: false });
    }

    const emailResult = await pool.query(
      `SELECT ${USER_SELECT} FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [normalizedEmail]
    );

    if (emailResult.rows.length > 0) {
      const user = emailResult.rows[0];
      if (user.suspended) {
        return res.status(403).json({ error: 'Account suspended. Contact support.', code: 'AUTH_ACCOUNT_SUSPENDED' });
      }

      if (!email_verified || isAppleRelayEmail(normalizedEmail)) {
        return res.status(409).json({ error: 'An account with this email already exists. Try signing in with a different method.' });
      }

      const updates = ['google_user_id = $2', 'email_verified = true'];
      const params = [user.id, sub];
      let paramIdx = 3;

      if (googleAvatarUrl) {
        updates.push(`google_avatar_url = $${paramIdx}`);
        params.push(googleAvatarUrl);
        paramIdx++;
      }

      if (!user.display_name && name) {
        updates.push(`display_name = $${paramIdx}`);
        params.push(name);
        paramIdx++;
      }

      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $1`, params);
      const updated = await pool.query(`SELECT ${USER_SELECT} FROM users WHERE id = $1`, [user.id]);
      return await respondWithSession(req, res, { user: updated.rows[0], isNewUser: false });
    }

    const newUser = await pool.query(
      `INSERT INTO users (email, display_name, google_user_id, google_avatar_url, email_verified, plan, trial_ends_at)
       VALUES ($1, $2, $3, $4, true, 'trial', NOW() + INTERVAL '7 days')
       RETURNING ${USER_SELECT}`,
      [normalizedEmail, name || null, sub, googleAvatarUrl]
    );

    const user = newUser.rows[0];
    trackServerEvent(user.id, 'signup_completed', { method: 'google' });
    return await respondWithSession(req, res, { user, isNewUser: true, statusCode: 201 });
  } catch (err) {
    if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token')) {
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
