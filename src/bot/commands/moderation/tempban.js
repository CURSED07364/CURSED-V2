const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const caseService = require('../../../services/caseService');
const loggingService = require('../../../services/loggingService');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

function parseDuration(str) {
  const match = str.match(/^(\d+)([mhd])$/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

module.exports = {
  name: 'tempban',
  description: 'Temporarily ban a user from the server.',
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a user from the server.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to tempban').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 1h, 7d, 30d)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the tempban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const moderator = interaction.member;

      // 1. Cooldown check
      const cooldown = cooldownService.check(moderator.id, 'tempban');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        return interaction.reply({ content: `⏱️ Please wait ${seconds}s before using this command again.`, ephemeral: true });
      }

      // 2. Extract options
      const targetUser = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      const durationMs = parseDuration(durationStr);
      if (!durationMs) {
        return interaction.reply({ content: '❌ Invalid duration format. Use e.g. `1h`, `7d`, `30d`.', ephemeral: true });
      }

      if (targetMember) {
        const validation = await validateModeration(moderator, targetMember, guild, 'BAN');
        if (!validation.valid) {
          return interaction.reply({ content: validation.reason, ephemeral: true });
        }
        if (!targetMember.bannable) {
          return interaction.reply({ content: '❌ I cannot ban this user.', ephemeral: true });
        }
      }

      // 3. DM before ban
      const expiresAt = new Date(Date.now() + durationMs);
      const dmEmbed = new EmbedBuilder()
        .setTitle(`🔨 Temporarily Banned from ${guild.name}`)
        .setDescription(`You have been temporarily banned for: **${reason}**\nBan expires: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`)
        .setColor('#FF0000')
        .setTimestamp();
      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

      // 4. Execute ban
      await guild.members.ban(targetUser.id, { reason: `[Tempban ${durationStr}] ${reason}` });

      // 5. Create case
      const caseData = await caseService.createCase(guild.id, targetUser.id, moderator.id, 'BAN', `[Tempban ${durationStr}] ${reason}`, durationMs);

      // 6. Schedule unban
      setTimeout(async () => {
        try {
          await guild.members.unban(targetUser.id, `Tempban expired (${durationStr})`);
          await caseService.deactivateCase(guild.id, caseData.caseId);
        } catch (err) {
          // User may have already been unbanned manually
        }
      }, durationMs);

      // 7. Set cooldown
      cooldownService.set(moderator.id, 'tempban', 3000);

      // 8. Log
      await loggingService.logModeration(guild, 'BAN', targetUser, moderator.user, `[Tempban ${durationStr}] ${reason}`, caseData.caseId);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ User Temporarily Banned')
            .addFields(
              { name: 'User', value: `${targetUser.tag}`, inline: true },
              { name: 'Duration', value: durationStr, inline: true },
              { name: 'Case', value: `#${caseData.caseId}`, inline: true },
              { name: 'Expires', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true },
              { name: 'Reason', value: reason }
            )
            .setColor('#FF0000')
            .setTimestamp()
        ]
      });
    } catch (err) {
      await handleCommandError(err, interaction, 'tempban');
    }
  }
};
