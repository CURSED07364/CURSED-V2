const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const Guild = require('../../../database/models/Guild');
const cacheService = require('../../../services/cacheService');
const { handleCommandError } = require('../../../utils/errorHandler');

module.exports = {
  name: 'logs',
  description: 'Configure the logging channel and logging options.',
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure the logging system.')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set the log channel.')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('The channel to send logs to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable logging.')
    )
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Toggle specific log types.')
        .addStringOption(opt =>
          opt.setName('type')
            .setDescription('The log type to toggle')
            .addChoices(
              { name: 'Message Deletes', value: 'logMessageDeletes' },
              { name: 'Message Edits', value: 'logMessageEdits' },
              { name: 'Member Joins', value: 'logMemberJoins' },
              { name: 'Member Leaves', value: 'logMemberLeaves' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View current logging configuration.')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const subcommand = interaction.options.getSubcommand();

      let guildSettings = await Guild.findOne({ guildId: guild.id });
      if (!guildSettings) {
        guildSettings = new Guild({ guildId: guild.id, name: guild.name });
        await guildSettings.save();
      }

      if (subcommand === 'set') {
        const channel = interaction.options.getChannel('channel');

        await Guild.findOneAndUpdate(
          { guildId: guild.id },
          { $set: { logChannelId: channel.id } }
        );

        // Invalidate cache
        cacheService.delete(`guild:${guild.id}`);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Log Channel Set')
              .setDescription(`Moderation logs will now be sent to ${channel}.`)
              .setColor('#00FF00')
              .setTimestamp()
          ]
        });
      }

      if (subcommand === 'disable') {
        await Guild.findOneAndUpdate(
          { guildId: guild.id },
          { $set: { logChannelId: null } }
        );

        cacheService.delete(`guild:${guild.id}`);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Logging Disabled')
              .setDescription('Logging has been disabled for this server.')
              .setColor('#FF0000')
              .setTimestamp()
          ]
        });
      }

      if (subcommand === 'toggle') {
        const logType = interaction.options.getString('type');
        const currentValue = guildSettings[logType] !== false; // default true
        const newValue = !currentValue;

        await Guild.findOneAndUpdate(
          { guildId: guild.id },
          { $set: { [logType]: newValue } }
        );

        cacheService.delete(`guild:${guild.id}`);

        const typeNames = {
          logMessageDeletes: 'Message Deletes',
          logMessageEdits: 'Message Edits',
          logMemberJoins: 'Member Joins',
          logMemberLeaves: 'Member Leaves'
        };

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Log Type Toggled')
              .setDescription(`**${typeNames[logType]}** logging is now **${newValue ? 'enabled' : 'disabled'}**.`)
              .setColor(newValue ? '#00FF00' : '#FF0000')
              .setTimestamp()
          ]
        });
      }

      if (subcommand === 'status') {
        const logChannel = guildSettings.logChannelId
          ? `<#${guildSettings.logChannelId}>`
          : '*(not set)*';

        const bool = v => v !== false ? '✅ Enabled' : '❌ Disabled';

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('📋 Logging Configuration')
              .addFields(
                { name: 'Log Channel', value: logChannel, inline: false },
                { name: 'Message Deletes', value: bool(guildSettings.logMessageDeletes), inline: true },
                { name: 'Message Edits', value: bool(guildSettings.logMessageEdits), inline: true },
                { name: 'Member Joins', value: bool(guildSettings.logMemberJoins), inline: true },
                { name: 'Member Leaves', value: bool(guildSettings.logMemberLeaves), inline: true }
              )
              .setColor('#6c35de')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
    } catch (err) {
      await handleCommandError(err, interaction, 'logs');
    }
  }
};
