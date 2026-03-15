import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import striptags from 'striptags';
import { authenticate } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import { checkTrialExpiry, PLAN_LIMITS } from '../middleware/plan.js';
import pool from '../db/pool.js';

const router = Router();

const saveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.userId,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many save requests. Please try again later.' },
});

// List all decks for the user
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.user_id, d.title, d.source_text, d.origin, d.purchased_from_listing_id,
              d.created_at, d.updated_at, COUNT(c.id)::int AS card_count,
              ml.id AS listing_id, ml.status AS listing_status,
              (rt.id IS NOT NULL) AS has_rated,
              ls.last_studied_at
       FROM decks d
       LEFT JOIN cards c ON c.deck_id = d.id
       LEFT JOIN marketplace_listings ml ON ml.deck_id = d.id
       LEFT JOIN ratings rt ON rt.user_id = d.user_id
         AND rt.listing_id = d.purchased_from_listing_id
       LEFT JOIN (
         SELECT deck_id, MAX(completed_at) AS last_studied_at
         FROM study_sessions
         WHERE user_id = $1 AND completed_at IS NOT NULL
         GROUP BY deck_id
       ) ls ON ls.deck_id = d.id
       WHERE d.user_id = $1
       GROUP BY d.id, ml.id, ml.status, rt.id, ls.last_studied_at
       ORDER BY d.created_at DESC`,
      [req.userId]
    );
    res.json({ decks: result.rows });
  } catch (err) {
    console.error('List decks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single deck with its cards
router.get('/:id', authenticate, async (req, res) => {
  try {
    const deckResult = await pool.query(
      'SELECT * FROM decks WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (deckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const cardsResult = await pool.query(
      'SELECT id, front, back, position, created_at FROM cards WHERE deck_id = $1 ORDER BY position',
      [req.params.id]
    );

    res.json({ deck: deckResult.rows[0], cards: cardsResult.rows });
  } catch (err) {
    console.error('Get deck error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save deck from preview
router.post('/save', requireXHR, authenticate, checkTrialExpiry, saveLimiter, async (req, res) => {
  const { title, source_text, cards } = req.body;

  // Validation
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (title.length > 200) {
    return res.status(400).json({ error: 'Title is too long. Maximum 200 characters.' });
  }
  if (!Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: 'At least 1 card is required' });
  }
  if (cards.length > 30) {
    return res.status(400).json({ error: 'Maximum 30 cards per deck' });
  }
  if (source_text && source_text.length > 50000) {
    return res.status(400).json({ error: 'Source text is too long. Maximum 50,000 characters.' });
  }
  for (const card of cards) {
    if (!card.front?.trim() || !card.back?.trim()) {
      return res.status(400).json({ error: 'Each card must have front and back text' });
    }
    if (card.front.length > 2000) {
      return res.status(400).json({ error: 'Card front text is too long. Maximum 2,000 characters.' });
    }
    if (card.back.length > 5000) {
      return res.status(400).json({ error: 'Card back text is too long. Maximum 5,000 characters.' });
    }
  }

  try {
    // Inline deck count limit check
    const limits = PLAN_LIMITS[req.userPlan] || PLAN_LIMITS.free;
    if (limits.maxDecks !== Infinity) {
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*)::int AS count FROM decks WHERE user_id = $1 AND origin = 'generated'",
        [req.userId]
      );
      if (countRows[0].count >= limits.maxDecks) {
        return res.status(429).json({
          error: `Maximum deck limit reached (${limits.maxDecks}). Upgrade to Pro for unlimited decks.`,
          limit: true,
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const deckResult = await client.query(
        "INSERT INTO decks (user_id, title, source_text, origin) VALUES ($1, $2, $3, 'generated') RETURNING *",
        [req.userId, title.trim(), source_text || null]
      );
      const deck = deckResult.rows[0];

      // Multi-row INSERT with RETURNING
      const values = [];
      const placeholders = [];
      cards.forEach((card, i) => {
        const offset = i * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(deck.id, striptags(card.front.trim()), striptags(card.back.trim()), i);
      });

      const cardsResult = await client.query(
        `INSERT INTO cards (deck_id, front, back, position) VALUES ${placeholders.join(', ')} RETURNING *`,
        values
      );

      await client.query('COMMIT');

      res.status(201).json({
        deck: { ...deck, cards: cardsResult.rows },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Save deck error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rename a deck
router.patch('/:id', requireXHR, authenticate, async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (title.length > 200) {
    return res.status(400).json({ error: 'Title is too long. Maximum 200 characters.' });
  }
  try {
    const result = await pool.query(
      'UPDATE decks SET title = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [title, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    res.json({ deck: result.rows[0] });
  } catch (err) {
    console.error('Update deck error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a deck
router.delete('/:id', requireXHR, authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM decks WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete deck error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a card to a deck
router.post('/:id/cards', requireXHR, authenticate, async (req, res) => {
  const { front, back } = req.body;
  if (!front || !back) {
    return res.status(400).json({ error: 'Front and back are required' });
  }
  if (front.length > 2000) {
    return res.status(400).json({ error: 'Card front text is too long. Maximum 2,000 characters.' });
  }
  if (back.length > 5000) {
    return res.status(400).json({ error: 'Card back text is too long. Maximum 5,000 characters.' });
  }
  try {
    // Verify ownership
    const deck = await pool.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (deck.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const maxPos = await pool.query('SELECT COALESCE(MAX(position), -1) AS max_pos FROM cards WHERE deck_id = $1', [req.params.id]);
    const result = await pool.query(
      'INSERT INTO cards (deck_id, front, back, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, striptags(front), striptags(back), maxPos.rows[0].max_pos + 1]
    );
    res.status(201).json({ card: result.rows[0] });
  } catch (err) {
    console.error('Add card error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a card
router.patch('/:deckId/cards/:cardId', requireXHR, authenticate, async (req, res) => {
  const { front, back } = req.body;
  if (front !== undefined && front.length > 2000) {
    return res.status(400).json({ error: 'Card front text is too long. Maximum 2,000 characters.' });
  }
  if (back !== undefined && back.length > 5000) {
    return res.status(400).json({ error: 'Card back text is too long. Maximum 5,000 characters.' });
  }
  try {
    const deck = await pool.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [req.params.deckId, req.userId]);
    if (deck.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const result = await pool.query(
      'UPDATE cards SET front = COALESCE($1, front), back = COALESCE($2, back) WHERE id = $3 AND deck_id = $4 RETURNING *',
      [front ? striptags(front) : front, back ? striptags(back) : back, req.params.cardId, req.params.deckId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.json({ card: result.rows[0] });
  } catch (err) {
    console.error('Update card error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a card
router.delete('/:deckId/cards/:cardId', requireXHR, authenticate, async (req, res) => {
  try {
    const deck = await pool.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [req.params.deckId, req.userId]);
    if (deck.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const result = await pool.query(
      'DELETE FROM cards WHERE id = $1 AND deck_id = $2 RETURNING id',
      [req.params.cardId, req.params.deckId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete card error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
