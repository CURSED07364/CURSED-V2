const { EmbedBuilder } = require('discord.js');
const User = require('../../../database/models/User');

const AVAILABLE_PETS = {
  dragon: { name: 'Infernal Dragon', price: 1000, type: 'DRAGON' },
  cerberus: { name: 'Shadow Cerberus', price: 750, type: 'DOG' },
  phoenix: { name: 'Aether Phoenix', price: 1500, type: 'BIRD' },
  slime: { name: 'Gooey Slime', price: 200, type: 'SLIME' }
};

module.exports = {
  name: 'pets',
  aliases: ['pet', 'mypets'],
  description: 'View, equip, or buy companion pets.',
  async execute(message, args) {
    const userId = message.author.id;

    try {
      let user = await User.findOne({ discordId: userId });
      if (!user) {
        user = new User({ discordId: userId, username: message.author.username });
        await user.save();
      }

      if (!args[0]) {
        // List owned pets
        const petEmbed = new EmbedBuilder()
          .setTitle('🐾 Your Companion Pets')
          .setColor('#6c35de')
          .setTimestamp();

        if (!user.pets || user.pets.length === 0) {
          petEmbed.setDescription('You don’t own any pets yet. Buy one with `!pets buy <pet_id>`!\n\n**Available Pets to Buy:**\n' + 
            Object.entries(AVAILABLE_PETS).map(([id, info]) => `• \`${id}\` — **${info.name}** ($${info.price})`).join('\n')
          );
        } else {
          const equippedPet = user.pets.find(p => p.equipped);
          const list = user.pets.map(p => `• **${p.name}** (Level ${p.level} ${p.type}) ${p.equipped ? '`[EQUIPPED]`' : ''} — Skin: \`${p.skin}\``).join('\n');
          
          petEmbed.setDescription(`**Equipped**: ${equippedPet ? `**${equippedPet.name}**` : '*None*'}\n\n**Your Collection**:\n${list}\n\n*Use \`!pets equip <pet_id>\` or check \`!pets shop\` for more.*`);
        }

        return message.reply({ embeds: [petEmbed] });
      }

      const action = args[0].toLowerCase();

      if (action === 'shop' || action === 'store') {
        const shopEmbed = new EmbedBuilder()
          .setTitle('🐾 CURSED Pet Store')
          .setColor('#6c35de')
          .setDescription('Purchase companion pets using your wallet credits.\nUse `!pets buy <pet_id>` to purchase.')
          .addFields(
            Object.entries(AVAILABLE_PETS).map(([id, info]) => ({
              name: `${info.name} (ID: \`${id}\`)`,
              value: `Price: **$${info.price}** | Type: \`${info.type}\``,
              inline: true
            }))
          );
        return message.reply({ embeds: [shopEmbed] });
      }

      if (action === 'buy') {
        const petId = args[1]?.toLowerCase();
        if (!petId || !AVAILABLE_PETS[petId]) {
          return message.reply('❌ Please specify a valid pet ID from the store. Check `!pets shop`.');
        }

        const petInfo = AVAILABLE_PETS[petId];

        // Check if user already owns it
        if (user.pets.some(p => p.id === petId)) {
          return message.reply('❌ You already own this pet!');
        }

        if (user.wallet < petInfo.price) {
          return message.reply(`❌ You do not have enough cash in your wallet ($${user.wallet} / $${petInfo.price}).`);
        }

        // Subtract money and add pet
        user.wallet -= petInfo.price;
        user.pets.push({
          id: petId,
          name: petInfo.name,
          type: petInfo.type,
          level: 1,
          xp: 0,
          skin: 'default',
          equipped: false
        });

        await user.save();
        return message.reply(`🎉 You bought a **${petInfo.name}** for **$${petInfo.price}** credits! Use \`!pets equip ${petId}\` to set it active.`);
      }

      if (action === 'equip') {
        const petId = args[1]?.toLowerCase();
        if (!petId) return message.reply('❌ Please specify the pet ID to equip.');

        const pet = user.pets.find(p => p.id === petId);
        if (!pet) return message.reply('❌ You do not own that pet.');

        // Unequip all others, equip target
        user.pets.forEach(p => p.equipped = (p.id === petId));
        await user.save();

        return message.reply(`✅ Equipped **${pet.name}** as your active companion!`);
      }

      if (action === 'unequip') {
        user.pets.forEach(p => p.equipped = false);
        await user.save();
        return message.reply(`✅ Unequipped your active companion pet.`);
      }

      await message.reply('❌ Invalid action. Use `!pets`, `!pets shop`, `!pets buy <id>`, `!pets equip <id>`, or `!pets unequip`.');

    } catch (err) {
      await message.reply(`❌ Pet command failed: ${err.message}`);
    }
  }
};
