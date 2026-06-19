const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const caseService = require('../../../services/caseService');
const loggingService = require('../../../services/loggingService');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

module.exports = {
  name: 'softban',
  description: 'Softban a user (ban then immediately unban to delete messages).',
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Softban a user — bans then immediately unbans to purge their messages.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to softban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the softban').setRequired(false))
    .addIntegerOption(opt => opt.setName('delete_days').setDescription('Days of messages to delete (1-7, default 1)').setMinValue(1).setMaxValue(7).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const moderator = interaction.member;

      // 1. Cooldown check
      const cooldown = cooldownService.check(moderator.id, 'softban');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        return interaction.reply({ content: `⏱️ Please wait ${seconds}s before using this command again.`, ephemeral: true });
      }

      // 2. Extract options
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const deleteDays = interaction.options.getInteger('delete_days') ?? 1;
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember) {
        return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
      }

      // 3. Validate
      const validation = await validateModeration(moderator, targetMember, guild, 'SOFTBAN');
      if (!validation.valid) {
        return interaction.reply({ content: validation.reason, ephemeral: true });
      }

      if (!targetMember.bannable) {
        return interaction.reply({ content: '❌ I cannot ban this user.', ephemeral: true });
      }

      // 4. DM before softban
      const dmEmbed = new EmbedBuilder()
        .setTitle(`🔨 Softbanned from ${guild.name}`)
        .setDescription(`You have been softbanned (messages deleted) for: **${reason}**\nYou may rejoin the server.`)
        .setColor('#FF3300')
        .setTimestamp();
      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

      // 5. Ban then immediately unban
      await guild.members.ban(targetUser.id, { reason: `[Softban] ${reason}`, deleteMessageDays: deleteDays });
      await guild.members.unban(targetUser.id, `[Softban] ${reason}`);

      // 6. Create case
      const caseData = await caseService.createCase(guild.id, targetUser.id, moderator.id, 'SOFTBAN', reason);

      // 7. Set cooldown
      cooldownService.set(moderator.id, 'softban', 3000);

      // 8. Log
      await loggingService.logModeration(guild, 'SOFTBAN', targetUser, moderator.user, reason, caseData.caseId);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ User Softbanned')
            .addFields(
              { name: 'User', value: `${targetUser.tag}`, inline: true },
              { name: 'Case', value: `#${caseData.caseId}`, inline: true },
              { name: 'Messages Deleted', value: `${deleteDays} day(s)`, inline: true },
              { name: 'Reason', value: reason }
            )
            .setColor('#FF3300')
            .setTimestamp()
        ]
      });
    } catch (err) {
      await handleCommandError(err, interaction, 'softban');
    }
  }
};
