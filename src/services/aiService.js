const axios = require('axios');
const CustomAIProfile = require('../database/models/CustomAIProfile');
const Guild = require('../database/models/Guild');
const config = require('../config');
const logger = require('../utils/logger');

class AIService {
  // Retrieve or create AI conversation context (user memory or guild memory)
  async getContext(entityId, type, defaultPrompt) {
    let profile = await CustomAIProfile.findOne({ entityId, type });
    if (!profile) {
      profile = new CustomAIProfile({
        entityId,
        type,
        systemPrompt: defaultPrompt
      });
      await profile.save();
    }
    return profile;
  }

  // Save conversation message to memory and truncate
  async saveMessage(entityId, type, role, content, maxMemory = 10) {
    try {
      await CustomAIProfile.findOneAndUpdate(
        { entityId, type },
        {
          $push: {
            memory: {
              $each: [{ role, content, timestamp: new Date() }],
              $slice: -maxMemory // Keep only the last N messages
            }
          }
        },
        { upsert: true }
      );
    } catch (err) {
      logger.error(`Failed to save AI memory message for ${entityId}:`, err);
    }
  }

  // Clear memory
  async clearMemory(entityId, type) {
    await CustomAIProfile.findOneAndUpdate(
      { entityId, type },
      { $set: { memory: [] } },
      { upsert: true }
    );
  }

  // Query primary (Groq) and fallback (Gemini) APIs
  async generateResponse(entityId, type, userMessage, customSystemPrompt = null) {
    // 1. Resolve personality
    let systemPrompt = customSystemPrompt;
    if (!systemPrompt) {
      if (type === 'GUILD') {
        const guild = await Guild.findOne({ guildId: entityId });
        systemPrompt = guild?.ai?.personality || 'You are a helpful Discord AI bot.';
      } else {
        systemPrompt = 'You are a helpful Discord AI bot.';
      }
    }

    // 2. Load context memory
    const profile = await this.getContext(entityId, type, systemPrompt);
    const messages = [];

    // Prepend system prompt
    messages.push({ role: 'system', content: systemPrompt });

    // Append memory
    if (profile.memory && profile.memory.length > 0) {
      profile.memory.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    // Append current user message
    messages.push({ role: 'user', content: userMessage });

    let reply = '';
    let usedFallback = false;

    // 3. Attempt Groq API (Primary)
    if (config.ai.groqApiKey) {
      try {
        logger.debug('Attempting AI query with Groq...');
        // Map standard system/user messages to Groq format
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama3-8b-8192',
          messages: messages,
          temperature: profile.aimode === 'CREATIVE' ? 0.9 : profile.aimode === 'STRICT' ? 0.2 : 0.7,
          max_tokens: 800
        }, {
          headers: {
            'Authorization': `Bearer ${config.ai.groqApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000 // 8s timeout
        });

        reply = response.data.choices[0].message.content;
      } catch (err) {
        logger.warn('Groq API query failed. Trying Gemini fallback...', { error: err.message });
        usedFallback = true;
      }
    } else {
      usedFallback = true;
    }

    // 4. Attempt Gemini API (Fallback)
    if (usedFallback && config.ai.geminiApiKey) {
      try {
        logger.debug('Attempting AI query with Gemini...');
        // Format messages for Gemini API
        // Gemini structured prompt expects content in parts/role structure
        // Let's create a simpler prompt style for Gemini:
        const contents = [];
        
        // Since Gemini 1.5 Beta handles system instructions separately or as system_instruction object:
        // We'll feed a concatenated prompt:
        const systemInstruction = systemPrompt;
        
        // Map messages into Gemini's user/model structure (Gemini uses 'model' instead of 'assistant')
        const geminiHistory = messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }));

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.ai.geminiApiKey}`,
          {
            contents: geminiHistory,
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            generationConfig: {
              temperature: profile.aimode === 'CREATIVE' ? 0.9 : profile.aimode === 'STRICT' ? 0.2 : 0.7,
              maxOutputTokens: 800
            }
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 8000
          }
        );

        reply = response.data.candidates[0].content.parts[0].text;
      } catch (err) {
        logger.error('Gemini API query fallback failed as well:', { error: err.message });
        throw new Error('Both Groq and Gemini AI services are temporarily unavailable. Please try again later.');
      }
    }

    if (!reply) {
      throw new Error('No response generated by AI services.');
    }

    // 5. Save context memory
    await this.saveMessage(entityId, type, 'user', userMessage, profile.maxMemorySize);
    await this.saveMessage(entityId, type, 'assistant', reply, profile.maxMemorySize);

    return reply;
  }
}

module.exports = new AIService();
