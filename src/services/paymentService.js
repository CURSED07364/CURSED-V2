const crypto = require('crypto');
const User = require('../database/models/User');
const Transaction = require('../database/models/Transaction');
const PremiumSubscription = require('../database/models/PremiumSubscription');
const premiumService = require('./premiumService');
const config = require('../config');
const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class PaymentService {
  // Verify Patreon Signature
  verifyPatreonSignature(rawBody, signature) {
    if (!config.payments.patreonSecret || !signature) return false;
    const hash = crypto.createHmac('md5', config.payments.patreonSecret).update(rawBody).digest('hex');
    return hash === signature;
  }

  // Verify BuyMeACoffee Signature
  verifyBMCSignature(rawBody, signature) {
    if (!config.payments.bmcSecret || !signature) return false;
    const hash = crypto.createHmac('sha256', config.payments.bmcSecret).update(rawBody).digest('hex');
    return hash === signature;
  }

  // Verify Ko-fi webhook token (Ko-fi sends token inside the payload)
  verifyKofiToken(receivedToken) {
    if (!config.payments.kofiToken || !receivedToken) return false;
    return config.payments.kofiToken === receivedToken;
  }

  // Handle transaction processing
  async processPayment({ userId, amount, currency, provider, transactionId, email, rawPayload }) {
    try {
      logger.info(`Processing payment from ${provider}. TX: ${transactionId}, User: ${userId || 'UNKNOWN'}, Amount: ${amount}`);
      
      // 1. Check if transaction already exists
      let transaction = await Transaction.findOne({ transactionId });
      if (transaction) {
        logger.warn(`Transaction ${transactionId} already processed.`);
        return { success: false, error: 'Transaction already exists' };
      }

      // 2. Create new transaction log
      transaction = new Transaction({
        userId: userId || 'UNCLAIMED',
        amount,
        currency,
        paymentProvider: provider,
        transactionId,
        email,
        status: 'COMPLETED',
        rawPayload
      });
      await transaction.save();

      // 3. If userId is provided, assign premium automatically
      if (userId && userId !== 'UNCLAIMED') {
        const tier = amount >= 9.99 ? 'PREMIUM+' : 'PREMIUM';
        const durationDays = amount >= 29.99 ? 365 : 30; // Year vs Month
        const durationMs = durationDays * 24 * 60 * 60 * 1000;
        
        let user = await User.findOne({ discordId: userId });
        if (!user) {
          user = new User({ discordId: userId, username: email || 'Unknown Subscriber' });
        }

        let newExpires = new Date(Date.now() + durationMs);
        if (user.premiumTier === tier && user.premiumExpiresAt) {
          newExpires = new Date(user.premiumExpiresAt.getTime() + durationMs);
        }

        user.premiumTier = tier;
        user.premiumExpiresAt = newExpires;
        
        // Add server slots quota
        const extraQuota = tier === 'PREMIUM+' ? 3 : 1;
        user.premiumServerQuota = (user.premiumServerQuota || 0) + extraQuota;
        await user.save();

        // Create subscription entry
        const sub = new PremiumSubscription({
          userId,
          type: 'USER',
          tier,
          startsAt: new Date(),
          expiresAt: newExpires,
          paymentProvider: provider,
          paymentEmail: email,
          transactionId
        });
        await sub.save();

        cacheService.delete(`premium:user:${userId}`);
        logger.success(`Auto-assigned ${tier} premium to user ${userId} for ${durationDays} days.`);
        return { success: true, claimed: true, userId };
      }

      logger.info(`Transaction ${transactionId} recorded. Awaiting manual !verify command.`);
      return { success: true, claimed: false };
    } catch (err) {
      logger.error('Error processing payment transaction:', err);
      return { success: false, error: err.message };
    }
  }

  // Claim transaction manually using discord ID and TX ID
  async verifyAndClaimTransaction(userId, transactionId) {
    const transaction = await Transaction.findOne({ transactionId });
    if (!transaction) {
      throw new Error('Transaction ID not found. Ensure the payment is completed and ID is typed correctly.');
    }

    if (transaction.userId !== 'UNCLAIMED') {
      throw new Error('This transaction has already been claimed by another Discord account.');
    }

    // Assign transaction to user
    transaction.userId = userId;
    await transaction.save();

    // Give premium benefits
    const tier = transaction.amount >= 9.99 ? 'PREMIUM+' : 'PREMIUM';
    const durationDays = transaction.amount >= 29.99 ? 365 : 30;
    const durationMs = durationDays * 24 * 60 * 60 * 1000;

    let user = await User.findOne({ discordId: userId });
    if (!user) {
      user = new User({ discordId: userId, username: 'Verified Member' });
    }

    let newExpires = new Date(Date.now() + durationMs);
    if (user.premiumTier === tier && user.premiumExpiresAt) {
      newExpires = new Date(user.premiumExpiresAt.getTime() + durationMs);
    }

    user.premiumTier = tier;
    user.premiumExpiresAt = newExpires;
    
    const extraQuota = tier === 'PREMIUM+' ? 3 : 1;
    user.premiumServerQuota = (user.premiumServerQuota || 0) + extraQuota;
    await user.save();

    // Create subscription entry
    const sub = new PremiumSubscription({
      userId,
      type: 'USER',
      tier,
      startsAt: new Date(),
      expiresAt: newExpires,
      paymentProvider: transaction.paymentProvider,
      paymentEmail: transaction.email,
      transactionId: transaction.transactionId
    });
    await sub.save();

    cacheService.delete(`premium:user:${userId}`);
    logger.success(`Manually verified & claimed payment. Assigned ${tier} to user ${userId} for ${durationDays} days.`);
    
    return {
      tier,
      expiresAt: newExpires,
      amount: transaction.amount
    };
  }
}

module.exports = new PaymentService();
