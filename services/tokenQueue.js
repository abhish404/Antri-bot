// services/tokenQueue.js
// ─────────────────────────────────────────────────────────
// Hybrid token queue: Firestore atomic counter + MongoDB user records.
//
// Firestore handles:
//   - Atomic token numbering (nextToken counter per day)
//
// MongoDB handles:
//   - Full user records (name, phone, token, status, etc.)
//   - Dashboard queries (queue list, treat/untreat)
//
// Exports:
//   getNextToken(phone)              — reserve next token number (Firestore)
//   getExistingToken(phone)          — check if phone has a token today (MongoDB)
//   saveCustomer(phone, name, token) — save user record after name collected (MongoDB)
//   getTodayQueue()                  — all tokens issued today (MongoDB)
//   resetQueue()                     — clear today's queue (both)
//   markTreated(phone)               — set status to 'treated' (MongoDB)
//   markUntreated(phone, reason)     — revert status to 'waiting' (MongoDB)
// ─────────────────────────────────────────────────────────

const admin = require('firebase-admin');
const { db } = require('../config/firebase');
const { getTodate } = require('../utils/dateHelpers');
const Customer = require('../models/Customer');

const COLLECTION = 'queue_tokens';

// ─── Firestore: Atomic Token Counter ─────────────────────

/**
 * Reserves the next token number for a phone number.
 * Uses a Firestore transaction for atomic incrementing.
 * Does NOT check MongoDB — the webhook handles idempotency.
 *
 * @param {string} phone - Sender's phone number
 * @returns {Promise<{ token: number }>}
 */
async function getNextToken(phone) {
  const today = getTodate();
  const docRef = db.collection(COLLECTION).doc(today);

  return db.runTransaction(async (txn) => {
    const doc = await txn.get(docRef);

    if (doc.exists) {
      const data = doc.data();
      const nextToken = data.nextToken || 1;

      txn.update(docRef, {
        nextToken: nextToken + 1,
      });

      return { token: nextToken };
    }

    // First token of the day — create the counter document
    txn.set(docRef, {
      date: today,
      nextToken: 2,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { token: 1 };
  });
}

// ─── MongoDB: User Records ──────────────────────────────

/**
 * Checks if a phone number already has a token today.
 *
 * @param {string} phone - Sender's phone number
 * @returns {Promise<{ token: number, name: string } | null>}
 */
async function getExistingToken(phone) {
  const today = getTodate();
  const existing = await Customer.findOne({ date: today, phone }).lean();
  return existing || null;
}

/**
 * Saves a customer record to MongoDB after name is collected.
 *
 * @param {string} phone - Sender's phone number
 * @param {string} name - User's full name
 * @param {number} token - Reserved token number
 * @returns {Promise<Object>} - The saved customer document
 */
async function saveCustomer(phone, name, token) {
  const today = getTodate();

  const customer = await Customer.findOneAndUpdate(
    { date: today, phone },
    {
      $setOnInsert: {
        name,
        token,
        date: today,
        phone,
        issuedAt: new Date(),
        status: 'waiting',
      },
    },
    { upsert: true, new: true }
  );

  console.log(`[TokenQueue] 💾 Customer saved: ${name} (${phone}) → Token #${token}`);
  return customer;
}

/**
 * Returns today's full queue from MongoDB.
 *
 * @returns {Promise<{ date: string, tokens: Array, total: number }>}
 */
async function getTodayQueue() {
  const today = getTodate();
  const tokens = await Customer.find({ date: today })
    .sort({ token: 1 })
    .lean();

  return {
    date: today,
    tokens: tokens.map((t) => ({
      phone: t.phone,
      name: t.name,
      token: t.token,
      issuedAt: t.issuedAt,
      status: t.status,
      treatedAt: t.treatedAt || null,
      retrieveReason: t.retrieveReason || null,
      retrievedAt: t.retrievedAt || null,
    })),
    total: tokens.length,
  };
}

/**
 * Resets today's queue (admin action).
 * Clears both the Firestore counter and MongoDB records.
 *
 * @returns {Promise<{ date: string, message: string }>}
 */
async function resetQueue() {
  const today = getTodate();

  // Reset Firestore counter
  const docRef = db.collection(COLLECTION).doc(today);
  await docRef.set({
    date: today,
    nextToken: 1,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Delete all MongoDB records for today
  const result = await Customer.deleteMany({ date: today });

  console.log(`[TokenQueue] 🔄 Queue reset for ${today} (${result.deletedCount} records removed)`);
  return { date: today, message: 'Queue reset successfully' };
}

/**
 * Marks a token as treated.
 *
 * @param {string} phone - The phone number of the token holder
 * @returns {Promise<{ success: boolean, token: number }>}
 */
async function markTreated(phone) {
  const today = getTodate();

  const customer = await Customer.findOneAndUpdate(
    { date: today, phone },
    { status: 'treated', treatedAt: new Date() },
    { new: true }
  );

  if (!customer) {
    throw new Error('Token not found for this phone number');
  }

  console.log(`[TokenQueue] ✅ Token #${customer.token} marked as treated`);
  return { success: true, token: customer.token };
}

/**
 * Reverts a treated token back to waiting (with mandatory reason).
 *
 * @param {string} phone - The phone number of the token holder
 * @param {string} reason - Reason for reverting
 * @returns {Promise<{ success: boolean, token: number }>}
 */
async function markUntreated(phone, reason) {
  const today = getTodate();

  const customer = await Customer.findOneAndUpdate(
    { date: today, phone },
    {
      status: 'waiting',
      treatedAt: null,
      retrieveReason: reason,
      retrievedAt: new Date(),
    },
    { new: true }
  );

  if (!customer) {
    throw new Error('Token not found for this phone number');
  }

  console.log(`[TokenQueue] ↩️ Token #${customer.token} reverted to waiting. Reason: ${reason}`);
  return { success: true, token: customer.token };
}

module.exports = {
  getNextToken,
  getExistingToken,
  saveCustomer,
  getTodayQueue,
  resetQueue,
  markTreated,
  markUntreated,
};
