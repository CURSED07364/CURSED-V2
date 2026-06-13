const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  skin: { type: String, default: 'default' },
  equipped: { type: Boolean, default: false }
}, { _id: false });

const questSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  progress: { type: Number, default: 0 },
  target: { type: Number, required: true },
  completed: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true },
  
  // Economy System
  wallet: { type: Number, default: 0, min: 0 },
  bank: { type: Number, default: 0, min: 0 },
  bankLimit: { type: Number, default: 5000 },
  
  // XP & Levels
  xp: { type: Number, default: 0, min: 0 },
  level: { type: Number, default: 1, min: 1 },
  lastXpGain: { type: Date, default: Date.now },
  
  // Premium Features
  premiumTier: { type: String, enum: ['FREE', 'PREMIUM', 'PREMIUM+'], default: 'FREE', index: true },
  premiumExpiresAt: { type: Date, default: null },
  premiumServerQuota: { type: Number, default: 0 }, // How many servers they can upgrade
  
  // Pets, Achievements, Quests
  pets: [petSchema],
  achievements: [{ type: String }],
  quests: [questSchema],
  completedQuests: [{ type: String }],
  
  // Custom Settings & Customization
  cosmetics: [{ type: String }], // skin IDs, custom borders, badge names
  activeCosmeticRole: { type: String, default: null },
  customPersonality: { type: String, default: '' },
  
  // Rate-limiting and Anti-abuse
  blacklisted: { type: Boolean, default: false },
  cooldowns: {
    type: Map,
    of: Date,
    default: new Map()
  }
}, {
  timestamps: true
});

// Indexes for economy leaderboard operations
userSchema.index({ wallet: -1 });
userSchema.index({ bank: -1 });
userSchema.index({ xp: -1 });
userSchema.index({ level: -1 });

module.exports = mongoose.model('User', userSchema);
