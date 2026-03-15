import { Router } from 'express';
import bcrypt from 'bcrypt';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import { authenticate, requireActiveUser } from '../middleware/auth.js';
import { requireXHR } from '../middleware/csrf.js';
import { SALT_ROUNDS, setTokenCookie } from './auth.js';
import { uploadAvatar, deleteAvatar } from '../services/storage.js';
import pool from '../db/pool.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG and PNG allowed'));
  },
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// POST /avatar — upload avatar image
router.post('/avatar', authenticate, requireXHR, requireActiveUser, (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum 2MB.' });
    }
    if (err) return res.status(422).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Validate magic bytes
    const detected = await fileTypeFromBuffer(req.file.buffer);
    if (!detected || !['image/jpeg', 'image/png'].includes(detected.mime)) {
      return res.status(422).json({ error: 'Invalid image file' });
    }

    // Delete previous avatar if extension will change
    const { rows: [current] } = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.userId]);
    const ext = detected.mime === 'image/png' ? 'png' : 'jpg';
    const newPath = `avatars/${req.userId}.${ext}`;
    if (current.avatar_url && current.avatar_url !== newPath) {
      await deleteAvatar(current.avatar_url);
    }

    // Upload to Supabase Storage
    const storagePath = await uploadAvatar(req.userId, req.file.buffer, detected.mime);

    // Store path in DB
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [storagePath, req.userId]);

    // Return resolved public URL
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${storagePath}?v=${Date.now()}`;
    res.json({ avatar_url: publicUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    if (err.message?.startsWith('Storage upload failed')) {
      return res.status(502).json({ error: 'Failed to upload avatar' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /avatar — remove avatar
router.delete('/avatar', authenticate, requireXHR, requireActiveUser, async (req, res) => {
  try {
    const { rows: [current] } = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.userId]);
    if (current.avatar_url) {
      await deleteAvatar(current.avatar_url);
    }
    await pool.query('UPDATE users SET avatar_url = NULL WHERE id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Avatar delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /password — change password
router.patch('/password', authenticate, requireXHR, requireActiveUser, passwordLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (!rows[0].password_hash) {
      return res.status(400).json({ error: 'No password set. Use magic link to set a password.' });
    }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      "UPDATE users SET password_hash = $1, token_revoked_at = NOW() - INTERVAL '1 second' WHERE id = $2",
      [hash, req.userId]
    );

    // Re-issue token so current session stays valid
    setTokenCookie(res, req.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE / — delete account (soft-delete)
router.delete('/', authenticate, requireXHR, deleteLimiter, async (req, res) => {
  try {
    if (req.body.confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Type DELETE to confirm' });
    }

    // Cancel Stripe subscription (best-effort)
    const { rows: [user] } = await pool.query(
      'SELECT stripe_customer_id, plan, avatar_url FROM users WHERE id = $1',
      [req.userId]
    );
    if (user.plan === 'pro' && user.stripe_customer_id) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const subs = await stripe.subscriptions.list({ customer: user.stripe_customer_id, status: 'active' });
        await Promise.all(subs.data.map(sub => stripe.subscriptions.cancel(sub.id)));
      } catch (stripeErr) {
        console.error('Stripe cancellation failed during account deletion:', stripeErr);
      }
    }

    // Soft-delete: scrub ALL PII in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE users SET
          deleted_at = NOW(),
          email = 'deleted-' || id,
          display_name = NULL,
          avatar_url = NULL,
          google_avatar_url = NULL,
          password_hash = NULL,
          preferences = '{}',
          token_revoked_at = NOW(),
          google_user_id = NULL,
          stripe_customer_id = NULL,
          stripe_connect_account_id = NULL,
          connect_charges_enabled = false,
          connect_payouts_enabled = false,
          seller_terms_accepted_at = NULL,
          current_streak = 0,
          longest_streak = 0,
          last_study_date = NULL,
          study_score = 0,
          daily_generation_count = 0,
          last_generation_date = NULL
        WHERE id = $1
      `, [req.userId]);
      // Delete behavioral data (soft-delete doesn't trigger CASCADE)
      await client.query('DELETE FROM deck_stats WHERE user_id = $1', [req.userId]);
      await client.query('DELETE FROM study_sessions WHERE user_id = $1', [req.userId]);
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Delete avatar from storage (best-effort)
    if (user.avatar_url) {
      await deleteAvatar(user.avatar_url);
    }

    res.clearCookie('token');
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
