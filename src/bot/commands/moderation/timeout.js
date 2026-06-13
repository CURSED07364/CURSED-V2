const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../../utils/modLogger');

function parseDuration(str) {
  const match = str.match(/^(\d+)([mhd])$/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

module.exports = {
  name: 'timeout',
  description: 'Timeout a member in the server.',
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to timeout').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(context, args, client) {
    const isInteraction = !context.author;
    const guild = context.guild;
    const moderator = isInteraction ? context.user : context.author;

    let targetMember;
    let durationStr;
    let reason = 'No reason provided';

    if (isInteraction) {
      const user = context.options.getUser('user');
      targetMember = await guild.members.fetch(user.id).catch(() => null);
      durationStr = context.options.getString('duration');
      reason = context.options.getString('reason') || reason;
    } else {
      if (!context.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return context.reply('❌ You do not have permission to use this command.');
      }
      const user = context.mentions.users.first();
      targetMember = user ? await guild.members.fetch(user.id).catch(() => null) : null;
      durationStr = args[1];
      reason = args.slice(2).join(' ') || reason;
    }

    if (!targetMember) {
      const reply = '❌ User not found in this server.';
      return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
    }

    if (!durationStr) {
      const reply = '❌ Please specify a duration (e.g. `10m`, `1h`, `1d`).';
      return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      const reply = '❌ Invalid duration format. Use e.g. `10m`, `2h`, `1d`.';
      return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
    }

    try {
      // Check hierarchy
      if (targetMember.roles.highest.position >= context.guild.members.me.roles.highest.position) {
        const reply = '❌ I cannot timeout this user as their role is higher than or equal to mine.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      await targetMember.timeout(durationMs, reason);
      
      await sendModLog(client, guild, 'TIMEOUT', targetMember.user, moderator, reason, [
        { name: 'Duration', value: durationStr, inline: true }
      ]);

      const successReply = `✅ **${targetMember.user.tag}** has been timed out for ${durationStr}.`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }
    } catch (err) {
      const errorReply = `❌ Failed to timeout: ${err.message}`;
      if (isInteraction) {
        await context.reply({ content: errorReply, ephemeral: true });
      } else {
        await context.reply(errorReply);
      }
    }
  }
};
