const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../../config');

module.exports = {
  name: 'subscribe',
  aliases: ['buy', 'donate'],
  description: 'Get subscription links to purchase CURSED Premium.',
  async execute(message, args) {
    const embed = new EmbedBuilder()
      .setTitle('💜 Subscribe to CURSED Premium')
      .setDescription('Support the bot by subscribing on any of our supported payment platforms. After subscribing, you will receive a receipt containing your **Transaction ID**. Use it with `!verify <ID>` to claim your premium status!')
      .setColor('#6c35de')
      .addFields(
        { name: '⭐ PREMIUM ($4.99/mo)', value: 'Unlock AI features, faster cooldowns, and boost 1 server.' },
        { name: '🔥 PREMIUM+ ($9.99/mo)', value: 'Unlock custom personalities, premium dashboards, and boost 3 servers.' }
      )
      .setFooter({ text: 'Already subscribed? Run !verify <transactionId> to claim.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Support on Ko-fi')
        .setStyle(ButtonStyle.Link)
        .setURL('https://ko-fi.com/cursedbot'),
      new ButtonBuilder()
        .setLabel('Join our Patreon')
        .setStyle(ButtonStyle.Link)
        .setURL('https://patreon.com/cursedbot'),
      new ButtonBuilder()
        .setLabel('Buy Me A Coffee')
        .setStyle(ButtonStyle.Link)
        .setURL('https://buymeacoffee.com/cursedbot')
    );

    await message.reply({ embeds: [embed], components: [row] });
  }
};
