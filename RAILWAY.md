# Railway Deployment Guide

## Prerequisites
- Railway account (railway.app)
- GitHub repository connected
- MongoDB Atlas cluster
- Discord bot token and OAuth credentials

## Setup Steps

### 1. Create Railway Project
- Go to railway.app and create a new project
- Select "Deploy from GitHub repo"
- Choose the CURSED-V2 repository

### 2. Configure Environment Variables
Go to **Service Settings → Variables** and add all variables from `.env.example`:

| Variable | Description | Required |
|---|---|---|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal | ✅ |
| `DISCORD_CLIENT_ID` | Application client ID | ✅ |
| `DISCORD_CLIENT_SECRET` | Application client secret (for OAuth) | ✅ |
| `MONGODB_URI` | MongoDB Atlas connection string | ✅ |
| `SESSION_SECRET` | Random secret for Express sessions | ✅ |
| `DASHBOARD_URL` | Your Railway public domain (e.g. `https://cursed.up.railway.app`) | ✅ |
| `PORT` | HTTP port (Railway sets this automatically) | auto |
| `GROQ_API_KEY` | Groq API key for AI (primary) | optional |
| `GEMINI_API_KEY` | Google Gemini API key for AI (fallback) | optional |
| `KOFI_VERIFICATION_TOKEN` | Ko-fi webhook verification token | optional |
| `PATREON_WEBHOOK_SECRET` | Patreon webhook secret | optional |
| `BMC_WEBHOOK_SECRET` | Buy Me a Coffee webhook secret | optional |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments | optional |
| `ADMIN_DISCORD_IDS` | Comma-separated Discord IDs for bot admins | optional |
| `REDIS_URL` | Redis connection URL for caching | optional |

> **Important:** Set `DASHBOARD_URL` to your Railway-assigned domain **before** configuring Discord OAuth redirect URIs.

### 3. Configure Discord OAuth2
In the [Discord Developer Portal](https://discord.com/developers/applications):
- Go to **OAuth2 → Redirects**
- Add `https://your-railway-url.railway.app/auth/callback`
- This must match `DASHBOARD_URL` exactly

### 4. Deploy
Railway auto-deploys on every push to the `main` branch. To trigger a manual deploy:
```
railway up
```

### 5. Verify Deployment
- **Health check:** `GET https://your-railway-url.railway.app/health` → should return `{ "status": "OK" }`
- **Bot status:** Bot should appear online in Discord within ~30 seconds
- **Dashboard:** Navigate to your Railway URL to see the landing page
- **Logs:** Monitor real-time logs in the Railway dashboard

## Troubleshooting

### Build fails with npm error
- Ensure Node.js version is `>=18.0.0` (set in `package.json` engines)
- Check that all required environment variables are set before deploy

### Bot is offline after deploy
- Verify `DISCORD_TOKEN` is correct and the bot is not banned
- Check Railway logs for `Bootstrap sequence failed` errors
- Ensure `MONGODB_URI` is reachable from Railway (whitelist `0.0.0.0/0` in MongoDB Atlas Network Access)

### Dashboard OAuth not working
- Confirm `DASHBOARD_URL` matches the Railway domain exactly (no trailing slash)
- Confirm the redirect URI in Discord Developer Portal matches `DASHBOARD_URL/auth/callback`
- Ensure `DISCORD_CLIENT_SECRET` is set correctly

### MongoDB connection refused
- Whitelist all IPs (`0.0.0.0/0`) in MongoDB Atlas → Network Access
- Verify the connection string format: `mongodb+srv://user:pass@cluster.mongodb.net/dbname`

## Architecture

```
Railway Service
├── Express HTTP Server (PORT env var)
│   ├── GET  /health          → Health check
│   ├── GET  /auth            → Discord OAuth2 redirect
│   ├── GET  /auth/callback   → OAuth2 callback
│   ├── GET  /dashboard/*     → Protected dashboard pages
│   └── POST /api/payments/*  → Payment webhooks
└── Discord.js Bot
    ├── Prefix commands  (!help, !premium, etc.)
    ├── Slash commands   (/ban, /kick, etc.)
    └── AutoMod          (anti-spam, anti-link, etc.)
```
