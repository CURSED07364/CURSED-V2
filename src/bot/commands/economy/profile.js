const { EmbedBuilder } = require('discord.js');
const User = require('../../../database/models/User');

module.exports = {
  name: 'profile',
  aliases: ['p', 'userinfo'],
  description: 'View your comprehensive bot profile card.',
  async execute(message, args) {
    const target = message.mentions.users.first() || message.author;

    try {
      let user = await User.findOne({ discordId: target.id });
      if (!user) {
        user = new User({ discordId: target.id, username: target.username });
        await user.save();
      }

      const nextLevelXp = user.level * 500;
      const progressPercent = Math.min(Math.round((user.xp / nextLevelXp) * 100), 100);
      const equippedPet = user.pets ? user.pets.find(p => p.equipped) : null;
      const totalSavings = user.wallet + user.bank;

      const embed = new EmbedBuilder()
        .setTitle(`💀 ${target.username}'s CURSED Profile`)
        .setColor('#6c35de')
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '✨ Level/XP', value: `Level \`${user.level}\` (${user.xp} / ${nextLevelXp} XP, ${progressPercent}%)`, inline: true },
          { name: '👑 Sub Tier', value: `\`${user.premiumTier}\``, inline: true },
          { name: '💰 Total Savings', value: `\`$${totalSavings.toLocaleString()}\``, inline: true },
          { name: '🐾 Companion', value: equippedPet ? `**${equippedPet.name}** (Lv.${equippedPet.level})` : '`None`', inline: true },
          { name: '🏆 Badges Earned', value: `\`${user.achievements ? user.achievements.length : 0}\` badges`, inline: true }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Profile command failed: ${err.message}`);
    }
  }
};
