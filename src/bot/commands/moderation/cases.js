const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const caseService = require('../../../services/caseService');
const { handleCommandError } = require('../../../utils/errorHandler');

const ACTION_EMOJIS = {
  WARN: '⚠️',
  TIMEOUT: '⏱️',
  KICK: '👢',
  BAN: '🔨',
  SOFTBAN: '🔨',
  UNBAN: '✅',
  UNWARN: '✅'
};

module.exports = {
  name: 'cases',
  description: "View a user's moderation history.",
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription("View a user's moderation history.")
    .addUserOption(opt => opt.setName('user').setDescription('The user to look up').setRequired(true))
    .addStringOption(opt =>
      opt.setName('filter')
        .setDescription('Filter by action type')
        .addChoices(
          { name: 'All', value: 'ALL' },
          { name: 'Warnings', value: 'WARN' },
          { name: 'Bans', value: 'BAN' },
          { name: 'Kicks', value: 'KICK' },
          { name: 'Timeouts', value: 'TIMEOUT' }
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const targetUser = interaction.options.getUser('user');
      const filter = interaction.options.getString('filter') || 'ALL';

      let cases = await caseService.getUserCases(guild.id, targetUser.id);

      if (filter !== 'ALL') {
        cases = cases.filter(c => c.action === filter);
      }

      if (cases.length === 0) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`📋 Cases for ${targetUser.tag}`)
              .setDescription('No moderation cases found.')
              .setColor('#808080')
              .setTimestamp()
          ]
        });
      }

      // Show up to 10 most recent cases
      const displayCases = cases.slice(0, 10);
      const caseLines = displayCases.map(c => {
        const emoji = ACTION_EMOJIS[c.action] || '🛡️';
        const status = c.active ? '' : ' ~~(inactive)~~';
        const ts = `<t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:d>`;
        return `${emoji} **#${c.caseId}** ${c.action}${status} — ${ts}\n> ${c.reason.substring(0, 80)}`;
      }).join('\n\n');

      const activeCases = cases.filter(c => c.active);
      const warnCount = activeCases.filter(c => c.action === 'WARN').length;
      const banCount = activeCases.filter(c => c.action === 'BAN').length;
      const kickCount = activeCases.filter(c => c.action === 'KICK').length;
      const timeoutCount = activeCases.filter(c => c.action === 'TIMEOUT').length;

      const embed = new EmbedBuilder()
        .setTitle(`📋 Cases for ${targetUser.tag}`)
        .setDescription(caseLines)
        .addFields(
          { name: 'Total Cases', value: `${cases.length}`, inline: true },
          { name: 'Active Warnings', value: `${warnCount}`, inline: true },
          { name: 'Bans', value: `${banCount}`, inline: true },
          { name: 'Kicks', value: `${kickCount}`, inline: true },
          { name: 'Timeouts', value: `${timeoutCount}`, inline: true }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setColor('#6c35de')
        .setFooter({ text: cases.length > 10 ? `Showing 10 of ${cases.length} cases` : `${cases.length} total case(s)` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      await handleCommandError(err, interaction, 'cases');
    }
  }
};
