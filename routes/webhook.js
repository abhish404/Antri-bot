// routes/webhook.js
// ─────────────────────────────────────────────────────────
// WhatsApp webhook: verification + incoming message handler.
//
// GET  /webhook  → Meta webhook verification (hub challenge)
// POST /webhook  → Incoming messages from WhatsApp users
//
// Flow: user sends passcode → token reserved → ask name →
//       save to MongoDB → reveal token number
// ─────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { validateCode } = require('../services/dailyCode');
const { getNextToken, getExistingToken, saveCustomer } = require('../services/tokenQueue');
const { sendMessage } = require('../services/whatsapp');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ─── Conversation State ─────────────────────────────────
// Tracks users who have verified passcode but haven't provided name yet.
// Key: phone number, Value: { state, token, timestamp }
const conversationState = new Map();

// Auto-clear stale states after 10 minutes
const STATE_TTL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of conversationState) {
    if (now - data.timestamp > STATE_TTL_MS) {
      conversationState.delete(phone);
      console.log(`[Webhook] 🧹 Cleared stale state for ${phone}`);
    }
  }
}, 60 * 1000);

// ─── Webhook Verification (GET) ──────────────────────────
// Meta sends a GET request to verify the webhook URL.
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[Webhook] Verify attempt — mode="${mode}" token="${token}" expected="${VERIFY_TOKEN}"`);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verification successful');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] ❌ Verification failed — token mismatch');
  return res.sendStatus(403);
});

// ─── Incoming Messages (POST) ────────────────────────────
router.post('/', async (req, res) => {
  console.log('[Webhook] 📨 POST received:', JSON.stringify(req.body).substring(0, 300));

  // Always respond 200 quickly to Meta (they retry on timeout)
  res.sendStatus(200);

  try {
    const body = req.body;

    // Validate it's a WhatsApp message event
    if (
      !body.object ||
      !body.entry ||
      !body.entry[0]?.changes ||
      !body.entry[0]?.changes[0]?.value?.messages
    ) {
      return; // Not a message event (could be status update, etc.)
    }

    const message = body.entry[0].changes[0].value.messages[0];
    const from = message.from; // Sender's phone number
    const msgType = message.type;

    console.log(`[Webhook] 📩 Message from ${from} (type: ${msgType})`);

    // Only handle text messages
    if (msgType !== 'text') {
      await sendMessage(from, '⚠️ Please send a text message.');
      return;
    }

    const userInput = message.text.body.trim();
    console.log(`[Webhook] 📝 User input: "${userInput}"`);

    // ─── Step 2: User is providing their name ────────────
    if (conversationState.has(from)) {
      const name = userInput;

      if (name.length < 2 || name.length > 50) {
        await sendMessage(from, '⚠️ Please enter a valid name (2–50 characters).');
        return;
      }

      const { token } = conversationState.get(from);
      console.log(`[Webhook] 📛 Name received from ${from}: "${name}"`);
      conversationState.delete(from);

      // Save customer data to MongoDB
      await saveCustomer(from, name, token);

      console.log(`[Webhook] 🎫 Token #${token} revealed to ${name} (${from})`);
      await sendMessage(
        from,
        `✅ *Welcome, ${name}!*\n\n` +
        `🎫 Your token number is *#${token}*\n\n` +
        `Please wait for your number to be called.\n\n` +
        `_Thank you for your patience! 🙏_`
      );
      return;
    }

    // ─── Step 1: Validate the passcode ───────────────────
    const { valid, code } = await validateCode(userInput);

    if (valid) {
      console.log(`[Webhook] ✅ Passcode verified for ${from}`);

      // Check if user already has a token today (in MongoDB)
      const existing = await getExistingToken(from);
      if (existing) {
        console.log(`[Webhook] 🔄 Existing token #${existing.token} returned to ${from}`);
        await sendMessage(
          from,
          `ℹ️ *You already have a token!*\n\n` +
          `🎫 Your token number is *#${existing.token}*\n\n` +
          `Please wait for your number to be called.\n\n` +
          `_Thank you for your patience! 🙏_`
        );
        return;
      }

      // Reserve a token number atomically (Firestore counter)
      const { token } = await getNextToken(from);

      // Set state to awaiting name — token is reserved but not revealed
      conversationState.set(from, {
        state: 'awaiting_name',
        token,
        timestamp: Date.now(),
      });

      await sendMessage(
        from,
        `✅ *Passcode Verified!*\n\n` +
        `📝 Please reply with your *full name* to receive your queue token.`
      );
    } else {
      console.log(`[Webhook] ❌ Invalid passcode from ${from}: "${userInput}"`);
      await sendMessage(
        from,
        `❌ *Invalid Passcode*\n\nThe code you entered is incorrect. Please scan the QR code at the venue and try again.`
      );
    }
  } catch (error) {
    console.error('[Webhook] ❌ Error processing message:', error.message);
  }
});

module.exports = router;
