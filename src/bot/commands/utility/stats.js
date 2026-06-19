const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ModerationStats = require('../../../database/models/ModerationStats');
const Case = require('../../../database/models/Case');
const { handleCommandError } = require('../../../utils/errorHandler');

module.exports = {
  name: 'stats',
  description: 'View moderation statistics for this server.',
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View moderation statistics for this server.')
    .addStringOption(opt =>
      opt.setName('period')
        .setDescription('Time period to view stats for')
        .addChoices(
          { name: 'Today', value: 'today' },
          { name: 'Last 7 days', value: '7d' },
          { name: 'Last 30 days', value: '30d' },
          { name: 'All time', value: 'all' }
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const period = interaction.options.getString('period') || 'today';

      await interaction.deferReply();

      let stats;
      let periodLabel;

      if (period === 'all') {
        // Aggregate all-time stats from Case model
        periodLabel = 'All Time';
        const [warnings, bans, kicks, timeouts, softbans] = await Promise.all([
          Case.countDocuments({ guildId: guild.id, action: 'WARN' }),
          Case.countDocuments({ guildId: guild.id, action: 'BAN' }),
          Case.countDocuments({ guildId: guild.id, action: 'KICK' }),
          Case.countDocuments({ guildId: guild.id, action: 'TIMEOUT' }),
          Case.countDocuments({ guildId: guild.id, action: 'SOFTBAN' })
        ]);
        stats = { warnings, bans, kicks, timeouts, softbans, automodActions: 0, ticketsCreated: 0, ticketsClosed: 0 };
      } else {
        // Aggregate from ModerationStats daily records
        let dateFilter;
        const now = new Date();

        if (period === 'today') {
          periodLabel = 'Today';
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          dateFilter = { date: today };
        } else if (period === '7d') {
          periodLabel = 'Last 7 Days';
          const dates = [];
          for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          }
          dateFilter = { date: { $in: dates } };
        } else {
          periodLabel = 'Last 30 Days';
          const dates = [];
          for (let i = 0; i < 30; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          }
          dateFilter = { date: { $in: dates } };
        }

        const records = await ModerationStats.find({ guildId: guild.id, ...dateFilter });
        stats = records.reduce((acc, r) => ({
          warnings: acc.warnings + (r.warnings || 0),
          bans: acc.bans + (r.bans || 0),
          kicks: acc.kicks + (r.kicks || 0),
          timeouts: acc.timeouts + (r.timeouts || 0),
          softbans: acc.softbans + (r.softbans || 0),
          automodActions: acc.automodActions + (r.automodActions || 0),
          ticketsCreated: acc.ticketsCreated + (r.ticketsCreated || 0),
          ticketsClosed: acc.ticketsClosed + (r.ticketsClosed || 0)
        }), { warnings: 0, bans: 0, kicks: 0, timeouts: 0, softbans: 0, automodActions: 0, ticketsCreated: 0, ticketsClosed: 0 });
      }

      const total = stats.warnings + stats.bans + stats.kicks + stats.timeouts + stats.softbans;

      const embed = new EmbedBuilder()
        .setTitle(`📊 Moderation Stats — ${periodLabel}`)
        .setDescription(`**${guild.name}** moderation activity`)
        .addFields(
          { name: '⚠️ Warnings', value: `${stats.warnings}`, inline: true },
          { name: '🔨 Bans', value: `${stats.bans}`, inline: true },
          { name: '👢 Kicks', value: `${stats.kicks}`, inline: true },
          { name: '⏱️ Timeouts', value: `${stats.timeouts}`, inline: true },
          { name: '🔨 Softbans', value: `${stats.softbans}`, inline: true },
          { name: '🤖 AutoMod', value: `${stats.automodActions}`, inline: true },
          { name: '🎫 Tickets Opened', value: `${stats.ticketsCreated}`, inline: true },
          { name: '🔒 Tickets Closed', value: `${stats.ticketsClosed}`, inline: true },
          { name: '📋 Total Actions', value: `${total}`, inline: true }
        )
        .setColor('#6c35de')
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await handleCommandError(err, interaction, 'stats');
    }
  }
};
