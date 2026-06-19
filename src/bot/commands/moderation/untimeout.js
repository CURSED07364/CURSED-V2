const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const caseService = require('../../../services/caseService');
const loggingService = require('../../../services/loggingService');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

module.exports = {
  name: 'untimeout',
  description: 'Remove a timeout from a member.',
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a timeout from a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to remove timeout from').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for removing the timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const moderator = interaction.member;

      // 1. Cooldown check
      const cooldown = cooldownService.check(moderator.id, 'untimeout');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        return interaction.reply({ content: `⏱️ Please wait ${seconds}s before using this command again.`, ephemeral: true });
      }

      // 2. Extract options
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
      }

      if (!targetMember.isCommunicationDisabled()) {
        return interaction.reply({ content: '❌ This user is not currently timed out.', ephemeral: true });
      }

      // 3. Validate
      const validation = await validateModeration(moderator, targetMember, guild, 'TIMEOUT');
      if (!validation.valid) {
        return interaction.reply({ content: validation.reason, ephemeral: true });
      }

      // 4. Remove timeout
      await targetMember.timeout(null, reason);

      // 5. Set cooldown
      cooldownService.set(moderator.id, 'untimeout', 3000);

      // 6. Log (no case created for untimeout — it's a reversal)
      await loggingService.logModeration(guild, 'UNWARN', targetUser, moderator.user, `Timeout removed: ${reason}`, 0);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Timeout Removed')
            .addFields(
              { name: 'User', value: `${targetUser.tag}`, inline: true },
              { name: 'Reason', value: reason }
            )
            .setColor('#00FF00')
            .setTimestamp()
        ]
      });
    } catch (err) {
      await handleCommandError(err, interaction, 'untimeout');
    }
  }
};
