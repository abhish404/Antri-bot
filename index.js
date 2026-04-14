// index.js
// ─────────────────────────────────────────────────────────
// Entry point: starts the daily code cron scheduler.
//
// Cron schedule: every day at 00:00 IST (Asia/Kolkata)
// On startup: ensures a code exists for today immediately.
// ─────────────────────────────────────────────────────────

const cron = require('node-cron');
const { getTodayCode, rotateCode } = require('./services/dailyCode');

const CRON_SCHEDULE = '0 0 * * *'; // midnight every day
const CRON_TIMEZONE = 'Asia/Kolkata';

// ─── Cron Job: Rotate code at midnight IST ───────────────
const task = cron.schedule(
  CRON_SCHEDULE,
  async () => {
    console.log(`\n[Cron] 🕛 Midnight IST — rotating daily code...`);

    try {
      const { code, date } = await rotateCode();
      console.log(`[Cron] ✅ New code for ${date}: ${code}`);
    } catch (error) {
      console.error(`[Cron] ❌ Code rotation failed:`, error.message);
    }
  },
  {
    timezone: CRON_TIMEZONE,
  }
);

// ─── Startup ─────────────────────────────────────────────
(async () => {
  console.log('========================================');
  console.log(' WhatsApp Daily Code Service');
  console.log('========================================');
  console.log(`[Startup] Cron scheduled: "${CRON_SCHEDULE}" (${CRON_TIMEZONE})`);

  try {
    const { code, date } = await getTodayCode();
    console.log(`[Startup] ✅ Today's code (${date}): ${code}`);
  } catch (error) {
    console.error(`[Startup] ❌ Failed to get/create today's code:`, error.message);
  }

  console.log(`[Startup] Service is running. Waiting for midnight rotation...\n`);
})();
