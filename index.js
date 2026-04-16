// index.js
// ─────────────────────────────────────────────────────────
// Entry point: Express server + daily code cron scheduler.
//
// Cron schedule: every day at 00:00 IST (Asia/Kolkata)
// On startup: ensures a code exists for today immediately.
// ─────────────────────────────────────────────────────────

require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const cron = require('node-cron');
const { getTodayCode, rotateCode } = require('./services/dailyCode');
const { connectMongoDB } = require('./config/mongodb');

// ─── Express App Setup ───────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: false, // Set to true if behind HTTPS
  },
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ──────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');

app.use('/api/auth', authRoutes);
app.use('/api/code', apiRoutes);
app.use('/webhook', webhookRoutes);

// Root redirect → login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ─── Cron Job: Rotate code at midnight IST ───────────────
const CRON_SCHEDULE = '0 0 * * *'; // midnight every day
const CRON_TIMEZONE = 'Asia/Kolkata';

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

  // Connect MongoDB (optional — dashboard features)
  try {
    await connectMongoDB();
  } catch (error) {
    console.error(`[Startup] ⚠️ MongoDB not available — dashboard will work without customer names`);
  }

  // Start Express server
  app.listen(PORT, () => {
    console.log(`[Server] 🌐 Admin dashboard: http://localhost:${PORT}`);
    console.log(`[Server] 📱 WhatsApp webhook: http://localhost:${PORT}/webhook`);
    console.log(`[Startup] Service is running. Waiting for midnight rotation...\n`);
  });
})();
