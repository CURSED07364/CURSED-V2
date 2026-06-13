const { EmbedBuilder } = require('discord.js');
const User = require('../../../database/models/User');

module.exports = {
  name: 'xp',
  aliases: ['level', 'lvl'],
  description: 'View your current XP, level, and progress.',
  async execute(message, args) {
    const target = message.mentions.users.first() || message.author;
    
    try {
      const user = await User.findOne({ discordId: target.id });
      if (!user) {
        return message.reply(target.id === message.author.id 
          ? '❌ You do not have an active profile yet. Chat a bit first!' 
          : '❌ That user does not have an active profile yet.');
      }

      const nextLevelXp = user.level * 500;
      const progressPercent = Math.min(Math.round((user.xp / nextLevelXp) * 100), 100);

      // Simple ASCII progress bar
      const barLength = 15;
      const filledLength = Math.round((progressPercent / 100) * barLength);
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${target.username}'s Level Profile`)
        .setColor('#6c35de')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '✨ Level', value: `\`${user.level}\``, inline: true },
          { name: '⭐ Total XP', value: `\`${user.xp} / ${nextLevelXp}\``, inline: true },
          { name: '👑 Premium Booster', value: `\`${user.premiumTier !== 'FREE' ? 'Active (' + user.premiumTier + ')' : 'None'}\``, inline: true },
          { name: '📈 Progress', value: `\`${bar}\` (${progressPercent}%)` }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Error loading level details: ${err.message}`);
    }
  }
};
