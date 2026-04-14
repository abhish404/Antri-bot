// services/dailyCode.js
// ─────────────────────────────────────────────────────────
// Core business logic for the daily venue access code.
//
// Exports:
//   getTodayCode()      — returns current code (creates if missing)
//   validateCode(input) — checks input against today's code
//   rotateCode()        — generates & stores a fresh code for today
//   getCodeHistory()    — returns last 7 days of codes
// ─────────────────────────────────────────────────────────

const { db } = require('../config/firebase');
const { generateCode } = require('../utils/codeGenerator');
const { getTodate, getLastNDays } = require('../utils/dateHelpers');

const COLLECTION = 'daily_codes';

/**
 * Returns today's code. If no code exists for today, creates one first.
 *
 * @returns {Promise<{ code: string, date: string, createdAt: any }>}
 */
async function getTodayCode() {
  const today = getTodate();
  const docRef = db.collection(COLLECTION).doc(today);

  try {
    const doc = await docRef.get();

    if (doc.exists) {
      return doc.data();
    }

    // No code for today yet — generate one
    console.log(`[DailyCode] No code found for ${today}, generating...`);
    return await rotateCode();
  } catch (error) {
    console.error(`[DailyCode] Error fetching today's code:`, error.message);
    throw error;
  }
}

/**
 * Validates a user-provided code against today's code.
 * Comparison is case-insensitive.
 *
 * @param {string} input - The code to validate
 * @returns {Promise<{ valid: boolean, code: string }>}
 */
async function validateCode(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, code: null };
  }

  try {
    const { code } = await getTodayCode();
    const isValid = input.toUpperCase().trim() === code.toUpperCase();

    return { valid: isValid, code };
  } catch (error) {
    console.error(`[DailyCode] Error validating code:`, error.message);
    throw error;
  }
}

/**
 * Generates a fresh code for today and stores it in Firestore.
 * Used by the cron job and can be triggered manually by an admin.
 *
 * @returns {Promise<{ code: string, date: string, createdAt: any }>}
 */
async function rotateCode() {
  const today = getTodate();
  const code = generateCode();

  const data = {
    code,
    date: today,
    createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
  };

  try {
    await db.collection(COLLECTION).doc(today).set(data);
    console.log(`[DailyCode] ✅ New code generated for ${today}: ${code}`);
    return data;
  } catch (error) {
    console.error(`[DailyCode] ❌ Failed to store code for ${today}:`, error.message);
    throw error;
  }
}

/**
 * Returns the last 7 days of codes for audit purposes.
 *
 * @returns {Promise<Array<{ date: string, code: string, createdAt: any }>>}
 */
async function getCodeHistory() {
  const dateKeys = getLastNDays(7);

  try {
    const results = [];

    for (const dateKey of dateKeys) {
      const doc = await db.collection(COLLECTION).doc(dateKey).get();

      if (doc.exists) {
        results.push(doc.data());
      } else {
        results.push({ date: dateKey, code: null, createdAt: null });
      }
    }

    return results;
  } catch (error) {
    console.error(`[DailyCode] Error fetching code history:`, error.message);
    throw error;
  }
}

module.exports = { getTodayCode, validateCode, rotateCode, getCodeHistory };
