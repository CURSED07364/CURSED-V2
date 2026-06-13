const imagineCmd = require('./imagine');

module.exports = {
  name: 'banner',
  description: 'Generate landscape web header banners.',
  async execute(message, args, client) {
    await imagineCmd.execute(message, args, client, 'banner');
  }
};
