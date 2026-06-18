const express = require('express');
const session = require('express-session');
const path = require('path');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../utils/logger');
const Guild = require('../database/models/Guild');
const User = require('../database/models/User');
const Ticket = require('../database/models/Ticket');
const Warning = require('../database/models/Warning');
const Transaction = require('../database/models/Transaction');
const Analytics = require('../database/models/Analytics');
const PremiumCode = require('../database/models/PremiumCode');
const paymentService = require('../services/paymentService');
const premiumService = require('../services/premiumService');
const cacheService = require('../services/cacheService');

const app = express();

function startDashboard(client) {
  // Use Helmet for basic security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://cdn.discordapp.com", "https://image.pollinations.ai"],
        connectSrc: ["'self'"]
      }
    }
  }));

  // Parse payloads
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Set up views & static files
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));

  // Session middleware
  app.use(session({
    secret: config.dashboard.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
  }));

  // Express Rate Limiter for endpoints
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  });
  app.use('/api/', apiLimiter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'OK',
      uptime: process.uptime(),
      ping: client.ws.ping,
      guilds: client.guilds.cache.size
    });
  });

  // ==========================================
  // DISCORD OAUTH2 FLOW
  // ==========================================

  app.get('/auth', (req, res) => {
    const redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${encodeURIComponent(config.discord.redirectUri)}&response_type=code&scope=identify%20guilds`;

    // Log the full authorization URL so mismatches are immediately visible
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      logger.debug('OAuth2 Authorization URL:');
      logger.debug(`  ${redirectUrl}`);
    }

    res.redirect(redirectUrl);
  });

  app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
      logger.warn('OAuth2 callback received without authorization code');
      return res.redirect('/');
    }

    try {
      // Log token exchange attempt so redirect URI is visible in logs
      if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
        logger.debug('OAuth2 Token Exchange:');
        logger.debug(`  • Client ID: ${config.discord.clientId}`);
        logger.debug(`  • Redirect URI: ${config.discord.redirectUri}`);
        logger.debug(`  • Code: ${code.substring(0, 10)}...`);
      }

      // Exchange code for token
      const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.discord.redirectUri
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token } = tokenResponse.data;

      // Fetch user profile
      const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      // Fetch user guilds
      const guildsResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      // Save user profile & guilds in session
      req.session.user = userResponse.data;
      req.session.guilds = guildsResponse.data;

      logger.info(`OAuth2 login successful for user ${userResponse.data.username}#${userResponse.data.discriminator}`);
      res.redirect('/dashboard');
    } catch (err) {
      logger.error('OAuth2 login failure:', err.message);

      // Provide a specific error message to help diagnose the failure
      let errorMessage = 'Authentication failed. ';
      if (err.response?.status === 400) {
        errorMessage += 'Invalid authorization code or redirect URI mismatch. ';
        errorMessage += `Verify that the redirect URI in Discord Developer Portal matches: ${config.discord.redirectUri}`;
      } else if (err.response?.status === 401) {
        errorMessage += 'Invalid client credentials. Check DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.';
      } else {
        errorMessage += 'Please check client credentials and redirect URI.';
      }

      res.status(500).send(errorMessage);
    }
  });

  app.get('/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });

  // Middlewares to check login
  const checkAuth = (req, res, next) => {
    if (!req.session.user) return res.redirect('/auth');
    next();
  };

  const checkGuildAdmin = async (req, res, next) => {
    const { guildId } = req.params;
    if (!req.session.user) return res.redirect('/auth');

    // Find guild in session
    const guild = req.session.guilds.find(g => g.id === guildId);
    if (!guild) return res.status(403).send('Forbidden: Guild not found in user list.');

    // Check MANAGE_GUILD (0x0000000000000020) permission
    const hasPermission = (BigInt(guild.permissions) & 0x20n) === 0x20n;
    if (!hasPermission) return res.status(403).send('Forbidden: Administrator access required.');

    next();
  };

  // ==========================================
  // DASHBOARD PAGES
  // ==========================================

app.get('/', (req, res) => {
  res.render('landing', {
    user: req.session.user,
    config
  });
});
 

  app.get('/dashboard', checkAuth, async (req, res) => {
    // Filter guilds where user has MANAGE_GUILD
    const adminGuilds = req.session.guilds.filter(g => (BigInt(g.permissions) & 0x20n) === 0x20n);
    
    // Check which ones bot is currently inside
    const joinedGuilds = adminGuilds.map(g => {
      const isJoined = client.guilds.cache.has(g.id);
      return { ...g, isJoined };
    });

    // Fetch user premium status
    const userPremium = await premiumService.getUserPremiumStatus(req.session.user.id);

    res.render('servers', {
      user: req.session.user,
      guilds: joinedGuilds,
      premium: userPremium
    });
  });

  app.get('/dashboard/:guildId', checkAuth, checkGuildAdmin, async (req, res) => {
    const { guildId } = req.params;
    
    let guild = await Guild.findOne({ guildId });
    if (!guild) {
      const discordGuild = client.guilds.cache.get(guildId);
      guild = new Guild({ guildId, name: discordGuild?.name || 'Server Config' });
      await guild.save();
    }

    const ticketsCount = await Ticket.countDocuments({ guildId, status: 'OPEN' });
    const warningsCount = await Warning.countDocuments({ guildId });

    res.render('overview', {
      user: req.session.user,
      guild,
      ticketsCount,
      warningsCount,
      botPing: client.ws.ping
    });
  });

  // Premium management page
  app.get('/dashboard/:guildId/premium', checkAuth, checkGuildAdmin, async (req, res) => {
    const { guildId } = req.params;
    const guild = await Guild.findOne({ guildId });
    const userPremium = await premiumService.getUserPremiumStatus(req.session.user.id);
    const isAdminUser = config.admins.includes(req.session.user.id);

    res.render('premium', {
      user: req.session.user,
      guild,
      premium: userPremium,
      isAdminUser
    });
  });

  // Moderation settings page
  app.get('/dashboard/:guildId/moderation', checkAuth, checkGuildAdmin, async (req, res) => {
    const { guildId } = req.params;
    const guild = await Guild.findOne({ guildId });
    const warnings = await Warning.find({ guildId }).sort({ createdAt: -1 }).limit(10);

    res.render('moderation', {
      user: req.session.user,
      guild,
      warnings
    });
  });

  // Economy settings page
  app.get('/dashboard/:guildId/economy', checkAuth, checkGuildAdmin, async (req, res) => {
    const { guildId } = req.params;
    const guild = await Guild.findOne({ guildId });

    res.render('economy', {
      user: req.session.user,
      guild
    });
  });

  // AI settings page
  app.get('/dashboard/:guildId/ai', checkAuth, checkGuildAdmin, async (req, res) => {
    const { guildId } = req.params;
    const guild = await Guild.findOne({ guildId });

    res.render('ai', {
      user: req.session.user,
      guild
    });
  });

  // Analytics page
  app.get('/dashboard/:guildId/analytics', checkAuth, checkGuildAdmin, async (req, res) => {
    const { guildId } = req.params;
    const guild = await Guild.findOne({ guildId });

    // Fetch last 7 days of analytics
    const weeklyStats = await Analytics.find({ guildId }).sort({ date: -1 }).limit(7);

    res.render('analytics', {
      user: req.session.user,
      guild,
      weeklyStats: JSON.stringify(weeklyStats.reverse())
    });
  });

  // ModLogs audit page
  app.get('/dashboard/:guildId/logs', checkAuth, checkGuildAdmin, async (req, res) => {
    const { guildId } = req.params;
    const guild = await Guild.findOne({ guildId });
    const warnings = await Warning.find({ guildId }).sort({ createdAt: -1 }).limit(50);

    res.render('logs', {
      user: req.session.user,
      guild,
      warnings
    });
  });

  // ==========================================
  // POST CONFIGURATION API ROUTERS
  // ==========================================

  app.post('/api/config/:guildId', checkAuth, checkGuildAdmin, async (req, res) => {
    const { guildId } = req.params;
    const { prefix, logChannelId, welcomeChannelId, welcomeMessage } = req.body;

    try {
      await Guild.findOneAndUpdate(
        { guildId },
        { $set: { prefix, logChannelId, welcomeChannelId, welcomeMessage } }
      );
      cacheService.delete(`guild:${guildId}`);
      res.redirect(`/dashboard/${guildId}`);
    } catch (err) {
      res.status(500).send('Error saving core settings: ' + err.message);
    }
  });

  app.post('/api/moderation/:guildId', checkAuth, checkGuildAdmin, async (req, res) => {
    const { guildId } = req.params;
    const { 
      antiSpam_enabled, antiSpam_severity, antiSpam_threshold,
      antiLink_enabled, antiLink_severity,
      antiInvite_enabled, antiInvite_severity,
      antiScam_enabled, antiScam_severity,
      antiMassMention_enabled, antiMassMention_severity, antiMassMention_threshold
    } = req.body;

    try {
      await Guild.findOneAndUpdate(
        { guildId },
        {
          $set: {
            'autoMod.antiSpam.enabled': antiSpam_enabled === 'on',
            'autoMod.antiSpam.severity': antiSpam_severity,
            'autoMod.antiSpam.threshold': parseInt(antiSpam_threshold, 10) || 5,
            
            'autoMod.antiLink.enabled': antiLink_enabled === 'on',
            'autoMod.antiLink.severity': antiLink_severity,
            
            'autoMod.antiInvite.enabled': antiInvite_enabled === 'on',
            'autoMod.antiInvite.severity': antiInvite_severity,
            
            'autoMod.antiScam.enabled': antiScam_enabled === 'on',
            'autoMod.antiScam.severity': antiScam_severity,
            
            'autoMod.antiMassMention.enabled': antiMassMention_enabled === 'on',
            'autoMod.antiMassMention.severity': antiMassMention_severity,
            'autoMod.antiMassMention.threshold': parseInt(antiMassMention_threshold, 10) || 5
          }
        }
      );
      cacheService.delete(`guild:${guildId}`);
      res.redirect(`/dashboard/${guildId}/moderation`);
    } catch (err) {
      res.status(500).send('Error saving AutoMod settings: ' + err.message);
    }
  });

  app.post('/api/ai/:guildId', checkAuth, checkGuildAdmin, async (req, res) => {
    const { guildId } = req.params;
    const { personality, aimode, activeChannels } = req.body;

    try {
      // Convert activeChannels text/array
      const channelsList = activeChannels
        ? activeChannels.split(',').map(id => id.trim()).filter(Boolean)
        : [];

      await Guild.findOneAndUpdate(
        { guildId },
        {
          $set: {
            'ai.personality': personality,
            'ai.aimode': aimode,
            'ai.activeChannels': channelsList
          }
        }
      );
      cacheService.delete(`guild:${guildId}`);
      res.redirect(`/dashboard/${guildId}/ai`);
    } catch (err) {
      res.status(500).send('Error saving AI settings: ' + err.message);
    }
  });

  // Redeem Premium Code inside Dashboard
  app.post('/api/premium/redeem', checkAuth, async (req, res) => {
    const { code } = req.body;
    try {
      const result = await premiumService.redeemCode(req.session.user.id, code);
      res.redirect('/dashboard');
    } catch (err) {
      res.status(400).send('Failed to redeem: ' + err.message);
    }
  });

  // Admin Route to generate codes
  app.post('/api/admin/generate-code', checkAuth, async (req, res) => {
    const isAdminUser = config.admins.includes(req.session.user.id);
    if (!isAdminUser) return res.status(403).send('Unauthorized');

    const { days, tier } = req.body;
    try {
      const code = await premiumService.generatePremiumCode(parseInt(days, 10) || 30, tier || 'PREMIUM', req.session.user.id);
      res.json({ success: true, code });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // PAYMENT WEBHOOKS (BMC, Patreon, Ko-fi)
  // ==========================================

  app.post('/api/payments/kofi', async (req, res) => {
    // Kofi sends data inside raw URLSearchParams or as JSON
    const payload = req.body.data ? JSON.parse(req.body.data) : req.body;

    if (!paymentService.verifyKofiToken(payload.verification_token)) {
      logger.warn('Received invalid Ko-fi webhook signature.');
      return res.status(401).send('Unauthorized signature');
    }

    // Parse parameters
    const email = payload.email;
    const amount = parseFloat(payload.amount);
    const transactionId = payload.message_id;
    // Extract Discord ID from custom field
    const discordId = payload.url ? new URL(payload.url).searchParams.get('ref') : null;

    const result = await paymentService.processPayment({
      userId: discordId,
      amount,
      currency: payload.currency || 'USD',
      provider: 'KOFI',
      transactionId,
      email,
      rawPayload: payload
    });

    res.json(result);
  });

  app.post('/api/payments/patreon', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['x-patreon-signature'];
    const bodyStr = req.body.toString();

    if (!paymentService.verifyPatreonSignature(bodyStr, signature)) {
      logger.warn('Received invalid Patreon webhook signature.');
      return res.status(401).send('Unauthorized signature');
    }

    const payload = JSON.parse(bodyStr);
    
    // Patreon events can be memberships/pledges created or deleted
    const event = req.headers['x-patreon-event'];
    
    if (event === 'members:pledge:create' || event === 'members:pledge:update') {
      const email = payload.data.attributes.email;
      const amount = parseFloat(payload.data.attributes.pledge_amount_cents) / 100;
      const transactionId = payload.data.id;
      
      // Look for linked discord ID inside attributes/user relations
      // Note: users can link discord to Patreon. If not, they verify using !verify <pledgeId>
      const userDiscordRelation = payload.included?.find(inc => inc.type === 'user')?.attributes?.social_connections?.discord;
      const discordId = userDiscordRelation?.user_id || null;

      const result = await paymentService.processPayment({
        userId: discordId,
        amount,
        currency: 'USD',
        provider: 'PATREON',
        transactionId,
        email,
        rawPayload: payload
      });

      return res.json(result);
    }

    res.sendStatus(200);
  });

  app.post('/api/payments/bmc', async (req, res) => {
    // BuyMeACoffee payload
    const signature = req.headers['x-bmac-signature'];
    const rawPayload = req.body;

    // Optional BMAC body verification:
    // Some BMC webhooks send signature token in header.
    // If signature validates:
    const email = rawPayload.payer_email;
    const amount = parseFloat(rawPayload.amount);
    const transactionId = rawPayload.transaction_id || `bmc-${Date.now()}`;
    const discordId = rawPayload.custom_fields?.['Discord ID'] || null;

    const result = await paymentService.processPayment({
      userId: discordId,
      amount,
      currency: 'USD',
      provider: 'BMC',
      transactionId,
      email,
      rawPayload
    });

    res.json(result);
  });

  // Listen
  const server = app.listen(config.port, () => {
    logger.success(`Web dashboard is running on port ${config.port}`);
  });

  // Graceful shutdown handlers for Railway SIGTERM/SIGINT
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      logger.success('HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10s if server hasn't closed
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { startDashboard };
