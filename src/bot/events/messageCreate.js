const Guild = require('../../database/models/Guild');
const Warning = require('../../database/models/Warning');
const cacheService = require('../../services/cacheService');
const autoModService = require('../../services/autoModService');
const caseService = require('../../services/caseService');
const loggingService = require('../../services/loggingService');
const logger = require('../../utils/logger');
const { PermissionFlagsBits } = require('discord.js');

module.exports = {
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;

    // 1. Fetch Guild Configuration (cached for 2 minutes)
    const guildSettings = await cacheService.getOrFetch(`guild:${guildId}`, async () => {
      let g = await Guild.findOne({ guildId });
      if (!g) {
        g = new Guild({ guildId, name: message.guild.name });
        await g.save();
      }
      return g;
    }, 120000);

    // 2. AutoMod checks (skip for staff with ManageMessages)
    const isStaff = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);
    if (!isStaff) {
      const triggered = await handleAutoMod(message, guildSettings, client);
      if (triggered) return;
    }

    // 3. Prefix command handling
    const prefix = guildSettings.prefix || '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (!command) return;

    try {
      logger.info(`Running prefix command ${command.name} for ${message.author.tag}`);
      await command.execute(message, args, client);
    } catch (err) {
      logger.error(`Error running command ${command.name}:`, err);
      await message.reply('❌ An error occurred while executing that command.').catch(() => {});
    }
  }
};

/**
 * Run automod checks via autoModService and apply the triggered action.
 * Returns true if a rule was triggered (so the caller can stop processing).
 */
async function handleAutoMod(message, settings, client) {
  const result = await autoModService.checkMessage(message, settings);
  if (!result) return false;

  const { rule, action, reason, duration } = result;
  const author = message.author;
  const guild = message.guild;

  try {
    // 1. Delete the offending message
    await message.delete().catch(() => {});

    // 2. Warn the user in the channel (auto-deletes after 5s)
    const alert = await message.channel.send(
      `⚠️ ${author}, your message was removed: **${reason}** [Rule: ${rule}]`
    ).catch(() => null);
    if (alert) setTimeout(() => alert.delete().catch(() => {}), 5000);

    // 3. Apply the configured action
    const member = await guild.members.fetch(author.id).catch(() => null);
    if (member) {
      if (action === 'TIMEOUT' && member.moderatable) {
        await member.timeout(duration || 10 * 60 * 1000, `[AutoMod: ${rule}] ${reason}`);
      } else if (action === 'KICK' && member.kickable) {
        await member.kick(`[AutoMod: ${rule}] ${reason}`);
      } else if (action === 'BAN' && member.bannable) {
        await guild.members.ban(author.id, { reason: `[AutoMod: ${rule}] ${reason}` });
      }
    }

    // 4. Save a warning record
    const warning = new Warning({
      guildId: guild.id,
      userId: author.id,
      moderatorId: client.user.id,
      reason: `[AutoMod: ${rule}] ${reason}`
    });
    await warning.save();

    // 5. Log to mod channel
    await loggingService.logAutoMod(guild, author, rule, action, reason, message.channel.id);

    // 6. Track automod stat
    await caseService.trackAutoModAction(guild.id);

    // 7. Persist to AutoModLog
    await autoModService.logAction(guild.id, author.id, rule, action, reason, message.id, message.channel.id);

    return true;
  } catch (err) {
    logger.error('AutoMod execution error:', err);
    return false;
  }
}
