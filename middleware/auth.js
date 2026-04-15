// middleware/auth.js
// ─────────────────────────────────────────────────────────
// Session-based authentication middleware.
// Protects API routes that require admin access.
// ─────────────────────────────────────────────────────────

/**
 * Middleware that checks if the user is authenticated.
 * Returns 401 if not logged in.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

module.exports = { requireAuth };
