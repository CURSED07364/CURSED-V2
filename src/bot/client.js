const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * A Collection subclass that enforces a maximum size by evicting the oldest
 * entry whenever the cap is reached, preventing unbounded memory growth.
 */
class BoundedCooldownCollection extends Collection {
  constructor(maxSize = 10000) {
    super();
    this.maxSize = maxSize;
  }

  set(key, value) {
    if (this.size >= this.maxSize && !this.has(key)) {
      const firstKey = this.keys().next().value;
      this.delete(firstKey);
    }
    return super.set(key, value);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  allowedMentions: {
    parse: ['users', 'roles'], // Explicitly omit 'everyone' to prevent @everyone and @here pings
    repliedUser: true
  }
});

client.commands = new Collection();
client.slashCommands = new Collection();
client.cooldowns = new BoundedCooldownCollection(10000);

client.once('ready', () => {
  logger.success(`Logged in as ${client.user.tag}! Serving ${client.guilds.cache.size} servers.`);

  // Set moderation-focused activity
  client.user.setActivity({
    name: 'over your server | /help',
    type: 3 // Watching
  });
});

module.exports = client;
