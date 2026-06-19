const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const StaffNote = require('../../../database/models/StaffNote');
const { handleCommandError } = require('../../../utils/errorHandler');

module.exports = {
  name: 'note',
  description: 'Manage internal staff notes about a user.',
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Manage internal staff notes about a user.')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a staff note about a user.')
        .addUserOption(opt => opt.setName('user').setDescription('The user to add a note for').setRequired(true))
        .addStringOption(opt => opt.setName('content').setDescription('The note content').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View staff notes for a user.')
        .addUserOption(opt => opt.setName('user').setDescription('The user to view notes for').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a staff note by its ID.')
        .addStringOption(opt => opt.setName('note_id').setDescription('The MongoDB note ID to remove').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction, args, client) {
    try {
      const guild = interaction.guild;
      const moderator = interaction.member;
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'add') {
        const targetUser = interaction.options.getUser('user');
        const content = interaction.options.getString('content');

        const note = new StaffNote({
          guildId: guild.id,
          userId: targetUser.id,
          authorId: moderator.id,
          content
        });
        await note.save();

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('📝 Staff Note Added')
              .addFields(
                { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                { name: 'Author', value: `${moderator.user.tag}`, inline: true },
                { name: 'Note', value: content }
              )
              .setColor('#6c35de')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }

      if (subcommand === 'view') {
        const targetUser = interaction.options.getUser('user');
        const notes = await StaffNote.find({ guildId: guild.id, userId: targetUser.id }).sort({ createdAt: -1 });

        if (notes.length === 0) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`📝 Staff Notes — ${targetUser.tag}`)
                .setDescription('No staff notes found for this user.')
                .setColor('#808080')
                .setTimestamp()
            ],
            ephemeral: true
          });
        }

        const noteLines = notes.slice(0, 10).map((n, i) => {
          const ts = `<t:${Math.floor(new Date(n.createdAt).getTime() / 1000)}:d>`;
          return `**${i + 1}.** <@${n.authorId}> — ${ts}\n> ${n.content.substring(0, 200)}\n> ID: \`${n._id}\``;
        }).join('\n\n');

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`📝 Staff Notes — ${targetUser.tag}`)
              .setDescription(noteLines)
              .setFooter({ text: notes.length > 10 ? `Showing 10 of ${notes.length} notes` : `${notes.length} note(s)` })
              .setColor('#6c35de')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }

      if (subcommand === 'remove') {
        const noteId = interaction.options.getString('note_id').trim();

        const note = await StaffNote.findOne({ _id: noteId, guildId: guild.id });
        if (!note) {
          return interaction.reply({ content: '❌ Note not found in this server.', ephemeral: true });
        }

        await StaffNote.deleteOne({ _id: noteId });

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Staff Note Removed')
              .addFields(
                { name: 'Note ID', value: noteId, inline: true },
                { name: 'Content', value: note.content.substring(0, 512) }
              )
              .setColor('#00FF00')
              .setTimestamp()
          ],
          ephemeral: true
        });
      }
    } catch (err) {
      await handleCommandError(err, interaction, 'note');
    }
  }
};
