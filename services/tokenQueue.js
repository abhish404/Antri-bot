// services/tokenQueue.js
// ─────────────────────────────────────────────────────────
// Daily token queue backed by Firestore.
//
// Each day gets its own document in `queue_tokens` with:
//   - nextToken: atomic counter (starts at 1)
//   - tokens[]: array of { phone, token, issuedAt, name?, status }
//
// Exports:
//   getNextToken(phone) — idempotent: same phone → same token per day
//   getTodayQueue()     — returns all tokens issued today
//   resetQueue()        — clears today's queue (admin action)
//   markTreated(phone)  — set token status to 'treated'
//   markUntreated(phone, reason) — revert status, log reason
// ─────────────────────────────────────────────────────────

const admin = require('firebase-admin');
const { db } = require('../config/firebase');
const { getTodate } = require('../utils/dateHelpers');

const COLLECTION = 'queue_tokens';

/**
 * Returns the next token for a phone number.
 * If the phone already has a token today, returns the existing one (idempotent).
 *
 * @param {string} phone - Sender's phone number (with country code, no +)
 * @returns {Promise<{ token: number, isNew: boolean, total: number }>}
 */
async function getNextToken(phone) {
  const today = getTodate();
  const docRef = db.collection(COLLECTION).doc(today);

  // Use a Firestore transaction for atomicity
  return db.runTransaction(async (txn) => {
    const doc = await txn.get(docRef);

    if (doc.exists) {
      const data = doc.data();
      const tokens = data.tokens || [];

      // Check if this phone already has a token today
      const existing = tokens.find((t) => t.phone === phone);
      if (existing) {
        return {
          token: existing.token,
          isNew: false,
          total: tokens.length,
        };
      }

      // Assign next token
      const nextToken = data.nextToken || tokens.length + 1;
      const entry = {
        phone,
        token: nextToken,
        issuedAt: new Date().toISOString(),
        status: 'waiting',
      };

      txn.update(docRef, {
        nextToken: nextToken + 1,
        tokens: admin.firestore.FieldValue.arrayUnion(entry),
      });

      return {
        token: nextToken,
        isNew: true,
        total: tokens.length + 1,
      };
    }

    // First token of the day — create the document
    const entry = {
      phone,
      token: 1,
      issuedAt: new Date().toISOString(),
      status: 'waiting',
    };

    txn.set(docRef, {
      date: today,
      nextToken: 2,
      tokens: [entry],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      token: 1,
      isNew: true,
      total: 1,
    };
  });
}

/**
 * Returns today's full queue.
 *
 * @returns {Promise<{ date: string, tokens: Array, total: number }>}
 */
async function getTodayQueue() {
  const today = getTodate();
  const doc = await db.collection(COLLECTION).doc(today).get();

  if (!doc.exists) {
    return { date: today, tokens: [], total: 0 };
  }

  const data = doc.data();
  const tokens = data.tokens || [];

  return {
    date: today,
    tokens: tokens.sort((a, b) => a.token - b.token),
    total: tokens.length,
  };
}

/**
 * Resets today's queue (admin action).
 *
 * @returns {Promise<{ date: string, message: string }>}
 */
async function resetQueue() {
  const today = getTodate();
  const docRef = db.collection(COLLECTION).doc(today);

  await docRef.set({
    date: today,
    nextToken: 1,
    tokens: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[TokenQueue] 🔄 Queue reset for ${today}`);
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
  const docRef = db.collection(COLLECTION).doc(today);

  return db.runTransaction(async (txn) => {
    const doc = await txn.get(docRef);

    if (!doc.exists) {
      throw new Error('No queue found for today');
    }

    const data = doc.data();
    const tokens = data.tokens || [];
    const index = tokens.findIndex((t) => t.phone === phone);

    if (index === -1) {
      throw new Error('Token not found for this phone number');
    }

    tokens[index].status = 'treated';
    tokens[index].treatedAt = new Date().toISOString();

    txn.update(docRef, { tokens });

    console.log(`[TokenQueue] ✅ Token #${tokens[index].token} marked as treated`);
    return { success: true, token: tokens[index].token };
  });
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
  const docRef = db.collection(COLLECTION).doc(today);

  return db.runTransaction(async (txn) => {
    const doc = await txn.get(docRef);

    if (!doc.exists) {
      throw new Error('No queue found for today');
    }

    const data = doc.data();
    const tokens = data.tokens || [];
    const index = tokens.findIndex((t) => t.phone === phone);

    if (index === -1) {
      throw new Error('Token not found for this phone number');
    }

    tokens[index].status = 'waiting';
    tokens[index].treatedAt = null;
    tokens[index].retrieveReason = reason;
    tokens[index].retrievedAt = new Date().toISOString();

    txn.update(docRef, { tokens });

    console.log(`[TokenQueue] ↩️ Token #${tokens[index].token} reverted to waiting. Reason: ${reason}`);
    return { success: true, token: tokens[index].token };
  });
}

module.exports = { getNextToken, getTodayQueue, resetQueue, markTreated, markUntreated };
