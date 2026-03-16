import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import pool from '../db/pool.js';
import { syncOfflineStudySessions } from '../services/study-sync.js';

const router = Router();

const ALLOWED_MODES = ['flip', 'multiple_choice', 'type_answer', 'match'];
const MIN_CARDS = { flip: 1, multiple_choice: 4, type_answer: 1, match: 6 };
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.userId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

// Start a study session
router.post('/', requireXHR, authenticate, async (req, res) => {
  const { deckId } = req.body;
  const mode = req.body.mode || 'flip';

  if (!deckId) {
    return res.status(400).json({ error: 'deckId is required' });
  }
  if (!ALLOWED_MODES.includes(mode)) {
    return res.status(400).json({ error: 'Invalid study mode' });
  }

  try {
    // Combined deck ownership + card count (one round-trip)
    const { rows } = await pool.query(
      `SELECT COUNT(c.id)::int AS card_count
       FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
       WHERE d.id = $1 AND d.user_id = $2
       GROUP BY d.id`,
      [deckId, req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const cardCount = rows[0].card_count;
    const minRequired = MIN_CARDS[mode];
    if (cardCount < minRequired) {
      return res.status(400).json({ error: `This mode requires at least ${minRequired} cards` });
    }

    // Match mode: total_cards is always 6 (server-authoritative)
    const totalCards = mode === 'match' ? 6 : cardCount;

    const result = await pool.query(
      'INSERT INTO study_sessions (user_id, deck_id, total_cards, mode) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, deckId, totalCards, mode]
    );
    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error('Start session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete a study session — also increments study_score + streak and upserts deck_stats
router.patch('/:id', requireXHR, authenticate, async (req, res) => {
  const { correct, totalCards } = req.body;

  // Type validation (pre-existing gap: string "5" passes "5" < 0 due to JS coercion)
  if (!Number.isInteger(correct) || !Number.isInteger(totalCards)) {
    return res.status(400).json({ error: 'correct and totalCards must be integers' });
  }

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

      // Atomic streak + study_score update (CTE computes streak value once)
      const streakResult = await client.query(
        `WITH new_streak AS (
          SELECT CASE
            WHEN last_study_date = (NOW() AT TIME ZONE 'UTC')::date THEN current_streak
            WHEN last_study_date = (NOW() AT TIME ZONE 'UTC')::date - 1 THEN current_streak + 1
            ELSE 1
          END AS val
          FROM users WHERE id = $1
        )
        UPDATE users SET
          study_score = study_score + 1,
          current_streak = (SELECT val FROM new_streak),
          longest_streak = GREATEST(longest_streak, (SELECT val FROM new_streak)),
          last_study_date = GREATEST(last_study_date, (NOW() AT TIME ZONE 'UTC')::date)
        WHERE id = $1
        RETURNING current_streak, longest_streak, study_score`,
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
        streak: streakResult.rows[0],
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

router.post('/sync', requireXHR, authenticate, requireActiveUser, syncLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await syncOfflineStudySessions(client, req.userId, {
      sessions: req.body?.sessions,
    });
    return res.json(result);
  } catch (err) {
    console.error('Study sync error:', err);
    return res.status(err.status || 400).json({ error: err.message || 'Unable to sync study sessions' });
  } finally {
    client.release();
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

    // Streak + daily goal data
    const { rows: [userData] } = await pool.query(
      `SELECT current_streak, longest_streak, preferences->'daily_goal' AS daily_goal
       FROM users WHERE id = $1`,
      [req.userId]
    );

    // Sessions completed today (UTC)
    const { rows: [todayData] } = await pool.query(
      `SELECT COUNT(*)::int AS sessions_today
       FROM study_sessions
       WHERE user_id = $1 AND completed_at >= (NOW() AT TIME ZONE 'UTC')::date`,
      [req.userId]
    );

    res.json({
      stats: {
        ...result.rows[0],
        current_streak: userData?.current_streak || 0,
        longest_streak: userData?.longest_streak || 0,
        daily_goal: userData?.daily_goal || null,
        sessions_today: todayData?.sessions_today || 0,
      },
    });
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
      SELECT ss.id, ss.total_cards, ss.correct, ss.completed_at, ss.mode, d.title AS deck_title
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
