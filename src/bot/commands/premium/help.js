const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['commands', 'h'],
    description: 'Shows all commands',

    async execute(message) {
        const embed = new EmbedBuilder()
            .setTitle('📖 CURSED Commands')
            .setDescription(`
⚔️ General
• !help
• !ping

💰 Economy
• !balance

🎫 Tickets
• !ticket

⭐ Premium
• !premium
• !premiumstatus
            `)
            .setColor('#6c35de');

        return message.reply({ embeds: [embed] });
    }
};
