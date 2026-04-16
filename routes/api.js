// routes/api.js
// ─────────────────────────────────────────────────────────
// Protected API routes for daily code + queue operations.
//
// QR routes: requireAuth (any admin)
// Dashboard routes: requireDashboardAuth (dashboard role only)
// ─────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { requireAuth, requireDashboardAuth } = require('../middleware/auth');
const { getTodayCode, rotateCode, getCodeHistory } = require('../services/dailyCode');
const { getTodayQueue, resetQueue, markTreated, markUntreated } = require('../services/tokenQueue');

// All routes in this router require at least basic authentication
router.use(requireAuth);

/**
 * GET /api/code/today
 * Returns today's code.
 */
router.get('/today', async (req, res) => {
  try {
    const data = await getTodayCode();
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[API] Error getting today\'s code:', error.message);
    return res.status(500).json({ error: 'Failed to get today\'s code.' });
  }
});

/**
 * POST /api/code/rotate
 * Generates a fresh code for today (admin manual trigger).
 */
router.post('/rotate', async (req, res) => {
  try {
    const data = await rotateCode();
    console.log(`[API] 🔄 Admin manually rotated code → ${data.code}`);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[API] Error rotating code:', error.message);
    return res.status(500).json({ error: 'Failed to rotate code.' });
  }
});

/**
 * GET /api/code/history
 * Returns the last 7 days of codes.
 */
router.get('/history', async (req, res) => {
  try {
    const history = await getCodeHistory();
    return res.json({ success: true, history });
  } catch (error) {
    console.error('[API] Error getting code history:', error.message);
    return res.status(500).json({ error: 'Failed to get code history.' });
  }
});

/**
 * GET /api/code/queue
 * Returns today's token queue.
 */
router.get('/queue', async (req, res) => {
  try {
    const queue = await getTodayQueue();
    return res.json({ success: true, ...queue });
  } catch (error) {
    console.error('[API] Error getting queue:', error.message);
    return res.status(500).json({ error: 'Failed to get queue.' });
  }
});

/**
 * POST /api/code/queue/reset
 * Resets today's queue (admin action).
 */
router.post('/queue/reset', requireDashboardAuth, async (req, res) => {
  try {
    const result = await resetQueue();
    console.log(`[API] 🔄 Admin reset the queue`);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[API] Error resetting queue:', error.message);
    return res.status(500).json({ error: 'Failed to reset queue.' });
  }
});

/**
 * POST /api/code/queue/treat
 * Mark a token as treated.
 * Body: { phone }
 */
router.post('/queue/treat', requireDashboardAuth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }
    const result = await markTreated(phone);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[API] Error treating token:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to treat token.' });
  }
});

/**
 * POST /api/code/queue/untreat
 * Revert a treated token back to waiting.
 * Body: { phone, reason }
 */
router.post('/queue/untreat', requireDashboardAuth, async (req, res) => {
  try {
    const { phone, reason } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for retrieval.' });
    }
    const result = await markUntreated(phone, reason.trim());
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[API] Error untreating token:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to untreat token.' });
  }
});

/**
 * GET /api/code/config
 * Returns client-safe configuration (bot number for QR deep links).
 */
router.get('/config', (req, res) => {
  return res.json({
    success: true,
    waNumber: process.env.WA_BOT_NUMBER || '',
  });
});

module.exports = router;
