const { EmbedBuilder } = require('discord.js');
const User = require('../../../database/models/User');

module.exports = {
  name: 'balance',
  aliases: ['bal', 'money', 'cash'],
  description: 'Check your wallet and bank balances.',
  async execute(message, args) {
    const target = message.mentions.users.first() || message.author;

    try {
      let user = await User.findOne({ discordId: target.id });
      if (!user) {
        user = new User({ discordId: target.id, username: target.username });
        await user.save();
      }

      const total = user.wallet + user.bank;

      const embed = new EmbedBuilder()
        .setTitle(`💰 ${target.username}'s Balance`)
        .setColor('#6c35de')
        .addFields(
          { name: '💵 Wallet', value: `\`$${user.wallet.toLocaleString()}\``, inline: true },
          { name: '🏦 Bank', value: `\`$${user.bank.toLocaleString()} / $${user.bankLimit.toLocaleString()}\``, inline: true },
          { name: '💳 Total Savings', value: `\`$${total.toLocaleString()}\``, inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Error loading balance: ${err.message}`);
    }
  }
};
