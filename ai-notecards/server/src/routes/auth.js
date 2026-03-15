import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from '../db/pool.js';
import { PLAN_LIMITS } from '../middleware/plan.js';
import { trackServerEvent } from '../services/analytics.js';

const router = Router();
export const SALT_ROUNDS = 12;
const COOKIE_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_EXPIRY = '15m';
const NATIVE_CLIENT_PLATFORM = 'ios-native';
const MOBILE_SESSION_LIMIT = 5;

export const USER_SELECT = `id, email, plan, trial_ends_at, daily_generation_count, last_generation_date,
  study_score, current_streak, longest_streak, stripe_customer_id, stripe_connect_account_id, connect_charges_enabled,
  connect_payouts_enabled, seller_terms_accepted_at, apple_user_id,
  display_name, role, suspended, google_user_id, created_at,
  avatar_url, google_avatar_url, preferences, email_verified, token_revoked_at,
  cancel_at_period_end, cancel_at,
  (password_hash IS NOT NULL) AS has_password`;

export function isNativeClient(req) {
  return req.get('X-Client-Platform') === NATIVE_CLIENT_PLATFORM;
}

export function createAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function setTokenCookie(res, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_TOKEN_MAX_AGE,
  });
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(refreshToken) {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

function normalizeDeviceInfo(deviceInfo) {
  if (!deviceInfo || typeof deviceInfo !== 'object' || Array.isArray(deviceInfo)) {
    return { platform: 'ios' };
  }

  const normalized = { platform: 'ios' };
  const allowedKeys = ['platform', 'deviceName', 'osVersion', 'appVersion'];

  for (const key of allowedKeys) {
    const value = deviceInfo[key];
    if (typeof value === 'string') {
      normalized[key] = value.trim().slice(0, 120);
    }
  }

  normalized.platform = 'ios';
  return normalized;
}

async function enforceRefreshTokenLimit(client, userId) {
  await client.query(
    `WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) AS row_num
      FROM refresh_tokens
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
    )
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE id IN (SELECT id FROM ranked WHERE row_num > $2)`,
    [userId, MOBILE_SESSION_LIMIT]
  );
}

export async function issueMobileSession({ userId, deviceInfo }, client) {
  const accessToken = createAccessToken(userId);
  const refreshToken = createRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);

  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info, last_used_at)
     VALUES ($1, $2, NOW() + INTERVAL '30 days', $3::jsonb, NOW())`,
    [userId, tokenHash, JSON.stringify(normalizeDeviceInfo(deviceInfo))]
  );

  await enforceRefreshTokenLimit(client, userId);

  return { accessToken, refreshToken };
}

export async function revokeRefreshToken(refreshToken, client = pool) {
  if (!refreshToken || typeof refreshToken !== 'string') return;

  await client.query(
    `UPDATE refresh_tokens
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashRefreshToken(refreshToken)]
  );
}

export async function respondWithSession(req, res, { user, isNewUser = false, statusCode = 200 }) {
  const safeUser = sanitizeUser(user);

  if (isNativeClient(req)) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const session = await issueMobileSession({ userId: user.id, deviceInfo: req.body?.deviceInfo }, client);
      await client.query('COMMIT');
      return res.status(statusCode).json({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        user: safeUser,
        isNewUser,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  setTokenCookie(res, user.id);
  return res.status(statusCode).json({ user: safeUser, isNewUser });
}

const STORAGE_BASE = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/storage/v1/object/public`
  : '';

export function sanitizeUser(user) {
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
    current_streak: user.current_streak || 0,
    longest_streak: user.longest_streak || 0,
    daily_generation_count: user.daily_generation_count,
    last_generation_date: user.last_generation_date,
    stripe_customer_id: user.stripe_customer_id,
    stripe_connect_account_id: user.stripe_connect_account_id,
    connect_charges_enabled: user.connect_charges_enabled,
    connect_payouts_enabled: user.connect_payouts_enabled,
    seller_terms_accepted_at: user.seller_terms_accepted_at,
    display_name: user.display_name,
    role: user.role,
    created_at: user.created_at,
    avatar_url: resolvedAvatar,
    has_password: user.has_password,
    cancel_at_period_end: user.cancel_at_period_end || false,
    cancel_at: user.cancel_at,
    google_connected: !!user.google_user_id,
    apple_connected: !!user.apple_user_id,
    email_verified: !!user.email_verified,
    preferences: user.preferences || {},
  };
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const signupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });

router.post('/signup', signupLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, plan, trial_ends_at)
       VALUES ($1, $2, 'trial', NOW() + INTERVAL '7 days')
       RETURNING ${USER_SELECT}`,
      [normalizedEmail, passwordHash]
    );

    const user = result.rows[0];
    trackServerEvent(user.id, 'signup_completed', { method: 'email' });
    await respondWithSession(req, res, { user, isNewUser: true, statusCode: 201 });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT ${USER_SELECT}, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase().trim()]
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

    await respondWithSession(req, res, { user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', refreshLimiter, async (req, res) => {
  const { refreshToken, deviceInfo } = req.body ?? {};
  if (typeof refreshToken !== 'string' || refreshToken.length < 20) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at,
              u.deleted_at, u.suspended
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
       FOR UPDATE`,
      [hashRefreshToken(refreshToken)]
    );

    const row = result.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (row.revoked_at || new Date(row.expires_at) <= new Date()) {
      await client.query('UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE id = $1', [row.id]);
      await client.query('COMMIT');
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    if (row.deleted_at) {
      await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [row.id]);
      await client.query('COMMIT');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (row.suspended) {
      await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [row.id]);
      await client.query('COMMIT');
      return res.status(403).json({ error: 'Account suspended' });
    }

    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), last_used_at = NOW() WHERE id = $1`,
      [row.id]
    );

    const userResult = await client.query(
      `SELECT ${USER_SELECT} FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [row.user_id]
    );
    const user = userResult.rows[0];
    const session = await issueMobileSession({ userId: row.user_id, deviceInfo }, client);

    await client.query('COMMIT');
    res.json({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.post('/logout', async (req, res) => {
  try {
    if (typeof req.body?.refreshToken === 'string') {
      await revokeRefreshToken(req.body.refreshToken);
    }
    res.clearCookie('token');
    res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
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

    if (user.token_revoked_at && new Date(user.token_revoked_at) > new Date(payload.iat * 1000)) {
      res.clearCookie('token');
      return res.json({ user: null });
    }

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
