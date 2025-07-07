const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('명령어초기화')
        .setDescription('중복된 명령어를 제거합니다 (개발자 전용)'),
    
    async execute(interaction) {
        // 개발자 확인
        const DEVELOPER_IDS = ['424480594542592009', '295980447849250817', '532128778175619084'];
        if (!DEVELOPER_IDS.includes(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 개발자만 사용할 수 있습니다!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
            if (!token) {
                throw new Error('BOT_TOKEN 또는 DISCORD_TOKEN이 설정되지 않았습니다. .env 파일을 확인해주세요.');
            }
            const rest = new REST({ version: '10' }).setToken(token);
            
            // 전역 명령어 가져오기
            const globalCommands = await rest.get(
                Routes.applicationCommands(process.env.CLIENT_ID)
            );
            
            // 중복 명령어 찾기
            const commandMap = new Map();
            const duplicates = [];
            
            globalCommands.forEach(cmd => {
                if (commandMap.has(cmd.name)) {
                    duplicates.push({
                        name: cmd.name,
                        id: cmd.id,
                        created: cmd.created_at
                    });
                } else {
                    commandMap.set(cmd.name, {
                        id: cmd.id,
                        created: cmd.created_at
                    });
                }
            });
            
            // 결과 임베드 생성
            const embed = new EmbedBuilder()
                .setTitle('🧹 명령어 초기화')
                .setColor('#0099FF')
                .setTimestamp();
            
            if (duplicates.length === 0) {
                embed.setDescription('✅ 중복된 명령어가 없습니다!')
                    .addFields({
                        name: '📊 전체 명령어',
                        value: `${globalCommands.length}개`,
                        inline: true
                    });
            } else {
                embed.setDescription(`🔍 ${duplicates.length}개의 중복 명령어를 발견했습니다.`);
                
                // 중복 명령어 삭제
                let deletedCount = 0;
                for (const dup of duplicates) {
                    try {
                        await rest.delete(
                            Routes.applicationCommand(process.env.CLIENT_ID, dup.id)
                        );
                        deletedCount++;
                    } catch (error) {
                        console.error(`Failed to delete duplicate command ${dup.name}:`, error);
                    }
                }
                
                embed.addFields(
                    {
                        name: '🗑️ 삭제된 중복 명령어',
                        value: duplicates.map(d => `• ${d.name} (ID: ${d.id})`).join('\n') || '없음',
                        inline: false
                    },
                    {
                        name: '📊 처리 결과',
                        value: `${deletedCount}/${duplicates.length}개 삭제 완료`,
                        inline: true
                    },
                    {
                        name: '📋 남은 명령어',
                        value: `${globalCommands.length - deletedCount}개`,
                        inline: true
                    }
                );
            }
            
            // 길드별 명령어도 확인
            if (interaction.guild) {
                const guildCommands = await rest.get(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, interaction.guild.id)
                );
                
                if (guildCommands.length > 0) {
                    embed.addFields({
                        name: '⚠️ 길드 명령어',
                        value: `이 서버에 ${guildCommands.length}개의 길드 전용 명령어가 있습니다.\n전역 명령어와 충돌할 수 있으니 확인이 필요합니다.`,
                        inline: false
                    });
                }
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('명령어 초기화 중 오류:', error);
            await interaction.editReply({
                content: '❌ 명령어 초기화 중 오류가 발생했습니다.',
                embeds: []
            });
        }
    }
};