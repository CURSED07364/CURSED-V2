const logger = require('../utils/logger');

/**
 * Memory-safe cooldown service with automatic expiry cleanup and a hard
 * upper bound on the number of tracked entries to prevent OOM growth.
 */
class CooldownService {
  constructor() {
    this.cooldowns = new Map();
    this.maxSize = 10000;
    this.cleanupInterval = 60000; // 1 minute
    this.startCleanup();
  }

  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, data] of this.cooldowns.entries()) {
        if (now > data.expiresAt) {
          this.cooldowns.delete(key);
          cleaned++;
        }
      }

      // If still over max size after expiry cleanup, evict oldest entries
      if (this.cooldowns.size > this.maxSize) {
        const toRemove = this.cooldowns.size - this.maxSize;
        let removed = 0;
        for (const key of this.cooldowns.keys()) {
          if (removed >= toRemove) break;
          this.cooldowns.delete(key);
          removed++;
        }
      }

      if (cleaned > 0) {
        logger.debug(`Cooldown cleanup: removed ${cleaned} expired entries`);
      }
    }, this.cleanupInterval);
  }

  /**
   * Check if a user is currently on cooldown for a command.
   * @param {string} userId      - The user's Discord ID
   * @param {string} commandName - The command name
   * @returns {{ onCooldown: boolean, remainingMs: number }}
   */
  check(userId, commandName) {
    const key = `${userId}:${commandName}`;
    const data = this.cooldowns.get(key);

    if (!data) {
      return { onCooldown: false, remainingMs: 0 };
    }

    const remaining = data.expiresAt - Date.now();

    if (remaining <= 0) {
      this.cooldowns.delete(key);
      return { onCooldown: false, remainingMs: 0 };
    }

    return { onCooldown: true, remainingMs: remaining };
  }

  /**
   * Record a cooldown for a user/command pair.
   * @param {string} userId      - The user's Discord ID
   * @param {string} commandName - The command name
   * @param {number} durationMs  - Cooldown duration in milliseconds (default 3 s)
   */
  set(userId, commandName, durationMs = 3000) {
    const key = `${userId}:${commandName}`;
    const expiresAt = Date.now() + durationMs;

    // Evict the oldest entry when the map is full
    if (this.cooldowns.size >= this.maxSize && !this.cooldowns.has(key)) {
      const firstKey = this.cooldowns.keys().next().value;
      this.cooldowns.delete(firstKey);
    }

    this.cooldowns.set(key, { expiresAt });
  }

  /**
   * Remove the cooldown for a specific user/command pair.
   * @param {string} userId
   * @param {string} commandName
   */
  clear(userId, commandName) {
    this.cooldowns.delete(`${userId}:${commandName}`);
  }

  /**
   * Remove all cooldowns for a given user.
   * @param {string} userId
   */
  clearUser(userId) {
    const prefix = `${userId}:`;
    for (const key of this.cooldowns.keys()) {
      if (key.startsWith(prefix)) {
        this.cooldowns.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupTimer);
    this.cooldowns.clear();
  }
}

module.exports = new CooldownService();
