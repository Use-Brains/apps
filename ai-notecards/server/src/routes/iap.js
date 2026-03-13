import { Router } from 'express';
import { readFileSync } from 'fs';
import { authenticate } from '../middleware/auth.js';
import { USER_SELECT, sanitizeUser } from './auth.js';
import pool from '../db/pool.js';
import { ErrorCodes } from '../constants/errors.js';

const router = Router();

// IAP product → plan mapping
const SUBSCRIPTION_PRODUCTS = {
  'com.ainotecards.pro.monthly': 'pro',
  'com.ainotecards.byokpro.monthly': 'byok_pro',
};

// Consumable tier → price mapping (cents)
const CONSUMABLE_TIERS = {
  'com.ainotecards.deck.tier1': 100,
  'com.ainotecards.deck.tier2': 200,
  'com.ainotecards.deck.tier3': 300,
  'com.ainotecards.deck.tier4': 400,
  'com.ainotecards.deck.tier5': 500,
};

// Lazy-init verifier (requires Apple credentials which may not be set up yet)
let _verifiers = null;
async function getVerifiers() {
  if (_verifiers) return _verifiers;

  const { SignedDataVerifier, Environment } = await import('@apple/app-store-server-library');

  const bundleId = process.env.APPLE_BUNDLE_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const issuerId = process.env.APPLE_ISSUER_ID;
  const keyPath = process.env.APPLE_IAP_KEY;

  if (!bundleId || !keyId || !issuerId || !keyPath) {
    throw new Error('Apple IAP environment variables not configured');
  }

  const signingKey = readFileSync(keyPath, 'utf8');

  // Two verifiers: production first, sandbox fallback (TestFlight/reviewer)
  const production = new SignedDataVerifier(
    [], // Apple root CAs — library fetches automatically
    true, // enable online checks
    Environment.PRODUCTION,
    bundleId,
    null // appAppleId — optional for server-side
  );

  const sandbox = new SignedDataVerifier(
    [],
    true,
    Environment.SANDBOX,
    bundleId,
    null
  );

  _verifiers = { production, sandbox, signingKey, keyId, issuerId };
  return _verifiers;
}

/**
 * Try to verify a signed transaction, production first then sandbox.
 */
async function verifyTransaction(signedTransaction) {
  const { production, sandbox } = await getVerifiers();

  try {
    return await production.verifyAndDecodeTransaction(signedTransaction);
  } catch {
    // Fall back to sandbox (TestFlight, reviewer devices)
    return await sandbox.verifyAndDecodeTransaction(signedTransaction);
  }
}

/**
 * Verify a signed notification payload.
 */
async function verifyNotification(signedPayload) {
  const { production, sandbox } = await getVerifiers();

  try {
    return await production.verifyAndDecodeNotification(signedPayload);
  } catch {
    return await sandbox.verifyAndDecodeNotification(signedPayload);
  }
}

// POST /api/iap/verify — subscription verification from iOS
router.post('/verify', authenticate, async (req, res) => {
  const { signedTransaction } = req.body;

  if (!signedTransaction) {
    return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'signedTransaction is required' });
  }

  try {
    const transaction = await verifyTransaction(signedTransaction);

    // Verify appAccountToken matches authenticated user (prevent cross-account replay)
    if (transaction.appAccountToken && transaction.appAccountToken !== req.userId) {
      return res.status(403).json({ error: ErrorCodes.IAP_ACCOUNT_MISMATCH });
    }

    const plan = SUBSCRIPTION_PRODUCTS[transaction.productId];
    if (!plan) {
      return res.status(400).json({ error: ErrorCodes.IAP_VERIFICATION_FAILED, message: 'Unknown product ID' });
    }

    // Cancel any existing Stripe subscription to prevent dual subscription state
    const { rows: userRows } = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [req.userId]
    );
    if (userRows[0]?.stripe_customer_id) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const subscriptions = await stripe.subscriptions.list({
          customer: userRows[0].stripe_customer_id,
          status: 'active',
        });
        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id);
          console.log(`Cancelled Stripe subscription ${sub.id} — user switching to Apple IAP`);
        }
      } catch (err) {
        console.warn('Failed to cancel Stripe subscription during IAP switch:', err.message);
      }
    }

    // Update user plan and Apple subscription info
    const expiresAt = transaction.expiresDate ? new Date(transaction.expiresDate) : null;
    const { rows } = await pool.query(
      `UPDATE users SET
        plan = $1,
        apple_original_transaction_id = $2,
        apple_subscription_product_id = $3,
        apple_subscription_expires_at = $4,
        trial_ends_at = NULL
       WHERE id = $5
       RETURNING ${USER_SELECT}`,
      [plan, transaction.originalTransactionId, transaction.productId, expiresAt, req.userId]
    );

    res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) {
    console.error('IAP verify error:', err);
    res.status(400).json({ error: ErrorCodes.IAP_VERIFICATION_FAILED, message: 'Transaction verification failed' });
  }
});

// POST /api/iap/verify-purchase — marketplace consumable purchase verification
router.post('/verify-purchase', authenticate, async (req, res) => {
  const { signedTransaction, listingId, expectedPriceCents } = req.body;

  if (!signedTransaction || !listingId) {
    return res.status(400).json({
      error: ErrorCodes.VALIDATION_ERROR,
      message: 'signedTransaction and listingId are required',
    });
  }

  try {
    const transaction = await verifyTransaction(signedTransaction);

    // Verify appAccountToken matches authenticated user
    if (transaction.appAccountToken && transaction.appAccountToken !== req.userId) {
      return res.status(403).json({ error: ErrorCodes.IAP_ACCOUNT_MISMATCH });
    }

    // Verify this is a consumable product
    const tierPriceCents = CONSUMABLE_TIERS[transaction.productId];
    if (tierPriceCents === undefined) {
      return res.status(400).json({ error: ErrorCodes.IAP_VERIFICATION_FAILED, message: 'Not a valid consumable product' });
    }

    // Get listing details
    const { rows: listings } = await pool.query(
      `SELECT ml.*, u.stripe_connect_account_id
       FROM marketplace_listings ml
       JOIN users u ON u.id = ml.seller_id
       WHERE ml.id = $1`,
      [listingId]
    );

    if (listings.length === 0 || listings[0].status !== 'active') {
      return res.status(404).json({ error: ErrorCodes.LISTING_NOT_FOUND });
    }

    const listing = listings[0];

    // Self-purchase prevention
    if (listing.seller_id === req.userId) {
      return res.status(400).json({ error: ErrorCodes.IAP_SELF_PURCHASE });
    }

    // CRITICAL: Verify IAP product tier matches listing's actual price
    if (tierPriceCents !== listing.price_cents) {
      return res.status(400).json({
        error: ErrorCodes.IAP_PRICE_MISMATCH,
        message: `IAP tier ($${tierPriceCents / 100}) does not match listing price ($${listing.price_cents / 100})`,
      });
    }

    // Also check expectedPriceCents if provided (client-side price verification)
    if (expectedPriceCents && expectedPriceCents !== listing.price_cents) {
      return res.status(409).json({
        error: ErrorCodes.LISTING_PRICE_CHANGED,
        message: 'Listing price has changed since you initiated the purchase',
      });
    }

    // Check if buyer already owns this
    const { rows: existing } = await pool.query(
      'SELECT id FROM purchases WHERE buyer_id = $1 AND listing_id = $2',
      [req.userId, listingId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: ErrorCodes.IAP_ALREADY_PURCHASED });
    }

    // Read source deck + cards outside transaction
    const { rows: sourceDeck } = await pool.query(
      'SELECT title FROM decks WHERE id = $1',
      [listing.deck_id]
    );
    if (sourceDeck.length === 0) {
      return res.status(404).json({ error: ErrorCodes.LISTING_NOT_FOUND, message: 'Source deck not found' });
    }

    const { rows: sourceCards } = await pool.query(
      'SELECT front, back, position FROM cards WHERE deck_id = $1 ORDER BY position',
      [listing.deck_id]
    );

    const platformFeeCents = Math.round(listing.price_cents * 0.3);

    // Fulfillment transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Idempotent insert via apple_iap_transaction_id unique constraint
      const { rows: purchaseRows } = await client.query(
        `INSERT INTO purchases (buyer_id, seller_id, listing_id, deck_id, price_cents,
         platform_fee_cents, apple_iap_transaction_id, seller_payout_status, seller_payout_eligible_at)
         VALUES ($1, $2, $3, gen_random_uuid(), $4, $5, $6, 'pending', NOW() + INTERVAL '14 days')
         ON CONFLICT (apple_iap_transaction_id) DO NOTHING
         RETURNING id`,
        [req.userId, listing.seller_id, listingId, listing.price_cents,
         platformFeeCents, transaction.transactionId]
      );

      if (purchaseRows.length === 0) {
        // Already processed
        await client.query('ROLLBACK');
        return res.json({ ok: true, message: 'Purchase already processed' });
      }

      // Create buyer's deck copy
      const { rows: newDeck } = await client.query(
        `INSERT INTO decks (user_id, title, origin, purchased_from_listing_id)
         VALUES ($1, $2, 'purchased', $3)
         RETURNING id`,
        [req.userId, sourceDeck[0].title, listingId]
      );
      const newDeckId = newDeck[0].id;

      // Update purchase with actual deck_id
      await client.query(
        'UPDATE purchases SET deck_id = $1 WHERE id = $2',
        [newDeckId, purchaseRows[0].id]
      );

      // Batch insert cards
      if (sourceCards.length > 0) {
        const values = [];
        const params = [];
        for (let i = 0; i < sourceCards.length; i++) {
          const offset = i * 4;
          values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
          params.push(newDeckId, sourceCards[i].front, sourceCards[i].back, sourceCards[i].position);
        }
        await client.query(
          `INSERT INTO cards (deck_id, front, back, position) VALUES ${values.join(', ')}`,
          params
        );
      }

      // Increment purchase count
      await client.query(
        'UPDATE marketplace_listings SET purchase_count = purchase_count + 1 WHERE id = $1',
        [listingId]
      );

      await client.query('COMMIT');

      res.status(201).json({
        ok: true,
        deckId: newDeckId,
        message: 'Purchase fulfilled',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.status || err.code) throw err; // re-throw structured errors (already sent response)
    console.error('IAP verify-purchase error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});

export default router;
