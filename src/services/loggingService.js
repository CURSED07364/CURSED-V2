const { EmbedBuilder } = require('discord.js');
const Guild = require('../database/models/Guild');
const logger = require('../utils/logger');

/**
 * Centralized logging service for moderation actions and server events.
 * All methods are safe to call without awaiting — errors are caught internally.
 */
class LoggingService {
  /**
   * Fetch the log channel for a guild, or null if not configured.
   */
  async getLogChannel(guild) {
    try {
      const guildSettings = await Guild.findOne({ guildId: guild.id }).lean();
      if (!guildSettings?.logChannelId) return null;

      const channel = guild.channels.cache.get(guildSettings.logChannelId);
      return channel || null;
    } catch (err) {
      logger.error('LoggingService.getLogChannel error:', err);
      return null;
    }
  }

  /**
   * Log a moderation action (warn, ban, kick, timeout, etc.).
   */
  async logModeration(guild, action, targetUser, moderator, reason, caseId) {
    try {
      const channel = await this.getLogChannel(guild);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${action} | Case #${caseId}`)
        .addFields(
          { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
          { name: 'Reason', value: reason || 'No reason provided' }
        )
        .setColor(this.getActionColor(action))
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error('LoggingService.logModeration error:', err);
    }
  }

  /**
   * Log a deleted message.
   */
  async logMessageDelete(guild, message) {
    try {
      const guildSettings = await Guild.findOne({ guildId: guild.id }).lean();
      if (!guildSettings?.logChannelId || guildSettings.logMessageDeletes === false) return;

      const channel = guild.channels.cache.get(guildSettings.logChannelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted')
        .addFields(
          { name: 'Author', value: `${message.author.tag} (${message.author.id})`, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Content', value: (message.content || '*(empty)*').substring(0, 1024) }
        )
        .setColor('#FF0000')
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error('LoggingService.logMessageDelete error:', err);
    }
  }

  /**
   * Log an edited message.
   */
  async logMessageEdit(guild, oldMessage, newMessage) {
    try {
      if (oldMessage.content === newMessage.content) return;

      const guildSettings = await Guild.findOne({ guildId: guild.id }).lean();
      if (!guildSettings?.logChannelId || guildSettings.logMessageEdits === false) return;

      const channel = guild.channels.cache.get(guildSettings.logChannelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('✏️ Message Edited')
        .addFields(
          { name: 'Author', value: `${newMessage.author.tag} (${newMessage.author.id})`, inline: true },
          { name: 'Channel', value: `<#${newMessage.channel.id}>`, inline: true },
          { name: 'Before', value: (oldMessage.content || '*(empty)*').substring(0, 512) },
          { name: 'After', value: (newMessage.content || '*(empty)*').substring(0, 512) }
        )
        .setColor('#FFA500')
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error('LoggingService.logMessageEdit error:', err);
    }
  }

  /**
   * Log a member joining the server.
   */
  async logMemberJoin(guild, member) {
    try {
      const guildSettings = await Guild.findOne({ guildId: guild.id }).lean();
      if (!guildSettings?.logChannelId || guildSettings.logMemberJoins === false) return;

      const channel = guild.channels.cache.get(guildSettings.logChannelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('📥 Member Joined')
        .addFields(
          { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
          { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setColor('#00FF00')
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error('LoggingService.logMemberJoin error:', err);
    }
  }

  /**
   * Log a member leaving the server.
   */
  async logMemberLeave(guild, user) {
    try {
      const guildSettings = await Guild.findOne({ guildId: guild.id }).lean();
      if (!guildSettings?.logChannelId || guildSettings.logMemberLeaves === false) return;

      const channel = guild.channels.cache.get(guildSettings.logChannelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle('📤 Member Left')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setColor('#FF0000')
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error('LoggingService.logMemberLeave error:', err);
    }
  }

  /**
   * Log an automod action.
   */
  async logAutoMod(guild, targetUser, rule, action, reason, channelId = null) {
    try {
      const channel = await this.getLogChannel(guild);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle(`🤖 AutoMod: ${rule}`)
        .addFields(
          { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
          { name: 'Action', value: action, inline: true },
          { name: 'Reason', value: reason },
          ...(channelId ? [{ name: 'Channel', value: `<#${channelId}>`, inline: true }] : [])
        )
        .setColor('#FF6600')
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error('LoggingService.logAutoMod error:', err);
    }
  }

  /**
   * Returns a hex color string for a given moderation action.
   */
  getActionColor(action) {
    const colors = {
      WARN: '#FFFF00',
      TIMEOUT: '#FFA500',
      KICK: '#FF6600',
      BAN: '#FF0000',
      SOFTBAN: '#FF3300',
      UNBAN: '#00FF00',
      UNWARN: '#00FF00'
    };
    return colors[action] || '#808080';
  }
}

module.exports = new LoggingService();
