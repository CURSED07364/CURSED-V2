const mongoose = require('mongoose');

const staffNoteSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  authorId: { type: String, required: true },
  content: { type: String, required: true }
}, {
  timestamps: true
});

staffNoteSchema.index({ guildId: 1, userId: 1 });

module.exports = mongoose.model('StaffNote', staffNoteSchema);
