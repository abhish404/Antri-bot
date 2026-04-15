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


const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { db };