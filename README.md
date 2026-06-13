# 💀 CURSED - Production SaaS Discord Bot

CURSED is a highly scalable, premium-grade Discord SaaS bot architecture written in Node.js with **Discord.js v14**, **Express web dashboard**, **MongoDB Mongoose schemas**, and **fallback AI reasoning integrations (Groq + Gemini)**.

---

## 🚀 Quick Start & Installation

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: Active MongoDB Atlas URI connection string
- **Discord Bot**: Application client ID, client secret, and bot token from the Discord Developer Portal.

### 2. Setup Files
Clone the project, then configure settings:
```bash
npm install
cp .env.example .env
```
Open `.env` and configure all required credential keys.

### 3. Running Locally
- Run in Development (with Nodemon auto-reloads):
  ```bash
  npm run dev
  ```
- Run in Production mode:
  ```bash
  npm start
  ```

---

## 🛠️ Configuration Details

| Key | Description | Required |
|---|---|---|
| `DISCORD_TOKEN` | Discord application bot token | Yes |
| `DISCORD_CLIENT_ID` | Discord client ID | Yes |
| `DISCORD_CLIENT_SECRET` | Discord oauth secret key | Yes |
| `MONGODB_URI` | MongoDB Atlas connections connection string | Yes |
| `SESSION_SECRET` | Cryptographic secret for signing browser sessions | Yes |
| `DASHBOARD_URL` | Base URL of dashboard (e.g. `http://localhost:3000` or Railway URL) | Yes |
| `GROQ_API_KEY` | Primary Groq API key | No (Falls back to Gemini) |
| `GEMINI_API_KEY` | Fallback Gemini API key | No (Falls back to Groq) |

---

## 🚂 Railway Hosting Deployment Guide

1. Log into your [Railway Dashboard](https://railway.app/).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Choose the repository containing your CURSED bot.
4. Go to the service **Settings** -> **Variables**, and load all keys defined in `.env.example`.
5. Under service **Settings**, enable the **Public Networking** port generation (Railway automatically maps `PORT` to 3000 by default and handles proxy setups).
6. Deploy! The bot will boot both the Discord Client and the Express server concurrently.

---

## 📊 Database Collections Layout

- **Users**: Tracks economy levels, XP balances, owned pets, unlockable badges, and cooldown states.
- **Guilds**: Manages server AutoMod toggles, custom AI personalities, welcome hooks, and active ticket staff roles.
- **PremiumSubscriptions**: Logs active Premium/Premium+ subscription expirations and redemption details.
- **Transactions**: Audit ledger of payment webhook transactions.
- **Warnings**: Infractions history database.
- **Tickets**: Support tickets record with EJS/HTML transcripts array.
- **Analytics**: Compiles daily message/command totals per guild.
- **CustomAIProfiles**: Persists chat context sliding windows and user personalities.
- **PremiumCodes**: Registry of generated, unredeemed gift keys.
