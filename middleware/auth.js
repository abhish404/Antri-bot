// middleware/auth.js
// ─────────────────────────────────────────────────────────
// Session-based authentication middleware.
//
// requireAuth         → any authenticated admin (qr or dashboard)
// requireDashboardAuth → dashboard role only
// ─────────────────────────────────────────────────────────

/**
 * Middleware that checks if the user is authenticated (any role).
 * Returns 401 if not logged in.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

/**
 * Middleware that checks if the user has dashboard role.
 * Returns 403 if authenticated but wrong role, 401 if not logged in.
 */
function requireDashboardAuth(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  if (req.session.role !== 'dashboard') {
    return res.status(403).json({ error: 'Access denied. Dashboard credentials required.' });
  }
  return next();
}

module.exports = { requireAuth, requireDashboardAuth };
