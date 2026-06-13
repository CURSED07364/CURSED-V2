const { EmbedBuilder } = require('discord.js');
const premiumService = require('../../../services/premiumService');
const CustomAIProfile = require('../../../database/models/CustomAIProfile');
const Guild = require('../../../database/models/Guild');

module.exports = {
  name: 'personality',
  aliases: ['aiprompt'],
  description: 'View or set your custom user or server AI personality (PREMIUM+ only).',
  async execute(message, args) {
    const userId = message.author.id;
    const guildId = message.guild?.id;

    try {
      const userPremium = await premiumService.getUserPremiumStatus(userId);
      
      // Check if they want to update
      if (args.length > 0) {
        if (userPremium.tier !== 'PREMIUM+') {
          return message.reply('❌ Custom personalities are a **PREMIUM+** exclusive feature! Type `!subscribe` to upgrade.');
        }

        const newPrompt = args.join(' ');
        
        // Check if editing server personality or user personality
        const isServerStaff = message.member?.permissions.has('ManageGuild');
        
        if (isServerStaff && args[0].toLowerCase() === 'server') {
          const promptText = args.slice(1).join(' ');
          if (!promptText) return message.reply('❌ Please specify a personality prompt for the server.');
          
          await Guild.findOneAndUpdate(
            { guildId },
            { $set: { 'ai.personality': promptText } },
            { upsert: true }
          );
          return message.reply('✅ **Success!** Server-wide AI personality updated.');
        } else {
          // Update user personality
          await CustomAIProfile.findOneAndUpdate(
            { entityId: userId, type: 'USER' },
            { $set: { systemPrompt: newPrompt } },
            { upsert: true }
          );
          return message.reply('✅ **Success!** Your personal AI personality prompt has been updated.');
        }
      }

      // View personality
      const userProfile = await CustomAIProfile.findOne({ entityId: userId, type: 'USER' });
      const guildInfo = guildId ? await Guild.findOne({ guildId }) : null;

      const embed = new EmbedBuilder()
        .setTitle('🤖 Custom AI Personality Info')
        .setColor('#6c35de')
        .addFields(
          { 
            name: '👤 Your Personal Persona', 
            value: userProfile?.systemPrompt ? `\`\`\`${userProfile.systemPrompt}\`\`\`` : '*Default AI Bot Persona*' 
          }
        );

      if (guildInfo) {
        embed.addFields({
          name: '🖥️ Current Server Persona',
          value: `\`\`\`${guildInfo.ai?.personality || 'Default Guild Persona'}\`\`\``
        });
      }

      embed.setFooter({ text: 'PREMIUM+ members can update via: !personality [prompt]' });
      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Error: ${err.message}`);
    }
  }
};
