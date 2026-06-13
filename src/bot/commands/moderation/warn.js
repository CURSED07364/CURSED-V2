const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Warning = require('../../../database/models/Warning');
const { sendModLog } = require('../../../utils/modLogger');

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
    const moderator = isInteraction ? context.user : context.author;
    
    // 1. Extract target user and reason
    let targetUser;
    let reason;

    if (isInteraction) {
      targetUser = context.options.getUser('user');
      reason = context.options.getString('reason');
    } else {
      // Check permissions for prefix execution
      if (!context.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return context.reply('❌ You do not have permission to use this command.');
      }
      targetUser = context.mentions.users.first();
      reason = args.slice(1).join(' ');
      
      if (!targetUser) return context.reply('❌ Please mention a user to warn.');
      if (!reason) return context.reply('❌ Please specify a reason for the warning.');
    }

    try {
      // 2. Prevent self-warning or bot-warning
      if (targetUser.id === moderator.id) {
        const reply = '❌ You cannot warn yourself.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }
      if (targetUser.bot) {
        const reply = '❌ You cannot warn bots.';
        return isInteraction ? context.reply({ content: reply, ephemeral: true }) : context.reply(reply);
      }

      // 3. Save warning record
      const warning = new Warning({
        guildId: guild.id,
        userId: targetUser.id,
        moderatorId: moderator.id,
        reason
      });
      await warning.save();

      // 4. Notify user in DM
      const dmEmbed = new EmbedBuilder()
        .setTitle(`⚠️ Warning: ${guild.name}`)
        .setDescription(`You have been warned for: **${reason}**`)
        .setColor('#ffff00')
        .setTimestamp();
      
      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

      // 5. Send mod log
      const warningsCount = await Warning.countDocuments({ guildId: guild.id, userId: targetUser.id, active: true });
      await sendModLog(client, guild, 'WARN', targetUser, moderator, reason, [
        { name: 'Total Warnings', value: `${warningsCount}`, inline: true }
      ]);

      const successReply = `✅ **${targetUser.tag}** has been warned. (Total warnings: ${warningsCount})`;
      if (isInteraction) {
        await context.reply({ content: successReply });
      } else {
        await context.reply(successReply);
      }

    } catch (err) {
      const errorReply = `❌ Failed to execute warning: ${err.message}`;
      if (isInteraction) {
        await context.reply({ content: errorReply, ephemeral: true });
      } else {
        await context.reply(errorReply);
      }
    }
  }
};
