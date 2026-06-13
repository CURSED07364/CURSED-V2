const imagineCmd = require('./imagine');

module.exports = {
  name: 'art',
  description: 'Generate artistic masterpieces using AI oil painting styles.',
  async execute(message, args, client) {
    await imagineCmd.execute(message, args, client, 'art');
  }
};
