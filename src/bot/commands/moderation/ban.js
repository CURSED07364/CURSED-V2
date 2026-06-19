const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const caseService = require('../../../services/caseService');
const loggingService = require('../../../services/loggingService');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

module.exports = {
  name: 'ban',
  description: 'Ban a member from the server.',
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .addIntegerOption(opt => opt.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const moderator = interaction.member;

      // 1. Cooldown check
      const cooldown = cooldownService.check(moderator.id, 'ban');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        return interaction.reply({ content: `⏱️ Please wait ${seconds}s before using this command again.`, ephemeral: true });
      }

      // 2. Extract options
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetUser) {
        return interaction.reply({ content: '❌ User not found.', ephemeral: true });
      }

      // 3. Validate (only if member is still in server)
      if (targetMember) {
        const validation = await validateModeration(moderator, targetMember, guild, 'BAN');
        if (!validation.valid) {
          return interaction.reply({ content: validation.reason, ephemeral: true });
        }
        if (!targetMember.bannable) {
          return interaction.reply({ content: '❌ I cannot ban this user.', ephemeral: true });
        }
      }

      // 4. DM before ban
      const dmEmbed = new EmbedBuilder()
        .setTitle(`🔨 Banned from ${guild.name}`)
        .setDescription(`You have been banned for: **${reason}**`)
        .setColor('#FF0000')
        .setTimestamp();
      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

      // 5. Execute ban
      await guild.members.ban(targetUser.id, { reason, deleteMessageDays: deleteDays });

      // 6. Create case
      const caseData = await caseService.createCase(guild.id, targetUser.id, moderator.id, 'BAN', reason);

      // 7. Set cooldown
      cooldownService.set(moderator.id, 'ban', 3000);

      // 8. Log
      await loggingService.logModeration(guild, 'BAN', targetUser, moderator.user, reason, caseData.caseId);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ User Banned')
            .addFields(
              { name: 'User', value: `${targetUser.tag}`, inline: true },
              { name: 'Case', value: `#${caseData.caseId}`, inline: true },
              { name: 'Reason', value: reason }
            )
            .setColor('#FF0000')
            .setTimestamp()
        ]
      });
    } catch (err) {
      await handleCommandError(err, interaction, 'ban');
    }
  }
};
