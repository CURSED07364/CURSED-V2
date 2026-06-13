const User = require('../../database/models/User');
const Guild = require('../../database/models/Guild');
const Warning = require('../../database/models/Warning');
const cacheService = require('../../services/cacheService');
const premiumService = require('../../services/premiumService');
const analyticsService = require('../../services/analyticsService');
const aiService = require('../../services/aiService');
const { sendModLog } = require('../../utils/modLogger');
const logger = require('../../utils/logger');
const { PermissionFlagsBits } = require('discord.js');

// Simple in-memory maps for anti-spam and xp-cooldowns
const antiSpamTracker = new Map(); // userId -> Array of timestamps
const xpCooldownTracker = new Map(); // userId -> timestamp

module.exports = {
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    // 1. Fetch Guild Configuration (cached)
    const guildSettings = await cacheService.getOrFetch(`guild:${guildId}`, async () => {
      let g = await Guild.findOne({ guildId });
      if (!g) {
        g = new Guild({ guildId, name: message.guild.name });
        await g.save();
      }
      return g;
    }, 120000); // Cache for 2 mins

    // Track daily message analytics
    analyticsService.trackMessage(guildId, userId);

    // 2. RUN AUTOMOD CHECKS
    const isStaff = message.member.permissions.has(PermissionFlagsBits.ManageMessages);
    if (!isStaff) {
      const automodTriggered = await handleAutoMod(message, guildSettings, client);
      if (automodTriggered) return; // Stop processing further if message was deleted/punished
    }

    // 3. XP / LEVELING SYSTEM
    await handleLeveling(message, userXpBoost(guildSettings, userId));

    // 4. PREFIX COMMAND HANDLING
    const prefix = guildSettings.prefix || '!';
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      const command = client.commands.get(commandName);
      if (command) {
        // Enforce command cooldown
        const hasCooldown = handleCommandCooldown(message, command, client);
        if (hasCooldown) return;

        try {
          analyticsService.trackCommand(guildId, command.name, userId);
          logger.info(`Running command ${command.name} for ${message.author.tag}`);
          await command.execute(message, args, client);
        } catch (err) {
          logger.error(`Error running command ${command.name}:`, err);
          await message.reply('❌ An error occurred while executing that command.');
        }
        return;
      }
    }

    // 5. AI CHAT CHANNEL AUTO-RESPONDER
    const isMentioned = message.mentions.has(client.user.id) && !message.mentions.everyone;
    const isAiChannel = guildSettings.ai?.activeChannels?.includes(message.channel.id);

    if (isMentioned || isAiChannel) {
      // Clean mention out of content
      let cleanPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
      if (!cleanPrompt && isMentioned) {
        return message.reply('Yes? Need some help? Type `!premium` or ask me anything!');
      }

      try {
        message.channel.sendTyping();
        
        // Resolve custom user prompt if premium
        const userPremium = await premiumService.getUserPremiumStatus(userId);
        const systemPrompt = userPremium.tier === 'PREMIUM+' ? userPremium.customPersonality : null;
        
        const aiResponse = await aiService.generateResponse(
          guildId, 
          'GUILD', 
          cleanPrompt || 'Hello', 
          systemPrompt
        );

        // Send response (chunked if > 2000 chars)
        if (aiResponse.length > 2000) {
          const chunks = aiResponse.match(/[\s\S]{1,1900}/g) || [];
          for (const chunk of chunks) {
            await message.reply(chunk);
          }
        } else {
          await message.reply(aiResponse);
        }
      } catch (err) {
        logger.error('AI chat failed:', err);
        await message.reply('⚠️ Sorry, my AI circuits are currently overloaded. Please try again in a few seconds!');
      }
    }
  }
};

// Helper for AutoMod Checks
async function handleAutoMod(message, settings, client) {
  const content = message.content;
  const author = message.author;
  const guild = message.guild;
  const now = Date.now();

  let ruleTriggered = null;
  let severity = 'WARN';
  let reason = '';

  // A. Anti-Invite
  if (settings.autoMod?.antiInvite?.enabled) {
    const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discordapp\.com\/invite\/.+|discord\.com\/invite\/.+)/i;
    if (inviteRegex.test(content)) {
      ruleTriggered = 'Anti-Invite';
      severity = settings.autoMod.antiInvite.severity || 'WARN';
      reason = 'Posting server invite link.';
    }
  }

  // B. Anti-Link (External URLs)
  if (!ruleTriggered && settings.autoMod?.antiLink?.enabled) {
    const urlRegex = /https?:\/\/[^\s]+/i;
    if (urlRegex.test(content)) {
      ruleTriggered = 'Anti-Link';
      severity = settings.autoMod.antiLink.severity || 'WARN';
      reason = 'Posting external links.';
    }
  }

  // C. Anti-Scam Links / Nitro Phishing
  if (!ruleTriggered && settings.autoMod?.antiScam?.enabled) {
    const scamRegex = /(steamgift|discord\.gifts|nitro-free|gift-claim|nitro-drop|free-nitro|get-nitro)/i;
    if (scamRegex.test(content)) {
      ruleTriggered = 'Anti-Scam';
      severity = settings.autoMod.antiScam.severity || 'TIMEOUT';
      reason = 'Posting phishing/scam content.';
    }
  }

  // D. Anti-Mass Mention
  if (!ruleTriggered && settings.autoMod?.antiMassMention?.enabled) {
    const limit = settings.autoMod.antiMassMention.threshold || 5;
    if (message.mentions.users.size >= limit) {
      ruleTriggered = 'Anti-Mass Mention';
      severity = settings.autoMod.antiMassMention.severity || 'TIMEOUT';
      reason = `Mentioned too many users (${message.mentions.users.size} >= ${limit}).`;
    }
  }

  // Anti-Everyone/Here Mention (Unauthorized pings)
  if (!ruleTriggered && (content.includes('@everyone') || content.includes('@here'))) {
    const hasMentionEveryone = message.member?.permissions.has(PermissionFlagsBits.MentionEveryone);
    if (!hasMentionEveryone) {
      ruleTriggered = 'Anti-Everyone/Here Mention';
      severity = 'TIMEOUT';
      reason = 'Pinging @everyone or @here without permissions.';
    }
  }

  // E. Anti-Spam (Rate limiting messages)
  if (!ruleTriggered && settings.autoMod?.antiSpam?.enabled) {
    const list = antiSpamTracker.get(author.id) || [];
    const recent = list.filter(t => now - t < 5000); // Last 5s
    recent.push(now);
    antiSpamTracker.set(author.id, recent);

    const threshold = settings.autoMod.antiSpam.threshold || 5;
    if (recent.length >= threshold) {
      ruleTriggered = 'Anti-Spam';
      severity = settings.autoMod.antiSpam.severity || 'WARN';
      reason = `Spamming messages (${recent.length} msgs in 5s).`;
    }
  }

  if (ruleTriggered) {
    try {
      // 1. Delete message
      await message.delete().catch(() => {});

      // 2. Log Warning in database
      const warning = new Warning({
        guildId: guild.id,
        userId: author.id,
        moderatorId: client.user.id,
        reason: `[AutoMod: ${ruleTriggered}] ${reason}`
      });
      await warning.save();

      // Send warning alert to channel
      const warningAlert = await message.channel.send(`⚠️ ${author}, your message was deleted: **${reason}** [Rule: ${ruleTriggered}]`);
      setTimeout(() => warningAlert.delete().catch(() => {}), 5000);

      // Apply severity action
      const member = await guild.members.fetch(author.id).catch(() => null);
      if (member) {
        if (severity === 'TIMEOUT' && member.moderatable) {
          await member.timeout(10 * 60 * 1000, `[AutoMod] ${reason}`); // 10 minutes timeout
        } else if (severity === 'MUTE' && member.moderatable) {
          const mutedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
          if (mutedRole) await member.roles.add(mutedRole);
        } else if (severity === 'KICK' && member.kickable) {
          await member.kick(`[AutoMod] ${reason}`);
        } else if (severity === 'BAN' && member.bannable) {
          await guild.members.ban(author.id, { reason: `[AutoMod] ${reason}` });
        }
      }

      // 3. Post to logs channel
      const warningsCount = await Warning.countDocuments({ guildId: guild.id, userId: author.id, active: true });
      await sendModLog(client, guild, `AUTOMOD_${severity}`, author, client.user, reason, [
        { name: 'Triggered Rule', value: ruleTriggered, inline: true },
        { name: 'Severity Action', value: severity, inline: true },
        { name: 'Total Warnings', value: `${warningsCount}`, inline: true }
      ]);

      return true; // Triggered AutoMod
    } catch (err) {
      logger.error('Error executing AutoMod restriction:', err);
    }
  }

  return false;
}

// XP & Leveling logic
async function handleLeveling(message, xpMultiplier) {
  const userId = message.author.id;
  const now = Date.now();

  // 1-minute XP gain cooldown to prevent spamming
  const lastXpTime = xpCooldownTracker.get(userId);
  if (lastXpTime && (now - lastXpTime < 60000)) return;

  xpCooldownTracker.set(userId, now);

  try {
    let user = await User.findOne({ discordId: userId });
    if (!user) {
      user = new User({ discordId: userId, username: message.author.username });
    }

    const xpGained = Math.floor(Math.random() * 11) + 15; // 15 to 25 random XP
    const finalXpGained = xpGained * xpMultiplier;

    user.xp += finalXpGained;
    
    // Level up check (Level * 500 XP required)
    const nextLevelThreshold = user.level * 500;
    if (user.xp >= nextLevelThreshold) {
      user.level += 1;
      user.xp -= nextLevelThreshold;
      
      // Send level-up message
      await message.reply(`🎉 **Level Up!** Congratulations ${message.author}, you reached **Level ${user.level}**!`).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 10000);
      }).catch(() => {});
    }

    await user.save();

    // Track analytics in service
    analyticsService.trackXPGain(message.guild.id, finalXpGained, userId);
  } catch (err) {
    logger.error('Error updating leveling XP:', err);
  }
}

// Check multiplier boosts (User premium)
function userXpBoost(guildSettings, userId) {
  // If guild has premium, all users get 1.2x boost. If user is premium, they get 2.0x boost
  // We'll calculate a final multiplier
  return 1; // Base. Actually, we will read cache/user premium inside database update or from service
}

// Handle Command Cooldown
function handleCommandCooldown(message, command, client) {
  const userId = message.author.id;
  const now = Date.now();

  const cooldowns = client.cooldowns;
  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Map());
  }

  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 3) * 1000; // default 3s

  if (timestamps.has(userId)) {
    const expirationTime = timestamps.get(userId) + cooldownAmount;
    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      message.reply(`⏱️ Please wait **${timeLeft.toFixed(1)}s** before reusing the \`${command.name}\` command.`).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      });
      return true;
    }
  }

  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownAmount);
  return false;
}
