import { Router } from 'express';
import crypto from 'crypto';
import pool from '../db/pool.js';
import { USER_SELECT, createToken, setTokenCookie, sanitizeUser } from './auth.js';
import { ErrorCodes } from '../constants/errors.js';

const router = Router();

// HMAC-based nonce verification (no server-side storage needed)
const NONCE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function generateNonce() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(16).toString('hex');
  const data = `${timestamp}:${random}`;
  const hmac = crypto.createHmac('sha256', process.env.JWT_SECRET).update(data).digest('hex');
  return `${data}:${hmac}`;
}

function verifyNonce(nonce) {
  if (!nonce || typeof nonce !== 'string') return false;
  const parts = nonce.split(':');
  if (parts.length !== 3) return false;

  const [timestamp, random, hmac] = parts;
  const data = `${timestamp}:${random}`;
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET).update(data).digest('hex');

  // Timing-safe comparison
  if (hmac.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) return false;

  // Check age
  const nonceTime = parseInt(timestamp, 36);
  if (Date.now() - nonceTime > NONCE_MAX_AGE_MS) return false;

  return true;
}

// GET /api/auth/apple/nonce — generate nonce for SIWA
router.get('/nonce', (req, res) => {
  const nonce = generateNonce();
  res.json({ nonce });
});

// POST /api/auth/apple — Sign in with Apple (create-only, no account linking in v1)
router.post('/', async (req, res) => {
  const { identityToken, nonce, fullName, email: appleEmail } = req.body;

  if (!identityToken) {
    return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Identity token required' });
  }

  try {
    // Dynamically import apple-signin-auth (may not be installed yet)
    let appleSignin;
    try {
      appleSignin = await import('apple-signin-auth');
    } catch {
      console.error('apple-signin-auth not installed');
      return res.status(500).json({ error: ErrorCodes.SERVER_ERROR, message: 'Apple Sign In not configured' });
    }

    // Verify Apple identity token
    const appleUser = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_BUNDLE_ID,
      ignoreExpiration: false,
    });

    // Verify nonce if provided
    if (nonce && !verifyNonce(appleUser.nonce)) {
      return res.status(401).json({ error: ErrorCodes.AUTH_INVALID_TOKEN, message: 'Invalid nonce' });
    }

    const appleUserId = appleUser.sub;
    if (!appleUserId) {
      return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Invalid identity token' });
    }

    // Lookup by apple_user_id
    const existing = await pool.query(
      `SELECT ${USER_SELECT} FROM users WHERE apple_user_id = $1 AND deleted_at IS NULL`,
      [appleUserId]
    );

    if (existing.rows.length > 0) {
      // Existing SIWA user — login
      const user = existing.rows[0];
      if (user.suspended) {
        return res.status(403).json({ error: ErrorCodes.AUTH_ACCOUNT_SUSPENDED });
      }
      const token = setTokenCookie(res, user.id);
      return res.json({ token, user: sanitizeUser(user) });
    }

    // New user — create account (no account linking in v1)
    const email = appleEmail || appleUser.email || `apple-${appleUserId.slice(0, 8)}@private.relay`;
    const displayName = fullName
      ? [fullName.givenName, fullName.familyName].filter(Boolean).join(' ') || null
      : null;

    const result = await pool.query(
      `INSERT INTO users (email, apple_user_id, display_name, plan, trial_ends_at)
       VALUES ($1, $2, $3, 'trial', NOW() + INTERVAL '7 days')
       RETURNING ${USER_SELECT}`,
      [email.toLowerCase(), appleUserId, displayName]
    );

    const user = result.rows[0];
    const token = setTokenCookie(res, user.id);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Apple auth error:', err);
    if (err.code === '23505') {
      // Unique constraint violation (email already exists)
      return res.status(409).json({ error: ErrorCodes.AUTH_EMAIL_EXISTS, message: 'An account with this email already exists. Please log in with your password.' });
    }
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});

export default router;
