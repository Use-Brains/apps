import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import pool from '../db/pool.js';

const router = Router();

// Get user profile
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT display_name, email FROM users WHERE id = $1',
      [req.userId]
    );
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.patch('/', authenticate, async (req, res) => {
  const { display_name } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING display_name, email',
      [display_name?.trim() || null, req.userId]
    );
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
