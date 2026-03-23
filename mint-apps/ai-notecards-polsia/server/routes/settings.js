import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import pool from '../db/index.js';

const router = Router();

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many export requests. Please try again later.' },
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT display_name, email FROM users WHERE id = $1',
      [req.userId]
    );
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/', requireXHR, authenticate, requireActiveUser, async (req, res) => {
  const { display_name } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING display_name, email',
      [display_name?.trim() || null, req.userId]
    );
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/preferences', authenticate, requireXHR, async (req, res) => {
  try {
    const validated = validatePreferences(req.body);
    if (!validated) {
      return res.status(400).json({ error: 'Invalid preferences' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [current] } = await client.query(
        'SELECT preferences FROM users WHERE id = $1 FOR UPDATE',
        [req.userId]
      );
      const merged = deepMerge(current.preferences || {}, validated);
      await client.query(
        'UPDATE users SET preferences = $1 WHERE id = $2',
        [JSON.stringify(merged), req.userId]
      );
      await client.query('COMMIT');
      res.json({ preferences: merged });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/export', authenticate, requireXHR, requireActiveUser, exportLimiter, async (req, res) => {
  try {
    const { rows: decks } = await pool.query(
      'SELECT id, title FROM decks WHERE user_id = $1 ORDER BY created_at LIMIT 500',
      [req.userId]
    );
    const { rows: allCards } = await pool.query(
      `SELECT c.deck_id, c.front, c.back
      FROM cards c
      JOIN decks d ON d.id = c.deck_id
      WHERE d.user_id = $1
      ORDER BY c.deck_id, c.position`,
      [req.userId]
    );

    const cardsByDeck = {};
    for (const card of allCards) {
      if (!cardsByDeck[card.deck_id]) cardsByDeck[card.deck_id] = [];
      cardsByDeck[card.deck_id].push({ front: card.front, back: card.back });
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      decks: decks.map((deck) => ({ title: deck.title, cards: cardsByDeck[deck.id] || [] })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="notecards-export.json"');
    res.json(exportData);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function validatePreferences(input) {
  if (typeof input !== 'object' || input === null) return null;
  const clean = {};

  if ('auto_flip_seconds' in input) {
    if (![0, 3, 5, 10].includes(input.auto_flip_seconds)) return null;
    clean.auto_flip_seconds = input.auto_flip_seconds;
  }
  if ('daily_goal' in input) {
    const goal = input.daily_goal;
    if (!Number.isInteger(goal) || goal < 5 || goal > 100) return null;
    clean.daily_goal = goal;
  }
  if ('notifications' in input && typeof input.notifications === 'object') {
    clean.notifications = {};
    if ('study_reminders' in input.notifications) {
      clean.notifications.study_reminders = !!input.notifications.study_reminders;
    }
    if ('marketplace_activity' in input.notifications) {
      clean.notifications.marketplace_activity = !!input.notifications.marketplace_activity;
    }
  }
  if ('onboarding_completed' in input) {
    if (input.onboarding_completed === true) {
      clean.onboarding_completed = true;
    }
  }
  if ('analytics_opt_out' in input) {
    if (typeof input.analytics_opt_out !== 'boolean') return null;
    clean.analytics_opt_out = input.analytics_opt_out;
  }
  if ('timezone' in input) {
    if (typeof input.timezone !== 'string') return null;
    const timezone = input.timezone.trim();
    if (timezone.length === 0 || timezone.length > 100) return null;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    } catch {
      return null;
    }
    clean.timezone = timezone;
  }
  if ('ai_generation_consent' in input) {
    const consent = input.ai_generation_consent;
    if (typeof consent !== 'object' || consent === null || Array.isArray(consent)) return null;
    if (typeof consent.granted !== 'boolean') return null;
    if (typeof consent.version !== 'string' || consent.version.trim().length === 0 || consent.version.length > 50) return null;

    clean.ai_generation_consent = {
      granted: consent.granted,
      version: consent.version.trim(),
    };

    if ('granted_at' in consent) {
      if (typeof consent.granted_at !== 'string' || Number.isNaN(Date.parse(consent.granted_at))) return null;
      clean.ai_generation_consent.granted_at = consent.granted_at;
    }

    if ('updated_at' in consent) {
      if (typeof consent.updated_at !== 'string' || Number.isNaN(Date.parse(consent.updated_at))) return null;
      clean.ai_generation_consent.updated_at = consent.updated_at;
    }
  }
  return clean;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      typeof source[key] === 'object' && source[key] !== null &&
      typeof result[key] === 'object' && result[key] !== null &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export default router;
export { validatePreferences };
