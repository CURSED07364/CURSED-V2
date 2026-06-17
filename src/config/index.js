const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

/**
 * Validates environment variables on startup.
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
    console.error('\nPlease check your .env file and try again.\n');
    process.exit(1);
  }

  console.log('✅ Environment variables validated successfully');
}

validateEnvironment();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoUri: process.env.MONGODB_URI,
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: `${process.env.DASHBOARD_URL || 'http://localhost:3000'}/auth/callback`
  },
  dashboard: {
    url: process.env.DASHBOARD_URL || 'http://localhost:3000',
    port: parseInt(process.env.PORT || '3000', 10),
    sessionSecret: process.env.SESSION_SECRET,
  },
  ai: {
    groqApiKey: process.env.GROQ_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || ''
  },
  payments: {
    kofiToken: process.env.KOFI_VERIFICATION_TOKEN || '',
    patreonSecret: process.env.PATREON_WEBHOOK_SECRET || '',
    bmcSecret: process.env.BMC_WEBHOOK_SECRET || '',
    stripeKey: process.env.STRIPE_SECRET_KEY || ''
  },
  redis: {
    url: process.env.REDIS_URL || ''
  },
  admins: (process.env.ADMIN_DISCORD_IDS || '').split(',').map(id => id.trim()).filter(Boolean)
};
