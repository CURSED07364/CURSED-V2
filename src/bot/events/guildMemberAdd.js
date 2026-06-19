const loggingService = require('../../services/loggingService');
const logger = require('../../utils/logger');

module.exports = {
  once: false,
  async execute(member, client) {
    try {
      await loggingService.logMemberJoin(member.guild, member);
    } catch (err) {
      logger.error('guildMemberAdd event error:', err);
    }
  }
};
