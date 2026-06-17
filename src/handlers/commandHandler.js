const { handleCommandError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Wraps a command's execute function so that any unhandled error is caught,
 * logged, and surfaced to the user as a clean ephemeral reply rather than
 * crashing the process.
 *
 * @param {Function} execute     - The original command execute function
 * @param {string}   commandName - The command name (used in error logs)
 * @returns {Function}           - A wrapped execute function with the same signature
 */
function wrapCommandExecution(execute, commandName) {
  return async function wrappedExecute(context, args, client) {
    try {
      return await execute.call(this, context, args, client);
    } catch (err) {
      logger.error(`Unhandled error in command ${commandName}:`, err);
      await handleCommandError(err, context, commandName);
    }
  };
}

module.exports = { wrapCommandExecution };
