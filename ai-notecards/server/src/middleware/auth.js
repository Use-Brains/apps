import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import { ErrorCodes } from '../constants/errors.js';

// Extract JWT from Bearer header or cookie
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return { token: authHeader.slice(7), source: 'bearer' };
  }
  if (req.cookies?.token) {
    return { token: req.cookies.token, source: 'cookie' };
  }
  return { token: null, source: null };
}

export function authenticate(req, res, next) {
  const { token, source } = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: ErrorCodes.AUTH_REQUIRED });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    req.tokenSource = source;
    req.tokenIssuedAt = payload.iat;

    // Check token revocation and soft-delete asynchronously
    pool.query(
      'SELECT token_revoked_at, deleted_at, suspended FROM users WHERE id = $1',
      [payload.userId]
    ).then(({ rows }) => {
      if (!rows[0]) {
        return res.status(401).json({ error: ErrorCodes.AUTH_INVALID_TOKEN });
      }
      const user = rows[0];
      if (user.deleted_at) {
        return res.status(401).json({ error: ErrorCodes.AUTH_ACCOUNT_DELETED });
      }
      if (user.suspended) {
        return res.status(403).json({ error: ErrorCodes.AUTH_ACCOUNT_SUSPENDED });
      }
      if (user.token_revoked_at && payload.iat < Math.floor(new Date(user.token_revoked_at).getTime() / 1000)) {
        return res.status(401).json({ error: ErrorCodes.AUTH_EXPIRED_TOKEN });
      }
      next();
    }).catch(() => {
      return res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
    });
  } catch {
    return res.status(401).json({ error: ErrorCodes.AUTH_INVALID_TOKEN });
  }
}

// Optional auth — attaches userId if valid token present, continues regardless
export function authenticateOptional(req, res, next) {
  const { token, source } = extractToken(req);
  if (!token) {
    req.userId = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    req.tokenSource = source;
    req.tokenIssuedAt = payload.iat;

    pool.query(
      'SELECT token_revoked_at, deleted_at, suspended FROM users WHERE id = $1',
      [payload.userId]
    ).then(({ rows }) => {
      if (!rows[0] || rows[0].deleted_at || rows[0].suspended) {
        req.userId = null;
      } else if (rows[0].token_revoked_at && payload.iat < Math.floor(new Date(rows[0].token_revoked_at).getTime() / 1000)) {
        req.userId = null;
      }
      next();
    }).catch(() => {
      req.userId = null;
      next();
    });
  } catch {
    req.userId = null;
    next();
  }
}
