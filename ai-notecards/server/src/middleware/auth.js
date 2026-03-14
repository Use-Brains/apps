import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

export function authenticate(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    req.tokenIat = payload.iat;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// DB check for sensitive operations — verifies user isn't deleted and token isn't revoked
export async function requireActiveUser(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT deleted_at, token_revoked_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (!rows[0] || rows[0].deleted_at) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (rows[0].token_revoked_at && new Date(rows[0].token_revoked_at) > new Date(req.tokenIat * 1000)) {
      return res.status(401).json({ error: 'Session expired' });
    }
    next();
  } catch (err) {
    console.error('requireActiveUser error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
