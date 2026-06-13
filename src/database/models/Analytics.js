const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
  messagesCount: { type: Number, default: 0 },
  commandsCount: { type: Number, default: 0 },
  activeUsers: [{ type: String }], // Unique user IDs active on this day
  xpGained: { type: Number, default: 0 },
  premiumConversions: { type: Number, default: 0 },
  commandDistribution: {
    type: Map,
    of: Number,
    default: new Map()
  }
}, {
  timestamps: true
});

// Compound index for efficient daily updates and queries
analyticsSchema.index({ guildId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Analytics', analyticsSchema);
