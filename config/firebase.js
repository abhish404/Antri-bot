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

// Placeholder — replace with your Firebase initialization
const admin = require('firebase-admin');


const serviceAccount = require('../antri-asia-firebase.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { db };
