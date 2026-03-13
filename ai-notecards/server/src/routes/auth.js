import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { ErrorCodes } from '../constants/errors.js';

const router = Router();
const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '24h';
const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

export const USER_SELECT = `id, email, plan, trial_ends_at, daily_generation_count, last_generation_date,
  study_score, stripe_customer_id, stripe_connect_account_id, connect_charges_enabled,
  display_name, role, suspended, created_at, preferred_model,
  apple_subscription_expires_at, apple_subscription_product_id`;

export function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function setTokenCookie(res, userId) {
  const token = createToken(userId);
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE,
  });
  return token;
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan,
    trial_ends_at: user.trial_ends_at,
    study_score: user.study_score,
    daily_generation_count: user.daily_generation_count,
    last_generation_date: user.last_generation_date,
    stripe_customer_id: user.stripe_customer_id,
    stripe_connect_account_id: user.stripe_connect_account_id,
    connect_charges_enabled: user.connect_charges_enabled,
    display_name: user.display_name,
    role: user.role,
    suspended: user.suspended,
    created_at: user.created_at,
    preferred_model: user.preferred_model,
    apple_subscription_expires_at: user.apple_subscription_expires_at,
    apple_subscription_product_id: user.apple_subscription_product_id,
  };
}

router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: ErrorCodes.AUTH_EMAIL_EXISTS, message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, plan, trial_ends_at)
       VALUES ($1, $2, 'trial', NOW() + INTERVAL '7 days')
       RETURNING ${USER_SELECT}`,
      [email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    const token = setTokenCookie(res, user.id);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT ${USER_SELECT}, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: ErrorCodes.AUTH_INVALID_CREDENTIALS });
    }

    const user = result.rows[0];
    if (user.suspended) {
      return res.status(403).json({ error: ErrorCodes.AUTH_ACCOUNT_SUSPENDED });
    }

    // SIWA users have no password — direct them to Sign in with Apple
    if (!user.password_hash) {
      return res.status(401).json({ error: ErrorCodes.AUTH_USE_APPLE, message: 'Use Sign in with Apple' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: ErrorCodes.AUTH_INVALID_CREDENTIALS });
    }

    const token = setTokenCookie(res, user.id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    // Revoke all tokens by setting token_revoked_at
    await pool.query('UPDATE users SET token_revoked_at = NOW() WHERE id = $1', [req.userId]);
    res.clearCookie('token');
    res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.clearCookie('token');
    res.json({ ok: true });
  }
});

router.get('/me', async (req, res) => {
  // Dual behavior: Bearer → 401 on failure, Cookie → { user: null } on failure
  const authHeader = req.headers.authorization;
  const isBearer = authHeader?.startsWith('Bearer ');
  const tokenStr = isBearer ? authHeader.slice(7) : req.cookies?.token;

  if (!tokenStr) {
    if (isBearer) return res.status(401).json({ error: ErrorCodes.AUTH_REQUIRED });
    return res.json({ user: null });
  }

  try {
    const payload = jwt.verify(tokenStr, process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT ${USER_SELECT}, token_revoked_at FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      if (!isBearer) res.clearCookie('token');
      if (isBearer) return res.status(401).json({ error: ErrorCodes.AUTH_INVALID_TOKEN });
      return res.json({ user: null });
    }

    const user = result.rows[0];

    // Check token revocation
    if (user.token_revoked_at && payload.iat < Math.floor(new Date(user.token_revoked_at).getTime() / 1000)) {
      if (!isBearer) res.clearCookie('token');
      if (isBearer) return res.status(401).json({ error: ErrorCodes.AUTH_EXPIRED_TOKEN });
      return res.json({ user: null });
    }

    // Auto-downgrade expired trial
    if (user.plan === 'trial' && user.trial_ends_at && new Date(user.trial_ends_at) < new Date()) {
      await pool.query("UPDATE users SET plan = 'free' WHERE id = $1 AND plan = 'trial'", [user.id]);
      user.plan = 'free';
    }

    res.json({ user: sanitizeUser(user) });
  } catch {
    if (!isBearer) res.clearCookie('token');
    if (isBearer) return res.status(401).json({ error: ErrorCodes.AUTH_INVALID_TOKEN });
    res.json({ user: null });
  }
});

export default router;
