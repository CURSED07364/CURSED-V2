const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Warning = require('../../../database/models/Warning');
const { sendModLog } = require('../../../utils/modLogger');
const { validateModeration } = require('../../../utils/permissions');
const { handleCommandError } = require('../../../utils/errorHandler');
const cooldownService = require('../../../services/cooldownService');

module.exports = {
  name: 'warn',
  description: 'Warn a user for violating server rules.',
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user.')
    .addUserOption(opt => opt.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('The reason for warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  
  async execute(context, args, client) {
    const isInteraction = !context.author;
    const guild = context.guild;
    const moderator = context.member; // GuildMember (has .roles, .permissions)

    try {
      // 1. Check cooldown
      const cooldown = cooldownService.check(moderator.id, 'warn');
      if (cooldown.onCooldown) {
        const seconds = Math.ceil(cooldown.remainingMs / 1000);
        const reply = `⏱️ Please wait ${seconds}s before using this command again.`;
        return isInteraction
          ? context.reply({ content: reply, ephemeral: true })
          : context.reply(reply);
      }

      // 2. Extract target user and reason
      let targetUser;
      let targetMember;
      let reason;

      if (isInteraction) {
        targetUser = context.options.getUser('user');
        reason = context.options.getString('reason');
        targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      } else {
        targetUser = context.mentions.users.first();
        reason = args.slice(1).join(' ');

        if (!targetUser) return context.reply('❌ Please mention a user to warn.');
        if (!reason) return context.reply('❌ Please specify a reason for the warning.');

        targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      }

      if (!targetMember) {
        const reply = '❌ User not found in this server.';
        return isInteraction
          ? context.reply({ content: reply, ephemeral: true })
          : context.reply(reply);
      }

      // 3. Validate moderation permissions and role hierarchy
      const validation = await validateModeration(moderator, targetMember, guild, 'WARN');
      if (!validation.valid) {
        return isInteraction
          ? context.reply({ content: validation.reason, ephemeral: true })
          : context.reply(validation.reason);
      }

      // 4. Save warning record
      const warning = new Warning({
        guildId: guild.id,
        userId: targetUser.id,
        moderatorId: moderator.id,
        reason
      });
      await warning.save();

      // 5. Set cooldown
      cooldownService.set(moderator.id, 'warn', 3000);

      // 6. Notify user in DM
      const dmEmbed = new EmbedBuilder()
        .setTitle(`⚠️ Warning: ${guild.name}`)
        .setDescription(`You have been warned for: **${reason}**`)
        .setColor('#ffff00')
        .setTimestamp();

      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

      // 7. Send mod log
      const warningsCount = await Warning.countDocuments({
        guildId: guild.id,
        userId: targetUser.id,
        active: true
      });
      await sendModLog(client, guild, 'WARN', targetUser, moderator.user, reason, [
        { name: 'Total Warnings', value: `${warningsCount}`, inline: true }
      ]);

      const successReply = `✅ **${targetUser.tag}** has been warned. (Total warnings: ${warningsCount})`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }

    } catch (err) {
      await handleCommandError(err, context, 'warn');
    }
  }
};
