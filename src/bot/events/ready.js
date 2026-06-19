const logger = require('../../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    logger.success(`Bot logged in as ${client.user.tag}! Serving ${client.guilds.cache.size} servers.`);
    client.user.setActivity({
      name: 'over your server | /help',
      type: 3 // Watching
    });
  },
};
