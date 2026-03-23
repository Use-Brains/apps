import { Router } from 'express';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import { checkTrialExpiry, requirePlan } from '../middleware/plan.js';
import { getStripe } from '../services/stripe.js';
import { buildClientUrl, getFeatureAvailability } from '../config/runtime.js';
import pool from '../db/index.js';
import { trackServerEvent } from '../services/analytics.js';

const DEFAULT_SELLER_SHELL = Object.freeze({
  status: 'unavailable',
  message: 'Seller tools coming soon',
  shell: true,
});

const MAX_ACTIVE_LISTINGS = 50;
const MIN_CARD_COUNT = 10;

export function createSellerRouter({
  authenticateMiddleware = authenticate,
  requireActiveUserMiddleware = requireActiveUser,
  requireXHRMiddleware = requireXHR,
  checkTrialExpiryMiddleware = checkTrialExpiry,
  requirePlanMiddleware = requirePlan,
  getFeatureAvailabilityFn = getFeatureAvailability,
  poolInstance = pool,
  getStripeFn = getStripe,
  buildClientUrlFn = buildClientUrl,
  trackServerEventFn = trackServerEvent,
  shellPayload = DEFAULT_SELLER_SHELL,
} = {}) {
  const router = Router();

  router.use((req, res, next) => {
    const availability = getFeatureAvailabilityFn('sellerTools');
    if (!availability.enabled) {
      return res.json({
        ...shellPayload,
        code: availability.code,
        detail: availability.message,
      });
    }
    next();
  });

  router.post('/listings', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, checkTrialExpiryMiddleware, requirePlanMiddleware('pro'), async (req, res) => {
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
      const { rows: deckRows } = await poolInstance.query(
        "SELECT id, title, user_id, origin FROM decks WHERE id = $1 AND user_id = $2 AND origin = 'generated'",
        [deck_id, req.userId]
      );
      if (deckRows.length === 0) {
        return res.status(404).json({ error: 'Deck not found or not eligible for listing (must be a generated deck you own)' });
      }

      const { rows: cardCountRows } = await poolInstance.query(
        'SELECT COUNT(*)::int AS count FROM cards WHERE deck_id = $1',
        [deck_id]
      );
      if (cardCountRows[0].count < MIN_CARD_COUNT) {
        return res.status(400).json({ error: `Deck must have at least ${MIN_CARD_COUNT} cards` });
      }

      const { rows: existingListing } = await poolInstance.query(
        'SELECT id FROM marketplace_listings WHERE deck_id = $1',
        [deck_id]
      );
      if (existingListing.length > 0) {
        return res.status(409).json({ error: 'This deck is already listed' });
      }

      const { rows: activeCount } = await poolInstance.query(
        "SELECT COUNT(*)::int AS count FROM marketplace_listings WHERE seller_id = $1 AND status IN ('active', 'pending_review')",
        [req.userId]
      );
      if (activeCount[0].count >= MAX_ACTIVE_LISTINGS) {
        return res.status(429).json({ error: `Maximum ${MAX_ACTIVE_LISTINGS} active listings allowed` });
      }

      const { rows: userRows } = await poolInstance.query(
        'SELECT connect_charges_enabled, seller_terms_accepted_at FROM users WHERE id = $1',
        [req.userId]
      );
      if (!userRows[0].seller_terms_accepted_at) {
        return res.status(403).json({ error: 'terms_required', message: 'You must accept seller terms first.' });
      }
      if (!userRows[0].connect_charges_enabled) {
        return res.status(403).json({ error: 'Complete Stripe Connect onboarding before listing decks' });
      }

      const { rows: dupeRows } = await poolInstance.query(
        "SELECT id FROM marketplace_listings WHERE seller_id = $1 AND category_id = $2 AND title = $3 AND status IN ('active', 'pending_review')",
        [req.userId, category_id, deckRows[0].title]
      );
      if (dupeRows.length > 0) {
        return res.status(409).json({ error: 'You already have a listing with this title in this category' });
      }

      const client = await poolInstance.connect();
      try {
        await client.query('BEGIN');

        const { rows: listingRows } = await client.query(
          `INSERT INTO marketplace_listings (deck_id, seller_id, category_id, title, description, price_cents, status, moderation_status, moderation_requested_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending_review', 'pending', NOW())
           RETURNING *`,
          [deck_id, req.userId, category_id, deckRows[0].title, description, price_cents]
        );
        const listing = listingRows[0];

        for (const tag of tags) {
          if (tag.trim()) {
            await client.query(
              'INSERT INTO listing_tags (listing_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [listing.id, tag.trim().toLowerCase()]
            );
          }
        }

        await client.query('COMMIT');
        trackServerEventFn(req.userId, 'listing_created', { listing_id: listing.id, price_cents });
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

  router.patch('/listings/:id', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, checkTrialExpiryMiddleware, requirePlanMiddleware('pro'), async (req, res) => {
    const { description, price_cents, tags } = req.body;

    try {
      const { rows } = await poolInstance.query(
        'SELECT * FROM marketplace_listings WHERE id = $1 AND seller_id = $2',
        [req.params.id, req.userId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      if (description !== undefined && description.length > 500) {
        return res.status(400).json({ error: 'Description must be 500 characters or less' });
      }
      if (price_cents !== undefined && (price_cents < 100 || price_cents > 500)) {
        return res.status(400).json({ error: 'Price must be between $1 and $5' });
      }
      if (tags !== undefined && tags.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 tags allowed' });
      }

      const descriptionChanged = description !== undefined && description !== rows[0].description;
      const client = await poolInstance.connect();
      try {
        await client.query('BEGIN');

        const updates = [];
        const params = [];

        if (description !== undefined) {
          params.push(description);
          updates.push(`description = $${params.length}`);
        }
        if (price_cents !== undefined) {
          params.push(price_cents);
          updates.push(`price_cents = $${params.length}`);
        }
        if (descriptionChanged) {
          updates.push(`moderation_status = 'pending'`);
          updates.push(`moderation_requested_at = NOW()`);
          updates.push(`status = 'pending_review'`);
        }

        if (updates.length > 0) {
          updates.push('updated_at = NOW()');
          params.push(req.params.id);
          await client.query(
            `UPDATE marketplace_listings SET ${updates.join(', ')} WHERE id = $${params.length}`,
            params
          );
        }

        if (tags !== undefined) {
          await client.query('DELETE FROM listing_tags WHERE listing_id = $1', [req.params.id]);
          for (const tag of tags) {
            if (tag.trim()) {
              await client.query(
                'INSERT INTO listing_tags (listing_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [req.params.id, tag.trim().toLowerCase()]
              );
            }
          }
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      const { rows: updated } = await poolInstance.query(
        'SELECT * FROM marketplace_listings WHERE id = $1',
        [req.params.id]
      );
      res.json({ listing: updated[0] });
    } catch (err) {
      console.error('Update listing error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/listings/:id', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, async (req, res) => {
    try {
      const { rows } = await poolInstance.query(
        `UPDATE marketplace_listings SET status = 'delisted', delisted_at = NOW(), updated_at = NOW()
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

  router.post('/listings/:id/relist', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, checkTrialExpiryMiddleware, requirePlanMiddleware('pro'), async (req, res) => {
    try {
      const { rows: userRows } = await poolInstance.query(
        'SELECT connect_charges_enabled, seller_terms_accepted_at FROM users WHERE id = $1',
        [req.userId]
      );
      if (!userRows[0].seller_terms_accepted_at) {
        return res.status(403).json({ error: 'terms_required', message: 'You must accept seller terms first.' });
      }
      if (!userRows[0].connect_charges_enabled) {
        return res.status(403).json({ error: 'Stripe Connect required' });
      }

      const { rows: listingRows } = await poolInstance.query(
        'SELECT id, moderation_status FROM marketplace_listings WHERE id = $1 AND seller_id = $2 AND status = $3',
        [req.params.id, req.userId, 'delisted']
      );
      if (listingRows.length === 0) {
        return res.status(404).json({ error: 'Listing not found or not delisted' });
      }

      if (listingRows[0].moderation_status === 'rejected') {
        await poolInstance.query(
          `UPDATE marketplace_listings
           SET status = 'pending_review', moderation_status = 'pending',
               moderation_requested_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND seller_id = $2`,
          [req.params.id, req.userId]
        );
      } else {
        await poolInstance.query(
          `UPDATE marketplace_listings SET status = 'active', updated_at = NOW()
           WHERE id = $1 AND seller_id = $2`,
          [req.params.id, req.userId]
        );
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Relist error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/listings', authenticateMiddleware, async (req, res) => {
    try {
      const { rows } = await poolInstance.query(
        `SELECT ml.*, mc.name AS category_name,
               (SELECT COUNT(*)::int FROM cards WHERE deck_id = ml.deck_id) AS card_count,
               ARRAY(SELECT tag FROM listing_tags WHERE listing_id = ml.id) AS tags
        FROM marketplace_listings ml
        JOIN marketplace_categories mc ON mc.id = ml.category_id
        WHERE ml.seller_id = $1
        ORDER BY ml.created_at DESC`,
        [req.userId]
      );
      res.json({ listings: rows });
    } catch (err) {
      console.error('Seller listings error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/dashboard', authenticateMiddleware, async (req, res) => {
    try {
      const { rows: stats } = await poolInstance.query(
        `SELECT
          COALESCE(SUM(price_cents - platform_fee_cents), 0)::int AS total_earnings_cents,
          COALESCE(SUM(price_cents), 0)::int AS total_gross_cents,
          COUNT(*)::int AS total_sales,
          COALESCE(SUM(CASE WHEN created_at > NOW() - INTERVAL '30 days'
            THEN price_cents - platform_fee_cents ELSE 0 END), 0)::int AS last_30_earnings_cents
        FROM purchases WHERE seller_id = $1`,
        [req.userId]
      );

      const { rows: listingStats } = await poolInstance.query(
        `SELECT
          COUNT(*)::int FILTER (WHERE status = 'active') AS active_listings,
          COUNT(*)::int AS total_listings,
          COALESCE(AVG(average_rating) FILTER (WHERE rating_count > 0), 0)::float AS avg_rating
        FROM marketplace_listings WHERE seller_id = $1`,
        [req.userId]
      );

      res.json({
        earnings: stats[0],
        listings: listingStats[0],
      });
    } catch (err) {
      console.error('Seller dashboard error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/accept-terms', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, checkTrialExpiryMiddleware, requirePlanMiddleware('pro'), async (req, res) => {
    try {
      const { rows } = await poolInstance.query(
        'SELECT seller_terms_accepted_at, seller_terms_version FROM users WHERE id = $1',
        [req.userId]
      );
      const user = rows[0];

      if (user.seller_terms_accepted_at) {
        return res.json({
          seller_terms_accepted_at: user.seller_terms_accepted_at,
          seller_terms_version: user.seller_terms_version,
        });
      }

      const { rows: updated } = await poolInstance.query(
        'UPDATE users SET seller_terms_accepted_at = NOW(), seller_terms_version = 1 WHERE id = $1 RETURNING seller_terms_accepted_at, seller_terms_version',
        [req.userId]
      );
      trackServerEventFn(req.userId, 'seller_terms_accepted');
      res.json(updated[0]);
    } catch (err) {
      console.error('Accept terms error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/onboard', requireXHRMiddleware, authenticateMiddleware, requireActiveUserMiddleware, checkTrialExpiryMiddleware, requirePlanMiddleware('pro'), async (req, res) => {
    try {
      const { rows: termsRows } = await poolInstance.query(
        'SELECT seller_terms_accepted_at FROM users WHERE id = $1',
        [req.userId]
      );
      if (!termsRows[0].seller_terms_accepted_at) {
        return res.status(403).json({ error: 'terms_required', message: 'You must accept seller terms before connecting Stripe.' });
      }

      const stripe = getStripeFn();
      const { rows } = await poolInstance.query(
        'SELECT email, stripe_connect_account_id FROM users WHERE id = $1',
        [req.userId]
      );
      const user = rows[0];

      let accountId = user.stripe_connect_account_id;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          email: user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: { user_id: req.userId },
        });
        accountId = account.id;
        await poolInstance.query(
          'UPDATE users SET stripe_connect_account_id = $1 WHERE id = $2',
          [accountId, req.userId]
        );
      }

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: buildClientUrlFn('/seller', { query: { connect: 'refresh' } }),
        return_url: buildClientUrlFn('/seller', { query: { connect: 'return' } }),
        type: 'account_onboarding',
        collection_options: { fields: 'eventually_due' },
      });

      trackServerEventFn(req.userId, 'seller_onboarding_started');
      res.json({ url: accountLink.url });
    } catch (err) {
      console.error('Connect onboarding error:', err);
      res.status(500).json({ error: 'Failed to start onboarding' });
    }
  });

  router.get('/onboard/refresh', authenticateMiddleware, async (req, res) => {
    try {
      const stripe = getStripeFn();
      const { rows } = await poolInstance.query(
        'SELECT stripe_connect_account_id FROM users WHERE id = $1',
        [req.userId]
      );
      const accountId = rows[0]?.stripe_connect_account_id;
      if (!accountId) {
        return res.status(400).json({ error: 'No Connect account found. Start onboarding first.' });
      }

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: buildClientUrlFn('/seller', { query: { connect: 'refresh' } }),
        return_url: buildClientUrlFn('/seller', { query: { connect: 'return' } }),
        type: 'account_onboarding',
        collection_options: { fields: 'eventually_due' },
      });

      res.json({ url: accountLink.url });
    } catch (err) {
      console.error('Connect refresh error:', err);
      res.status(500).json({ error: 'Failed to regenerate onboarding link' });
    }
  });

  router.get('/onboard/return', authenticateMiddleware, async (req, res) => {
    try {
      const stripe = getStripeFn();
      const { rows } = await poolInstance.query(
        'SELECT stripe_connect_account_id FROM users WHERE id = $1',
        [req.userId]
      );
      const accountId = rows[0]?.stripe_connect_account_id;
      if (!accountId) {
        return res.json({ onboarded: false });
      }

      const account = await stripe.accounts.retrieve(accountId);

      await poolInstance.query(
        `UPDATE users SET connect_charges_enabled = $1, connect_payouts_enabled = $2 WHERE id = $3`,
        [account.charges_enabled, account.payouts_enabled, req.userId]
      );

      const onboarded = account.charges_enabled && account.details_submitted;
      if (onboarded) {
        trackServerEventFn(req.userId, 'seller_onboarding_completed');
      }
      res.json({
        onboarded,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements?.currently_due || [],
      });
    } catch (err) {
      console.error('Connect return check error:', err);
      res.status(500).json({ error: 'Failed to verify onboarding status' });
    }
  });

  return router;
}

export default createSellerRouter();
