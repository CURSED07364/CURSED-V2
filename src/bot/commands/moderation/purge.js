const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

module.exports = {
  name: 'purge',
  description: 'Bulk delete messages from the current channel.',
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages from the current channel.')
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction, args, client) {
    try {
      const moderator = interaction.member;
      const channel = interaction.channel;

      // 1. Cooldown check
      const cooldown = cooldownService.check(moderator.id, 'purge');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        return interaction.reply({ content: `⏱️ Please wait ${seconds}s before using this command again.`, ephemeral: true });
      }

      // 2. Extract options
      const amount = interaction.options.getInteger('amount');
      const filterUser = interaction.options.getUser('user');

      await interaction.deferReply({ ephemeral: true });

      // 3. Fetch and optionally filter messages
      let messages = await channel.messages.fetch({ limit: filterUser ? 100 : amount });

      if (filterUser) {
        messages = messages.filter(m => m.author.id === filterUser.id).first(amount);
      }

      const deleted = await channel.bulkDelete(messages, true);

      // 4. Set cooldown
      cooldownService.set(moderator.id, 'purge', 5000);

      await interaction.editReply({ content: `🧹 Successfully deleted **${deleted.size}** message(s).` });

      // Auto-delete the ephemeral reply after 5s
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    } catch (err) {
      await handleCommandError(err, interaction, 'purge');
    }
  }
};
