const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const caseService = require('../../../services/caseService');
const loggingService = require('../../../services/loggingService');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

module.exports = {
  name: 'unban',
  description: 'Unban a user from the server.',
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server.')
    .addStringOption(opt => opt.setName('user_id').setDescription('The Discord user ID to unban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the unban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const moderator = interaction.member;

      // 1. Cooldown check
      const cooldown = cooldownService.check(moderator.id, 'unban');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        return interaction.reply({ content: `⏱️ Please wait ${seconds}s before using this command again.`, ephemeral: true });
      }

      // 2. Extract options
      const userId = interaction.options.getString('user_id').trim();
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!/^\d{17,20}$/.test(userId)) {
        return interaction.reply({ content: '❌ Invalid user ID. Please provide a valid Discord snowflake.', ephemeral: true });
      }

      // 3. Check if user is actually banned
      const banEntry = await guild.bans.fetch(userId).catch(() => null);
      if (!banEntry) {
        return interaction.reply({ content: '❌ This user is not banned from this server.', ephemeral: true });
      }

      // 4. Execute unban
      await guild.members.unban(userId, reason);

      // 5. Create case
      const caseData = await caseService.createCase(guild.id, userId, moderator.id, 'UNBAN', reason);

      // 6. Set cooldown
      cooldownService.set(moderator.id, 'unban', 3000);

      // 7. Log
      await loggingService.logModeration(guild, 'UNBAN', banEntry.user, moderator.user, reason, caseData.caseId);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ User Unbanned')
            .addFields(
              { name: 'User', value: `${banEntry.user.tag} (${userId})`, inline: true },
              { name: 'Case', value: `#${caseData.caseId}`, inline: true },
              { name: 'Reason', value: reason }
            )
            .setColor('#00FF00')
            .setTimestamp()
        ]
      });
    } catch (err) {
      await handleCommandError(err, interaction, 'unban');
    }
  }
};
