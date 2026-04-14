// utils/codeGenerator.js
// ─────────────────────────────────────────────────────────
// Generates a cryptographically secure 6-character
// alphanumeric code using a safe character set.
//
// Excluded characters (visually ambiguous):
//   0 (zero), O (oh), 1 (one), I (eye), L (ell)
// ─────────────────────────────────────────────────────────

const crypto = require('crypto');

const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Generates a random 6-character alphanumeric code.
 * Uses crypto.randomInt() for uniform, secure randomness.
 *
 * @returns {string} e.g. "X7KM3P"
 */
function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = crypto.randomInt(0, SAFE_CHARS.length);
    code += SAFE_CHARS[index];
  }
  return code;
}

module.exports = { generateCode };
