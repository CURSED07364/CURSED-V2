const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../../utils/modLogger');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

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
    const moderator = context.member; // GuildMember

    try {
      // 1. Check cooldown
      const cooldown = cooldownService.check(moderator.id, 'kick');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        const reply = `⏱️ Please wait ${seconds}s before using this command again.`;
        return isInteraction
          ? context.reply({ content: reply, ephemeral: true })
          : context.reply(reply);
      }

      // 2. Extract target and reason
      let targetMember;
      let reason = 'No reason provided';

      if (isInteraction) {
        const user = context.options.getUser('user');
        targetMember = await guild.members.fetch(user.id).catch(() => null);
        reason = context.options.getString('reason') || reason;
      } else {
        const user = context.mentions.users.first();
        targetMember = user ? await guild.members.fetch(user.id).catch(() => null) : null;
        reason = args.slice(1).join(' ') || reason;
      }

      if (!targetMember) {
        const reply = '❌ User not found in this server.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      // 3. Validate moderation permissions and role hierarchy
      const validation = await validateModeration(moderator, targetMember, guild, 'KICK');
      if (!validation.valid) {
        return isInteraction
          ? context.reply({ content: validation.reason, ephemeral: true })
          : context.reply(validation.reason);
      }

      if (!targetMember.kickable) {
        const reply = '❌ I cannot kick this user.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      await targetMember.kick(reason);

      // 4. Set cooldown
      cooldownService.set(moderator.id, 'kick', 3000);

      await sendModLog(client, guild, 'KICK', targetMember.user, moderator.user, reason);

      const successReply = `✅ **${targetMember.user.tag}** has been kicked.`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }
    } catch (err) {
      await handleCommandError(err, context, 'kick');
    }
  }
};
