module.exports = {
  name: 'setpersonality',
  description: 'Quickly set your custom user AI personality (PREMIUM+ only).',
  async execute(message, args) {
    const personalityCmd = require('./personality');
    await personalityCmd.execute(message, args);
  }
};
