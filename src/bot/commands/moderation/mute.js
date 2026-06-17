const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModLog } = require('../../../utils/modLogger');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

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
    const moderator = context.member; // GuildMember

    try {
      // 1. Check cooldown
      const cooldown = cooldownService.check(moderator.id, 'mute');
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
      const validation = await validateModeration(moderator, targetMember, guild, 'MUTE');
      if (!validation.valid) {
        return isInteraction
          ? context.reply({ content: validation.reason, ephemeral: true })
          : context.reply(validation.reason);
      }

      // 4. Find or create 'Muted' role
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

      // 5. Set cooldown
      cooldownService.set(moderator.id, 'mute', 3000);

      await sendModLog(client, guild, 'MUTE', targetMember.user, moderator.user, reason);

      const successReply = `✅ **${targetMember.user.tag}** has been muted.`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }
    } catch (err) {
      await handleCommandError(err, context, 'mute');
    }
  }
};
