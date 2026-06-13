const { EmbedBuilder } = require('discord.js');
const Transaction = require('../../../database/models/Transaction');

module.exports = {
  name: 'payments',
  aliases: ['txs', 'transactions'],
  description: 'View your transaction history with CURSED.',
  async execute(message, args) {
    const userId = message.author.id;

    try {
      const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 }).limit(10);

      const embed = new EmbedBuilder()
        .setTitle('💳 Your Payment History')
        .setColor('#6c35de');

      if (transactions.length === 0) {
        embed.setDescription('*No payment transactions found associated with your account.*');
      } else {
        const list = transactions.map(tx => {
          const date = new Date(tx.createdAt).toLocaleDateString();
          return `• **$${tx.amount.toFixed(2)} ${tx.currency}** via \`${tx.paymentProvider}\` on ${date} (ID: \`${tx.transactionId}\`) [${tx.status}]`;
        }).join('\n');
        
        embed.setDescription(list);
      }

      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Error loading transaction history: ${err.message}`);
    }
  }
};
