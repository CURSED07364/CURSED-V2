const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('../config');

async function connectDatabase() {
  try {
    logger.info('Connecting to MongoDB database...');
    await mongoose.connect(config.mongoUri);
    logger.info('Successfully connected to MongoDB.');
  } catch (error) {
    logger.error('Failed to connect to MongoDB database:', error);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB error occurred:', err);
});

module.exports = { connectDatabase };
