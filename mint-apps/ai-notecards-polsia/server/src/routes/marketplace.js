import { Router } from 'express';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import { createPurchaseCheckout } from '../services/purchase.js';
import { getMarketplacePurchaseAvailability } from '../config/runtime.js';
import pool from '../db/pool.js';

const router = Router();

// Auto-approve listings stuck in pending_review after 60s (manual review fallback)
let lastCleanup = 0;
async function maybeAutoApprove() {
  const now = Date.now();
  if (now - lastCleanup < 30_000) return;
  lastCleanup = now;
  await pool.query(`
    UPDATE marketplace_listings
    SET status = 'active', moderation_status = 'approved',
        moderation_reason = 'auto-approved (timeout)'
    WHERE status = 'pending_review'
      AND moderation_status = 'pending'
      AND moderation_requested_at < NOW() - INTERVAL '60 seconds'
  `);
}

// Browse/search marketplace listings
router.get('/', async (req, res) => {
  // Fire-and-forget auto-approve cleanup (don't block response)
  maybeAutoApprove().catch(err => console.error('Auto-approve cleanup failed:', err));
  try {
    const { category, q, sort = 'popular', cursor, limit = '20' } = req.query;
    const pageLimit = Math.min(parseInt(limit) || 20, 50);
    const params = [];
    const conditions = ["ml.status = 'active'"];

    if (category) {
      params.push(category);
      conditions.push(`mc.slug = $${params.length}`);
    }

    if (q && q.trim()) {
      params.push(q.trim());
      conditions.push(`ml.search_vector @@ plainto_tsquery('english', $${params.length})`);
    }

    // Cursor-based pagination
    if (cursor) {
      const [cursorValue, cursorId] = cursor.split('_');
      if (sort === 'newest') {
        params.push(cursorValue, cursorId);
        conditions.push(`(ml.created_at, ml.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
      } else if (sort === 'price_low') {
        params.push(cursorValue, cursorId);
        conditions.push(`(ml.price_cents, ml.id) > ($${params.length - 1}::int, $${params.length}::uuid)`);
      } else if (sort === 'price_high') {
        params.push(cursorValue, cursorId);
        conditions.push(`(ml.price_cents, ml.id) < ($${params.length - 1}::int, $${params.length}::uuid)`);
      } else if (sort === 'rating') {
        params.push(cursorValue, cursorId);
        conditions.push(`(ml.average_rating, ml.id) < ($${params.length - 1}::numeric, $${params.length}::uuid)`);
      } else {
        // popular (default)
        params.push(cursorValue, cursorId);
        conditions.push(`(ml.purchase_count, ml.id) < ($${params.length - 1}::int, $${params.length}::uuid)`);
      }
    }

    const orderMap = {
      popular: 'ml.purchase_count DESC, ml.id DESC',
      newest: 'ml.created_at DESC, ml.id DESC',
      rating: 'ml.average_rating DESC, ml.id DESC',
      price_low: 'ml.price_cents ASC, ml.id ASC',
      price_high: 'ml.price_cents DESC, ml.id DESC',
    };
    const orderBy = orderMap[sort] || orderMap.popular;

    params.push(pageLimit + 1);
    const query = `
      SELECT ml.id, ml.title, ml.description, ml.price_cents, ml.purchase_count,
             ml.average_rating, ml.rating_count, ml.created_at,
             mc.name AS category_name, mc.slug AS category_slug,
             u.display_name AS seller_name, u.study_score AS seller_study_score,
             (SELECT COUNT(*)::int FROM cards WHERE deck_id = ml.deck_id) AS card_count,
             ARRAY(SELECT tag FROM listing_tags WHERE listing_id = ml.id) AS tags
      FROM marketplace_listings ml
      JOIN marketplace_categories mc ON mc.id = ml.category_id
      JOIN users u ON u.id = ml.seller_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${params.length}
    `;

    const { rows } = await pool.query(query, params);
    const hasMore = rows.length > pageLimit;
    const listings = hasMore ? rows.slice(0, pageLimit) : rows;

    let nextCursor = null;
    if (hasMore && listings.length > 0) {
      const last = listings[listings.length - 1];
      if (sort === 'newest') nextCursor = `${last.created_at}_${last.id}`;
      else if (sort === 'price_low' || sort === 'price_high') nextCursor = `${last.price_cents}_${last.id}`;
      else if (sort === 'rating') nextCursor = `${last.average_rating}_${last.id}`;
      else nextCursor = `${last.purchase_count}_${last.id}`;
    }

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      listings,
      nextCursor,
      hasMore,
      purchaseAvailability: getMarketplacePurchaseAvailability(),
    });
  } catch (err) {
    console.error('Marketplace browse error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all categories with listing counts
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT mc.id, mc.name, mc.slug, mc.sort_order,
             COUNT(ml.id)::int AS listing_count
      FROM marketplace_categories mc
      LEFT JOIN marketplace_listings ml ON ml.category_id = mc.id AND ml.status = 'active'
      GROUP BY mc.id
      ORDER BY mc.sort_order
    `);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ categories: rows });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get listing detail with sample cards
router.get('/:id', async (req, res) => {
  try {
    const { rows: listings } = await pool.query(`
      SELECT ml.*, mc.name AS category_name, mc.slug AS category_slug,
             u.display_name AS seller_name, u.study_score AS seller_study_score, u.id AS seller_user_id,
             ARRAY(SELECT tag FROM listing_tags WHERE listing_id = ml.id) AS tags
      FROM marketplace_listings ml
      JOIN marketplace_categories mc ON mc.id = ml.category_id
      JOIN users u ON u.id = ml.seller_id
      WHERE ml.id = $1 AND ml.status = 'active'
    `, [req.params.id]);

    if (listings.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listings[0];

    // Get total card count
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM cards WHERE deck_id = $1',
      [listing.deck_id]
    );
    const totalCards = countRows[0].total;

    // Get preview cards (first 10% rounded up)
    const previewCount = Math.max(1, Math.ceil(totalCards * 0.1));
    const { rows: sampleCards } = await pool.query(
      'SELECT front, back, position FROM cards WHERE deck_id = $1 ORDER BY position LIMIT $2',
      [listing.deck_id, previewCount]
    );

    res.json({
      listing,
      totalCards,
      sampleCards,
      previewCount,
      purchaseAvailability: getMarketplacePurchaseAvailability(),
    });
  } catch (err) {
    console.error('Listing detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Flag a listing or review
router.post('/:id/flag', requireXHR, authenticate, requireActiveUser, async (req, res) => {
  const { reason, flagType = 'listing', ratingId = null } = req.body;
  const VALID_REASONS = ['Inappropriate', 'Misleading', 'Spam', 'Low Quality', 'Other'];

  if (!reason || !VALID_REASONS.includes(reason)) {
    return res.status(400).json({ error: `Reason must be one of: ${VALID_REASONS.join(', ')}` });
  }
  if (!['listing', 'review'].includes(flagType)) {
    return res.status(400).json({ error: "flag_type must be 'listing' or 'review'" });
  }
  if (flagType === 'review' && !ratingId) {
    return res.status(400).json({ error: 'rating_id is required when flagging a review' });
  }
  if (flagType === 'listing' && ratingId) {
    return res.status(400).json({ error: 'rating_id must not be set when flagging a listing' });
  }

  try {
    // When flagging a review, verify the rating belongs to this listing
    if (flagType === 'review') {
      const { rows } = await pool.query(
        'SELECT id FROM ratings WHERE id = $1 AND listing_id = $2',
        [ratingId, req.params.id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Rating not found for this listing' });
      }
    }

    await pool.query(
      `INSERT INTO content_flags (listing_id, reporter_id, reason, flag_type, rating_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (listing_id, reporter_id, flag_type) DO NOTHING`,
      [req.params.id, req.userId, reason, flagType, flagType === 'review' ? ratingId : null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Flag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Purchase — create Stripe Checkout session
router.post('/:id/purchase', requireXHR, authenticate, requireActiveUser, async (req, res) => {
  try {
    const purchaseAvailability = getMarketplacePurchaseAvailability();
    if (req.get('X-Client-Platform') === 'ios-native' && purchaseAvailability.ios_native.enabled === false) {
      return res.status(409).json({
        error: purchaseAvailability.ios_native.message,
        code: purchaseAvailability.ios_native.code,
      });
    }
    const url = await createPurchaseCheckout(req.userId, req.params.id);
    res.json({ url });
  } catch (err) {
    console.error('Purchase checkout error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
