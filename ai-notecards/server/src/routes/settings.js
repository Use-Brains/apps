import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import pool from '../db/pool.js';

const router = Router();

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many export requests. Please try again later.' },
});

// Get user profile
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

// Update user profile
router.patch('/', authenticate, async (req, res) => {
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

// PATCH /preferences — update user preferences
router.patch('/preferences', authenticate, requireXHR, async (req, res) => {
  try {
    const validated = validatePreferences(req.body);
    if (!validated) {
      return res.status(400).json({ error: 'Invalid preferences' });
    }

    // Read current preferences, deep-merge, write back
    const { rows: [current] } = await pool.query(
      'SELECT preferences FROM users WHERE id = $1',
      [req.userId]
    );
    const merged = deepMerge(current.preferences || {}, validated);

    await pool.query(
      'UPDATE users SET preferences = $1 WHERE id = $2',
      [JSON.stringify(merged), req.userId]
    );

    res.json({ preferences: merged });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /export — export all user decks as JSON download
router.get('/export', authenticate, requireXHR, requireActiveUser, exportLimiter, async (req, res) => {
  try {
    const { rows: decks } = await pool.query(
      'SELECT id, title FROM decks WHERE user_id = $1 ORDER BY created_at LIMIT 500',
      [req.userId]
    );
    const { rows: allCards } = await pool.query(`
      SELECT c.deck_id, c.front, c.back
      FROM cards c
      JOIN decks d ON d.id = c.deck_id
      WHERE d.user_id = $1
      ORDER BY c.deck_id, c.position
    `, [req.userId]);

    // Group cards by deck_id
    const cardsByDeck = {};
    for (const card of allCards) {
      if (!cardsByDeck[card.deck_id]) cardsByDeck[card.deck_id] = [];
      cardsByDeck[card.deck_id].push({ front: card.front, back: card.back });
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      decks: decks.map(d => ({ title: d.title, cards: cardsByDeck[d.id] || [] })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="notecards-export.json"');
    res.json(exportData);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -- Helpers --

function validatePreferences(input) {
  if (typeof input !== 'object' || input === null) return null;
  const clean = {};

  if ('card_order' in input) {
    if (!['shuffle', 'sequential'].includes(input.card_order)) return null;
    clean.card_order = input.card_order;
  }
  if ('auto_flip_seconds' in input) {
    if (![0, 3, 5, 10].includes(input.auto_flip_seconds)) return null;
    clean.auto_flip_seconds = input.auto_flip_seconds;
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
