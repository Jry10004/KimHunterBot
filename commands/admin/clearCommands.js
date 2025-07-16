const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('명령어초기화')
        .setDescription('모든 명령어를 삭제합니다 (개발자 전용)'),
    
    async execute(interaction) {
        // 개발자 권한 확인
        const developerIds = ['295980447849250817', '532128778175619084', '424480594542592009'];
        if (!developerIds.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 개발자만 사용할 수 있습니다!',
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            const token = process.env.BOT_TOKEN || interaction.client.token;
            const rest = new REST({ version: '9' }).setToken(token);
            const clientId = interaction.client.user.id;
            const guildId = interaction.guild.id;

            // 길드 명령어 모두 삭제
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            
            // 글로벌 명령어 모두 삭제
            await rest.put(Routes.applicationCommands(clientId), { body: [] });

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🗑️ 명령어 초기화 완료!')
                .setDescription('모든 명령어가 삭제되었습니다.')
                .addFields(
                    { name: '다음 단계', value: '봇을 재시작한 후 /명령어등록을 사용하세요', inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('명령어 초기화 오류:', error);
            await interaction.editReply({
                content: `❌ 명령어 초기화 중 오류가 발생했습니다: ${error.message}`
            });
        }
    }
};