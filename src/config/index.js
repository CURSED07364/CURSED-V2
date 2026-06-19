const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Validates required environment variables on startup.
 * Fails fast with clear, actionable error messages rather than cryptic
 * runtime failures deep inside the application.
 */
function validateEnvironment() {
  const errors = [];

  // Required variables — the bot cannot function without these
  const required = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'MONGODB_URI'
  ];

  for (const key of required) {
    if (!process.env[key]) {
      errors.push(`${key} is required but not set`);
    }
  }

  // Format validation — catch obviously wrong values early
  if (process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN.length < 50) {
    errors.push('DISCORD_TOKEN appears to be invalid (too short)');
  }

  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.startsWith('mongodb')) {
    errors.push('MONGODB_URI must start with "mongodb" or "mongodb+srv"');
  }

  if (process.env.DISCORD_CLIENT_ID && !/^\d{17,20}$/.test(process.env.DISCORD_CLIENT_ID)) {
    errors.push('DISCORD_CLIENT_ID must be a valid Discord snowflake (17-20 digits)');
  }

  if (errors.length > 0) {
    console.error('\n❌ ENVIRONMENT VALIDATION FAILED:\n');
    errors.forEach(err => console.error(`  • ${err}`));
    console.error('\nPlease set the required environment variables and try again.\n');
    process.exit(1);
  }

  console.log('✅ Environment variables validated successfully');
}

validateEnvironment();

const config = {
  mongoUri: process.env.MONGODB_URI,
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID
  },
  admins: (process.env.ADMIN_DISCORD_IDS || '').split(',').map(id => id.trim()).filter(Boolean)
};

module.exports = config;
