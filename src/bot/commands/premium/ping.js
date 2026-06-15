module.exports = {
    name: 'ping',
    aliases: ['latency'],
    description: 'Shows bot latency',

    async execute(message, args, client) {
        return message.reply(`🏓 Pong! ${client.ws.ping}ms`);
    }
};
