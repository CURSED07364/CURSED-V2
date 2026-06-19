const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  caseId: { type: Number, required: true },
  userId: { type: String, required: true, index: true },
  moderatorId: { type: String, required: true },
  action: {
    type: String,
    enum: ['WARN', 'TIMEOUT', 'KICK', 'BAN', 'SOFTBAN', 'UNBAN', 'UNWARN'],
    required: true
  },
  reason: { type: String, required: true },
  duration: { type: Number, default: null }, // milliseconds for temporary actions
  expiresAt: { type: Date, default: null },
  evidence: [{ type: String }], // URLs to attachments
  notes: [{
    moderatorId: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  appealStatus: {
    type: String,
    enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
    default: 'NONE'
  },
  appealReason: { type: String, default: null },
  appealedAt: { type: Date, default: null },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

caseSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
caseSchema.index({ guildId: 1, userId: 1 });
caseSchema.index({ guildId: 1, action: 1 });

module.exports = mongoose.model('Case', caseSchema);
