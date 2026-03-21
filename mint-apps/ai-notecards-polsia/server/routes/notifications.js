import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../db/index.js';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import { deactivateDeviceToken, upsertDeviceToken } from '../services/notifications.js';

const router = Router();

const deviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/devices', requireXHR, authenticate, requireActiveUser, deviceLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const device = await upsertDeviceToken(client, req.userId, req.body ?? {});
    res.status(201).json({ device });
  } catch (err) {
    console.error('Register device token error:', err);
    res.status(400).json({ error: err.message || 'Unable to register device token' });
  } finally {
    client.release();
  }
});

router.delete('/devices/:token', requireXHR, authenticate, requireActiveUser, deviceLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    await deactivateDeviceToken(client, req.userId, decodeURIComponent(req.params.token));
    res.json({ ok: true });
  } catch (err) {
    console.error('Deactivate device token error:', err);
    res.status(400).json({ error: err.message || 'Unable to deactivate device token' });
  } finally {
    client.release();
  }
});

export default router;
