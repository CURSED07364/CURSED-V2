const logger = require('../../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    logger.success(`Bot logged in as ${client.user.tag}! Serving ${client.guilds.cache.size} servers.`);
    client.user.setActivity({
      name: 'over CURSED servers | !premium',
      type: 3 // Watching
    });
  },
};
