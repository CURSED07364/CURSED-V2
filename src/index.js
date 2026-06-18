const mongoose = require('mongoose');
const { connectDatabase } = require('./database/connection');
const client = require('./bot/client');
const { loadCommands, loadEvents, registerSlashCommands } = require('./bot/handler');
const { startDashboard } = require('./dashboard/server');
const analyticsService = require('./services/analyticsService');
const config = require('./config');
const logger = require('./utils/logger');

// Validate required environment variables before anything else
function validateEnv() {
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'MONGODB_URI'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  logger.success('Environment variables validated');
}

// Global Error Catching for Production Uptime (Railway Compatibility)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason: reason?.stack || reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception occurred:', { error: err.stack || err });
  process.exit(1);
});

async function bootstrap() {
  logger.info('==========================================');
  logger.info('   CURSED V2 MODERATION BOT STARTUP      ');
  logger.info('==========================================');

  try {
    // 0. Validate environment variables
    logger.info('Validating environment variables...');
    validateEnv();

    // Log OAuth configuration so the exact redirect URI is visible in deploy logs
    logger.info('OAuth2 Configuration:');
    logger.info(`  • DISCORD_CLIENT_ID: ${config.discord.clientId}`);
    logger.info(`  • DASHBOARD_URL: ${config.dashboard.url}`);
    logger.info(`  • Redirect URI: ${config.discord.redirectUri}`);

    // 1. Establish database connection
    logger.info('Connecting to MongoDB...');
    await connectDatabase();
    logger.success('✅ MongoDB connected');

    // 2. Load bot commands & events
    logger.info('Loading bot systems...');
    loadCommands(client);
    loadEvents(client);
    logger.success('✅ Commands and events loaded');

    // 3. Connect to Discord Gateway
    logger.info('Connecting to Discord Gateway...');
    await client.login(config.discord.token);
    logger.success('✅ Discord client connected');

    // 4. Register slash commands
    registerSlashCommands(client).catch(err => {
      logger.error('Failed to register slash commands:', err);
    });

    // 5. Start Analytics aggregation background jobs
    analyticsService.startFlushInterval();

    // 6. Launch Web Dashboard & Webhooks
    startDashboard(client);

    logger.success('✅ CURSED V2 is online and ready!');
  } catch (err) {
    logger.error('❌ Bootstrap sequence failed:', err);
    process.exit(1);
  }
}

// Graceful shutdown — ensures Discord gateway and DB connections are closed
// cleanly on Railway deploys / container stops.
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  client.destroy();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  client.destroy();
  await mongoose.connection.close();
  process.exit(0);
});

bootstrap();
