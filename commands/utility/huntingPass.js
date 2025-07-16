const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('사냥패스')
        .setDescription('🎫 사냥 패스를 확인합니다'),
    async execute(interaction) {
        const { showHuntingPassMenu } = require('../../systems/huntingPassSystem');
        return await showHuntingPassMenu(interaction, interaction.user.id);
    }
};