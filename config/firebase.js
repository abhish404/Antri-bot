// config/firebase.js
// ─────────────────────────────────────────────────────────
// TODO: Initialize Firebase Admin SDK here.
//
// Example setup:
//
//   const admin = require('firebase-admin');
//   const serviceAccount = require('../serviceAccountKey.json');
//
//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//   });
//
//   const db = admin.firestore();
//   module.exports = { db };
//
// ─────────────────────────────────────────────────────────

const admin = require('firebase-admin');


const rawCreds = process.env.FIREBASE_SERVICE_ACCOUNT;
const serviceAccount = (rawCreds && rawCreds !== 'undefined' && rawCreds.trim().startsWith('{'))
    ? JSON.parse(rawCreds)
    : require('../antri-asia-firebase.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { db };