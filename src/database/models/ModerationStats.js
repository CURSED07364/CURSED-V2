const mongoose = require('mongoose');

const moderationStatsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  warnings: { type: Number, default: 0 },
  bans: { type: Number, default: 0 },
  kicks: { type: Number, default: 0 },
  timeouts: { type: Number, default: 0 },
  softbans: { type: Number, default: 0 },
  unbans: { type: Number, default: 0 },
  automodActions: { type: Number, default: 0 },
  ticketsCreated: { type: Number, default: 0 },
  ticketsClosed: { type: Number, default: 0 }
}, {
  timestamps: true
});

moderationStatsSchema.index({ guildId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ModerationStats', moderationStatsSchema);
