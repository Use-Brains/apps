import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../db/index.js';
import { USER_SELECT, respondWithSession } from './auth.js';
import { trackServerEvent } from '../services/analytics.js';

const router = Router();
const appleLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

function isAppleRelayEmail(email) {
  return typeof email === 'string' && (
    email.endsWith('@privaterelay.appleid.com') || /^apple-[a-z0-9]+@private\.relay$/i.test(email)
  );
}

async function verifyAppleIdentityToken(identityToken) {
  const appleSignin = await import('apple-signin-auth');
  const audience = [process.env.APPLE_BUNDLE_ID, process.env.APPLE_SERVICE_ID].filter(Boolean);

  if (audience.length === 0) {
    throw new Error('Apple auth is not configured');
  }

  return appleSignin.default.verifyIdToken(identityToken, {
    audience,
    ignoreExpiration: false,
  });
}

router.post('/', appleLimiter, async (req, res) => {
  const { identityToken, fullName } = req.body ?? {};
  if (typeof identityToken !== 'string' || !identityToken) {
    return res.status(400).json({ error: 'Identity token is required' });
  }

  try {
    const payload = await verifyAppleIdentityToken(identityToken);
    const appleUserId = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    const displayName = typeof fullName === 'string' ? fullName.trim().slice(0, 80) : null;

    const existingApple = await pool.query(
      `SELECT ${USER_SELECT} FROM users WHERE apple_user_id = $1 AND deleted_at IS NULL`,
      [appleUserId]
    );

    if (existingApple.rows.length > 0) {
      const user = existingApple.rows[0];
      if (user.suspended) {
        return res.status(403).json({ error: 'Account suspended. Contact support.', code: 'AUTH_ACCOUNT_SUSPENDED' });
      }
      return await respondWithSession(req, res, { user, isNewUser: false });
    }

    if (email) {
      const emailMatch = await pool.query(
        `SELECT ${USER_SELECT} FROM users WHERE email = $1 AND deleted_at IS NULL`,
        [email]
      );

      if (emailMatch.rows.length > 0) {
        const user = emailMatch.rows[0];
        if (user.suspended) {
          return res.status(403).json({ error: 'Account suspended. Contact support.', code: 'AUTH_ACCOUNT_SUSPENDED' });
        }

        if (!isAppleRelayEmail(email)) {
          const updates = ['apple_user_id = $2', 'email_verified = true'];
          const params = [user.id, appleUserId];
          let paramIndex = 3;

          if (!user.display_name && displayName) {
            updates.push(`display_name = $${paramIndex}`);
            params.push(displayName);
            paramIndex++;
          }

          await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $1`, params);
          const updated = await pool.query(`SELECT ${USER_SELECT} FROM users WHERE id = $1`, [user.id]);
          return await respondWithSession(req, res, { user: updated.rows[0], isNewUser: false });
        }
      }
    }

    const newUser = await pool.query(
      `INSERT INTO users (email, display_name, apple_user_id, email_verified, plan, trial_ends_at)
       VALUES ($1, $2, $3, $4, 'trial', NOW() + INTERVAL '7 days')
       RETURNING ${USER_SELECT}`,
      [email || `apple-${appleUserId}@private.relay`, displayName, appleUserId, !!email]
    );

    const user = newUser.rows[0];
    trackServerEvent(user.id, 'signup_completed', { method: 'apple' });
    return await respondWithSession(req, res, { user, isNewUser: true, statusCode: 201 });
  } catch (err) {
    if (err.message === 'Apple auth is not configured') {
      return res.status(500).json({ error: 'Apple auth is not configured' });
    }
    console.error('Apple auth error:', err);
    return res.status(401).json({ error: 'Invalid or expired Apple credential' });
  }
});

export default router;
