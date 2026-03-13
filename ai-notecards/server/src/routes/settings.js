import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { checkTrialExpiry, requirePlan } from '../middleware/plan.js';
import { encrypt, decrypt } from '../services/encryption.js';
import pool from '../db/pool.js';
import { ErrorCodes } from '../constants/errors.js';

const router = Router();

// Get user profile
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT display_name, email, preferred_model,
              openrouter_api_key_encrypted IS NOT NULL AS has_api_key
       FROM users WHERE id = $1`,
      [req.userId]
    );
    const profile = rows[0];

    // Show masked key if stored (last 4 chars)
    let maskedKey = null;
    if (profile.has_api_key) {
      try {
        const decrypted = decrypt(
          (await pool.query('SELECT openrouter_api_key_encrypted FROM users WHERE id = $1', [req.userId])).rows[0].openrouter_api_key_encrypted,
          req.userId
        );
        maskedKey = `sk-or-...${decrypted.slice(-4)}`;
      } catch {
        maskedKey = '****';
      }
    }

    res.json({
      profile: {
        display_name: profile.display_name,
        email: profile.email,
        preferred_model: profile.preferred_model,
        has_api_key: profile.has_api_key,
        masked_key: maskedKey,
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});

// Update user profile (display_name + preferred_model)
router.patch('/', authenticate, async (req, res) => {
  const { display_name, preferred_model } = req.body;
  try {
    const updates = [];
    const params = [];

    if (display_name !== undefined) {
      params.push(display_name?.trim() || null);
      updates.push(`display_name = $${params.length}`);
    }

    if (preferred_model !== undefined) {
      params.push(preferred_model || null);
      updates.push(`preferred_model = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: ErrorCodes.VALIDATION_ERROR, message: 'No fields to update' });
    }

    params.push(req.userId);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING display_name, email, preferred_model`,
      params
    );
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});

// PUT /api/settings/api-key — save or remove BYOK API key
// Send { key: "sk-or-..." } to save, { key: null } to remove
router.put('/api-key', authenticate, checkTrialExpiry, requirePlan('byok_pro'), async (req, res) => {
  const { key } = req.body;

  try {
    if (key === null || key === undefined || key === '') {
      // Remove key
      await pool.query(
        'UPDATE users SET openrouter_api_key_encrypted = NULL WHERE id = $1',
        [req.userId]
      );
      return res.json({ ok: true, has_api_key: false, masked_key: null });
    }

    // Basic format validation
    if (typeof key !== 'string' || key.length < 10) {
      return res.status(400).json({
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Invalid API key format',
      });
    }

    // Encrypt and store
    const encrypted = encrypt(key, req.userId);
    await pool.query(
      'UPDATE users SET openrouter_api_key_encrypted = $1 WHERE id = $2',
      [encrypted, req.userId]
    );

    const maskedKey = `sk-or-...${key.slice(-4)}`;
    res.json({ ok: true, has_api_key: true, masked_key: maskedKey });
  } catch (err) {
    console.error('Save API key error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});

export default router;
