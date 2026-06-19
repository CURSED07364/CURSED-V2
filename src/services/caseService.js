const Case = require('../database/models/Case');
const ModerationStats = require('../database/models/ModerationStats');
const logger = require('../utils/logger');

/**
 * Returns the current date as a YYYY-MM-DD string.
 */
function getDateKey() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Maps a case action to the ModerationStats field name.
 */
const ACTION_STAT_MAP = {
  WARN: 'warnings',
  BAN: 'bans',
  KICK: 'kicks',
  TIMEOUT: 'timeouts',
  SOFTBAN: 'softbans',
  UNBAN: 'unbans'
};

class CaseService {
  /**
   * Create a new moderation case and increment daily stats.
   */
  async createCase(guildId, userId, moderatorId, action, reason, duration = null) {
    try {
      const lastCase = await Case.findOne({ guildId }).sort({ caseId: -1 }).lean();
      const caseId = (lastCase?.caseId || 0) + 1;

      const expiresAt = duration ? new Date(Date.now() + duration) : null;

      const newCase = new Case({
        guildId,
        caseId,
        userId,
        moderatorId,
        action,
        reason,
        duration,
        expiresAt
      });

      await newCase.save();

      // Increment daily moderation stats
      const statField = ACTION_STAT_MAP[action];
      if (statField) {
        await ModerationStats.findOneAndUpdate(
          { guildId, date: getDateKey() },
          { $inc: { [statField]: 1 } },
          { upsert: true }
        );
      }

      return newCase;
    } catch (err) {
      logger.error('CaseService.createCase error:', err);
      throw err;
    }
  }

  /**
   * Retrieve a single case by guild + case number.
   */
  async getCase(guildId, caseId) {
    return Case.findOne({ guildId, caseId });
  }

  /**
   * Retrieve all cases for a user in a guild, newest first.
   */
  async getUserCases(guildId, userId) {
    return Case.find({ guildId, userId }).sort({ caseId: -1 });
  }

  /**
   * Add a moderator note to an existing case.
   */
  async addNote(guildId, caseId, moderatorId, content) {
    return Case.findOneAndUpdate(
      { guildId, caseId },
      { $push: { notes: { moderatorId, content, createdAt: new Date() } } },
      { new: true }
    );
  }

  /**
   * Deactivate a case (e.g. when a warning is removed).
   */
  async deactivateCase(guildId, caseId) {
    return Case.findOneAndUpdate(
      { guildId, caseId },
      { $set: { active: false } },
      { new: true }
    );
  }

  /**
   * Submit an appeal for a case.
   */
  async createAppeal(guildId, caseId, reason) {
    return Case.findOneAndUpdate(
      { guildId, caseId },
      {
        $set: {
          appealStatus: 'PENDING',
          appealReason: reason,
          appealedAt: new Date()
        }
      },
      { new: true }
    );
  }

  /**
   * Resolve an appeal (APPROVED or REJECTED).
   */
  async resolveAppeal(guildId, caseId, status) {
    return Case.findOneAndUpdate(
      { guildId, caseId },
      { $set: { appealStatus: status } },
      { new: true }
    );
  }

  /**
   * Increment the automod action counter for today.
   */
  async trackAutoModAction(guildId) {
    try {
      await ModerationStats.findOneAndUpdate(
        { guildId, date: getDateKey() },
        { $inc: { automodActions: 1 } },
        { upsert: true }
      );
    } catch (err) {
      logger.error('CaseService.trackAutoModAction error:', err);
    }
  }

  /**
   * Increment ticket stats for today.
   */
  async trackTicket(guildId, type) {
    try {
      const field = type === 'created' ? 'ticketsCreated' : 'ticketsClosed';
      await ModerationStats.findOneAndUpdate(
        { guildId, date: getDateKey() },
        { $inc: { [field]: 1 } },
        { upsert: true }
      );
    } catch (err) {
      logger.error('CaseService.trackTicket error:', err);
    }
  }
}

module.exports = new CaseService();
