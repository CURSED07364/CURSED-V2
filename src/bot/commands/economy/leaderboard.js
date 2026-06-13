const { EmbedBuilder } = require('discord.js');
const User = require('../../../database/models/User');

module.exports = {
  name: 'leaderboard',
  aliases: ['lb', 'top'],
  description: 'View the server level leaderboard.',
  async execute(message, args) {
    const type = (args[0] || 'level').toLowerCase();

    try {
      let queryField = 'xp';
      let title = 'Level/XP Leaderboard';
      
      if (type === 'money' || type === 'balance' || type === 'cash') {
        queryField = 'wallet';
        title = 'Economy Leaderboard';
      }

      // Query top 10 users
      const topUsers = await User.find({ blacklisted: false })
        .sort({ [queryField]: -1 })
        .limit(10);

      const embed = new EmbedBuilder()
        .setTitle(`🏆 CURSED - ${title}`)
        .setColor('#6c35de')
        .setTimestamp();

      if (topUsers.length === 0) {
        embed.setDescription('*No profiles found yet.*');
      } else {
        const rows = topUsers.map((user, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `\`#${idx + 1}\``;
          const valueStr = queryField === 'xp' 
            ? `Lv. ${user.level} (${user.xp} XP)`
            : `$${(user.wallet + user.bank).toLocaleString()}`;
          return `${medal} **${user.username}** — ${valueStr}`;
        }).join('\n');
        
        embed.setDescription(rows);
      }

      embed.setFooter({ text: 'Use !leaderboard [level|money] to toggle views' });
      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Error loading leaderboard: ${err.message}`);
    }
  }
};
