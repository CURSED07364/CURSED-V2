const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

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
client.cooldowns = new Collection();

client.once('ready', () => {
  logger.success(`Logged in as ${client.user.tag}! Serving ${client.guilds.cache.size} servers.`);
  
  // Set basic activity
  client.user.setActivity({
    name: 'over CURSED servers | !premium',
    type: 3 // Watching
  });
});

module.exports = client;
