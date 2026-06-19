const loggingService = require('../../services/loggingService');
const logger = require('../../utils/logger');

module.exports = {
  once: false,
  async execute(message, client) {
    try {
      // Ignore bot messages and DMs
      if (!message.guild || message.author?.bot) return;

      // Ignore partial messages with no content
      if (!message.author || !message.content) return;

      await loggingService.logMessageDelete(message.guild, message);
    } catch (err) {
      logger.error('messageDelete event error:', err);
    }
  }
};
