const path = require('path');

const colors = {
  reset: '\x1b[0m',
  info: '\x1b[36m', // Cyan
  success: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  debug: '\x1b[90m' // Dark Gray
};

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  const color = colors[level] || colors.reset;
  return `${colors.debug}[${timestamp}]${colors.reset} ${color}[${level.toUpperCase()}]${colors.reset} ${message}${metaStr}`;
}

const logger = {
  info: (msg, meta) => console.log(formatMessage('info', msg, meta)),
  success: (msg, meta) => console.log(formatMessage('success', msg, meta)),
  warn: (msg, meta) => console.warn(formatMessage('warn', msg, meta)),
  error: (msg, meta) => console.error(formatMessage('error', msg, meta)),
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatMessage('debug', msg, meta));
    }
  }
};

module.exports = logger;
