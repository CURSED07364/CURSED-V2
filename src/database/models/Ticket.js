const mongoose = require('mongoose');

const transcriptMessageSchema = new mongoose.Schema({
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String, default: '' },
  attachments: [{ type: String }],
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, unique: true, index: true },
  creatorId: { type: String, required: true, index: true },
  ticketNumber: { type: Number, required: true },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', index: true },
  
  // Closing details
  closedById: { type: String, default: null },
  closedAt: { type: Date, default: null },
  
  // Transcript array for storage
  transcript: [transcriptMessageSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Ticket', ticketSchema);
