const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../../utils/modLogger');

module.exports = {
  name: 'ban',
  description: 'Ban a member from the server.',
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for banning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(context, args, client) {
    const isInteraction = !context.author;
    const guild = context.guild;
    const moderator = isInteraction ? context.user : context.author;

    let targetUser;
    let targetMember;
    let reason = 'No reason provided';

    if (isInteraction) {
      targetUser = context.options.getUser('user');
      targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      reason = context.options.getString('reason') || reason;
    } else {
      if (!context.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return context.reply('❌ You do not have permission to use this command.');
      }
      targetUser = context.mentions.users.first();
      targetMember = targetUser ? await guild.members.fetch(targetUser.id).catch(() => null) : null;
      reason = args.slice(1).join(' ') || reason;
    }

    if (!targetUser) {
      const reply = '❌ User not found.';
      return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
    }

    try {
      // Check hierarchy if member exists in server
      if (targetMember) {
        if (targetMember.roles.highest.position >= context.guild.members.me.roles.highest.position) {
          const reply = '❌ I cannot ban this user as their role is higher than or equal to mine.';
          return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
        }
        if (!targetMember.bannable) {
          const reply = '❌ I cannot ban this user.';
          return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
        }
      }

      await guild.members.ban(targetUser.id, { reason });
      
      await sendModLog(client, guild, 'BAN', targetUser, moderator, reason);

      const successReply = `✅ **${targetUser.tag}** has been banned.`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }
    } catch (err) {
      const errorReply = `❌ Failed to ban: ${err.message}`;
      if (isInteraction) {
        await context.reply({ content: errorReply, ephemeral: true });
      } else {
        await context.reply(errorReply);
      }
    }
  }
};
