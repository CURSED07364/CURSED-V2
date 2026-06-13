const { EmbedBuilder } = require('discord.js');
const User = require('../../../database/models/User');

module.exports = {
  name: 'daily',
  description: 'Claim your daily allowance of credits.',
  async execute(message, args) {
    const userId = message.author.id;

    try {
      let user = await User.findOne({ discordId: userId });
      if (!user) {
        user = new User({ discordId: userId, username: message.author.username });
      }

      // Check daily cooldown (stored in user.cooldowns map or direct date)
      const lastDaily = user.cooldowns.get('daily');
      const now = new Date();

      if (lastDaily && (now - new Date(lastDaily)) < 86400000) { // 24 hours
        const diffMs = 86400000 - (now - new Date(lastDaily));
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        return message.reply(`❌ You have already claimed your daily credits! Come back in **${diffHrs}h ${diffMins}m**.`);
      }

      // Calculate reward: base $250, Premium gets double ($500)
      const baseReward = 250;
      const multiplier = user.premiumTier !== 'FREE' ? 2 : 1;
      const finalReward = baseReward * multiplier;

      user.wallet += finalReward;
      user.cooldowns.set('daily', now);
      await user.save();

      const embed = new EmbedBuilder()
        .setTitle('🎁 Daily Reward Claimed!')
        .setDescription(`You received **$${finalReward}** credits!`)
        .setColor('#32cd32')
        .addFields(
          { name: '💰 Wallet Balance', value: `\`$${user.wallet.toLocaleString()}\`` },
          { name: '👑 Premium Bonus multiplier', value: `\`${multiplier}x\` (${user.premiumTier})` }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Failed to claim daily allowance: ${err.message}`);
    }
  }
};
