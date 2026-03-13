import { Router } from 'express';
import express from 'express';
import pool from '../db/pool.js';

const router = Router();

// Lazy-init verifier (same Apple credentials as iap.js)
let _verifier = null;
async function getVerifier() {
  if (_verifier) return _verifier;

  const { SignedDataVerifier, Environment } = await import('@apple/app-store-server-library');
  const bundleId = process.env.APPLE_BUNDLE_ID;

  const production = new SignedDataVerifier([], true, Environment.PRODUCTION, bundleId, null);
  const sandbox = new SignedDataVerifier([], true, Environment.SANDBOX, bundleId, null);

  _verifier = { production, sandbox };
  return _verifier;
}

async function verifyNotification(signedPayload) {
  const { production, sandbox } = await getVerifier();
  try {
    return await production.verifyAndDecodeNotification(signedPayload);
  } catch {
    return await sandbox.verifyAndDecodeNotification(signedPayload);
  }
}

async function verifyTransaction(signedTransaction) {
  const { production, sandbox } = await getVerifier();
  try {
    return await production.verifyAndDecodeTransaction(signedTransaction);
  } catch {
    return await sandbox.verifyAndDecodeTransaction(signedTransaction);
  }
}

// Product → plan mapping
const SUBSCRIPTION_PRODUCTS = {
  'com.ainotecards.pro.monthly': 'pro',
  'com.ainotecards.byokpro.monthly': 'byok_pro',
};

// Apple sends JSON (not raw body) — use express.json() middleware
router.post('/', express.json(), async (req, res) => {
  const { signedPayload } = req.body;

  if (!signedPayload) {
    return res.status(400).json({ error: 'Missing signedPayload' });
  }

  try {
    const notification = await verifyNotification(signedPayload);

    const { notificationType, subtype, data } = notification;
    const notificationUUID = notification.notificationUUID;
    const signedDate = notification.signedDate ? new Date(notification.signedDate) : new Date();

    // Idempotency check
    const { rows: existing } = await pool.query(
      'SELECT id FROM processed_apple_notifications WHERE notification_uuid = $1',
      [notificationUUID]
    );
    if (existing.length > 0) {
      return res.json({ received: true }); // Already processed
    }

    // Decode nested transaction info
    let transaction = null;
    if (data?.signedTransactionInfo) {
      transaction = await verifyTransaction(data.signedTransactionInfo);
    }

    // Find user by original transaction ID
    let userId = null;
    if (transaction?.originalTransactionId) {
      const { rows } = await pool.query(
        'SELECT id FROM users WHERE apple_original_transaction_id = $1 AND deleted_at IS NULL',
        [transaction.originalTransactionId]
      );
      if (rows.length > 0) userId = rows[0].id;
    }

    // Also try appAccountToken
    if (!userId && transaction?.appAccountToken) {
      const { rows } = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL',
        [transaction.appAccountToken]
      );
      if (rows.length > 0) userId = rows[0].id;
    }

    if (!userId && ['SUBSCRIBED', 'DID_RENEW', 'EXPIRED', 'REFUND', 'REVOKE'].includes(notificationType)) {
      console.warn(`Apple webhook: no user found for notification ${notificationType}, txn=${transaction?.originalTransactionId}`);
      // Still return 200 — Apple will retry otherwise
      await recordNotification(notificationUUID, notificationType, signedDate);
      return res.json({ received: true });
    }

    // Handle notification types
    switch (notificationType) {
      case 'SUBSCRIBED': {
        if (!userId || !transaction) break;

        const plan = SUBSCRIPTION_PRODUCTS[transaction.productId];
        if (!plan) break;

        if (subtype === 'DOWNGRADE') {
          // Downgrade takes effect at next renewal — log intent, no immediate action
          console.log(`Apple: user ${userId} downgrade to ${plan} scheduled at next renewal`);
          break;
        }

        // INITIAL_BUY, RESUBSCRIBE, UPGRADE — immediate plan change
        const expiresAt = transaction.expiresDate ? new Date(transaction.expiresDate) : null;
        await pool.query(
          `UPDATE users SET
            plan = $1,
            apple_original_transaction_id = $2,
            apple_subscription_product_id = $3,
            apple_subscription_expires_at = $4,
            trial_ends_at = NULL
           WHERE id = $5`,
          [plan, transaction.originalTransactionId, transaction.productId, expiresAt, userId]
        );

        // Cancel any existing Stripe subscription
        await cancelStripeSubscription(userId);

        console.log(`Apple: user ${userId} subscribed to ${plan} (${subtype})`);
        break;
      }

      case 'DID_RENEW': {
        if (!userId || !transaction) break;

        const expiresAt = transaction.expiresDate ? new Date(transaction.expiresDate) : null;
        await pool.query(
          `UPDATE users SET apple_subscription_expires_at = $1 WHERE id = $2`,
          [expiresAt, userId]
        );
        console.log(`Apple: user ${userId} renewed, expires ${expiresAt}`);
        break;
      }

      case 'DID_CHANGE_RENEWAL_STATUS': {
        // AUTO_RENEW_DISABLED or AUTO_RENEW_ENABLED — log only, no action
        console.log(`Apple: user ${userId} renewal status changed (${subtype})`);
        break;
      }

      case 'EXPIRED': {
        if (!userId) break;

        // Downgrade to free, clear Apple subscription fields
        await pool.query(
          `UPDATE users SET
            plan = 'free',
            apple_subscription_product_id = NULL,
            apple_subscription_expires_at = NULL
           WHERE id = $1`,
          [userId]
        );

        // Delist marketplace listings
        await pool.query(
          `UPDATE marketplace_listings SET status = 'delisted', updated_at = NOW()
           WHERE seller_id = $1 AND status = 'active'`,
          [userId]
        );

        console.log(`Apple: user ${userId} subscription expired, downgraded to free`);
        break;
      }

      case 'REFUND': {
        if (!transaction) break;

        // For subscriptions: downgrade to free
        if (SUBSCRIPTION_PRODUCTS[transaction.productId]) {
          if (userId) {
            await pool.query(
              `UPDATE users SET
                plan = 'free',
                apple_subscription_product_id = NULL,
                apple_subscription_expires_at = NULL
               WHERE id = $1`,
              [userId]
            );
            await pool.query(
              `UPDATE marketplace_listings SET status = 'delisted', updated_at = NOW()
               WHERE seller_id = $1 AND status = 'active'`,
              [userId]
            );
          }
        } else {
          // For consumable purchases: mark payout as refunded if still pending
          await pool.query(
            `UPDATE purchases SET seller_payout_status = 'refunded'
             WHERE apple_iap_transaction_id = $1 AND seller_payout_status = 'pending'`,
            [transaction.transactionId]
          );
        }
        console.log(`Apple: refund processed for txn ${transaction.transactionId}`);
        break;
      }

      case 'REVOKE': {
        if (!userId) break;

        await pool.query(
          `UPDATE users SET
            plan = 'free',
            apple_subscription_product_id = NULL,
            apple_subscription_expires_at = NULL
           WHERE id = $1`,
          [userId]
        );
        console.log(`Apple: user ${userId} access revoked`);
        break;
      }

      default:
        console.log(`Apple webhook: unhandled type ${notificationType} (${subtype})`);
        break;
    }

    // Record processed notification for idempotency
    await recordNotification(notificationUUID, notificationType, signedDate);

    res.json({ received: true });
  } catch (err) {
    console.error('Apple webhook error:', err);
    // Return 200 even on error to prevent Apple from retrying indefinitely
    // (log the error, investigate manually)
    res.json({ received: true });
  }
});

async function recordNotification(notificationUUID, notificationType, signedDate) {
  await pool.query(
    `INSERT INTO processed_apple_notifications (notification_uuid, notification_type, signed_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (notification_uuid) DO NOTHING`,
    [notificationUUID, notificationType, signedDate]
  );
}

async function cancelStripeSubscription(userId) {
  try {
    const { rows } = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    if (!rows[0]?.stripe_customer_id) return;

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const subscriptions = await stripe.subscriptions.list({
      customer: rows[0].stripe_customer_id,
      status: 'active',
    });
    for (const sub of subscriptions.data) {
      await stripe.subscriptions.cancel(sub.id);
      console.log(`Cancelled Stripe sub ${sub.id} for user ${userId} — switched to Apple IAP`);
    }
  } catch (err) {
    console.warn(`Failed to cancel Stripe subscription for user ${userId}:`, err.message);
  }
}

export default router;
