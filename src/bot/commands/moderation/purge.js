const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'purge',
  aliases: ['clear', 'clean'],
  description: 'Bulk delete messages from the current channel.',
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete messages.')
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(context, args, client) {
    const isInteraction = !context.author;
    const channel = context.channel;

    let amount;

    if (isInteraction) {
      amount = context.options.getInteger('amount');
    } else {
      if (!context.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return context.reply('❌ You do not have permission to use this command.');
      }
      amount = parseInt(args[0], 10);
    }

    if (isNaN(amount) || amount < 1 || amount > 100) {
      const reply = '❌ Please specify a valid amount of messages to delete between 1 and 100.';
      return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
    }

    try {
      const deleted = await channel.bulkDelete(amount, true);
      
      const successReply = `🧹 Successfully deleted **${deleted.size}** messages.`;
      
      if (isInteraction) {
        await context.reply({ content: successReply });
        // Auto-delete interaction response after 3s
        setTimeout(() => context.deleteReply().catch(() => {}), 3000);
      } else {
        const msg = await context.channel.send(successReply);
        setTimeout(() => msg.delete().catch(() => {}), 3000);
      }
    } catch (err) {
      const errorReply = `❌ Failed to purge messages: ${err.message}`;
      if (isInteraction) {
        await context.reply({ content: errorReply, ephemeral: true });
      } else {
        await context.reply(errorReply);
      }
    }
  }
};
