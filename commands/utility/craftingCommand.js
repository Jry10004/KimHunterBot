const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('재료제작')
        .setDescription('🔨 수집한 재료로 아이템을 제작합니다'),
    async execute(interaction) {
        const { showCraftingMenu } = require('../../systems/materialCraftingSystem');
        return await showCraftingMenu(interaction, interaction.user.id);
    }
};