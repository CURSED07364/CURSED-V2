const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, required: true },
  caseId: { type: Number, default: null },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

warningSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('Warning', warningSchema);
