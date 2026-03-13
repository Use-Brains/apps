import { Router } from 'express';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth.js';
import { fulfillPurchase } from '../services/purchase.js';
import pool from '../db/pool.js';

const router = Router();

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Create a Pro subscription checkout session
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const stripe = getStripe();

    const { rows } = await pool.query(
      'SELECT email, stripe_customer_id, plan, trial_ends_at FROM users WHERE id = $1',
      [req.userId]
    );
    const user = rows[0];

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: req.userId },
      });
      customerId = customer.id;
      await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.userId]);
    }

    const sessionParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.CLIENT_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.CLIENT_URL}/pricing`,
      metadata: { userId: req.userId },
    };

    // If user is on trial, honor remaining trial time
    if (user.plan === 'trial' && user.trial_ends_at) {
      const trialEnd = Math.floor(new Date(user.trial_ends_at).getTime() / 1000);
      if (trialEnd > Math.floor(Date.now() / 1000)) {
        sessionParams.subscription_data = {
          trial_end: trialEnd,
          trial_settings: {
            end_behavior: { missing_payment_method: 'cancel' },
          },
        };
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Cancel subscription (voluntary — cancel_at_period_end)
router.post('/cancel', authenticate, async (req, res) => {
  try {
    const stripe = getStripe();

    const { rows } = await pool.query(
      'SELECT stripe_subscription_id FROM users WHERE id = $1',
      [req.userId]
    );
    const subId = rows[0]?.stripe_subscription_id;
    if (!subId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    res.json({ ok: true, message: 'Subscription will cancel at end of billing period' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Platform webhook — raw body parsed in index.js
router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (userId && session.mode === 'subscription') {
          await pool.query(
            `UPDATE users SET plan = 'pro', stripe_subscription_id = $1, trial_ends_at = NULL
             WHERE id = $2`,
            [session.subscription, userId]
          );
          console.log(`User ${userId} upgraded to pro`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        // Sync subscription status
        if (subscription.status === 'active') {
          await pool.query(
            `UPDATE users SET plan = 'pro', stripe_subscription_id = $1
             WHERE stripe_customer_id = $2 AND plan != 'pro'`,
            [subscription.id, customerId]
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        // Downgrade to free, delist marketplace listings
        await pool.query(
          `UPDATE users SET plan = 'free', stripe_subscription_id = NULL
           WHERE stripe_customer_id = $1 AND plan != 'free'`,
          [customerId]
        );
        // Delist any active marketplace listings
        await pool.query(
          `UPDATE marketplace_listings SET status = 'delisted', updated_at = NOW()
           WHERE seller_id = (SELECT id FROM users WHERE stripe_customer_id = $1)
           AND status = 'active'`,
          [customerId]
        ).catch(() => {}); // Table may not exist yet during Phase 1
        console.log(`Customer ${customerId} downgraded to free`);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const meta = paymentIntent.metadata;
        // Marketplace purchase fulfillment
        if (meta?.listing_id && meta?.buyer_id) {
          try {
            await fulfillPurchase(paymentIntent.id, meta);
          } catch (err) {
            console.error('Purchase fulfillment failed:', err);
            // Still return 200 — log for manual resolution
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log(`Payment failed for customer ${invoice.customer}`);
        // v2: trigger dunning email sequence
        break;
      }

      case 'invoice.payment_succeeded': {
        // Payment recovered — no action needed for v1
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // v2: send trial ending reminder email
        const subscription = event.data.object;
        console.log(`Trial ending soon for customer ${subscription.customer}`);
        break;
      }

      default:
        // Unhandled event type
        break;
    }
  } catch (err) {
    console.error(`Webhook ${event.type} processing error:`, err);
    // Still return 200 to prevent Stripe retry loop
  }

  res.json({ received: true });
});

export default router;
