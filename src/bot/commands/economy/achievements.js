const { EmbedBuilder } = require('discord.js');
const User = require('../../../database/models/User');

const ACHIEVEMENT_LIST = {
  beginner: { name: '🌱 Fresh Meat', desc: 'Reach Level 2 in the bot.' },
  rich: { name: '💰 Rich Club', desc: 'Accumulate more than $5,000 in credits.' },
  supporter: { name: '⭐ Cursed Supporter', desc: 'Subscribe to any premium tier.' },
  veteran: { name: '💀 Soul Bound', desc: 'Reach Level 10 in the bot.' }
};

module.exports = {
  name: 'achievements',
  aliases: ['achievement', 'badges'],
  description: 'View your unlocked achievements.',
  async execute(message, args) {
    const userId = message.author.id;

    try {
      let user = await User.findOne({ discordId: userId });
      if (!user) {
        user = new User({ discordId: userId, username: message.author.username });
        await user.save();
      }

      // Proactively check and unlock achievements in-memory before rendering
      const unlocked = [];
      if (user.level >= 2) unlocked.push('beginner');
      if (user.level >= 10) unlocked.push('veteran');
      if ((user.wallet + user.bank) >= 5000) unlocked.push('rich');
      if (user.premiumTier !== 'FREE') unlocked.push('supporter');

      // Update DB if new ones unlocked
      const newUnlocked = unlocked.filter(ach => !user.achievements.includes(ach));
      if (newUnlocked.length > 0) {
        user.achievements.push(...newUnlocked);
        await user.save();
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 Your Achievements & Badges')
        .setColor('#6c35de')
        .setTimestamp();

      const achievementsRender = Object.entries(ACHIEVEMENT_LIST).map(([id, info]) => {
        const hasIt = user.achievements.includes(id);
        const icon = hasIt ? '🟢 [UNLOCKED]' : '🔴 [LOCKED]';
        return `**${info.name}** ${icon}\n_${info.desc}_`;
      }).join('\n\n');

      embed.setDescription(achievementsRender);

      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Achievement command failed: ${err.message}`);
    }
  }
};
