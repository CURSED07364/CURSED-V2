const mongoose = require('mongoose');

const autoModLogSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  rule: { type: String, required: true },
  action: { type: String, required: true },
  reason: { type: String, required: true },
  messageId: { type: String, default: null },
  channelId: { type: String, default: null }
}, {
  timestamps: true
});

autoModLogSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('AutoModLog', autoModLogSchema);
