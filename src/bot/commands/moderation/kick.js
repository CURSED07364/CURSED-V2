const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../../utils/modLogger');

module.exports = {
  name: 'kick',
  description: 'Kick a member from the server.',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for kicking').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(context, args, client) {
    const isInteraction = !context.author;
    const guild = context.guild;
    const moderator = isInteraction ? context.user : context.author;

    let targetMember;
    let reason = 'No reason provided';

    if (isInteraction) {
      const user = context.options.getUser('user');
      targetMember = await guild.members.fetch(user.id).catch(() => null);
      reason = context.options.getString('reason') || reason;
    } else {
      if (!context.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        return context.reply('❌ You do not have permission to use this command.');
      }
      const user = context.mentions.users.first();
      targetMember = user ? await guild.members.fetch(user.id).catch(() => null) : null;
      reason = args.slice(1).join(' ') || reason;
    }

    if (!targetMember) {
      const reply = '❌ User not found in this server.';
      return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
    }

    try {
      // Check hierarchy
      if (targetMember.roles.highest.position >= context.guild.members.me.roles.highest.position) {
        const reply = '❌ I cannot kick this user as their role is higher than or equal to mine.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }
      if (!targetMember.kickable) {
        const reply = '❌ I cannot kick this user.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      await targetMember.kick(reason);
      
      await sendModLog(client, guild, 'KICK', targetMember.user, moderator, reason);

      const successReply = `✅ **${targetMember.user.tag}** has been kicked.`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }
    } catch (err) {
      const errorReply = `❌ Failed to kick: ${err.message}`;
      if (isInteraction) {
        await context.reply({ content: errorReply, ephemeral: true });
      } else {
        await context.reply(errorReply);
      }
    }
  }
};
