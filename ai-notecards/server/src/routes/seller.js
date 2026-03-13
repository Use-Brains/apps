import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { checkTrialExpiry, requirePlan } from '../middleware/plan.js';
import pool from '../db/pool.js';

const router = Router();

const MAX_ACTIVE_LISTINGS = 50;
const MIN_CARD_COUNT = 10;

// Create a new listing
router.post('/listings', authenticate, checkTrialExpiry, requirePlan('pro'), async (req, res) => {
  const { deck_id, category_id, description, price_cents, tags = [] } = req.body;

  if (!deck_id || !category_id || !description || !price_cents) {
    return res.status(400).json({ error: 'deck_id, category_id, description, and price_cents are required' });
  }

  if (price_cents < 100 || price_cents > 500) {
    return res.status(400).json({ error: 'Price must be between $1 and $5' });
  }

  if (tags.length > 5) {
    return res.status(400).json({ error: 'Maximum 5 tags allowed' });
  }

  if (description.length > 500) {
    return res.status(400).json({ error: 'Description must be 500 characters or less' });
  }

  try {
    // Verify deck ownership and eligibility
    const { rows: deckRows } = await pool.query(
      "SELECT id, title, user_id, origin FROM decks WHERE id = $1 AND user_id = $2 AND origin = 'generated'",
      [deck_id, req.userId]
    );
    if (deckRows.length === 0) {
      return res.status(404).json({ error: 'Deck not found or not eligible for listing (must be a generated deck you own)' });
    }

    // Check minimum card count
    const { rows: cardCountRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM cards WHERE deck_id = $1',
      [deck_id]
    );
    if (cardCountRows[0].count < MIN_CARD_COUNT) {
      return res.status(400).json({ error: `Deck must have at least ${MIN_CARD_COUNT} cards` });
    }

    // Check not already listed
    const { rows: existingListing } = await pool.query(
      'SELECT id FROM marketplace_listings WHERE deck_id = $1',
      [deck_id]
    );
    if (existingListing.length > 0) {
      return res.status(409).json({ error: 'This deck is already listed' });
    }

    // Check active listing count
    const { rows: activeCount } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM marketplace_listings WHERE seller_id = $1 AND status = 'active'",
      [req.userId]
    );
    if (activeCount[0].count >= MAX_ACTIVE_LISTINGS) {
      return res.status(429).json({ error: `Maximum ${MAX_ACTIVE_LISTINGS} active listings allowed` });
    }

    // Check seller has Stripe Connect charges enabled
    const { rows: userRows } = await pool.query(
      'SELECT connect_charges_enabled FROM users WHERE id = $1',
      [req.userId]
    );
    if (!userRows[0].connect_charges_enabled) {
      return res.status(403).json({ error: 'Complete Stripe Connect onboarding before listing decks' });
    }

    // Check duplicate title in same category by same seller
    const { rows: dupeRows } = await pool.query(
      "SELECT id FROM marketplace_listings WHERE seller_id = $1 AND category_id = $2 AND title = $3 AND status = 'active'",
      [req.userId, category_id, deckRows[0].title]
    );
    if (dupeRows.length > 0) {
      return res.status(409).json({ error: 'You already have a listing with this title in this category' });
    }

    // Create listing
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: listingRows } = await client.query(
        `INSERT INTO marketplace_listings (deck_id, seller_id, category_id, title, description, price_cents)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [deck_id, req.userId, category_id, deckRows[0].title, description, price_cents]
      );
      const listing = listingRows[0];

      // Insert tags
      for (const tag of tags) {
        if (tag.trim()) {
          await client.query(
            'INSERT INTO listing_tags (listing_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [listing.id, tag.trim().toLowerCase()]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ listing });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a listing
router.patch('/listings/:id', authenticate, checkTrialExpiry, requirePlan('pro'), async (req, res) => {
  const { description, price_cents, tags } = req.body;

  try {
    const { rows } = await pool.query(
      'SELECT * FROM marketplace_listings WHERE id = $1 AND seller_id = $2',
      [req.params.id, req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const updates = [];
    const params = [];

    if (description !== undefined) {
      if (description.length > 500) {
        return res.status(400).json({ error: 'Description must be 500 characters or less' });
      }
      params.push(description);
      updates.push(`description = $${params.length}`);
    }

    if (price_cents !== undefined) {
      if (price_cents < 100 || price_cents > 500) {
        return res.status(400).json({ error: 'Price must be between $1 and $5' });
      }
      params.push(price_cents);
      updates.push(`price_cents = $${params.length}`);
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      params.push(req.params.id);
      await pool.query(
        `UPDATE marketplace_listings SET ${updates.join(', ')} WHERE id = $${params.length}`,
        params
      );
    }

    if (tags !== undefined) {
      if (tags.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 tags allowed' });
      }
      await pool.query('DELETE FROM listing_tags WHERE listing_id = $1', [req.params.id]);
      for (const tag of tags) {
        if (tag.trim()) {
          await pool.query(
            'INSERT INTO listing_tags (listing_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.params.id, tag.trim().toLowerCase()]
          );
        }
      }
    }

    const { rows: updated } = await pool.query(
      'SELECT * FROM marketplace_listings WHERE id = $1',
      [req.params.id]
    );
    res.json({ listing: updated[0] });
  } catch (err) {
    console.error('Update listing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delist a listing (soft delete)
router.delete('/listings/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE marketplace_listings SET status = 'delisted', updated_at = NOW()
       WHERE id = $1 AND seller_id = $2 AND status = 'active'
       RETURNING id`,
      [req.params.id, req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found or already delisted' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Delist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Relist a delisted listing
router.post('/listings/:id/relist', authenticate, checkTrialExpiry, requirePlan('pro'), async (req, res) => {
  try {
    const { rows: userRows } = await pool.query(
      'SELECT connect_charges_enabled FROM users WHERE id = $1',
      [req.userId]
    );
    if (!userRows[0].connect_charges_enabled) {
      return res.status(403).json({ error: 'Stripe Connect required' });
    }

    const { rows } = await pool.query(
      `UPDATE marketplace_listings SET status = 'active', updated_at = NOW()
       WHERE id = $1 AND seller_id = $2 AND status = 'delisted'
       RETURNING id`,
      [req.params.id, req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found or not delisted' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Relist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get seller's own listings
router.get('/listings', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ml.*, mc.name AS category_name,
             (SELECT COUNT(*)::int FROM cards WHERE deck_id = ml.deck_id) AS card_count,
             ARRAY(SELECT tag FROM listing_tags WHERE listing_id = ml.id) AS tags
      FROM marketplace_listings ml
      JOIN marketplace_categories mc ON mc.id = ml.category_id
      WHERE ml.seller_id = $1
      ORDER BY ml.created_at DESC
    `, [req.userId]);
    res.json({ listings: rows });
  } catch (err) {
    console.error('Seller listings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Seller dashboard stats
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const { rows: stats } = await pool.query(`
      SELECT
        COALESCE(SUM(price_cents - platform_fee_cents), 0)::int AS total_earnings_cents,
        COALESCE(SUM(price_cents), 0)::int AS total_gross_cents,
        COUNT(*)::int AS total_sales,
        COALESCE(SUM(CASE WHEN created_at > NOW() - INTERVAL '30 days'
          THEN price_cents - platform_fee_cents ELSE 0 END), 0)::int AS last_30_earnings_cents
      FROM purchases WHERE seller_id = $1
    `, [req.userId]);

    const { rows: listingStats } = await pool.query(`
      SELECT
        COUNT(*)::int FILTER (WHERE status = 'active') AS active_listings,
        COUNT(*)::int AS total_listings,
        COALESCE(AVG(average_rating) FILTER (WHERE rating_count > 0), 0)::float AS avg_rating
      FROM marketplace_listings WHERE seller_id = $1
    `, [req.userId]);

    res.json({
      earnings: stats[0],
      listings: listingStats[0],
    });
  } catch (err) {
    console.error('Seller dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stripe Connect onboarding — placeholder, fully implemented in Phase 3
router.post('/onboard', authenticate, async (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

router.get('/onboard/refresh', authenticate, async (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

router.get('/onboard/return', authenticate, async (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

export default router;
