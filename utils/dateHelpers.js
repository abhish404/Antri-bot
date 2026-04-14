// utils/dateHelpers.js
// ─────────────────────────────────────────────────────────
// IST (Asia/Kolkata) date utilities.
// All date strings are in DD-MM-YYYY format.
// Uses Intl.DateTimeFormat — no external timezone library.
// ─────────────────────────────────────────────────────────

const TIMEZONE = 'Asia/Kolkata';

/**
 * Formats a Date object into DD-MM-YYYY string in IST.
 *
 * @param {Date} date
 * @returns {string} e.g. "14-04-2026"
 */
function formatDateIST(date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // en-GB gives DD/MM/YYYY — replace slashes with dashes
  return formatter.format(date).replace(/\//g, '-');
}

/**
 * Returns today's date as a DD-MM-YYYY string in IST.
 *
 * @returns {string} e.g. "14-04-2026"
 */
function getTodate() {
  return formatDateIST(new Date());
}

/**
 * Returns an array of the last N days' date strings (DD-MM-YYYY, IST),
 * starting from today and going backwards.
 *
 * @param {number} n - Number of days to include
 * @returns {string[]} e.g. ["14-04-2026", "13-04-2026", ...]
 */
function getLastNDays(n) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(formatDateIST(d));
  }
  return dates;
}

module.exports = { getTodate, getLastNDays };
