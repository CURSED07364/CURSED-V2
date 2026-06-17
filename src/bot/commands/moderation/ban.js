const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../../utils/modLogger');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

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
    const moderator = context.member; // GuildMember

    try {
      // 1. Check cooldown
      const cooldown = cooldownService.check(moderator.id, 'ban');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        const reply = `⏱️ Please wait ${seconds}s before using this command again.`;
        return isInteraction
          ? context.reply({ content: reply, ephemeral: true })
          : context.reply(reply);
      }

      // 2. Extract target and reason
      let targetUser;
      let targetMember;
      let reason = 'No reason provided';

      if (isInteraction) {
        targetUser = context.options.getUser('user');
        targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
        reason = context.options.getString('reason') || reason;
      } else {
        targetUser = context.mentions.users.first();
        targetMember = targetUser ? await guild.members.fetch(targetUser.id).catch(() => null) : null;
        reason = args.slice(1).join(' ') || reason;
      }

      if (!targetUser) {
        const reply = '❌ User not found.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      // 3. Validate moderation permissions and role hierarchy (only if member is in server)
      if (targetMember) {
        const validation = await validateModeration(moderator, targetMember, guild, 'BAN');
        if (!validation.valid) {
          return isInteraction
            ? context.reply({ content: validation.reason, ephemeral: true })
            : context.reply(validation.reason);
        }

        if (!targetMember.bannable) {
          const reply = '❌ I cannot ban this user.';
          return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
        }
      }

      await guild.members.ban(targetUser.id, { reason });

      // 4. Set cooldown
      cooldownService.set(moderator.id, 'ban', 3000);

      await sendModLog(client, guild, 'BAN', targetUser, moderator.user, reason);

      const successReply = `✅ **${targetUser.tag}** has been banned.`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }
    } catch (err) {
      await handleCommandError(err, context, 'ban');
    }
  }
};
