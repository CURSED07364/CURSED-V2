const { EmbedBuilder } = require('discord.js');
const Guild = require('../database/models/Guild');
const logger = require('./logger');

async function sendModLog(client, guild, action, targetUser, moderator, reason, extraFields = []) {
  try {
    const guildSettings = await Guild.findOne({ guildId: guild.id });
    if (!guildSettings || !guildSettings.logChannelId) return;

    const channel = guild.channels.cache.get(guildSettings.logChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ Moderation Log: ${action}`)
      .setColor(
        action === 'BAN' || action === 'KICK' ? '#ff0000' :
        action === 'MUTE' || action === 'TIMEOUT' ? '#ffa500' : '#ffff00' // Red/Orange/Yellow
      )
      .addFields(
        { name: 'Target User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
        { name: 'Reason', value: reason || 'No reason provided.' }
      )
      .setTimestamp();

    if (extraFields && extraFields.length > 0) {
      embed.addFields(extraFields);
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error('Failed to send mod log to channel:', err);
  }
}

module.exports = { sendModLog };
