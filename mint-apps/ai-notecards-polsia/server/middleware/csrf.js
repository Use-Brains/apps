export function requireXHR(req, res, next) {
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
