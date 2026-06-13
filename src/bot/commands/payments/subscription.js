const { EmbedBuilder } = require('discord.js');
const PremiumSubscription = require('../../../database/models/PremiumSubscription');

module.exports = {
  name: 'subscription',
  aliases: ['subinfo'],
  description: 'View details of your active premium subscription cycles.',
  async execute(message, args) {
    const userId = message.author.id;

    try {
      const activeSubs = await PremiumSubscription.find({ userId, status: 'ACTIVE' }).sort({ expiresAt: -1 });

      const embed = new EmbedBuilder()
        .setTitle('📅 Active Subscription Details')
        .setColor('#6c35de');

      if (activeSubs.length === 0) {
        embed.setDescription('You do not have any active subscriptions. Type `!subscribe` to get premium.');
      } else {
        const details = activeSubs.map((sub, i) => {
          return `**Subscription #${i + 1}**\n• **Tier**: \`${sub.tier}\`\n• **Started**: <t:${Math.floor(sub.startsAt.getTime() / 1000)}:D>\n• **Expires**: <t:${Math.floor(sub.expiresAt.getTime() / 1000)}:R>\n• **Method**: \`${sub.paymentProvider}\` ${sub.codeUsed ? `(Redeemed code: \`${sub.codeUsed}\`)` : ''}`;
        }).join('\n\n');

        embed.setDescription(details);
      }

      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Error loading subscription details: ${err.message}`);
    }
  }
};
