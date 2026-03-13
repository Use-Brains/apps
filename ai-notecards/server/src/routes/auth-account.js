import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { ErrorCodes } from '../constants/errors.js';

const router = Router();

// DELETE /api/auth/account — soft-delete with PII scrub
router.delete('/account', authenticate, async (req, res) => {
  const userId = req.userId;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check for active Apple subscription — warn but don't block
    const { rows: [user] } = await client.query(
      `SELECT plan, apple_subscription_expires_at, stripe_subscription_id
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (!user) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: ErrorCodes.NOT_FOUND });
    }

    const warnings = [];
    if (user.apple_subscription_expires_at && new Date(user.apple_subscription_expires_at) > new Date()) {
      warnings.push('You have an active Apple subscription. Deleting your account does not cancel it. Please cancel in Settings > Apple ID first.');
    }
    if (user.stripe_subscription_id) {
      warnings.push('You have an active Stripe subscription that will be left in place.');
    }

    // If this is a pre-check request (dry run), return warnings
    if (req.query.check === 'true') {
      await client.query('ROLLBACK');
      return res.json({ warnings, canDelete: true });
    }

    const anonymizedEmail = `deleted-${uuidv4()}@deleted`;

    // 1. Soft-delete user + anonymize PII + revoke tokens
    await client.query(
      `UPDATE users SET
        deleted_at = NOW(),
        token_revoked_at = NOW(),
        email = $2,
        display_name = NULL,
        password_hash = NULL,
        apple_user_id = NULL,
        openrouter_api_key_encrypted = NULL,
        preferred_model = NULL
      WHERE id = $1`,
      [userId, anonymizedEmail]
    );

    // 2. Scrub source_text from user's decks (may contain PII)
    await client.query(
      `UPDATE decks SET source_text = NULL WHERE user_id = $1`,
      [userId]
    );

    // 3. Delist all active marketplace listings
    await client.query(
      `UPDATE marketplace_listings SET status = 'delisted'
       WHERE seller_id = $1 AND status = 'active'`,
      [userId]
    );

    // 4. Handle seller payouts:
    //    - Past hold period but unpaid → execute payout (mark as 'eligible' for manual processing)
    //    - Still in hold period → cancel
    await client.query(
      `UPDATE purchases SET seller_payout_status = 'refunded'
       WHERE seller_id = $1
         AND seller_payout_status = 'pending'
         AND (seller_payout_eligible_at IS NULL OR seller_payout_eligible_at > NOW())`,
      [userId]
    );
    // Payouts past hold period get marked eligible for manual processing
    await client.query(
      `UPDATE purchases SET seller_payout_status = 'eligible'
       WHERE seller_id = $1
         AND seller_payout_status = 'pending'
         AND seller_payout_eligible_at IS NOT NULL
         AND seller_payout_eligible_at <= NOW()`,
      [userId]
    );

    await client.query('COMMIT');

    res.clearCookie('token');
    res.json({ ok: true, warnings });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Account deletion error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  } finally {
    client.release();
  }
});

export default router;
