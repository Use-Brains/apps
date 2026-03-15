import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import { fulfillPurchase } from '../services/purchase.js';
import { sendTransactionalEmail } from '../services/email.js';
import { getStripe } from '../services/stripe.js';
import pool from '../db/pool.js';
import { trackServerEvent } from '../services/analytics.js';
import { calculateSellerEarningsCents, getStripePriceIdForPeriod, reconcileUserBillingState } from '../services/billing.js';

const router = Router();

const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.userId,
  standardHeaders: true,
});

// Create a Pro subscription checkout session
router.post('/checkout', requireXHR, authenticate, requireActiveUser, async (req, res) => {
  try {
    const stripe = getStripe();
    const billingPeriod = req.body?.billingPeriod === 'annual' ? 'annual' : 'monthly';

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
      line_items: [{ price: getStripePriceIdForPeriod(billingPeriod), quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.CLIENT_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.CLIENT_URL}/pricing`,
      metadata: { userId: req.userId, billingPeriod },
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
router.post('/cancel', requireXHR, authenticate, requireActiveUser, async (req, res) => {
  try {
    const stripe = getStripe();

    const { rows } = await pool.query(
      'SELECT stripe_subscription_id, subscription_platform FROM users WHERE id = $1',
      [req.userId]
    );
    const subId = rows[0]?.stripe_subscription_id;
    if (rows[0]?.subscription_platform === 'apple') {
      return res.status(409).json({ error: 'Manage this subscription through Apple' });
    }
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

// Billing portal — redirect Pro user to Stripe portal
router.post('/portal', requireXHR, authenticate, requireActiveUser, portalLimiter, async (req, res) => {
  try {
    const stripe = getStripe();
    const { rows } = await pool.query(
      'SELECT stripe_customer_id, subscription_platform FROM users WHERE id = $1',
      [req.userId]
    );
    if (rows[0]?.subscription_platform === 'apple') {
      return res.status(409).json({ error: 'Manage this subscription through Apple' });
    }
    if (!rows[0]?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: rows[0].stripe_customer_id,
      return_url: `${process.env.CLIENT_URL}/settings?portal_return=true`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Billing portal error:', err);
    res.status(500).json({ error: 'Failed to create billing portal session' });
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
          const client = await pool.connect();
          let updatedUser;
          try {
            await client.query('BEGIN');
            const result = await client.query(
              `UPDATE users
               SET stripe_subscription_id = $1,
                   stripe_cancel_at_period_end = false,
                   stripe_cancel_at = NULL
               WHERE id = $2
               RETURNING email`,
              [session.subscription, userId]
            );
            updatedUser = result.rows[0];
            await reconcileUserBillingState(client, userId);
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
          console.log(`User ${userId} upgraded to pro`);
          trackServerEvent(userId, 'subscription_started');
          res.json({ received: true });
          if (updatedUser?.email) {
            sendTransactionalEmail('subscription_confirmed', updatedUser.email, {}).catch(() => {});
          }
          return;
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        if (subscription.cancel_at_period_end) {
          const cancelAt = new Date(subscription.cancel_at * 1000);
          const client = await pool.connect();
          let cancelledUser;
          try {
            await client.query('BEGIN');
            const result = await client.query(
              `UPDATE users
               SET stripe_cancel_at_period_end = true,
                   stripe_cancel_at = $1
               WHERE stripe_customer_id = $2
               RETURNING id, email`,
              [cancelAt.toISOString(), customerId]
            );
            cancelledUser = result.rows[0];
            if (cancelledUser?.id) {
              await reconcileUserBillingState(client, cancelledUser.id);
            }
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
          if (cancelledUser?.id) {
            trackServerEvent(cancelledUser.id, 'subscription_cancelled');
          }
          res.json({ received: true });
          if (cancelledUser?.email) {
            sendTransactionalEmail('subscription_cancelling', cancelledUser.email, {
              cancelAt: cancelAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            }).catch(() => {});
          }
          return;
        } else if (subscription.status === 'active') {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const { rows: [user] } = await client.query(
              `UPDATE users
               SET stripe_subscription_id = $1,
                   stripe_cancel_at_period_end = false,
                   stripe_cancel_at = NULL
               WHERE stripe_customer_id = $2
               RETURNING id`,
              [subscription.id, customerId]
            );
            if (user?.id) {
              await reconcileUserBillingState(client, user.id);
            }
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        // Atomic: downgrade user + delist listings in transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const { rows } = await client.query(
            `UPDATE users
             SET stripe_subscription_id = NULL,
                 stripe_cancel_at_period_end = false,
                 stripe_cancel_at = NULL
             WHERE stripe_customer_id = $1
             RETURNING id`,
            [customerId]
          );
          if (rows[0]) {
            await reconcileUserBillingState(client, rows[0].id);
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
        console.log(`Customer ${customerId} downgraded to free`);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const meta = paymentIntent.metadata;
        // Marketplace purchase fulfillment
        if (meta?.listing_id && meta?.buyer_id) {
          let result;
          try {
            result = await fulfillPurchase(paymentIntent.id, meta);
          } catch (err) {
            console.error('Purchase fulfillment failed:', err);
            // Still return 200 — log for manual resolution
          }
          res.json({ received: true });
          // Send emails and track only for new purchases (not replays)
          if (result?.isNew) {
            trackServerEvent(meta.buyer_id, 'purchase_completed', { listing_id: meta.listing_id });
            const { rows: [emailData] } = await pool.query(`
              SELECT buyer.email AS buyer_email, seller.email AS seller_email,
                     ml.title, ml.price_cents
              FROM purchases p
              JOIN users buyer ON buyer.id = p.buyer_id
              JOIN users seller ON seller.id = p.seller_id
              JOIN marketplace_listings ml ON ml.id = p.listing_id
              WHERE p.id = $1
            `, [result.purchaseId]);

            if (emailData) {
              const earnings = calculateSellerEarningsCents(emailData.price_cents);
              Promise.allSettled([
                sendTransactionalEmail('sale_notification', emailData.seller_email, {
                  title: emailData.title,
                  earnings,
                }),
                sendTransactionalEmail('purchase_confirmation', emailData.buyer_email, {
                  title: emailData.title,
                  price: emailData.price_cents,
                }),
              ]).then(results => {
                results.filter(r => r.status === 'rejected').forEach(r =>
                  console.error('Email send failed:', r.reason)
                );
              });
            }
          }
          return;
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log(`Payment failed for customer ${invoice.customer}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        // Payment recovered — no action needed for v1
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object;
        console.log(`Trial ending soon for customer ${subscription.customer}`);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Webhook ${event.type} processing error:`, err);
    // Still return 200 to prevent Stripe retry loop
  }

  res.json({ received: true });
});

export default router;
