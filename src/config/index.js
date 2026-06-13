const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const requiredEnv = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'MONGODB_URI',
  'SESSION_SECRET'
];

const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('\x1b[31m%s\x1b[0m', `CRITICAL ERROR: Missing required environment variables: ${missing.join(', ')}`);
  console.error('\x1b[33m%s\x1b[0m', 'Please create a .env file based on .env.example and configure all required variables.');
  process.exit(1);
}

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
