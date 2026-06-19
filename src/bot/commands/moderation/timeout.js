const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const caseService = require('../../../services/caseService');
const loggingService = require('../../../services/loggingService');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

module.exports = {
  name: 'timeout',
  description: 'Timeout a member in the server.',
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to timeout').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d — max 28d)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const moderator = interaction.member;

      // 1. Cooldown check
      const cooldown = cooldownService.check(moderator.id, 'timeout');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        return interaction.reply({ content: `⏱️ Please wait ${seconds}s before using this command again.`, ephemeral: true });
      }

      // 2. Extract options
      const targetUser = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
      }

      const durationMs = parseDuration(durationStr);
      if (!durationMs) {
        return interaction.reply({ content: '❌ Invalid duration format. Use e.g. `10m`, `2h`, `1d`.', ephemeral: true });
      }

      // Discord max timeout is 28 days
      const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000;
      if (durationMs > MAX_TIMEOUT) {
        return interaction.reply({ content: '❌ Timeout duration cannot exceed 28 days.', ephemeral: true });
      }

      // 3. Validate
      const validation = await validateModeration(moderator, targetMember, guild, 'TIMEOUT');
      if (!validation.valid) {
        return interaction.reply({ content: validation.reason, ephemeral: true });
      }

      // 4. Execute timeout
      await targetMember.timeout(durationMs, reason);

      // 5. Create case
      const caseData = await caseService.createCase(guild.id, targetUser.id, moderator.id, 'TIMEOUT', reason, durationMs);

      // 6. Set cooldown
      cooldownService.set(moderator.id, 'timeout', 3000);

      // 7. DM user
      const dmEmbed = new EmbedBuilder()
        .setTitle(`⏱️ Timed Out in ${guild.name}`)
        .setDescription(`You have been timed out for **${durationStr}**.\nReason: **${reason}**`)
        .setColor('#FFA500')
        .setTimestamp();
      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

      // 8. Log
      await loggingService.logModeration(guild, 'TIMEOUT', targetUser, moderator.user, reason, caseData.caseId);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ User Timed Out')
            .addFields(
              { name: 'User', value: `${targetUser.tag}`, inline: true },
              { name: 'Duration', value: durationStr, inline: true },
              { name: 'Case', value: `#${caseData.caseId}`, inline: true },
              { name: 'Reason', value: reason }
            )
            .setColor('#FFA500')
            .setTimestamp()
        ]
      });
    } catch (err) {
      await handleCommandError(err, interaction, 'timeout');
    }
  }
};
