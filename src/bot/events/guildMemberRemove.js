const loggingService = require('../../services/loggingService');
const logger = require('../../utils/logger');

module.exports = {
  once: false,
  async execute(member, client) {
    try {
      await loggingService.logMemberLeave(member.guild, member.user);
    } catch (err) {
      logger.error('guildMemberRemove event error:', err);
    }
  }
};
