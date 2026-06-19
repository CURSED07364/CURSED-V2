const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Warning = require('../../../database/models/Warning');
const Case = require('../../../database/models/Case');
const caseService = require('../../../services/caseService');
const loggingService = require('../../../services/loggingService');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

module.exports = {
  name: 'warn',
  description: 'Warn a user for violating server rules.',
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const moderator = interaction.member;

      // 1. Cooldown check
      const cooldown = cooldownService.check(moderator.id, 'warn');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        return interaction.reply({ content: `⏱️ Please wait ${seconds}s before using this command again.`, ephemeral: true });
      }

      // 2. Extract options
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
      }

      // 3. Permission & hierarchy validation
      const validation = await validateModeration(moderator, targetMember, guild, 'WARN');
      if (!validation.valid) {
        return interaction.reply({ content: validation.reason, ephemeral: true });
      }

      // 4. Create case record
      const caseData = await caseService.createCase(
        guild.id, targetUser.id, moderator.id, 'WARN', reason
      );

      // 5. Save legacy warning record (for backwards compatibility)
      const warning = new Warning({
        guildId: guild.id,
        userId: targetUser.id,
        moderatorId: moderator.id,
        reason,
        caseId: caseData.caseId
      });
      await warning.save();

      // 6. Set cooldown
      cooldownService.set(moderator.id, 'warn', 3000);

      // 7. DM the user
      const dmEmbed = new EmbedBuilder()
        .setTitle(`⚠️ Warning — ${guild.name}`)
        .setDescription(`You have been warned for: **${reason}**\nCase #${caseData.caseId}`)
        .setColor('#FFFF00')
        .setTimestamp();
      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

      // 8. Log to mod channel
      await loggingService.logModeration(guild, 'WARN', targetUser, moderator.user, reason, caseData.caseId);

      // 9. Count active warnings
      const warningsCount = await Case.countDocuments({
        guildId: guild.id,
        userId: targetUser.id,
        action: 'WARN',
        active: true
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ User Warned')
            .addFields(
              { name: 'User', value: `${targetUser.tag}`, inline: true },
              { name: 'Case', value: `#${caseData.caseId}`, inline: true },
              { name: 'Total Warnings', value: `${warningsCount}`, inline: true },
              { name: 'Reason', value: reason }
            )
            .setColor('#FFFF00')
            .setTimestamp()
        ]
      });
    } catch (err) {
      await handleCommandError(err, interaction, 'warn');
    }
  }
};
