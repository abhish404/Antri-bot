// models/Customer.js
// ─────────────────────────────────────────────────────────
// MongoDB model for customer data.
//
// Stores customer name linked to their phone number.
// Used by the dashboard to display names instead of raw phones.
// ─────────────────────────────────────────────────────────

const { mongoose } = require('../config/mongodb');

const customerSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field on save
customerSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
