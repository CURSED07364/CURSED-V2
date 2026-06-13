const { EmbedBuilder } = require('discord.js');
const premiumService = require('../../../services/premiumService');
const Guild = require('../../../database/models/Guild');

module.exports = {
  name: 'premiumservers',
  aliases: ['pservers', 'upgradeserver'],
  description: 'Manage premium server slot activations.',
  async execute(message, args) {
    const userId = message.author.id;
    const guildId = message.guild?.id;

    if (!args[0]) {
      // List active server upgrades
      try {
        const userStatus = await premiumService.getUserPremiumStatus(userId);
        const upgradedGuilds = await Guild.find({ premiumByUserId: userId, isPremium: true });

        const embed = new EmbedBuilder()
          .setTitle('🖥️ Your Upgraded Premium Servers')
          .setColor('#6c35de')
          .setDescription(`Quota: **${upgradedGuilds.length}/${userStatus.serverQuota}** slots used.\n\nUse \`!premiumservers upgrade\` to boost the current server.\nUse \`!premiumservers deactivate <guild_id>\` to remove boost.`)
          .addFields(
            {
              name: 'Upgraded Servers List',
              value: upgradedGuilds.length > 0 
                ? upgradedGuilds.map(g => `• **${g.name}** (ID: \`${g.guildId}\` | Tier: \`${g.premiumTier}\`)`).join('\n')
                : '*No servers currently upgraded.*'
            }
          );

        await message.reply({ embeds: [embed] });
      } catch (err) {
        await message.reply(`❌ Error loading premium servers: ${err.message}`);
      }
    } else {
      const subCommand = args[0].toLowerCase();
      
      if (subCommand === 'upgrade') {
        if (!guildId) return message.reply('❌ You can only run this command inside a server.');
        
        try {
          await premiumService.upgradeGuild(userId, guildId);
          await message.reply(`✅ **Success!** This server has been upgraded to Premium status using your subscription slot!`);
        } catch (err) {
          await message.reply(`❌ Failed to upgrade server: ${err.message}`);
        }
      } else if (subCommand === 'deactivate') {
        const targetGuildId = args[1];
        if (!targetGuildId) return message.reply('❌ Please specify a Guild ID to deactivate.');

        try {
          await premiumService.deactivateGuild(userId, targetGuildId);
          await message.reply(`✅ **Success!** Server \`${targetGuildId}\` has been downgraded to FREE tier, and your slot is now available.`);
        } catch (err) {
          await message.reply(`❌ Failed to deactivate server: ${err.message}`);
        }
      } else {
        await message.reply('❌ Invalid subcommand. Use `!premiumservers`, `!premiumservers upgrade`, or `!premiumservers deactivate <guildId>`.');
      }
    }
  }
};
