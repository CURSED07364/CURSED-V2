const mongoose = require('mongoose');

const premiumSubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  guildId: { type: String, default: null, index: true }, // populated if guild subscription
  type: { type: String, enum: ['USER', 'GUILD'], required: true },
  tier: { type: String, enum: ['PREMIUM', 'PREMIUM+'], required: true, index: true },
  status: { type: String, enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'], default: 'ACTIVE', index: true },
  
  // Expiration settings
  startsAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  autoRenew: { type: Boolean, default: false },

  // Origin info
  paymentProvider: { type: String, enum: ['KOFI', 'PATREON', 'BMC', 'CODE', 'ADMIN'], required: true },
  paymentEmail: { type: String, default: null },
  transactionId: { type: String, default: null, unique: true, sparse: true },
  codeUsed: { type: String, default: null } // Code string used if source was a gift code
}, {
  timestamps: true
});

module.exports = mongoose.model('PremiumSubscription', premiumSubscriptionSchema);
