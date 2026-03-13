import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import pool from '../db/pool.js';

const router = Router();

// Start a study session
router.post('/', authenticate, async (req, res) => {
  const { deckId } = req.body;
  if (!deckId) {
    return res.status(400).json({ error: 'deckId is required' });
  }
  try {
    const deck = await pool.query('SELECT id FROM decks WHERE id = $1 AND user_id = $2', [deckId, req.userId]);
    if (deck.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const cardCount = await pool.query('SELECT COUNT(*)::int AS count FROM cards WHERE deck_id = $1', [deckId]);

    const result = await pool.query(
      'INSERT INTO study_sessions (user_id, deck_id, total_cards) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, deckId, cardCount.rows[0].count]
    );
    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error('Start session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete a study session — also increments study_score
router.patch('/:id', authenticate, async (req, res) => {
  const { correct, totalCards } = req.body;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE study_sessions
         SET correct = $1, total_cards = $2, completed_at = NOW()
         WHERE id = $3 AND user_id = $4 AND completed_at IS NULL
         RETURNING *`,
        [correct, totalCards, req.params.id, req.userId]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Session not found or already completed' });
      }

      // Increment study_score (counts completed study sessions)
      await client.query(
        'UPDATE users SET study_score = study_score + 1 WHERE id = $1',
        [req.userId]
      );

      await client.query('COMMIT');

      // Return session along with the deck info for rating prompt
      const session = result.rows[0];
      const deck = await pool.query(
        'SELECT origin, purchased_from_listing_id FROM decks WHERE id = $1',
        [session.deck_id]
      );

      res.json({
        session,
        deck_origin: deck.rows[0]?.origin,
        listing_id: deck.rows[0]?.purchased_from_listing_id,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Complete session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get study stats for a user
router.get('/stats', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*)::int AS total_sessions,
        COALESCE(SUM(total_cards), 0)::int AS total_cards_studied,
        COALESCE(SUM(correct), 0)::int AS total_correct,
        COALESCE(
          ROUND(SUM(correct)::numeric / NULLIF(SUM(total_cards), 0) * 100, 1),
          0
        )::float AS accuracy
       FROM study_sessions
       WHERE user_id = $1 AND completed_at IS NOT NULL`,
      [req.userId]
    );
    res.json({ stats: result.rows[0] });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
