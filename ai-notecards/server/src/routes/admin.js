import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import pool from '../db/pool.js';

const router = Router();

// Admin auth middleware
function requireAdmin(req, res, next) {
  // req.userId is set by authenticate middleware — check role
  pool.query('SELECT role FROM users WHERE id = $1', [req.userId])
    .then(({ rows }) => {
      if (rows[0]?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    })
    .catch(() => res.status(500).json({ error: 'Internal server error' }));
}

// Get reported content
router.get('/flags', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT cf.*, ml.title AS listing_title, ml.seller_id,
             u_reporter.email AS reporter_email, u_reporter.display_name AS reporter_name,
             u_seller.email AS seller_email, u_seller.display_name AS seller_name
      FROM content_flags cf
      JOIN marketplace_listings ml ON ml.id = cf.listing_id
      JOIN users u_reporter ON u_reporter.id = cf.reporter_id
      JOIN users u_seller ON u_seller.id = ml.seller_id
      ORDER BY cf.created_at DESC
    `);
    res.json({ flags: rows });
  } catch (err) {
    console.error('Get flags error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve a flag
router.patch('/flags/:id', authenticate, requireAdmin, async (req, res) => {
  const { status, admin_notes, suspend_seller } = req.body;

  if (!status || !['upheld', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: "Status must be 'upheld' or 'dismissed'" });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `UPDATE content_flags SET status = $1, admin_notes = $2, resolved_at = NOW()
         WHERE id = $3 RETURNING listing_id`,
        [status, admin_notes || null, req.params.id]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Flag not found' });
      }

      // If upheld, delist the listing
      if (status === 'upheld') {
        await client.query(
          "UPDATE marketplace_listings SET status = 'removed', updated_at = NOW() WHERE id = $1",
          [rows[0].listing_id]
        );

        // Optionally suspend the seller
        if (suspend_seller) {
          await client.query(
            `UPDATE users SET suspended = true, suspended_reason = $1
             WHERE id = (SELECT seller_id FROM marketplace_listings WHERE id = $2)`,
            [admin_notes || 'Content policy violation', rows[0].listing_id]
          );
          // Delist all seller's active listings
          await client.query(
            `UPDATE marketplace_listings SET status = 'delisted', updated_at = NOW()
             WHERE seller_id = (SELECT seller_id FROM marketplace_listings WHERE id = $1)
             AND status = 'active'`,
            [rows[0].listing_id]
          );
        }
      }

      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Resolve flag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Suspend/unsuspend a user
router.patch('/users/:id/suspend', authenticate, requireAdmin, async (req, res) => {
  const { suspended, reason } = req.body;
  try {
    await pool.query(
      'UPDATE users SET suspended = $1, suspended_reason = $2 WHERE id = $3',
      [!!suspended, reason || null, req.params.id]
    );
    if (suspended) {
      // Delist all seller's active listings
      await pool.query(
        "UPDATE marketplace_listings SET status = 'delisted', updated_at = NOW() WHERE seller_id = $1 AND status = 'active'",
        [req.params.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Suspend user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
