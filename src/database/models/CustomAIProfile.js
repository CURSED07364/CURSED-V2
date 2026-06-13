const mongoose = require('mongoose');

const memoryMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const customAIProfileSchema = new mongoose.Schema({
  entityId: { type: String, required: true, index: true }, // User ID or Guild ID
  type: { type: String, enum: ['USER', 'GUILD'], required: true },
  
  // Personality Settings
  systemPrompt: { type: String, default: null },
  aimode: { type: String, enum: ['STANDARD', 'CREATIVE', 'STRICT'], default: 'STANDARD' },
  modelOverride: { type: String, default: null }, // e.g. groq vs gemini
  
  // Conversation history
  memory: [memoryMessageSchema],
  maxMemorySize: { type: Number, default: 10 } // max messages to retain in context
}, {
  timestamps: true
});

// Compound index to look up by ID and Type
customAIProfileSchema.index({ entityId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('CustomAIProfile', customAIProfileSchema);
