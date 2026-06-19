const AutoModLog = require('../database/models/AutoModLog');
const logger = require('../utils/logger');

/**
 * Memory-safe tracker that periodically evicts stale timestamp arrays,
 * preventing unbounded Map growth and eventual OOM crashes.
 */
class MemorySafeTracker {
  constructor(maxAge = 60000, cleanupInterval = 30000) {
    this.data = new Map();
    this.maxAge = maxAge;
    this.cleanupInterval = cleanupInterval;
    this.startCleanup();
  }

  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of this.data.entries()) {
        const valid = timestamps.filter(t => now - t < this.maxAge);
        if (valid.length === 0) {
          this.data.delete(key);
        } else {
          this.data.set(key, valid);
        }
      }
    }, this.cleanupInterval);
    // Allow the process to exit even if this timer is active
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  add(key, timestamp = Date.now()) {
    const list = this.data.get(key) || [];
    list.push(timestamp);
    this.data.set(key, list);
  }

  getRecent(key, windowMs) {
    const now = Date.now();
    const list = this.data.get(key) || [];
    return list.filter(t => now - t < windowMs);
  }

  destroy() {
    clearInterval(this.cleanupTimer);
    this.data.clear();
  }
}

class AutoModService {
  constructor() {
    this.spamTracker = new MemorySafeTracker(60000, 30000);
    this.raidTracker = new MemorySafeTracker(60000, 30000);
  }

  /**
   * Run all automod checks against a message.
   * Returns the first triggered rule object, or null if none triggered.
   *
   * @param {Message} message
   * @param {Object}  guildSettings - Guild document from MongoDB
   * @returns {Object|null} { rule, action, reason, duration? }
   */
  async checkMessage(message, guildSettings) {
    if (!guildSettings.autoMod) return null;

    const checks = [
      this.checkSpam(message, guildSettings),
      this.checkInvites(message, guildSettings),
      this.checkLinks(message, guildSettings),
      this.checkMassMention(message, guildSettings),
      this.checkScam(message, guildSettings),
      this.checkEveryonePing(message)
    ];

    for (const result of checks) {
      if (result) return result;
    }

    return null;
  }

  checkSpam(message, settings) {
    if (!settings.autoMod?.antiSpam?.enabled) return null;

    const key = `${message.guildId}:${message.author.id}`;
    this.spamTracker.add(key);
    const recentCount = this.spamTracker.getRecent(key, 5000).length;
    const threshold = settings.autoMod.antiSpam.threshold || 5;

    if (recentCount >= threshold) {
      return {
        rule: 'ANTI_SPAM',
        action: settings.autoMod.antiSpam.action || 'TIMEOUT',
        reason: `Spam detected (${recentCount} messages in 5s)`,
        duration: 10 * 60 * 1000
      };
    }

    return null;
  }

  checkInvites(message, settings) {
    if (!settings.autoMod?.antiInvite?.enabled) return null;

    const inviteRegex = /(discord\.(gg|io|me|li)\/|discordapp\.com\/invite\/|discord\.com\/invite\/)/i;
    if (inviteRegex.test(message.content)) {
      return {
        rule: 'ANTI_INVITE',
        action: settings.autoMod.antiInvite.action || 'WARN',
        reason: 'Posting Discord invite links'
      };
    }

    return null;
  }

  checkLinks(message, settings) {
    if (!settings.autoMod?.antiLink?.enabled) return null;

    const urlRegex = /https?:\/\/[^\s]+/i;
    if (urlRegex.test(message.content)) {
      return {
        rule: 'ANTI_LINK',
        action: settings.autoMod.antiLink.action || 'WARN',
        reason: 'Posting external links'
      };
    }

    return null;
  }

  checkMassMention(message, settings) {
    if (!settings.autoMod?.antiMassMention?.enabled) return null;

    const threshold = settings.autoMod.antiMassMention.threshold || 5;
    if (message.mentions.users.size >= threshold) {
      return {
        rule: 'ANTI_MASS_MENTION',
        action: settings.autoMod.antiMassMention.action || 'TIMEOUT',
        reason: `Mass mention detected (${message.mentions.users.size} users)`,
        duration: 10 * 60 * 1000
      };
    }

    return null;
  }

  checkScam(message, settings) {
    if (!settings.autoMod?.antiScam?.enabled) return null;

    const scamRegex = /(nitro-free|free-nitro|discord\.gifts|steam-gift|gift-claim|claim-reward|steamgift|nitro-drop|get-nitro)/i;
    if (scamRegex.test(message.content)) {
      return {
        rule: 'ANTI_SCAM',
        action: settings.autoMod.antiScam.action || 'BAN',
        reason: 'Posting scam/phishing content'
      };
    }

    return null;
  }

  checkEveryonePing(message) {
    const { PermissionFlagsBits } = require('discord.js');
    if (
      (message.content.includes('@everyone') || message.content.includes('@here')) &&
      !message.member?.permissions.has(PermissionFlagsBits.MentionEveryone)
    ) {
      return {
        rule: 'ANTI_EVERYONE_PING',
        action: 'TIMEOUT',
        reason: 'Pinging @everyone or @here without permission',
        duration: 10 * 60 * 1000
      };
    }

    return null;
  }

  /**
   * Persist an automod action to the database.
   */
  async logAction(guildId, userId, rule, action, reason, messageId = null, channelId = null) {
    try {
      const log = new AutoModLog({
        guildId,
        userId,
        rule,
        action,
        reason,
        messageId,
        channelId
      });
      await log.save();
    } catch (err) {
      logger.error('AutoModService.logAction error:', err);
    }
  }

  destroy() {
    this.spamTracker.destroy();
    this.raidTracker.destroy();
  }
}

module.exports = new AutoModService();
