const { SlashCommandBuilder } = require('discord.js');
const { executeCommand } = require('../../utils/commandUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('핑')
        .setDescription('봇의 응답 속도를 확인합니다'),
    
    async execute(interaction) {
        // executeCommand 유틸리티 사용 - 자동으로 defer 처리 및 에러 핸들링
        await executeCommand(interaction, async (interaction) => {
            const latency = Date.now() - interaction.createdTimestamp;
            const apiLatency = Math.round(interaction.client.ws.ping);
            
            await interaction.editReply({
                content: `🏓 퐁!\n응답 속도: ${latency}ms\nAPI 지연: ${apiLatency}ms`
            });
        }, { flags: 64 }); // ephemeral 응답
    }
};