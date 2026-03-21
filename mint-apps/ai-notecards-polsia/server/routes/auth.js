import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from '../db/index.js';
import { PLAN_LIMITS } from '../middleware/plan.js';
import { trackServerEvent } from '../services/analytics.js';
import { getFeatureAvailability } from '../config/runtime.js';
import { resolveAvatarUrl } from '../services/storage.js';

const router = Router();
export const SALT_ROUNDS = 12;
const COOKIE_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_EXPIRY = '15m';
const NATIVE_CLIENT_PLATFORM = 'ios-native';
const MOBILE_SESSION_LIMIT = 5;

export const USER_SELECT = `id, email, plan, trial_ends_at, daily_generation_count, last_generation_date,
  study_score, current_streak, longest_streak, stripe_customer_id, stripe_connect_account_id, connect_charges_enabled,
  connect_payouts_enabled, seller_terms_accepted_at, apple_user_id, subscription_platform,
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

async function pruneRefreshTokens(userId) {
  await pool.query(
    `DELETE FROM refresh_tokens
     WHERE id IN (
       SELECT id
       FROM refresh_tokens
       WHERE user_id = $1
       ORDER BY created_at DESC
       OFFSET $2
     )`,
    [userId, MOBILE_SESSION_LIMIT]
  );
}

async function createRefreshToken(userId, deviceInfo = {}) {
  const rawToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, expiresAt.toISOString(), JSON.stringify(deviceInfo || {})]
  );

  await pruneRefreshTokens(userId);

  return {
    refreshToken: rawToken,
    expiresAt,
  };
}

export async function sanitizeUser(user) {
  const resolvedAvatar = resolveAvatarUrl({
    avatarPath: user.avatar_url,
    googleAvatarUrl: user.google_avatar_url,
    cacheBuster: user.updated_at || user.created_at || user.token_revoked_at,
  });

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
    subscription_platform: user.subscription_platform,
    has_billing_account: !!user.stripe_customer_id,
    has_seller_payout_account: !!user.stripe_connect_account_id,
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
    feature_availability: {
      seller_tools: getFeatureAvailability('sellerTools'),
    },
  };
}

export async function respondWithSession(req, res, user) {
  const sanitized = await sanitizeUser(user);

  if (isNativeClient(req)) {
    const accessToken = createAccessToken(user.id);
    const { refreshToken, expiresAt } = await createRefreshToken(user.id, {
      platform: req.get('X-Client-Platform') || null,
      userAgent: req.get('User-Agent') || null,
      ip: req.ip || null,
    });

    return res.json({
      user: sanitized,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: ACCESS_TOKEN_EXPIRY,
      refresh_expires_at: expiresAt.toISOString(),
    });
  }

  setTokenCookie(res, user.id);
  return res.json({ user: sanitized });
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
    trackServerEvent(user.id, 'signed_up');
    return respondWithSession(req, res, user);
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const { rows } = await pool.query(
      `SELECT ${USER_SELECT}, password_hash
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [normalizedEmail]
    );
    const user = rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.suspended) {
      return res.status(403).json({ error: user.suspended_reason || 'Account suspended' });
    }

    trackServerEvent(user.id, 'logged_in');
    return respondWithSession(req, res, user);
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', async (req, res) => {
  res.clearCookie('token');
  return res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.json({ user: null });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      `SELECT ${USER_SELECT}, updated_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [decoded.userId]
    );
    const user = rows[0];
    if (!user) return res.json({ user: null });

    if (user.token_revoked_at) {
      const issuedAtMs = decoded.iat ? decoded.iat * 1000 : 0;
      const revokedAtMs = new Date(user.token_revoked_at).getTime();
      if (issuedAtMs <= revokedAtMs) {
        res.clearCookie('token');
        return res.json({ user: null });
      }
    }

    if (user.suspended) {
      res.clearCookie('token');
      return res.status(403).json({ error: user.suspended_reason || 'Account suspended' });
    }

    return res.json({ user: await sanitizeUser(user) });
  } catch {
    return res.json({ user: null });
  }
});

router.post('/refresh', refreshLimiter, async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== 'string' || !refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const { rows } = await pool.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at,
              ${USER_SELECT}
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
         AND u.deleted_at IS NULL`,
      [tokenHash]
    );
    const record = rows[0];
    if (!record || record.revoked_at || new Date(record.expires_at) <= new Date()) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    if (record.suspended) {
      return res.status(403).json({ error: record.suspended_reason || 'Account suspended' });
    }

    await pool.query(
      'UPDATE refresh_tokens SET last_used_at = NOW() WHERE id = $1',
      [record.id]
    );

    return res.json({
      access_token: createAccessToken(record.user_id),
      user: await sanitizeUser(record),
    });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
