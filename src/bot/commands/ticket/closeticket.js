const { EmbedBuilder } = require('discord.js');
const Ticket = require('../../../database/models/Ticket');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'closeticket',
  aliases: ['close'],
  description: 'Close the current support ticket and generate a transcript.',
  async execute(message, args) {
    const channelId = message.channel.id;
    const author = message.author;

    try {
      // 1. Fetch ticket from DB
      const ticket = await Ticket.findOne({ channelId, status: 'OPEN' });
      if (!ticket) {
        return message.reply('❌ This command can only be executed inside an open support ticket channel.');
      }

      await message.reply('🔒 *Closing ticket and compiling transcript... Channel will be deleted in 5 seconds.*');

      // 2. Fetch all messages in the channel for transcript (up to 100)
      const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
      const transcriptLogs = [];

      // Sort messages chronologically
      const sortedMessages = Array.from(fetchedMessages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      for (const msg of sortedMessages) {
        if (msg.author.bot && msg.content.includes('Closing ticket')) continue; // Skip closure alerts
        
        transcriptLogs.push({
          authorId: msg.author.id,
          authorName: msg.author.tag,
          content: msg.content,
          attachments: Array.from(msg.attachments.values()).map(a => a.url),
          timestamp: new Date(msg.createdAt)
        });
      }

      // 3. Save updates to DB
      ticket.status = 'CLOSED';
      ticket.closedById = author.id;
      ticket.closedAt = new Date();
      ticket.transcript = transcriptLogs;
      await ticket.save();

      // 4. Send confirmation embed to user's DMs
      const creator = await message.client.users.fetch(ticket.creatorId).catch(() => null);
      if (creator) {
        const embed = new EmbedBuilder()
          .setTitle(`🔒 Ticket Closed: #${String(ticket.ticketNumber).padStart(4, '0')}`)
          .setDescription(`Your support ticket has been closed.`)
          .setColor('#ff4500')
          .addFields(
            { name: '🖥️ Server', value: `${message.guild.name}`, inline: true },
            { name: '🔒 Closed By', value: `${author.tag}`, inline: true },
            { name: '💬 Messages logged', value: `${transcriptLogs.length}`, inline: true }
          )
          .setTimestamp();

        await creator.send({ embeds: [embed] }).catch(() => {
          logger.info(`Could not DM transcript details to user ${ticket.creatorId}. DMs closed.`);
        });
      }

      // 5. Delete channel after 5s
      setTimeout(() => {
        message.channel.delete().catch(err => {
          logger.error('Failed to delete ticket channel:', err);
        });
      }, 5000);

    } catch (err) {
      logger.error('Error closing ticket:', err);
      await message.reply(`❌ Failed to close ticket: ${err.message}`);
    }
  }
};
