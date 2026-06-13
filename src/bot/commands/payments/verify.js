const { EmbedBuilder } = require('discord.js');
const paymentService = require('../../../services/paymentService');
const premiumService = require('../../../services/premiumService');

module.exports = {
  name: 'verify',
  aliases: ['claim', 'redeem'],
  description: 'Verify a payment transaction ID or redeem a gift code to claim Premium.',
  async execute(message, args) {
    if (args.length === 0) {
      return message.reply('⚠️ Please provide a Gift Code or Transaction ID, e.g. `!verify CURSED-PREMIUM-...` or `!verify TX1234567`.');
    }

    const token = args[0].trim();
    const userId = message.author.id;

    try {
      // Check if it's a gift code format
      if (token.startsWith('CURSED-')) {
        const result = await premiumService.redeemCode(userId, token);
        const embed = new EmbedBuilder()
          .setTitle('🎉 Premium Redeemed!')
          .setDescription(`Successfully redeemed gift code! Your account has been upgraded.`)
          .setColor('#32cd32') // Lime Green
          .addFields(
            { name: '✨ Tier', value: `\`${result.tier}\``, inline: true },
            { name: '⏱️ Expires At', value: `<t:${Math.floor(result.expiresAt.getTime() / 1000)}:R>`, inline: true },
            { name: '🖥️ Upgradable Server Slots', value: `\`${result.quota}\``, inline: true }
          )
          .setFooter({ text: 'Run !premiumservers to activate it on a server.' });

        return message.reply({ embeds: [embed] });
      } else {
        // Assume Transaction ID
        const result = await paymentService.verifyAndClaimTransaction(userId, token);
        const embed = new EmbedBuilder()
          .setTitle('🎉 Payment Verified!')
          .setDescription(`Your transaction was verified successfully!`)
          .setColor('#32cd32')
          .addFields(
            { name: '✨ Tier Assigned', value: `\`${result.tier}\``, inline: true },
            { name: '⏱️ Duration Added', value: `30 days`, inline: true },
            { name: '💵 Amount Validated', value: `$${result.amount.toFixed(2)}`, inline: true }
          )
          .setFooter({ text: 'Thank you for supporting CURSED!' });

        return message.reply({ embeds: [embed] });
      }
    } catch (err) {
      await message.reply(`❌ Verification failed: ${err.message}`);
    }
  }
};
