// config/mongodb.js
// ─────────────────────────────────────────────────────────
// MongoDB connection using Mongoose.
//
// Connection string comes from: MONGODB_URI env var
// ─────────────────────────────────────────────────────────

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function connectMongoDB() {
  if (!MONGODB_URI) {
    console.warn('[MongoDB] ⚠️ MONGODB_URI not set — skipping MongoDB connection');
    return null;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[MongoDB] ✅ Connected successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('[MongoDB] ❌ Connection failed:', error.message);
    throw error;
  }
}

module.exports = { connectMongoDB, mongoose };
