// models/Customer.js
// ─────────────────────────────────────────────────────────
// MongoDB model for customer token data.
//
// Stores customer name, phone, token number, and status.
// Used by the webhook (saves after name collection) and
// the dashboard (displays queue, treat/untreat actions).
// ─────────────────────────────────────────────────────────

const { mongoose } = require('../config/mongodb');

const customerSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  token: {
    type: Number,
    required: true,
  },
  date: {
    type: String,
    required: true,
    index: true,
  },
  issuedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    default: 'waiting',
    enum: ['waiting', 'treated'],
  },
  treatedAt: {
    type: Date,
    default: null,
  },
  retrieveReason: {
    type: String,
    default: null,
  },
  retrievedAt: {
    type: Date,
    default: null,
  },
});

// One token per phone per day
customerSchema.index({ date: 1, phone: 1 }, { unique: true });

// Fast queue lookups sorted by token number
customerSchema.index({ date: 1, token: 1 });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
