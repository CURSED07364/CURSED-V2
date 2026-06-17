const logger = require('./logger');

/**
 * Handles command execution errors safely, sending a user-facing reply
 * without leaking internal error details.
 *
 * @param {Error}                  error       - The error that occurred
 * @param {Interaction|Message}    context     - The command context
 * @param {string}                 commandName - The command name (for logging)
 */
async function handleCommandError(error, context, commandName) {
  logger.error(`Error in command ${commandName}:`, error);

  const isInteraction = context.isChatInputCommand?.() || context.isButton?.();
  const reply = {
    content: '❌ An error occurred while executing this command. Please try again later.',
    ephemeral: true
  };

  try {
    if (isInteraction) {
      if (context.replied || context.deferred) {
        await context.followUp(reply);
      } else {
        await context.reply(reply);
      }
    } else {
      await context.reply(reply.content);
    }
  } catch (err) {
    logger.error('Failed to send error message:', err);
  }
}

/**
 * Translates a Mongoose/MongoDB error into a human-readable string.
 *
 * @param {Error}  error     - The database error
 * @param {string} operation - The operation that failed (for logging)
 * @returns {string}
 */
function handleDatabaseError(error, operation) {
  logger.error(`Database error during ${operation}:`, error);

  if (error.code === 11000) {
    return 'This record already exists.';
  }
  if (error.name === 'ValidationError') {
    return 'Invalid data provided.';
  }
  if (error.name === 'CastError') {
    return 'Invalid ID format.';
  }

  return 'A database error occurred.';
}

/**
 * Safely executes an async function, logging any error before re-throwing.
 *
 * @param {Function} fn      - The async function to execute
 * @param {string}   context - Context label for error logging
 * @returns {Promise<any>}
 */
async function safeExecute(fn, context = 'operation') {
  try {
    return await fn();
  } catch (error) {
    logger.error(`Error during ${context}:`, error);
    throw error;
  }
}

module.exports = {
  handleCommandError,
  handleDatabaseError,
  safeExecute
};
