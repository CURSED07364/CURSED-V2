const { connectDatabase } = require('./database/connection');
const client = require('./bot/client');
const { loadCommands, loadEvents, registerSlashCommands } = require('./bot/handler');
const { startDashboard } = require('./dashboard/server');
const analyticsService = require('./services/analyticsService');
const config = require('./config');
const logger = require('./utils/logger');

// Global Error Catching for Production Uptime (Railway Compatibility)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason: reason?.stack || reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception occurred:', { error: err.stack || err });
});

async function bootstrap() {
  logger.info('==========================================');
  logger.info('   CURSED SAAS BOT BOOTSTRAP SEQUENCE     ');
  logger.info('==========================================');

  try {
    // 1. Establish database connection
    await connectDatabase();

    // 2. Load bot commands & events
    logger.info('Loading bot systems...');
    loadCommands(client);
    loadEvents(client);

    // 3. Connect to Discord Gateway
    logger.info('Connecting to Discord Gateway...');
    await client.login(config.discord.token);

    // 4. Register slash commands (Runs globally in background)
    registerSlashCommands(client).catch(err => {
      logger.error('Failed to register slash commands:', err);
    });

    // 5. Start Analytics aggregation background jobs
    analyticsService.startFlushInterval();

    // 6. Launch Web Dashboard & Webhooks
    startDashboard(client);

    logger.success('CURSED SaaS Bot successfully initialized and running.');
  } catch (err) {
    logger.error('Bootstrap sequence failed. Shutting down.', err);
    process.exit(1);
  }
}

// Fire!
bootstrap();
