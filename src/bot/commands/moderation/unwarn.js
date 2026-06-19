const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Case = require('../../../database/models/Case');
const Warning = require('../../../database/models/Warning');
const caseService = require('../../../services/caseService');
const loggingService = require('../../../services/loggingService');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

module.exports = {
  name: 'unwarn',
  description: 'Remove a warning from a user.',
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Remove a warning from a user by case ID.')
    .addIntegerOption(opt => opt.setName('case_id').setDescription('The case ID of the warning to remove').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for removing the warning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const moderator = interaction.member;

      // 1. Cooldown check
      const cooldown = cooldownService.check(moderator.id, 'unwarn');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        return interaction.reply({ content: `⏱️ Please wait ${seconds}s before using this command again.`, ephemeral: true });
      }

      // 2. Extract options
      const caseId = interaction.options.getInteger('case_id');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      // 3. Find the case
      const caseData = await Case.findOne({ guildId: guild.id, caseId, action: 'WARN' });
      if (!caseData) {
        return interaction.reply({ content: `❌ Warning case #${caseId} not found in this server.`, ephemeral: true });
      }

      if (!caseData.active) {
        return interaction.reply({ content: `❌ Warning case #${caseId} has already been removed.`, ephemeral: true });
      }

      // 4. Deactivate the case
      await caseService.deactivateCase(guild.id, caseId);

      // 5. Deactivate the legacy warning record
      await Warning.findOneAndUpdate(
        { guildId: guild.id, caseId },
        { $set: { active: false } }
      );

      // 6. Set cooldown
      cooldownService.set(moderator.id, 'unwarn', 3000);

      // 7. Fetch target user for logging
      const targetUser = await client.users.fetch(caseData.userId).catch(() => null);

      if (targetUser) {
        await loggingService.logModeration(guild, 'UNWARN', targetUser, moderator.user, `Removed warning #${caseId}: ${reason}`, caseId);
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Warning Removed')
            .addFields(
              { name: 'Case', value: `#${caseId}`, inline: true },
              { name: 'User', value: targetUser ? targetUser.tag : caseData.userId, inline: true },
              { name: 'Original Reason', value: caseData.reason },
              { name: 'Removal Reason', value: reason }
            )
            .setColor('#00FF00')
            .setTimestamp()
        ]
      });
    } catch (err) {
      await handleCommandError(err, interaction, 'unwarn');
    }
  }
};
