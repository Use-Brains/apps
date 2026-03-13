import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import pool from '../db/pool.js';

const router = Router();

// Submit a rating (one per user per listing, must have completed the deck)
router.post('/', authenticate, async (req, res) => {
  const { listingId, stars } = req.body;

  if (!listingId || !stars) {
    return res.status(400).json({ error: 'listingId and stars are required' });
  }
  if (stars < 1 || stars > 5 || !Number.isInteger(stars)) {
    return res.status(400).json({ error: 'Stars must be an integer between 1 and 5' });
  }

  try {
    // Verify the listing exists
    const { rows: listings } = await pool.query(
      'SELECT id, deck_id FROM marketplace_listings WHERE id = $1',
      [listingId]
    );
    if (listings.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Verify user has purchased this deck
    const { rows: purchases } = await pool.query(
      'SELECT deck_id FROM purchases WHERE buyer_id = $1 AND listing_id = $2',
      [req.userId, listingId]
    );
    if (purchases.length === 0) {
      return res.status(403).json({ error: 'You must purchase this deck before rating it' });
    }

    // Verify user has completed at least one study session on the purchased deck
    const { rows: sessions } = await pool.query(
      'SELECT id FROM study_sessions WHERE user_id = $1 AND deck_id = $2 AND completed_at IS NOT NULL LIMIT 1',
      [req.userId, purchases[0].deck_id]
    );
    if (sessions.length === 0) {
      return res.status(403).json({ error: 'Complete a study session before rating' });
    }

    // Insert rating (unique constraint prevents duplicates)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO ratings (user_id, listing_id, stars)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, listing_id) DO NOTHING`,
        [req.userId, listingId, stars]
      );

      // Atomic update of average_rating and rating_count
      await client.query(
        `UPDATE marketplace_listings
         SET rating_count = rating_count + 1,
             average_rating = ((average_rating * rating_count) + $1) / (rating_count + 1)
         WHERE id = $2
         AND NOT EXISTS (
           SELECT 1 FROM ratings WHERE user_id = $3 AND listing_id = $2
           HAVING COUNT(*) > 1
         )`,
        [stars, listingId, req.userId]
      );

      await client.query('COMMIT');
      res.status(201).json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return res.status(409).json({ error: 'You have already rated this deck' });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Submit rating error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ratings for a listing
router.get('/listing/:listingId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.stars, r.created_at, u.display_name
       FROM ratings r
       JOIN users u ON u.id = r.user_id
       WHERE r.listing_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.listingId]
    );
    res.json({ ratings: rows });
  } catch (err) {
    console.error('Get ratings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
