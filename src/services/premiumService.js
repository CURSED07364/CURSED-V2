const User = require('../database/models/User');
const Guild = require('../database/models/Guild');
const PremiumSubscription = require('../database/models/PremiumSubscription');
const PremiumCode = require('../database/models/PremiumCode');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');
const crypto = require('crypto');

class PremiumService {
  // Check premium status of user (using cache)
  async getUserPremiumStatus(userId) {
    const cacheKey = `premium:user:${userId}`;
    return cacheService.getOrFetch(cacheKey, async () => {
      const user = await User.findOne({ discordId: userId });
      if (!user) return { tier: 'FREE', expiresAt: null, serverQuota: 0 };

      // Check for expiration
      if (user.premiumExpiresAt && new Date() > user.premiumExpiresAt) {
        // Update user to free
        user.premiumTier = 'FREE';
        user.premiumExpiresAt = null;
        user.premiumServerQuota = 0;
        await user.save();
        
        // Deactivate all servers upgraded by this user
        await Guild.updateMany(
          { premiumByUserId: userId },
          { $set: { isPremium: false, premiumTier: 'FREE', premiumByUserId: null, premiumExpiresAt: null } }
        );
        logger.info(`Expired premium subscription for user ${userId}.`);
      }

      return {
        tier: user.premiumTier,
        expiresAt: user.premiumExpiresAt,
        serverQuota: user.premiumServerQuota || 0
      };
    }, 60000); // Cache for 1 min
  }

  // Check premium status of a server/guild
  async getGuildPremiumStatus(guildId) {
    const cacheKey = `premium:guild:${guildId}`;
    return cacheService.getOrFetch(cacheKey, async () => {
      const guild = await Guild.findOne({ guildId });
      if (!guild) return { isPremium: false, tier: 'FREE', expiresAt: null };

      // Verify expiration
      if (guild.isPremium && guild.premiumExpiresAt && new Date() > guild.premiumExpiresAt) {
        guild.isPremium = false;
        guild.premiumTier = 'FREE';
        guild.premiumByUserId = null;
        guild.premiumExpiresAt = null;
        await guild.save();
        logger.info(`Expired premium subscription for guild ${guildId}.`);
      }

      return {
        isPremium: guild.isPremium,
        tier: guild.premiumTier,
        expiresAt: guild.premiumExpiresAt
      };
    }, 60000); // Cache for 1 min
  }

  // Generate a random unique premium code (Admin only)
  async generatePremiumCode(durationDays, tier = 'PREMIUM', generatedBy = 'SYSTEM') {
    const rawCode = `CURSED-${tier}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const newCode = new PremiumCode({
      code: rawCode,
      tier,
      durationDays,
      generatedBy
    });
    await newCode.save();
    return rawCode;
  }

  // Redeem code for user
  async redeemCode(userId, codeString) {
    const code = await PremiumCode.findOne({ code: codeString, redeemed: false });
    if (!code) throw new Error('Invalid or already redeemed premium code.');

    let user = await User.findOne({ discordId: userId });
    if (!user) {
      user = new User({ discordId: userId, username: 'Unknown' });
    }

    const durationMs = code.durationDays * 24 * 60 * 60 * 1000;
    let newExpiresAt = new Date(Date.now() + durationMs);

    // If user already has premium of same tier, extend it
    if (user.premiumTier === code.tier && user.premiumExpiresAt) {
      newExpiresAt = new Date(user.premiumExpiresAt.getTime() + durationMs);
    }

    user.premiumTier = code.tier;
    user.premiumExpiresAt = newExpiresAt;
    
    // PREMIUM receives 1 server slot, PREMIUM+ receives 3 server slots
    const extraQuota = code.tier === 'PREMIUM+' ? 3 : 1;
    user.premiumServerQuota = (user.premiumServerQuota || 0) + extraQuota;
    
    await user.save();

    // Mark code as redeemed
    code.redeemed = true;
    code.redeemedBy = userId;
    code.redeemedAt = new Date();
    await code.save();

    // Log subscription history
    const subscription = new PremiumSubscription({
      userId,
      type: 'USER',
      tier: code.tier,
      startsAt: new Date(),
      expiresAt: newExpiresAt,
      paymentProvider: 'CODE',
      codeUsed: codeString
    });
    await subscription.save();

    // Clear caches
    cacheService.delete(`premium:user:${userId}`);

    return {
      tier: code.tier,
      expiresAt: newExpiresAt,
      quota: user.premiumServerQuota
    };
  }

  // Upgrade guild using user's slot quota
  async upgradeGuild(userId, guildId) {
    const userStatus = await this.getUserPremiumStatus(userId);
    if (userStatus.tier === 'FREE') {
      throw new Error('You need an active Premium subscription to upgrade a server.');
    }

    // Check how many servers user has already upgraded
    const activeUpgradedGuilds = await Guild.countDocuments({ premiumByUserId: userId, isPremium: true });
    if (activeUpgradedGuilds >= userStatus.serverQuota) {
      throw new Error(`You have reached your limit of upgraded servers (${userStatus.serverQuota}). Deactivate another server first.`);
    }

    const guild = await Guild.findOne({ guildId });
    if (!guild) throw new Error('Guild settings not found.');
    if (guild.isPremium) throw new Error('This server already has Premium enabled.');

    guild.isPremium = true;
    guild.premiumTier = userStatus.tier;
    guild.premiumByUserId = userId;
    guild.premiumExpiresAt = userStatus.expiresAt;
    await guild.save();

    cacheService.delete(`premium:guild:${guildId}`);
    return guild;
  }

  // Deactivate a server upgrade to free up user quota slot
  async deactivateGuild(userId, guildId) {
    const guild = await Guild.findOne({ guildId, premiumByUserId: userId });
    if (!guild) throw new Error('You are not currently boosting this server.');

    guild.isPremium = false;
    guild.premiumTier = 'FREE';
    guild.premiumByUserId = null;
    guild.premiumExpiresAt = null;
    await guild.save();

    cacheService.delete(`premium:guild:${guildId}`);
    return guild;
  }

  // Sync premium roles in a specific guild
  async syncPremiumRole(client, guildId, userId, roleId) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      const { tier } = await this.getUserPremiumStatus(userId);
      const hasPremium = tier !== 'FREE';

      const hasRole = member.roles.cache.has(roleId);
      if (hasPremium && !hasRole) {
        await member.roles.add(roleId);
        logger.info(`Assigned Premium role to user ${userId} in guild ${guildId}`);
      } else if (!hasPremium && hasRole) {
        await member.roles.remove(roleId);
        logger.info(`Removed Premium role from user ${userId} in guild ${guildId}`);
      }
    } catch (err) {
      logger.error(`Failed to sync premium role in guild ${guildId}:`, err);
    }
  }
}

module.exports = new PremiumService();
