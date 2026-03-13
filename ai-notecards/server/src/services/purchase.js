import Stripe from 'stripe';
import pool from '../db/pool.js';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * Create a Stripe Checkout Session for a marketplace purchase.
 * Returns the checkout session URL.
 */
export async function createPurchaseCheckout(userId, listingId) {
  const stripe = getStripe();

  // Get listing details
  const { rows: listings } = await pool.query(
    `SELECT ml.*, u.stripe_connect_account_id, u.connect_charges_enabled
     FROM marketplace_listings ml
     JOIN users u ON u.id = ml.seller_id
     WHERE ml.id = $1`,
    [listingId]
  );

  if (listings.length === 0) {
    throw Object.assign(new Error('Listing not found'), { status: 404 });
  }

  const listing = listings[0];

  if (listing.status !== 'active') {
    throw Object.assign(new Error('Listing is no longer available'), { status: 400 });
  }

  if (!listing.connect_charges_enabled || !listing.stripe_connect_account_id) {
    throw Object.assign(new Error('Seller cannot accept payments at this time'), { status: 400 });
  }

  if (listing.seller_id === userId) {
    throw Object.assign(new Error('Cannot purchase your own deck'), { status: 400 });
  }

  // Check if buyer already owns this
  const { rows: existing } = await pool.query(
    'SELECT id FROM purchases WHERE buyer_id = $1 AND listing_id = $2',
    [userId, listingId]
  );
  if (existing.length > 0) {
    throw Object.assign(new Error('You already own this deck'), { status: 409 });
  }

  // Get buyer's Stripe customer ID
  const { rows: userRows } = await pool.query(
    'SELECT email, stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );
  const buyer = userRows[0];

  let customerId = buyer.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: buyer.email,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, userId]);
  }

  // 30% platform fee
  const platformFeeCents = Math.round(listing.price_cents * 0.3);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: listing.title,
          description: `Flashcard deck · ${listing.price_cents / 100} USD`,
        },
        unit_amount: listing.price_cents,
      },
      quantity: 1,
    }],
    mode: 'payment',
    payment_intent_data: {
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: listing.stripe_connect_account_id,
      },
      metadata: {
        listing_id: listingId,
        buyer_id: userId,
        seller_id: listing.seller_id,
        deck_id: listing.deck_id,
      },
    },
    success_url: `${process.env.CLIENT_URL}/dashboard?purchased=true`,
    cancel_url: `${process.env.CLIENT_URL}/marketplace/${listingId}`,
    metadata: {
      listing_id: listingId,
      buyer_id: userId,
    },
  }, {
    idempotencyKey: `pi_create_${userId}_${listingId}`,
  });

  return session.url;
}

/**
 * Fulfill a purchase after successful payment.
 * Called from webhook handler. Idempotent via ON CONFLICT.
 */
export async function fulfillPurchase(paymentIntentId, metadata) {
  const { listing_id, buyer_id, seller_id, deck_id } = metadata;

  // Read source deck + cards outside transaction (avoid lock contention)
  const { rows: sourceDeck } = await pool.query(
    'SELECT title FROM decks WHERE id = $1',
    [deck_id]
  );
  if (sourceDeck.length === 0) {
    console.error(`Purchase fulfillment: source deck ${deck_id} not found`);
    return;
  }

  const { rows: sourceCards } = await pool.query(
    'SELECT front, back, position FROM cards WHERE deck_id = $1 ORDER BY position',
    [deck_id]
  );

  // Get price info from listing
  const { rows: listings } = await pool.query(
    'SELECT price_cents FROM marketplace_listings WHERE id = $1',
    [listing_id]
  );
  const priceCents = listings[0]?.price_cents || 0;
  const platformFeeCents = Math.round(priceCents * 0.3);

  // Write transaction: create purchase record + copy deck + cards
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotent insert — if already exists, skip
    const { rows: purchaseRows } = await client.query(
      `INSERT INTO purchases (buyer_id, seller_id, listing_id, deck_id, price_cents, platform_fee_cents, stripe_payment_intent_id)
       VALUES ($1, $2, $3, gen_random_uuid(), $4, $5, $6)
       ON CONFLICT (stripe_payment_intent_id) DO NOTHING
       RETURNING id, deck_id`,
      [buyer_id, seller_id, listing_id, priceCents, platformFeeCents, paymentIntentId]
    );

    if (purchaseRows.length === 0) {
      // Already processed
      await client.query('ROLLBACK');
      return;
    }

    // Create buyer's deck copy
    const { rows: newDeck } = await client.query(
      `INSERT INTO decks (user_id, title, origin, purchased_from_listing_id)
       VALUES ($1, $2, 'purchased', $3)
       RETURNING id`,
      [buyer_id, sourceDeck[0].title, listing_id]
    );
    const newDeckId = newDeck[0].id;

    // Update purchase record with actual deck_id
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

    // Atomically increment purchase count
    await client.query(
      'UPDATE marketplace_listings SET purchase_count = purchase_count + 1 WHERE id = $1',
      [listing_id]
    );

    await client.query('COMMIT');
    console.log(`Purchase fulfilled: buyer=${buyer_id}, listing=${listing_id}, deck_copy=${newDeckId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Purchase fulfillment error:', err);
    throw err;
  } finally {
    client.release();
  }
}
