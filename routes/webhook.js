// routes/webhook.js
// ─────────────────────────────────────────────────────────
// WhatsApp webhook: verification + incoming message handler.
//
// GET  /webhook  → Meta webhook verification (hub challenge)
// POST /webhook  → Incoming messages from WhatsApp users
//
// Flow: user sends passcode → validate → assign queue token
// ─────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { validateCode } = require('../services/dailyCode');
const { getNextToken } = require('../services/tokenQueue');
const { sendMessage } = require('../services/whatsapp');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

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
      await sendMessage(from, '⚠️ Please send the passcode as a text message.');
      return;
    }

    const userInput = message.text.body.trim();
    console.log(`[Webhook] 📝 User input: "${userInput}"`);

    // Validate the passcode against today's code
    const { valid, code } = await validateCode(userInput);

    if (valid) {
      console.log(`[Webhook] ✅ Passcode verified for ${from}`);

      // Assign a queue token
      const { token, isNew, total } = await getNextToken(from);

      if (isNew) {
        console.log(`[Webhook] 🎫 New token #${token} issued to ${from} (total: ${total})`);
        await sendMessage(
          from,
          `✅ *Passcode Verified!*\n\n` +
          `🎫 Your token number is *#${token}*\n\n` +
          `You are number *${token}* in the queue.\n` +
          `Please wait for your number to be called.\n\n` +
          `_Thank you for your patience! 🙏_`
        );
      } else {
        console.log(`[Webhook] 🔄 Existing token #${token} returned to ${from}`);
        await sendMessage(
          from,
          `ℹ️ *You already have a token!*\n\n` +
          `🎫 Your token number is *#${token}*\n\n` +
          `Please wait for your number to be called.\n\n` +
          `_Thank you for your patience! 🙏_`
        );
      }
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
