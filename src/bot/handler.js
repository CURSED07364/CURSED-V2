const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { REST, Routes } = require('discord.js');
const config = require('../config');

function loadCommands(client) {
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) {
    logger.warn('No commands directory found.');
    return;
  }

  const categories = fs.readdirSync(commandsPath);
  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      try {
        const command = require(path.join(categoryPath, file));
        if ('name' in command && 'execute' in command) {
          // Standard prefix command
          client.commands.set(command.name, command);
          if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach(alias => client.commands.set(alias, command));
          }
          
          // If it supports slash command register it
          if (command.data) {
            client.slashCommands.set(command.data.name, command);
          }
          
          logger.debug(`Loaded command: ${command.name} (${category})`);
        }
      } catch (err) {
        logger.error(`Error loading command file ${file}:`, err);
      }
    }
  }
  logger.info(`Loaded ${client.commands.size} prefix commands and ${client.slashCommands.size} slash commands.`);
}

function loadEvents(client) {
  const eventsPath = path.join(__dirname, 'events');
  if (!fs.existsSync(eventsPath)) {
    logger.warn('No events directory found.');
    return;
  }

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    try {
      const event = require(path.join(eventsPath, file));
      const eventName = file.split('.')[0];
      if (event.once) {
        client.once(eventName, (...args) => event.execute(...args, client));
      } else {
        client.on(eventName, (...args) => event.execute(...args, client));
      }
      logger.debug(`Loaded event listener: ${eventName}`);
    } catch (err) {
      logger.error(`Error loading event file ${file}:`, err);
    }
  }
}

async function registerSlashCommands(client) {
  const slashData = [];
  client.slashCommands.forEach(cmd => {
    slashData.push(cmd.data.toJSON());
  });

  if (slashData.length === 0) return;

  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  try {
    logger.info(`Registering ${slashData.length} global slash commands...`);
    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: slashData }
    );
    logger.success('Successfully registered global slash commands.');
  } catch (error) {
    logger.error('Failed to register global slash commands:', error);
  }
}

module.exports = {
  loadCommands,
  loadEvents,
  registerSlashCommands
};
