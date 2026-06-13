const Analytics = require('../database/models/Analytics');
const logger = require('../utils/logger');

class AnalyticsService {
  constructor() {
    this.buffer = new Map(); // guildId -> dailyData
    this.flushInterval = null;
  }

  // Get current date key (YYYY-MM-DD)
  getDateKey() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  // Retrieve buffer entry for a guild
  getOrCreateBuffer(guildId) {
    const dateKey = this.getDateKey();
    const bufferKey = `${guildId}:${dateKey}`;

    if (!this.buffer.has(bufferKey)) {
      this.buffer.set(bufferKey, {
        guildId,
        date: dateKey,
        messagesCount: 0,
        commandsCount: 0,
        activeUsers: new Set(),
        xpGained: 0,
        premiumConversions: 0,
        commandDistribution: new Map()
      });
    }

    return this.buffer.get(bufferKey);
  }

  trackMessage(guildId, userId) {
    const entry = this.getOrCreateBuffer(guildId);
    entry.messagesCount++;
    entry.activeUsers.add(userId);
  }

  trackCommand(guildId, commandName, userId) {
    const entry = this.getOrCreateBuffer(guildId);
    entry.commandsCount++;
    entry.activeUsers.add(userId);
    
    const count = entry.commandDistribution.get(commandName) || 0;
    entry.commandDistribution.set(commandName, count + 1);
  }

  trackXPGain(guildId, xp, userId) {
    const entry = this.getOrCreateBuffer(guildId);
    entry.xpGained += xp;
    entry.activeUsers.add(userId);
  }

  trackPremiumConversion(guildId) {
    const entry = this.getOrCreateBuffer(guildId || 'GLOBAL');
    entry.premiumConversions++;
  }

  // Start background periodic flush to MongoDB
  startFlushInterval(ms = 300000) { // Default 5 mins
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flushInterval = setInterval(() => this.flush(), ms);
    logger.info('Analytics flushing background job initialized.');
  }

  // Flush buffer to DB
  async flush() {
    if (this.buffer.size === 0) return;

    logger.debug(`Flushing analytics buffer: ${this.buffer.size} entries.`);
    const entries = Array.from(this.buffer.values());
    this.buffer.clear(); // Clear memory buffer

    for (const entry of entries) {
      try {
        const query = { guildId: entry.guildId, date: entry.date };
        
        // Load existing analytics record to merge lists
        const existing = await Analytics.findOne(query);
        const mergedActiveUsers = existing 
          ? Array.from(new Set([...existing.activeUsers, ...entry.activeUsers]))
          : Array.from(entry.activeUsers);

        // Build command distribution map updates
        let finalCmdDist = entry.commandDistribution;
        if (existing && existing.commandDistribution) {
          finalCmdDist = new Map(existing.commandDistribution);
          for (const [cmd, count] of entry.commandDistribution.entries()) {
            finalCmdDist.set(cmd, (finalCmdDist.get(cmd) || 0) + count);
          }
        }

        await Analytics.findOneAndUpdate(
          query,
          {
            $inc: {
              messagesCount: entry.messagesCount,
              commandsCount: entry.commandsCount,
              xpGained: entry.xpGained,
              premiumConversions: entry.premiumConversions
            },
            $set: {
              activeUsers: mergedActiveUsers,
              commandDistribution: finalCmdDist
            }
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        logger.error(`Error saving analytics for guild ${entry.guildId}:`, err);
        // Put back in buffer to avoid losing data
        const current = this.getOrCreateBuffer(entry.guildId);
        current.messagesCount += entry.messagesCount;
        current.commandsCount += entry.commandsCount;
        current.xpGained += entry.xpGained;
        current.premiumConversions += entry.premiumConversions;
        entry.activeUsers.forEach(u => current.activeUsers.add(u));
        for (const [cmd, count] of entry.commandDistribution.entries()) {
          current.commandDistribution.set(cmd, (current.commandDistribution.get(cmd) || 0) + count);
        }
      }
    }
    logger.debug('Analytics flush completed.');
  }
}

module.exports = new AnalyticsService();
