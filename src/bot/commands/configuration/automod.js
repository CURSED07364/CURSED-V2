const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Guild = require('../../../database/models/Guild');
const cacheService = require('../../../services/cacheService');
const { handleCommandError } = require('../../../utils/errorHandler');

const RULE_NAMES = {
  antispam: 'antiSpam',
  antilink: 'antiLink',
  antiinvite: 'antiInvite',
  antiscam: 'antiScam',
  antimassmention: 'antiMassMention',
  antiraid: 'antiRaid'
};

const RULE_LABELS = {
  antiSpam: 'Anti-Spam',
  antiLink: 'Anti-Link',
  antiInvite: 'Anti-Invite',
  antiScam: 'Anti-Scam',
  antiMassMention: 'Anti-Mass Mention',
  antiRaid: 'Anti-Raid'
};

module.exports = {
  name: 'automod',
  description: 'Configure the automod system.',
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure the automod system.')
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable an automod rule.')
        .addStringOption(opt =>
          opt.setName('rule')
            .setDescription('The rule to enable')
            .addChoices(
              { name: 'Anti-Spam', value: 'antispam' },
              { name: 'Anti-Link', value: 'antilink' },
              { name: 'Anti-Invite', value: 'antiinvite' },
              { name: 'Anti-Scam', value: 'antiscam' },
              { name: 'Anti-Mass Mention', value: 'antimassmention' }
            )
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Action to take when triggered')
            .addChoices(
              { name: 'Warn', value: 'WARN' },
              { name: 'Timeout', value: 'TIMEOUT' },
              { name: 'Kick', value: 'KICK' },
              { name: 'Ban', value: 'BAN' }
            )
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('threshold')
            .setDescription('Threshold for spam/mention rules (default: 5)')
            .setMinValue(2)
            .setMaxValue(20)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable an automod rule.')
        .addStringOption(opt =>
          opt.setName('rule')
            .setDescription('The rule to disable')
            .addChoices(
              { name: 'Anti-Spam', value: 'antispam' },
              { name: 'Anti-Link', value: 'antilink' },
              { name: 'Anti-Invite', value: 'antiinvite' },
              { name: 'Anti-Scam', value: 'antiscam' },
              { name: 'Anti-Mass Mention', value: 'antimassmention' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View current automod configuration.')
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

      if (subcommand === 'enable') {
        const ruleKey = interaction.options.getString('rule');
        const ruleField = RULE_NAMES[ruleKey];
        const action = interaction.options.getString('action') || 'WARN';
        const threshold = interaction.options.getInteger('threshold') || 5;

        await Guild.findOneAndUpdate(
          { guildId: guild.id },
          {
            $set: {
              [`autoMod.${ruleField}.enabled`]: true,
              [`autoMod.${ruleField}.action`]: action,
              [`autoMod.${ruleField}.threshold`]: threshold
            }
          }
        );

        cacheService.delete(`guild:${guild.id}`);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ AutoMod Rule Enabled')
              .addFields(
                { name: 'Rule', value: RULE_LABELS[ruleField], inline: true },
                { name: 'Action', value: action, inline: true },
                { name: 'Threshold', value: `${threshold}`, inline: true }
              )
              .setColor('#00FF00')
              .setTimestamp()
          ]
        });
      }

      if (subcommand === 'disable') {
        const ruleKey = interaction.options.getString('rule');
        const ruleField = RULE_NAMES[ruleKey];

        await Guild.findOneAndUpdate(
          { guildId: guild.id },
          { $set: { [`autoMod.${ruleField}.enabled`]: false } }
        );

        cacheService.delete(`guild:${guild.id}`);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ AutoMod Rule Disabled')
              .setDescription(`**${RULE_LABELS[ruleField]}** has been disabled.`)
              .setColor('#FF0000')
              .setTimestamp()
          ]
        });
      }

      if (subcommand === 'status') {
        const am = guildSettings.autoMod || {};

        const ruleStatus = (rule) => {
          const r = am[rule];
          if (!r || !r.enabled) return '❌ Disabled';
          return `✅ ${r.action || 'WARN'}${r.threshold ? ` (threshold: ${r.threshold})` : ''}`;
        };

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🤖 AutoMod Configuration')
              .addFields(
                { name: 'Anti-Spam', value: ruleStatus('antiSpam'), inline: true },
                { name: 'Anti-Link', value: ruleStatus('antiLink'), inline: true },
                { name: 'Anti-Invite', value: ruleStatus('antiInvite'), inline: true },
                { name: 'Anti-Scam', value: ruleStatus('antiScam'), inline: true },
                { name: 'Anti-Mass Mention', value: ruleStatus('antiMassMention'), inline: true }
              )
              .setColor('#6c35de')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
    } catch (err) {
      await handleCommandError(err, interaction, 'automod');
    }
  }
};
