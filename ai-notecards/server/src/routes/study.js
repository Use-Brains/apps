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

// Complete a study session
router.patch('/:id', authenticate, async (req, res) => {
  const { correct, totalCards } = req.body;
  try {
    const result = await pool.query(
      `UPDATE study_sessions
       SET correct = $1, total_cards = $2, completed_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [correct, totalCards, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ session: result.rows[0] });
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
