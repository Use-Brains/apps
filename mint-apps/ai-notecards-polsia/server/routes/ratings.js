import { Router } from 'express';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import pool from '../db/index.js';

const router = Router();

router.post('/', requireXHR, authenticate, requireActiveUser, async (req, res) => {
  const { listingId, stars, reviewText } = req.body;

  if (!listingId || !stars) {
    return res.status(400).json({ error: 'listingId and stars are required' });
  }
  if (stars < 1 || stars > 5 || !Number.isInteger(stars)) {
    return res.status(400).json({ error: 'Stars must be an integer between 1 and 5' });
  }
  if (reviewText !== undefined && reviewText !== null && typeof reviewText !== 'string') {
    return res.status(400).json({ error: 'review_text must be a string' });
  }

  const cleanReviewText = typeof reviewText === 'string' ? reviewText.trim() || null : null;
  if (cleanReviewText && [...cleanReviewText].length > 200) {
    return res.status(400).json({ error: 'Review text must be 200 characters or less' });
  }

  try {
    const { rows: listings } = await pool.query(
      'SELECT id, deck_id FROM marketplace_listings WHERE id = $1',
      [listingId]
    );
    if (listings.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const { rows: purchases } = await pool.query(
      'SELECT deck_id FROM purchases WHERE buyer_id = $1 AND listing_id = $2',
      [req.userId, listingId]
    );
    if (purchases.length === 0) {
      return res.status(403).json({ error: 'You must purchase this deck before rating it' });
    }

    const { rows: sessions } = await pool.query(
      'SELECT id FROM study_sessions WHERE user_id = $1 AND deck_id = $2 AND completed_at IS NOT NULL LIMIT 1',
      [req.userId, purchases[0].deck_id]
    );
    if (sessions.length === 0) {
      return res.status(403).json({ error: 'Complete a study session before rating' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertResult = await client.query(
        `INSERT INTO ratings (user_id, listing_id, stars, review_text)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, listing_id) DO NOTHING
         RETURNING id`,
        [req.userId, listingId, stars, cleanReviewText]
      );

      if (insertResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'You have already rated this listing' });
      }

      await client.query(
        `UPDATE marketplace_listings SET
           average_rating = (SELECT AVG(stars) FROM ratings WHERE listing_id = $1),
           rating_count = (SELECT COUNT(*) FROM ratings WHERE listing_id = $1)
         WHERE id = $1`,
        [listingId]
      );

      await client.query('COMMIT');
      res.status(201).json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Submit rating error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/listing/:listingId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.stars, r.review_text, r.created_at, u.display_name
       FROM ratings r
       JOIN users u ON u.id = r.user_id
       WHERE r.listing_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [req.params.listingId]
    );
    res.json({ ratings: rows });
  } catch (err) {
    console.error('Get ratings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
