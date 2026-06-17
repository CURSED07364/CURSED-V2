const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../../utils/modLogger');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

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
    const moderator = context.member; // GuildMember

    try {
      // 1. Check cooldown
      const cooldown = cooldownService.check(moderator.id, 'unmute');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        const reply = `⏱️ Please wait ${seconds}s before using this command again.`;
        return isInteraction
          ? context.reply({ content: reply, ephemeral: true })
          : context.reply(reply);
      }

      // 2. Extract target
      let targetMember;

      if (isInteraction) {
        const user = context.options.getUser('user');
        targetMember = await guild.members.fetch(user.id).catch(() => null);
      } else {
        const user = context.mentions.users.first();
        targetMember = user ? await guild.members.fetch(user.id).catch(() => null) : null;
      }

      if (!targetMember) {
        const reply = '❌ User not found in this server.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      // 3. Validate moderation permissions and role hierarchy
      const validation = await validateModeration(moderator, targetMember, guild, 'UNMUTE');
      if (!validation.valid) {
        return isInteraction
          ? context.reply({ content: validation.reason, ephemeral: true })
          : context.reply(validation.reason);
      }

      const mutedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
      if (!mutedRole || !targetMember.roles.cache.has(mutedRole.id)) {
        const reply = '❌ This user is not muted.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      await targetMember.roles.remove(mutedRole);

      // 4. Set cooldown
      cooldownService.set(moderator.id, 'unmute', 3000);

      await sendModLog(client, guild, 'UNMUTE', targetMember.user, moderator.user, 'Manual Unmute');

      const successReply = `✅ **${targetMember.user.tag}** has been unmuted.`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }
    } catch (err) {
      await handleCommandError(err, context, 'unmute');
    }
  }
};
