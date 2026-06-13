const { EmbedBuilder } = require('discord.js');
const imageService = require('../../../services/imageService');
const premiumService = require('../../../services/premiumService');

module.exports = {
  name: 'imagine',
  aliases: ['generateimage', 'draw'],
  description: 'Generate an image using AI.',
  async execute(message, args, client, cmdType = 'imagine') {
    if (args.length === 0) {
      return message.reply('⚠️ Please provide a prompt, e.g. `!imagine a purple dragon in dark space`.');
    }

    const userId = message.author.id;
    const prompt = args.join(' ');

    try {
      // 1. Get user premium status
      const userPremium = await premiumService.getUserPremiumStatus(userId);
      const isPremium = userPremium.tier !== 'FREE';

      // 2. Enforce Rate Limiting (FREE: 1 image/min, PREMIUM/PREMIUM+: 5 images/min)
      const now = Date.now();
      const cooldownKey = `image_cooldown:${userId}`;
      const userHistory = client.cooldowns.get(cooldownKey) || [];

      // Filter history to last 60 seconds
      const recentAttempts = userHistory.filter(timestamp => now - timestamp < 60000);

      const limit = isPremium ? 5 : 1;
      if (recentAttempts.length >= limit) {
        const remainingSeconds = Math.ceil((60000 - (now - recentAttempts[0])) / 1000);
        return message.reply(`❌ Rate limit reached! You can generate up to **${limit}** images per minute. Please wait **${remainingSeconds}s** or upgrade using \`!subscribe\`.`);
      }

      // Record this attempt
      recentAttempts.push(now);
      client.cooldowns.set(cooldownKey, recentAttempts);

      // 3. Send progress message
      const progressMsg = await message.reply('🎨 *Casting spell to generate your image... Please wait...*');

      // 4. Generate URL
      const imageURL = imageService.generateImageURL(cmdType, prompt);

      // 5. Send final embed
      const embed = new EmbedBuilder()
        .setTitle(`🎨 AI ${cmdType.toUpperCase()}`)
        .setDescription(`**Prompt**: ${prompt}\n**Author**: ${message.author}`)
        .setColor('#6c35de')
        .setImage(imageURL)
        .setTimestamp();

      await progressMsg.delete().catch(() => {});
      await message.reply({ embeds: [embed] });

    } catch (err) {
      await message.reply(`❌ Image generation failed: ${err.message}`);
    }
  }
};
