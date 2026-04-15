// services/whatsapp.js
// ─────────────────────────────────────────────────────────
// WhatsApp Business API message sender.
// Uses the Cloud API to send text messages back to users.
// ─────────────────────────────────────────────────────────

const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

/**
 * Sends a text message to a WhatsApp user.
 *
 * @param {string} to - Recipient phone number (with country code, no +)
 * @param {string} body - Message text
 * @returns {Promise<object>} API response
 */
async function sendMessage(to, body) {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp] ❌ Failed to send message to ${to}:`, data);
      return { success: false, error: data };
    }

    console.log(`[WhatsApp] ✅ Message sent to ${to}`);
    return { success: true, data };
  } catch (error) {
    console.error(`[WhatsApp] ❌ Error sending message:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendMessage };
