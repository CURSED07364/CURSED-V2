const imagineCmd = require('./imagine');

module.exports = {
  name: 'avatar',
  description: 'Generate square profile avatar illustrations.',
  async execute(message, args, client) {
    await imagineCmd.execute(message, args, client, 'avatar');
  }
};
