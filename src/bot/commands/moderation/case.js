const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const caseService = require('../../../services/caseService');
const { handleCommandError } = require('../../../utils/errorHandler');

const ACTION_COLORS = {
  WARN: '#FFFF00',
  TIMEOUT: '#FFA500',
  KICK: '#FF6600',
  BAN: '#FF0000',
  SOFTBAN: '#FF3300',
  UNBAN: '#00FF00',
  UNWARN: '#00FF00'
};

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
  name: 'case',
  description: 'View details of a specific moderation case.',
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('View details of a specific moderation case.')
    .addIntegerOption(opt => opt.setName('case_id').setDescription('The case ID to look up').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const caseId = interaction.options.getInteger('case_id');

      const caseData = await caseService.getCase(guild.id, caseId);
      if (!caseData) {
        return interaction.reply({ content: `❌ Case #${caseId} not found in this server.`, ephemeral: true });
      }

      const targetUser = await client.users.fetch(caseData.userId).catch(() => null);
      const moderatorUser = await client.users.fetch(caseData.moderatorId).catch(() => null);

      const emoji = ACTION_EMOJIS[caseData.action] || '🛡️';
      const color = ACTION_COLORS[caseData.action] || '#808080';

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} Case #${caseData.caseId} — ${caseData.action}`)
        .addFields(
          { name: 'User', value: targetUser ? `${targetUser.tag} (${caseData.userId})` : caseData.userId, inline: true },
          { name: 'Moderator', value: moderatorUser ? `${moderatorUser.tag}` : caseData.moderatorId, inline: true },
          { name: 'Status', value: caseData.active ? '🟢 Active' : '🔴 Inactive', inline: true },
          { name: 'Reason', value: caseData.reason }
        )
        .setColor(color)
        .setTimestamp(caseData.createdAt);

      if (caseData.duration) {
        const expiresAt = caseData.expiresAt;
        embed.addFields({
          name: 'Expires',
          value: expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : 'N/A',
          inline: true
        });
      }

      if (caseData.notes && caseData.notes.length > 0) {
        const notesText = caseData.notes
          .slice(-3) // Show last 3 notes
          .map(n => `<@${n.moderatorId}>: ${n.content}`)
          .join('\n');
        embed.addFields({ name: `Notes (${caseData.notes.length})`, value: notesText.substring(0, 1024) });
      }

      if (caseData.appealStatus !== 'NONE') {
        embed.addFields({
          name: 'Appeal',
          value: `Status: **${caseData.appealStatus}**${caseData.appealReason ? `\nReason: ${caseData.appealReason}` : ''}`,
        });
      }

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      await handleCommandError(err, interaction, 'case');
    }
  }
};
