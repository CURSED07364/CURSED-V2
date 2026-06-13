const mongoose = require('mongoose');

const autoModRuleSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  whitelistRoles: [{ type: String }],
  whitelistChannels: [{ type: String }],
  severity: { type: String, enum: ['WARN', 'TIMEOUT', 'MUTE', 'KICK', 'BAN'], default: 'WARN' },
  threshold: { type: Number, default: 5 } // specific variables like message limits for spam
}, { _id: false });

const guildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  prefix: { type: String, default: '!' },
  
  // Channels
  logChannelId: { type: String, default: null },
  welcomeChannelId: { type: String, default: null },
  welcomeMessage: { type: String, default: 'Welcome {user} to CURSED!' },
  
  // Premium Server Integration
  isPremium: { type: Boolean, default: false, index: true },
  premiumTier: { type: String, enum: ['FREE', 'PREMIUM', 'PREMIUM+'], default: 'FREE' },
  premiumByUserId: { type: String, default: null },
  premiumExpiresAt: { type: Date, default: null },

  // AutoMod configurations
  autoMod: {
    antiSpam: { type: autoModRuleSchema, default: () => ({}) },
    antiLink: { type: autoModRuleSchema, default: () => ({}) },
    antiInvite: { type: autoModRuleSchema, default: () => ({}) },
    antiScam: { type: autoModRuleSchema, default: () => ({}) },
    antiMassMention: { type: autoModRuleSchema, default: () => ({}) }
  },

  // Support Tickets System
  tickets: {
    categoryId: { type: String, default: null },
    staffRoleId: { type: String, default: null },
    ticketCount: { type: Number, default: 0 }
  },

  // Guild Specific Custom AI personality
  ai: {
    personality: { type: String, default: 'You are CURSED, a dark, slightly sarcastic, but incredibly helpful AI assistant.' },
    aimode: { type: String, enum: ['STANDARD', 'CREATIVE', 'STRICT'], default: 'STANDARD' },
    activeChannels: [{ type: String }] // channels where bot auto-replies to chat
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Guild', guildSchema);
