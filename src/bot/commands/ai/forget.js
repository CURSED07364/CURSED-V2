const aiService = require('../../../services/aiService');

module.exports = {
  name: 'forget',
  aliases: ['resetmemory', 'clearcontext'],
  description: 'Reset your AI conversation context and forget memory logs.',
  async execute(message, args) {
    const userId = message.author.id;
    try {
      await aiService.clearMemory(userId, 'USER');
      await message.reply('🧠 **Memory wiped!** I have forgotten our previous conversation. Let’s start fresh!');
    } catch (err) {
      await message.reply(`❌ Failed to clear memory: ${err.message}`);
    }
  }
};
