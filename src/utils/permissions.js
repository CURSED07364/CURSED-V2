const { PermissionFlagsBits } = require('discord.js');
const logger = require('./logger');

/**
 * Validates if a moderator can perform an action on a target user.
 * Checks server ownership, bot targets, self-moderation, role hierarchy
 * (both moderator vs target and bot vs target), and required permissions.
 *
 * @param {GuildMember} moderator - The moderator performing the action
 * @param {GuildMember} target    - The target member
 * @param {Guild}       guild     - The guild
 * @param {string}      action    - Action key: WARN, KICK, BAN, etc.
 * @returns {Promise<{valid: boolean, reason: string}>}
 */
async function validateModeration(moderator, target, guild, action) {
  // Cannot moderate the server owner
  if (target.id === guild.ownerId) {
    return { valid: false, reason: '❌ Cannot moderate the server owner.' };
  }

  // Cannot moderate bots
  if (target.user.bot) {
    return { valid: false, reason: '❌ Cannot moderate bots.' };
  }

  // Cannot moderate yourself
  if (moderator.id === target.id) {
    return { valid: false, reason: '❌ You cannot moderate yourself.' };
  }

  // Target must have a strictly lower role than the moderator
  if (target.roles.highest.position >= moderator.roles.highest.position) {
    return {
      valid: false,
      reason: '❌ Target user has equal or higher role than you. You can only moderate users with lower roles.'
    };
  }

  // Bot must also outrank the target
  const botMember = guild.members.me;
  if (target.roles.highest.position >= botMember.roles.highest.position) {
    return {
      valid: false,
      reason: '❌ Target user has equal or higher role than the bot. The bot cannot moderate this user.'
    };
  }

  // Verify the moderator holds the Discord permission required for this action
  const requiredPermissions = {
    WARN:     PermissionFlagsBits.ModerateMembers,
    TIMEOUT:  PermissionFlagsBits.ModerateMembers,
    MUTE:     PermissionFlagsBits.ModerateMembers,
    UNMUTE:   PermissionFlagsBits.ModerateMembers,
    KICK:     PermissionFlagsBits.KickMembers,
    BAN:      PermissionFlagsBits.BanMembers,
    UNBAN:    PermissionFlagsBits.BanMembers,
    SOFTBAN:  PermissionFlagsBits.BanMembers,
    PURGE:    PermissionFlagsBits.ManageMessages,
    SLOWMODE: PermissionFlagsBits.ManageChannels,
    LOCK:     PermissionFlagsBits.ManageChannels,
    UNLOCK:   PermissionFlagsBits.ManageChannels
  };

  const required = requiredPermissions[action];
  if (required && !moderator.permissions.has(required)) {
    return {
      valid: false,
      reason: `❌ You don't have permission to ${action.toLowerCase()} users.`
    };
  }

  return { valid: true, reason: '' };
}

/**
 * Returns whether a member holds a given permission flag.
 * @param {GuildMember} member     - The member to check
 * @param {BigInt}      permission - A PermissionFlagsBits value
 * @returns {boolean}
 */
function hasPermission(member, permission) {
  return member.permissions.has(permission);
}

/**
 * Returns the highest role position of a member.
 * @param {GuildMember} member
 * @returns {number}
 */
function getRolePosition(member) {
  return member.roles.highest.position;
}

module.exports = {
  validateModeration,
  hasPermission,
  getRolePosition
};
