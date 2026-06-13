const logger = require('../../utils/logger');

module.exports = {
  once: false,
  async execute(interaction, client) {
    // 1. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const commandName = interaction.commandName;
      const command = client.slashCommands.get(commandName);

      if (!command) return;

      try {
        logger.info(`Running slash command /${commandName} for ${interaction.user.tag}`);
        await command.execute(interaction, [], client);
      } catch (err) {
        logger.error(`Slash command error: /${commandName}:`, err);
        const reply = { content: '❌ An error occurred while executing this command.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    }

    // 2. Handle Button Interactions
    if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId === 'close_ticket_btn') {
        const closeTicketCmd = require('../commands/ticket/closeticket');
        try {
          // Fake message context for the command
          const fakeMessage = {
            channel: interaction.channel,
            guild: interaction.guild,
            author: interaction.user,
            client: client,
            reply: async (payload) => {
              if (interaction.replied || interaction.deferred) {
                return interaction.followUp(payload);
              }
              return interaction.reply(payload);
            }
          };

          await closeTicketCmd.execute(fakeMessage, [], client);
        } catch (err) {
          logger.error('Failed to close ticket via button click:', err);
          await interaction.reply({ content: `❌ Error closing ticket: ${err.message}`, ephemeral: true }).catch(() => {});
        }
      }
    }
  }
};
