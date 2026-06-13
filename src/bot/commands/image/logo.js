const imagineCmd = require('./imagine');

module.exports = {
  name: 'logo',
  description: 'Generate minimalist flat vector logos.',
  async execute(message, args, client) {
    await imagineCmd.execute(message, args, client, 'logo');
  }
};
