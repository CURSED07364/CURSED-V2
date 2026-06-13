const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../../utils/modLogger');

module.exports = {
  name: 'unmute',
  description: 'Unmute a member in the server.',
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(context, args, client) {
    const isInteraction = !context.author;
    const guild = context.guild;
    const moderator = isInteraction ? context.user : context.author;

    let targetMember;

    if (isInteraction) {
      const user = context.options.getUser('user');
      targetMember = await guild.members.fetch(user.id).catch(() => null);
    } else {
      if (!context.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return context.reply('❌ You do not have permission to use this command.');
      }
      const user = context.mentions.users.first();
      targetMember = user ? await guild.members.fetch(user.id).catch(() => null) : null;
    }

    if (!targetMember) {
      const reply = '❌ User not found in this server.';
      return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
    }

    try {
      const mutedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
      if (!mutedRole || !targetMember.roles.cache.has(mutedRole.id)) {
        const reply = '❌ This user is not muted.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      await targetMember.roles.remove(mutedRole);
      
      await sendModLog(client, guild, 'UNMUTE', targetMember.user, moderator, 'Manual Unmute');

      const successReply = `✅ **${targetMember.user.tag}** has been unmuted.`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }
    } catch (err) {
      const errorReply = `❌ Failed to unmute: ${err.message}`;
      if (isInteraction) {
        await context.reply({ content: errorReply, ephemeral: true });
      } else {
        await context.reply(errorReply);
      }
    }
  }
};
