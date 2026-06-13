const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../../database/models/Guild');
const Ticket = require('../../../database/models/Ticket');
const logger = require('../../../utils/logger');

module.exports = {
  name: 'ticket',
  aliases: ['newticket', 'support'],
  description: 'Create a private support ticket channel.',
  async execute(message, args) {
    const guildId = message.guild.id;
    const creator = message.author;

    try {
      // 1. Fetch guild ticket settings
      let guildSettings = await Guild.findOne({ guildId });
      if (!guildSettings) {
        guildSettings = new Guild({ guildId, name: message.guild.name });
        await guildSettings.save();
      }

      // Check if ticket system is set up
      let categoryId = guildSettings.tickets?.categoryId;
      let staffRoleId = guildSettings.tickets?.staffRoleId;

      // Automatically try to resolve category/role if null for ease of setup
      if (!categoryId) {
        const category = message.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('tickets'));
        if (category) {
          categoryId = category.id;
        }
      }

      const ticketNumber = (guildSettings.tickets?.ticketCount || 0) + 1;
      const channelName = `ticket-${String(ticketNumber).padStart(4, '0')}`;

      // Build permissions
      const permissionOverwrites = [
        {
          id: message.guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: creator.id, // Ticket creator
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }
      ];

      // Add staff role if exists
      if (staffRoleId) {
        permissionOverwrites.push({
          id: staffRoleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
        });
      }

      // 2. Create the Channel
      const ticketChannel = await message.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId || null,
        permissionOverwrites
      });

      // 3. Increment Guild Ticket Counter
      await Guild.findOneAndUpdate(
        { guildId },
        { $inc: { 'tickets.ticketCount': 1 } }
      );

      // 4. Save Ticket model in DB
      const newTicket = new Ticket({
        guildId,
        channelId: ticketChannel.id,
        creatorId: creator.id,
        ticketNumber,
        status: 'OPEN'
      });
      await newTicket.save();

      // 5. Send Welcome message in Ticket channel
      const embed = new EmbedBuilder()
        .setTitle(`🎫 Ticket #${String(ticketNumber).padStart(4, '0')}`)
        .setDescription(`Hello ${creator}, support staff will be with you shortly.\nTo close this ticket, click the button below or type \`!closeticket\`.`)
        .setColor('#6c35de')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket_btn')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

      await ticketChannel.send({ embeds: [embed], components: [row] });
      await message.reply(`✅ Ticket created! Go to ${ticketChannel}`);

    } catch (err) {
      logger.error('Failed to create ticket:', err);
      await message.reply(`❌ Failed to create support ticket: ${err.message}`);
    }
  }
};
