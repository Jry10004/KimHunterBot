const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dogBotAutoBackup = require('../systems/dogBotAutoBackup');
const stateManager = require('../systems/dogBotStateManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('댕댕봇백업')
        .setDescription('댕댕봇 구출 이벤트 백업 관리 (관리자 전용)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('생성')
                .setDescription('현재 상태를 백업합니다'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('복원')
                .setDescription('최신 백업을 복원합니다'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('목록')
                .setDescription('백업 목록을 확인합니다')),
    
    async execute(interaction) {
        // 관리자 권한 확인
        const adminIds = ['424480594542592009', '295980447849250817', '532128778175619084'];
        if (!adminIds.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!',
                flags: 64
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case '생성':
                await interaction.deferReply({ flags: 64 });
                await dogBotAutoBackup.createBackup();
                
                const createEmbed = new EmbedBuilder()
                    .setTitle('💾 댕댕봇 백업 생성')
                    .setDescription('현재 상태가 백업되었습니다.')
                    .setColor('#00FF00')
                    .addFields(
                        { name: '현재 층', value: `${stateManager.state.status.currentFloor}층`, inline: true },
                        { name: '총 공격', value: `${stateManager.state.statistics.totalAttacks}회`, inline: true },
                        { name: '총 데미지', value: `${stateManager.state.statistics.totalDamage.toLocaleString()}`, inline: true }
                    )
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [createEmbed] });
                break;
                
            case '복원':
                await interaction.deferReply({ flags: 64 });
                const restored = await dogBotAutoBackup.restoreFromBackup();
                
                if (restored) {
                    // 상태 다시 로드
                    await stateManager.loadState();
                    
                    const restoreEmbed = new EmbedBuilder()
                        .setTitle('🔄 댕댕봇 백업 복원')
                        .setDescription('최신 백업이 복원되었습니다.')
                        .setColor('#00FF00')
                        .addFields(
                            { name: '현재 층', value: `${stateManager.state.status.currentFloor}층`, inline: true },
                            { name: '총 공격', value: `${stateManager.state.statistics.totalAttacks}회`, inline: true },
                            { name: '총 데미지', value: `${stateManager.state.statistics.totalDamage.toLocaleString()}`, inline: true }
                        )
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [restoreEmbed] });
                } else {
                    await interaction.editReply({ content: '❌ 복원할 백업이 없습니다.' });
                }
                break;
                
            case '목록':
                await interaction.deferReply({ flags: 64 });
                const fs = require('fs').promises;
                const path = require('path');
                
                try {
                    const backupDir = path.join(__dirname, '../backups/dogbot');
                    const files = await fs.readdir(backupDir);
                    const backupFiles = files
                        .filter(f => f.startsWith('dogbot_') && f.endsWith('.json'))
                        .sort()
                        .reverse()
                        .slice(0, 10);
                    
                    if (backupFiles.length === 0) {
                        await interaction.editReply({ content: '📂 백업 파일이 없습니다.' });
                        return;
                    }
                    
                    const listEmbed = new EmbedBuilder()
                        .setTitle('📂 댕댕봇 백업 목록')
                        .setDescription(backupFiles.map((file, index) => {
                            const timestamp = file.replace('dogbot_', '').replace('.json', '');
                            return `${index + 1}. ${timestamp}`;
                        }).join('\n'))
                        .setColor('#0099FF')
                        .setFooter({ text: `총 ${backupFiles.length}개의 백업` });
                    
                    await interaction.editReply({ embeds: [listEmbed] });
                } catch (error) {
                    await interaction.editReply({ content: '❌ 백업 목록을 가져오는데 실패했습니다.' });
                }
                break;
        }
    }
};