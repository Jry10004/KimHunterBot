const { SlashCommandBuilder } = require('discord.js');
const { showDummyMenu } = require('../../systems/dummySystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('허수아비')
        .setDescription('훈련용 허수아비로 데미지를 테스트합니다.'),
    
    async execute(interaction) {
        try {
            await interaction.deferReply();
            await showDummyMenu(interaction);
        } catch (error) {
            console.error('허수아비 명령어 오류:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ 오류가 발생했습니다.',
                    flags: 64
                });
            } else {
                await interaction.editReply({
                    content: '❌ 오류가 발생했습니다.'
                });
            }
        }
    }
};