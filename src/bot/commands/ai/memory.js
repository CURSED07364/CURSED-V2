const { EmbedBuilder } = require('discord.js');
const CustomAIProfile = require('../../../database/models/CustomAIProfile');

module.exports = {
  name: 'memory',
  aliases: ['aimemory'],
  description: 'View statistics of your conversation context memory.',
  async execute(message, args) {
    const userId = message.author.id;

    try {
      const profile = await CustomAIProfile.findOne({ entityId: userId, type: 'USER' });
      const memoryCount = profile?.memory ? profile.memory.length : 0;
      const maxCount = profile?.maxMemorySize || 10;

      const embed = new EmbedBuilder()
        .setTitle('🧠 AI Memory Status')
        .setColor('#6c35de')
        .setDescription(`Your conversation sliding window is active.`)
        .addFields(
          { name: '💬 Messages Stored', value: `\`${memoryCount} / ${maxCount}\` messages`, inline: true },
          { name: '🗑️ Clear Memory', value: 'Type `!forget` to reset your conversation context.', inline: true }
        );

      await message.reply({ embeds: [embed] });
    } catch (err) {
      await message.reply(`❌ Error checking AI memory: ${err.message}`);
    }
  }
};
