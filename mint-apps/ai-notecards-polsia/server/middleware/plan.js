import pool from '../db/index.js';
import { countUserDecks } from '../db/queries.js';

export const PLAN_LIMITS = {
  free: { generationsPerDay: 1, maxDecks: 10 },
  trial: { generationsPerDay: 10, maxDecks: Infinity },
  pro: { generationsPerDay: 10, maxDecks: Infinity },
};

export async function checkTrialExpiry(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, plan, trial_ends_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

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
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function requirePlan(...allowedPlans) {
  return (req, res, next) => {
    if (!allowedPlans.includes(req.userPlan)) {
      return res.status(403).json({
        error: 'upgrade_required',
        message: `This feature requires a ${allowedPlans.join(' or ')} plan`,
        current_plan: req.userPlan,
      });
    }
    next();
  };
}

export async function checkGenerationLimits(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT plan, daily_generation_count, last_generation_date FROM users WHERE id = $1',
      [req.userId]
    );
    const user = rows[0];
    const plan = req.userPlan || user.plan;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    const today = new Date().toISOString().split('T')[0];
    const isNewDay = !user.last_generation_date ||
      user.last_generation_date.toISOString().split('T')[0] !== today;
    const currentCount = isNewDay ? 0 : user.daily_generation_count;

    if (currentCount >= limits.generationsPerDay) {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setUTCDate(midnight.getUTCDate() + 1);
      midnight.setUTCHours(0, 0, 0, 0);
      const retryAfter = Math.ceil((midnight - now) / 1000);

      return res.status(429).json({
        error: `Daily generation limit reached (${limits.generationsPerDay}/day). ${
          plan === 'free' ? 'Upgrade to Pro for more generations.' : 'Limit resets tomorrow.'
        }`,
        retry_after: retryAfter,
      });
    }

    if (limits.maxDecks !== Infinity) {
      const deckCount = await countUserDecks(req.userId);
      if (deckCount >= limits.maxDecks) {
        return res.status(429).json({
          error: `Maximum deck limit reached (${limits.maxDecks}). Delete a deck or upgrade to Pro for unlimited decks.`,
        });
      }
    }

    req.generationCount = currentCount;
    req.generationLimit = limits.generationsPerDay;
    next();
  } catch (err) {
    console.error('Generation limit check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
