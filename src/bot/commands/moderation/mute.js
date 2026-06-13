const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModLog } = require('../../../utils/modLogger');

module.exports = {
  name: 'mute',
  description: 'Mute a user by assigning them a Muted role.',
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to mute').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for muting').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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
      if (!context.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
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
        const reply = '❌ I cannot mute this user as their role is higher than or equal to mine.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      // Find or create 'Muted' role
      let mutedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
      if (!mutedRole) {
        mutedRole = await guild.roles.create({
          name: 'Muted',
          color: '#808080',
          reason: 'Mute command execution'
        });

        // Set channel overrides
        guild.channels.cache.forEach(channel => {
          channel.permissionOverwrites.create(mutedRole, {
            SendMessages: false,
            AddReactions: false,
            Speak: false
          }).catch(() => {});
        });
      }

      if (targetMember.roles.cache.has(mutedRole.id)) {
        const reply = '❌ This user is already muted.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      await targetMember.roles.add(mutedRole);
      
      await sendModLog(client, guild, 'MUTE', targetMember.user, moderator, reason);

      const successReply = `✅ **${targetMember.user.tag}** has been muted.`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }
    } catch (err) {
      const errorReply = `❌ Failed to mute: ${err.message}`;
      if (isInteraction) {
        await context.reply({ content: errorReply, ephemeral: true });
      } else {
        await context.reply(errorReply);
      }
    }
  }
};
