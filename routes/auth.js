// routes/auth.js
// ─────────────────────────────────────────────────────────
// Authentication routes: login, logout, session check.
// ─────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Varma@admin';

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    console.log(`[Auth] ✅ Admin logged in`);
    return res.json({ success: true, message: 'Login successful.' });
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
 * Returns whether the current session is authenticated.
 */
router.get('/check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
