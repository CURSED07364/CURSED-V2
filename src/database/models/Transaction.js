const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  paymentProvider: { type: String, enum: ['KOFI', 'PATREON', 'BMC', 'MANUAL'], required: true },
  transactionId: { type: String, required: true, unique: true, index: true },
  email: { type: String, default: null },
  status: { type: String, enum: ['COMPLETED', 'REFUNDED', 'FAILED'], default: 'COMPLETED' },
  rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);
