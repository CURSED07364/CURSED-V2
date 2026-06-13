const mongoose = require('mongoose');

const premiumCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  tier: { type: String, enum: ['PREMIUM', 'PREMIUM+'], default: 'PREMIUM' },
  durationDays: { type: Number, required: true },
  redeemed: { type: Boolean, default: false },
  redeemedBy: { type: String, default: null }, // User ID who redeemed
  redeemedAt: { type: Date, default: null },
  generatedBy: { type: String, default: 'SYSTEM' } // Admin User ID or SYSTEM
}, {
  timestamps: true
});

module.exports = mongoose.model('PremiumCode', premiumCodeSchema);
