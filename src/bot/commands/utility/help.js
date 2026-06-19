const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'help',
  description: 'Show all available commands.',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available moderation commands.'),

  async execute(interaction, args, client) {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ CURSED V2 — Moderation Bot')
      .setDescription('A professional Discord moderation and server management bot.')
      .addFields(
        {
          name: '⚠️ Moderation',
          value: [
            '`/warn` — Warn a user',
            '`/unwarn` — Remove a warning by case ID',
            '`/timeout` — Timeout a user',
            '`/untimeout` — Remove a timeout',
            '`/kick` — Kick a user',
            '`/ban` — Ban a user',
            '`/tempban` — Temporarily ban a user',
            '`/softban` — Softban (ban + unban to delete messages)',
            '`/unban` — Unban a user by ID',
            '`/purge` — Bulk delete messages'
          ].join('\n')
        },
        {
          name: '📋 Case Management',
          value: [
            '`/case` — View a specific case',
            '`/cases` — View a user\'s moderation history'
          ].join('\n')
        },
        {
          name: '📝 Staff Notes',
          value: [
            '`/note add` — Add a staff note about a user',
            '`/note view` — View staff notes for a user',
            '`/note remove` — Remove a staff note'
          ].join('\n')
        },
        {
          name: '⚙️ Configuration',
          value: [
            '`/logs set` — Set the log channel',
            '`/logs disable` — Disable logging',
            '`/logs toggle` — Toggle specific log types',
            '`/logs status` — View logging config',
            '`/automod enable` — Enable an automod rule',
            '`/automod disable` — Disable an automod rule',
            '`/automod status` — View automod config'
          ].join('\n')
        },
        {
          name: '📊 Analytics',
          value: '`/stats` — View moderation statistics'
        },
        {
          name: '🎫 Tickets',
          value: [
            '`!ticket` — Create a support ticket',
            '`!closeticket` — Close the current ticket'
          ].join('\n')
        }
      )
      .setColor('#6c35de')
      .setFooter({ text: 'CURSED V2 Moderation Bot' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
