const { EmbedBuilder } = require('discord.js');
const User = require('../../../database/models/User');

const DEFAULT_QUESTS = [
  { id: 'chat_active', title: 'Talkative Member', target: 20, description: 'Send 20 messages in the server.' },
  { id: 'daily_credits', title: 'Daily Claimer', target: 1, description: 'Claim your daily allowance.' }
];

module.exports = {
  name: 'quests',
  aliases: ['quest', 'dailyquests'],
  description: 'View and claim active quests.',
  async execute(message, args) {
    const userId = message.author.id;

    try {
      let user = await User.findOne({ discordId: userId });
      if (!user) {
        user = new User({ discordId: userId, username: message.author.username });
      }

      // Initialize quests if empty
      if (!user.quests || user.quests.length === 0) {
        user.quests = DEFAULT_QUESTS.map(q => ({
          id: q.id,
          title: q.title,
          progress: 0,
          target: q.target,
          completed: false,
          startedAt: new Date()
        }));
        await user.save();
      }

      const questEmbed = new EmbedBuilder()
        .setTitle('⚔️ Active Quests')
        .setColor('#6c35de')
        .setTimestamp();

      const questRows = user.quests.map(q => {
        const desc = DEFAULT_QUESTS.find(dq => dq.id === q.id)?.description || '';
        const status = q.completed 
          ? '✅ **Completed**' 
          : `\`${q.progress} / ${q.target}\` (${Math.round((q.progress / q.target) * 100)}%)`;
        return `• **${q.title}**\n  _${desc}_\n  Status: ${status}`;
      }).join('\n\n');

      questEmbed.setDescription(questRows);
      
      await message.reply({ embeds: [questEmbed] });
    } catch (err) {
      await message.reply(`❌ Quest command failed: ${err.message}`);
    }
  }
};
