// CSRF defense — any custom header forces a CORS preflight,
// which the server's CORS policy will block for unauthorized origins
export function requireXHR(req, res, next) {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
