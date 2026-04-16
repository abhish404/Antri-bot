// routes/auth.js
// ─────────────────────────────────────────────────────────
// Authentication routes: login, logout, session check.
//
// Two credential sets:
//   1. QR Panel  → ADMIN_USERNAME / ADMIN_PASSWORD       → role: 'qr'
//   2. Dashboard → DASHBOARD_USERNAME / DASHBOARD_PASSWORD → role: 'dashboard'
// ─────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Varma@admin';

const DASHBOARD_USERNAME = process.env.DASHBOARD_USERNAME || 'DashAdmin';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'Dash@admin123';

/**
 * POST /api/auth/login
 * Body: { username, password }
 *
 * Returns: { success, role } where role is 'qr' or 'dashboard'
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Check dashboard credentials first
  if (username === DASHBOARD_USERNAME && password === DASHBOARD_PASSWORD) {
    req.session.isAdmin = true;
    req.session.role = 'dashboard';
    console.log(`[Auth] ✅ Dashboard admin logged in`);
    return res.json({ success: true, role: 'dashboard', message: 'Login successful.' });
  }

  // Check QR panel credentials
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.role = 'qr';
    console.log(`[Auth] ✅ QR admin logged in`);
    return res.json({ success: true, role: 'qr', message: 'Login successful.' });
  }

  console.log(`[Auth] ❌ Failed login attempt for user: ${username}`);
  return res.status(401).json({ error: 'Invalid credentials.' });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Auth] Error destroying session:', err.message);
      return res.status(500).json({ error: 'Logout failed.' });
    }
    console.log(`[Auth] 👋 Admin logged out`);
    return res.json({ success: true, message: 'Logged out.' });
  });
});

/**
 * GET /api/auth/check
 * Returns whether the current session is authenticated and the role.
 */
router.get('/check', (req, res) => {
  const authenticated = !!(req.session && req.session.isAdmin);
  const role = req.session?.role || null;
  res.json({ authenticated, role });
});

module.exports = router;
