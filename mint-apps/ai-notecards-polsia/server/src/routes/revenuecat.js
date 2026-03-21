import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import pool from '../db/pool.js';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import { getFeatureAvailability } from '../config/runtime.js';
import { sanitizeUser, USER_SELECT } from './auth.js';
import { applyRevenueCatWebhookPayload, fetchRevenueCatSubscriber, syncRevenueCatStateForUser } from '../services/billing.js';

const router = Router();

const reconcileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
});

function isAuthorizedRevenueCatWebhook(req) {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected) return false;
  const header = req.get('Authorization') || req.get('X-Webhook-Auth') || '';
  return header === expected || header === `Bearer ${expected}`;
}

router.post('/webhook', async (req, res) => {
  const availability = getFeatureAvailability('nativeBilling');
  if (!availability.enabled) {
    return res.status(503).json({ error: availability.message, code: availability.code });
  }

  if (!isAuthorizedRevenueCatWebhook(req)) {
    return res.status(401).json({ error: 'Unauthorized RevenueCat webhook' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await applyRevenueCatWebhookPayload(client, req.body);
    await client.query('COMMIT');
    return res.json({ received: true, ...result });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('RevenueCat webhook error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

router.post('/reconcile', requireXHR, authenticate, requireActiveUser, reconcileLimiter, async (req, res) => {
  const availability = getFeatureAvailability('nativeBilling');
  if (!availability.enabled) {
    return res.status(503).json({ error: availability.message, code: availability.code });
  }

  const client = await pool.connect();
  try {
    const subscriber = await fetchRevenueCatSubscriber(req.userId);
    await client.query('BEGIN');
    await syncRevenueCatStateForUser(client, req.userId, subscriber);
    const { rows: [user] } = await client.query(
      `SELECT ${USER_SELECT}
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.userId]
    );
    await client.query('COMMIT');
    return res.json({ user: sanitizeUser(user), reconciled: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('RevenueCat reconcile error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router;
