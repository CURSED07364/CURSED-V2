const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'premium',
  aliases: ['premiuminfo', 'tiers'],
  description: 'View the CURSED Premium tiers and benefits.',
  async execute(message, args) {
    const embed = new EmbedBuilder()
      .setTitle('💀 CURSED Premium Subscription Tiers')
      .setDescription('Support the bot development and unlock premium SaaS features!')
      .setColor('#6c35de')
      .addFields(
        {
          name: '🆓 FREE Tier',
          value: '• Access to basic commands\n• Standard AI replies (10s cooldown)\n• Standard economy commands\n• Image generation (1 img/min)',
          inline: false
        },
        {
          name: '⭐ PREMIUM Tier ($4.99/mo)',
          value: '• Access to fast Groq AI models\n• Longer AI conversation memory (15 messages)\n• Double XP rewards (+50% rate)\n• Fast cooldowns (-30% wait times)\n• Higher image rate limits (5 imgs/min)\n• Boost **1 Discord Server** to Premium',
          inline: false
        },
        {
          name: '🔥 PREMIUM+ Tier ($9.99/mo)',
          value: '• Everything in PREMIUM\n• Unlimited AI chats (no hourly caps)\n• Custom AI Personalities for yourself & servers\n• Priority processing and advanced analytics dashboard access\n• Boost up to **3 Discord Servers** to Premium',
          inline: false
        }
      )
      .setFooter({ text: 'Type !subscribe to get purchase links!' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
};
