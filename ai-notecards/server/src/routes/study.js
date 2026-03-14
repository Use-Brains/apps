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

// Complete a study session — also increments study_score and upserts deck_stats
router.patch('/:id', authenticate, async (req, res) => {
  const { correct, totalCards } = req.body;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Validate session exists and fetch stored total_cards BEFORE updating
      const sessionCheck = await client.query(
        'SELECT total_cards, deck_id FROM study_sessions WHERE id = $1 AND user_id = $2 AND completed_at IS NULL',
        [req.params.id, req.userId]
      );
      if (sessionCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Session not found or already completed' });
      }
      const storedTotal = sessionCheck.rows[0].total_cards;
      const deckId = sessionCheck.rows[0].deck_id;

      if (totalCards !== storedTotal) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Card count mismatch' });
      }
      if (correct < 0 || correct > totalCards) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid correct count' });
      }

      const result = await client.query(
        `UPDATE study_sessions
         SET correct = $1, total_cards = $2, completed_at = NOW()
         WHERE id = $3 AND user_id = $4 AND completed_at IS NULL
         RETURNING *`,
        [correct, totalCards, req.params.id, req.userId]
      );

      // Increment study_score (counts completed study sessions)
      await client.query(
        'UPDATE users SET study_score = study_score + 1 WHERE id = $1',
        [req.userId]
      );

      // UPSERT deck_stats — DO UPDATE pattern (accumulating, not deduplicating)
      const accuracy = totalCards > 0 ? (correct / totalCards) * 100 : 0;
      const statsResult = await client.query(
        `INSERT INTO deck_stats (user_id, deck_id, times_completed, best_accuracy)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (user_id, deck_id) DO UPDATE SET
           times_completed = deck_stats.times_completed + 1,
           best_accuracy = GREATEST(deck_stats.best_accuracy, EXCLUDED.best_accuracy),
           updated_at = NOW()
         RETURNING times_completed, best_accuracy`,
        [req.userId, deckId, accuracy]
      );

      await client.query('COMMIT');

      // Combined post-commit query: deck info + has_rated (single round-trip)
      const session = result.rows[0];
      const deckInfo = await pool.query(
        `SELECT d.origin AS deck_origin, d.purchased_from_listing_id AS listing_id,
                (r.id IS NOT NULL) AS has_rated
         FROM decks d
         LEFT JOIN ratings r ON r.user_id = $1
           AND r.listing_id = d.purchased_from_listing_id
         WHERE d.id = $2`,
        [req.userId, deckId]
      );

      res.json({
        session,
        deck_origin: deckInfo.rows[0]?.deck_origin,
        listing_id: deckInfo.rows[0]?.listing_id,
        has_rated: deckInfo.rows[0]?.has_rated || false,
        deck_stats: statsResult.rows[0],
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

// Get study history — cursor-paginated completed sessions
router.get('/history', authenticate, async (req, res) => {
  try {
    const { cursor_date, cursor_id } = req.query;
    const limit = 20;

    const { rows } = await pool.query(`
      SELECT ss.id, ss.total_cards, ss.correct, ss.completed_at, d.title AS deck_title
      FROM study_sessions ss
      JOIN decks d ON d.id = ss.deck_id
      WHERE ss.user_id = $1
        AND ss.completed_at IS NOT NULL
        AND ($2::timestamptz IS NULL OR (ss.completed_at, ss.id) < ($2::timestamptz, $3::uuid))
      ORDER BY ss.completed_at DESC, ss.id DESC
      LIMIT $4
    `, [req.userId, cursor_date || null, cursor_id || null, limit + 1]);

    const hasMore = rows.length > limit;
    const sessions = rows.slice(0, limit);
    const nextCursor = hasMore && sessions.length > 0
      ? { cursor_date: sessions[sessions.length - 1].completed_at, cursor_id: sessions[sessions.length - 1].id }
      : null;

    res.json({ sessions, nextCursor });
  } catch (err) {
    console.error('Study history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get per-deck stats
router.get('/deck-stats', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ds.deck_id, ds.times_completed, ds.best_accuracy, ds.updated_at, d.title AS deck_title
      FROM deck_stats ds
      JOIN decks d ON d.id = ds.deck_id
      WHERE ds.user_id = $1
      ORDER BY ds.updated_at DESC
      LIMIT 100
    `, [req.userId]);
    res.json({ deckStats: rows });
  } catch (err) {
    console.error('Deck stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
