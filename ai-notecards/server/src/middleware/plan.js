import pool from '../db/pool.js';
import { ErrorCodes } from '../constants/errors.js';

const PLAN_LIMITS = {
  free: { generationsPerDay: 1, maxDecks: 10, maxInputChars: 30000 },
  trial: { generationsPerDay: 10, maxDecks: Infinity, maxInputChars: 30000 },
  pro: { generationsPerDay: 10, maxDecks: Infinity, maxInputChars: 30000 },
  byok_pro: { generationsPerDay: Infinity, maxDecks: Infinity, maxInputChars: 200000 },
};

// BYOK rate limit: 60 requests/hour (backend still processes + stores)
const BYOK_RATE_WINDOW_MS = 60 * 60 * 1000;
const BYOK_RATE_LIMIT = 60;
const byokRateMap = new Map(); // userId -> { count, windowStart }

/**
 * Checks trial expiry on every authenticated request.
 * If trial has expired, auto-downgrades to free.
 * Must run AFTER authenticate middleware (needs req.userId).
 */
export async function checkTrialExpiry(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, plan, trial_ends_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (rows.length === 0) return res.status(401).json({ error: ErrorCodes.AUTH_REQUIRED });

    const user = rows[0];
    if (user.plan === 'trial' && user.trial_ends_at && new Date(user.trial_ends_at) < new Date()) {
      await pool.query(
        "UPDATE users SET plan = 'free' WHERE id = $1 AND plan = 'trial'",
        [user.id]
      );
      user.plan = 'free';
    }

    req.userPlan = user.plan;
    next();
  } catch (err) {
    console.error('Trial check error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
}

/**
 * Restricts route access to specific plans.
 * Usage: requirePlan('pro') or requirePlan('pro', 'byok_pro')
 */
export function requirePlan(...allowedPlans) {
  return (req, res, next) => {
    if (!allowedPlans.includes(req.userPlan)) {
      return res.status(403).json({
        error: ErrorCodes.UPGRADE_REQUIRED,
        message: `This feature requires a ${allowedPlans.join(' or ')} plan`,
        current_plan: req.userPlan,
      });
    }
    next();
  };
}

/**
 * Checks generation rate limits and deck count limits.
 * BYOK Pro users skip daily generation limits but have hourly rate limits.
 * Attaches req.generationCount, req.generationLimit, and req.planLimits.
 */
export async function checkGenerationLimits(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT plan, daily_generation_count, last_generation_date FROM users WHERE id = $1',
      [req.userId]
    );
    const user = rows[0];
    const plan = req.userPlan || user.plan;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    // BYOK Pro: skip daily limits, enforce hourly rate limit
    if (plan === 'byok_pro') {
      const now = Date.now();
      let entry = byokRateMap.get(req.userId);
      if (!entry || now - entry.windowStart > BYOK_RATE_WINDOW_MS) {
        entry = { count: 0, windowStart: now };
        byokRateMap.set(req.userId, entry);
      }
      if (entry.count >= BYOK_RATE_LIMIT) {
        return res.status(429).json({
          error: ErrorCodes.BYOK_RATE_LIMITED,
          message: 'Rate limit: max 60 generations per hour. Try again later.',
        });
      }
      entry.count++;
      req.generationCount = 0;
      req.generationLimit = Infinity;
      req.planLimits = limits;
      return next();
    }

    const today = new Date().toISOString().split('T')[0];
    const isNewDay = !user.last_generation_date ||
      user.last_generation_date.toISOString().split('T')[0] !== today;
    const currentCount = isNewDay ? 0 : user.daily_generation_count;

    if (currentCount >= limits.generationsPerDay) {
      return res.status(429).json({
        error: ErrorCodes.GENERATION_LIMIT_REACHED,
        message: plan === 'free'
          ? `Daily generation limit reached (${limits.generationsPerDay}/day). Upgrade to Pro for more generations.`
          : `Daily generation limit reached (${limits.generationsPerDay}/day). Limit resets tomorrow.`,
      });
    }

    // Check deck limit for free users (purchased decks are exempt)
    if (limits.maxDecks !== Infinity) {
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*) FROM decks WHERE user_id = $1 AND origin = 'generated'",
        [req.userId]
      );
      if (parseInt(countRows[0].count) >= limits.maxDecks) {
        return res.status(429).json({
          error: ErrorCodes.DECK_LIMIT_REACHED,
          message: `Maximum deck limit reached (${limits.maxDecks}). Upgrade to Pro for unlimited decks.`,
        });
      }
    }

    req.generationCount = currentCount;
    req.generationLimit = limits.generationsPerDay;
    req.planLimits = limits;
    next();
  } catch (err) {
    console.error('Generation limit check error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
}
