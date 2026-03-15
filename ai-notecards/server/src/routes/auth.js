import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from '../db/pool.js';
import { PLAN_LIMITS } from '../middleware/plan.js';
import { trackServerEvent } from '../services/analytics.js';

const router = Router();
export const SALT_ROUNDS = 12;
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export const USER_SELECT = `id, email, plan, trial_ends_at, daily_generation_count, last_generation_date,
  study_score, stripe_customer_id, stripe_connect_account_id, connect_charges_enabled,
  connect_payouts_enabled, seller_terms_accepted_at,
  display_name, role, suspended, google_user_id, created_at,
  avatar_url, google_avatar_url, preferences, email_verified, token_revoked_at,
  cancel_at_period_end, cancel_at,
  (password_hash IS NOT NULL) AS has_password`;

export function setTokenCookie(res, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE,
  });
}

const STORAGE_BASE = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/storage/v1/object/public`
  : '';

export function sanitizeUser(user) {
  // Resolve avatar: uploaded avatar (with cache-bust) > Google avatar > null
  let resolvedAvatar = null;
  if (user.avatar_url && STORAGE_BASE) {
    const cacheBust = user.updated_at ? `?v=${new Date(user.updated_at).getTime()}` : '';
    resolvedAvatar = `${STORAGE_BASE}/${user.avatar_url}${cacheBust}`;
  } else if (user.google_avatar_url) {
    resolvedAvatar = user.google_avatar_url;
  }

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
    connect_payouts_enabled: user.connect_payouts_enabled,
    seller_terms_accepted_at: user.seller_terms_accepted_at,
    display_name: user.display_name,
    role: user.role,
    suspended: user.suspended,
    created_at: user.created_at,
    avatar_url: resolvedAvatar,
    has_password: user.has_password,
    cancel_at_period_end: user.cancel_at_period_end || false,
    cancel_at: user.cancel_at,
    google_connected: !!user.google_user_id,
    email_verified: !!user.email_verified,
    preferences: user.preferences || {},
  };
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const signupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

router.post('/signup', signupLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, plan, trial_ends_at)
       VALUES ($1, $2, 'trial', NOW() + INTERVAL '7 days')
       RETURNING ${USER_SELECT}`,
      [email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];
    setTokenCookie(res, user.id);
    trackServerEvent(user.id, 'signup_completed', { method: 'email' });
    res.status(201).json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT ${USER_SELECT}, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    if (user.suspended) {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    setTokenCookie(res, user.id);
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.json({ user: null });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT ${USER_SELECT},
        (SELECT COUNT(*)::int FROM decks WHERE user_id = users.id) AS deck_count
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [payload.userId]
    );
    if (result.rows.length === 0) {
      res.clearCookie('token');
      return res.json({ user: null });
    }

    const user = result.rows[0];

    // Check token revocation (password change invalidates old sessions)
    if (user.token_revoked_at && new Date(user.token_revoked_at) > new Date(payload.iat * 1000)) {
      res.clearCookie('token');
      return res.json({ user: null });
    }

    // Auto-downgrade expired trial
    if (user.plan === 'trial' && user.trial_ends_at && new Date(user.trial_ends_at) < new Date()) {
      await pool.query("UPDATE users SET plan = 'free' WHERE id = $1 AND plan = 'trial'", [user.id]);
      user.plan = 'free';
    }

    const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
    res.json({ user: sanitizeUser(user), daily_generation_limit: limits.generationsPerDay, deck_count: user.deck_count });
  } catch {
    res.clearCookie('token');
    res.json({ user: null });
  }
});

export default router;
