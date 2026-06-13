const { EmbedBuilder } = require('discord.js');
const premiumService = require('../../../services/premiumService');
const config = require('../../../config');

module.exports = {
  name: 'giftpremium',
  aliases: ['gp', 'grantpremium', 'generatecode'],
  description: 'Admin command to gift premium directly or generate a subscription gift code.',
  async execute(message, args) {
    // Check if the author is an administrator
    const isAdmin = config.admins.includes(message.author.id);
    if (!isAdmin) {
      return message.reply('❌ You do not have permission to use this admin command.');
    }

    if (args.length < 2) {
      return message.reply('⚠️ Usage:\n`!giftpremium @user <days> [PREMIUM|PREMIUM+]` (Direct Gift)\n`!giftpremium code <days> [PREMIUM|PREMIUM+]` (Generate Code)');
    }

    const mode = args[0].toLowerCase();
    const days = parseInt(args[1], 10);
    const tier = (args[2] || 'PREMIUM').toUpperCase();

    if (isNaN(days) || days <= 0) {
      return message.reply('❌ Please specify a valid number of days.');
    }

    if (!['PREMIUM', 'PREMIUM+'].includes(tier)) {
      return message.reply('❌ Invalid tier. Must be `PREMIUM` or `PREMIUM+`.');
    }

    try {
      if (mode === 'code') {
        const generatedCode = await premiumService.generatePremiumCode(days, tier, message.author.id);
        const embed = new EmbedBuilder()
          .setTitle('🎟️ Premium Gift Code Generated')
          .setDescription(`Give this code to a user! They can redeem it with \`!verify <code>\` or \`!redeem <code>\`.`)
          .setColor('#6c35de')
          .addFields(
            { name: '🔑 Code', value: `\`${generatedCode}\`` },
            { name: '✨ Tier', value: `\`${tier}\`` },
            { name: '⏱️ Duration', value: `\`${days} Days\`` }
          )
          .setFooter({ text: 'Keep this code private.' });

        // Send to DM or reply
        await message.author.send({ embeds: [embed] }).catch(() => {});
        await message.reply('📬 The premium gift code has been generated and sent to your DMs!');
      } else {
        // Direct Gifting to user
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
          return message.reply('❌ Please mention a valid user to gift premium directly.');
        }

        const User = require('../../../database/models/User');
        const PremiumSubscription = require('../../../database/models/PremiumSubscription');
        const cacheService = require('../../../services/cacheService');

        let user = await User.findOne({ discordId: targetUser.id });
        if (!user) {
          user = new User({ discordId: targetUser.id, username: targetUser.username });
        }

        const durationMs = days * 24 * 60 * 60 * 1000;
        let newExpires = new Date(Date.now() + durationMs);

        if (user.premiumTier === tier && user.premiumExpiresAt) {
          newExpires = new Date(user.premiumExpiresAt.getTime() + durationMs);
        }

        user.premiumTier = tier;
        user.premiumExpiresAt = newExpires;

        const extraQuota = tier === 'PREMIUM+' ? 3 : 1;
        user.premiumServerQuota = (user.premiumServerQuota || 0) + extraQuota;
        await user.save();

        const sub = new PremiumSubscription({
          userId: targetUser.id,
          type: 'USER',
          tier,
          startsAt: new Date(),
          expiresAt: newExpires,
          paymentProvider: 'ADMIN',
          codeUsed: 'ADMIN_DIRECT_GIFT'
        });
        await sub.save();

        cacheService.delete(`premium:user:${targetUser.id}`);

        const embed = new EmbedBuilder()
          .setTitle('🎁 Premium Gift Activated!')
          .setDescription(`Congratulations! **${targetUser.username}** has been gifted Premium status!`)
          .setColor('#6c35de')
          .addFields(
            { name: '👤 Recipient', value: `${targetUser}` },
            { name: '✨ Tier', value: `\`${tier}\`` },
            { name: '⏱️ Expiration', value: `<t:${Math.floor(newExpires.getTime() / 1000)}:R>` }
          );

        await message.reply({ embeds: [embed] });
      }
    } catch (err) {
      await message.reply(`❌ Failed to gift premium: ${err.message}`);
    }
  }
};
