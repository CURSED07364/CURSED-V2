const mongoose = require('mongoose');

const autoModRuleSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  whitelistRoles: [{ type: String }],
  whitelistChannels: [{ type: String }],
  action: { type: String, enum: ['WARN', 'TIMEOUT', 'KICK', 'BAN'], default: 'WARN' },
  threshold: { type: Number, default: 5 }
}, { _id: false });

const guildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  prefix: { type: String, default: '!' },

  // Moderation
  logChannelId: { type: String, default: null },
  modRoleId: { type: String, default: null },

  // AutoMod configurations
  autoMod: {
    antiSpam: { type: autoModRuleSchema, default: () => ({}) },
    antiLink: { type: autoModRuleSchema, default: () => ({}) },
    antiInvite: { type: autoModRuleSchema, default: () => ({}) },
    antiScam: { type: autoModRuleSchema, default: () => ({}) },
    antiMassMention: { type: autoModRuleSchema, default: () => ({}) },
    antiRaid: { type: autoModRuleSchema, default: () => ({}) }
  },

  // Support Tickets System
  tickets: {
    categoryId: { type: String, default: null },
    staffRoleId: { type: String, default: null },
    ticketCount: { type: Number, default: 0 }
  },

  // Logging toggles
  logMessageDeletes: { type: Boolean, default: true },
  logMessageEdits: { type: Boolean, default: true },
  logMemberJoins: { type: Boolean, default: true },
  logMemberLeaves: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Guild', guildSchema);
