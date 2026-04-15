// routes/api.js
// ─────────────────────────────────────────────────────────
// Protected API routes for daily code + queue operations.
// ─────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getTodayCode, rotateCode, getCodeHistory } = require('../services/dailyCode');
const { getTodayQueue, resetQueue } = require('../services/tokenQueue');

// All routes in this router require authentication
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
router.post('/queue/reset', async (req, res) => {
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
