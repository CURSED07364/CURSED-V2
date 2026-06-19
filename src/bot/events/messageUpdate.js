const loggingService = require('../../services/loggingService');
const logger = require('../../utils/logger');

module.exports = {
  once: false,
  async execute(oldMessage, newMessage, client) {
    try {
      // Ignore bot messages and DMs
      if (!newMessage.guild || newMessage.author?.bot) return;

      // Ignore partial messages
      if (!newMessage.author) return;

      // Ignore embed-only updates (no content change)
      if (oldMessage.content === newMessage.content) return;

      await loggingService.logMessageEdit(newMessage.guild, oldMessage, newMessage);
    } catch (err) {
      logger.error('messageUpdate event error:', err);
    }
  }
};
