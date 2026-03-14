import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import pool from '../db/pool.js';

const router = Router();

// List all decks for the user
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.user_id, d.title, d.source_text, d.origin, d.purchased_from_listing_id,
              d.created_at, d.updated_at, COUNT(c.id)::int AS card_count,
              ml.id AS listing_id, ml.status AS listing_status,
              (rt.id IS NOT NULL) AS has_rated
       FROM decks d
       LEFT JOIN cards c ON c.deck_id = d.id
       LEFT JOIN marketplace_listings ml ON ml.deck_id = d.id
       LEFT JOIN ratings rt ON rt.user_id = d.user_id
         AND rt.listing_id = d.purchased_from_listing_id
       WHERE d.user_id = $1
       GROUP BY d.id, ml.id, ml.status, rt.id
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

// Rename a deck
router.patch('/:id', authenticate, async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
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
router.delete('/:id', authenticate, async (req, res) => {
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
router.post('/:id/cards', authenticate, async (req, res) => {
  const { front, back } = req.body;
  if (!front || !back) {
    return res.status(400).json({ error: 'Front and back are required' });
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
      [req.params.id, front, back, maxPos.rows[0].max_pos + 1]
    );
    res.status(201).json({ card: result.rows[0] });
  } catch (err) {
    console.error('Add card error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a card
router.patch('/:deckId/cards/:cardId', authenticate, async (req, res) => {
  const { front, back } = req.body;
  try {
    const deck = await pool.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [req.params.deckId, req.userId]);
    if (deck.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const result = await pool.query(
      'UPDATE cards SET front = COALESCE($1, front), back = COALESCE($2, back) WHERE id = $3 AND deck_id = $4 RETURNING *',
      [front, back, req.params.cardId, req.params.deckId]
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
router.delete('/:deckId/cards/:cardId', authenticate, async (req, res) => {
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
