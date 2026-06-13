const CustomAIProfile = require('../../../database/models/CustomAIProfile');
const premiumService = require('../../../services/premiumService');

module.exports = {
  name: 'aimode',
  description: 'Set your AI response mode: STANDARD (default), CREATIVE (high temperature), or STRICT (low temperature).',
  async execute(message, args) {
    const userId = message.author.id;

    if (args.length === 0) {
      const profile = await CustomAIProfile.findOne({ entityId: userId, type: 'USER' });
      return message.reply(`ℹ️ Your current AI Mode is: \`${profile?.aimode || 'STANDARD'}\`. Set it with \`!aimode [STANDARD|CREATIVE|STRICT]\``);
    }

    const mode = args[0].toUpperCase();
    if (!['STANDARD', 'CREATIVE', 'STRICT'].includes(mode)) {
      return message.reply('❌ Invalid AI mode. Choose from: `STANDARD`, `CREATIVE`, or `STRICT`.');
    }

    try {
      const userPremium = await premiumService.getUserPremiumStatus(userId);
      if (mode !== 'STANDARD' && userPremium.tier === 'FREE') {
        return message.reply('❌ Custom AI modes require **PREMIUM** tier! Type `!subscribe` to upgrade.');
      }

      await CustomAIProfile.findOneAndUpdate(
        { entityId: userId, type: 'USER' },
        { $set: { aimode: mode } },
        { upsert: true }
      );

      await message.reply(`✅ **AI Mode updated!** Your personal AI prompts will now execute in \`${mode}\` mode.`);
    } catch (err) {
      await message.reply(`❌ Error setting AI mode: ${err.message}`);
    }
  }
};
