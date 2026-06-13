const { EmbedBuilder } = require('discord.js');
const premiumService = require('../../../services/premiumService');

module.exports = {
  name: 'premiumstatus',
  aliases: ['pstatus', 'statuspremium'],
  description: 'Check your premium subscription status and current server status.',
  async execute(message, args) {
    const userId = message.author.id;
    const guildId = message.guild?.id;

    try {
      const userPremium = await premiumService.getUserPremiumStatus(userId);
      const guildPremium = guildId ? await premiumService.getGuildPremiumStatus(guildId) : null;

      const embed = new EmbedBuilder()
        .setTitle('🛡️ Your Premium Status')
        .setColor('#6c35de')
        .addFields(
          {
            name: '👤 User Status',
            value: `**Tier**: \`${userPremium.tier}\`\n**Expires**: ${userPremium.expiresAt ? `<t:${Math.floor(userPremium.expiresAt.getTime() / 1000)}:R>` : '`N/A`'}\n**Server Slots Available**: \`${userPremium.serverQuota}\``,
            inline: false
          }
        );

      if (guildPremium) {
        embed.addFields({
          name: '🖥️ Current Server Status',
          value: `**Premium Enabled**: \`${guildPremium.isPremium ? 'YES' : 'NO'}\`\n**Tier**: \`${guildPremium.tier}\`\n**Expires**: ${guildPremium.expiresAt ? `<t:${Math.floor(guildPremium.expiresAt.getTime() / 1000)}:R>` : '`N/A`'}`,
          inline: false
        });
      }

      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Error checking premium status: ${err.message}`);
    }
  }
};
