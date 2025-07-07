const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const backupSystem = require('../systems/backupSystem');
const { formatNumber } = require('../handlers/common/utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('백업')
        .setDescription('데이터 백업 관리 (관리자 전용)'),

    async execute(interaction) {
        // 관리자 권한 체크
        const adminIds = ['295980447849250817']; // 실제 관리자 ID로 변경
        
        if (!adminIds.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
                ephemeral: true
            });
        }

        // 백업 메뉴 표시
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('💾 데이터 백업 시스템')
            .setDescription('서버의 모든 데이터를 안전하게 백업하고 관리합니다.')
            .addFields(
                { 
                    name: '📊 백업 내용', 
                    value: '• 유저 데이터 (레벨, 골드, 장비 등)\n• 주식 시장 데이터\n• 보유 주식 현황\n• 모든 랭킹 데이터\n• 거래 기록\n• 프리런치 이벤트 데이터',
                    inline: false 
                },
                { 
                    name: '🕐 자동 백업', 
                    value: '• 매일 오전 4시: 전체 백업\n• 6시간마다: 간단한 백업',
                    inline: true 
                },
                {
                    name: '📁 백업 위치',
                    value: '`/backups` 폴더',
                    inline: true
                }
            )
            .setFooter({ text: '백업은 정기적으로 자동 실행됩니다.' })
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('backup_now')
                    .setLabel('🔄 지금 백업')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('backup_list')
                    .setLabel('📋 백업 목록')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('backup_clean')
                    .setLabel('🗑️ 오래된 백업 정리')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('backup_status')
                    .setLabel('📊 백업 상태')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({
            embeds: [embed],
            components: [buttons],
            ephemeral: true
        });
    },

    async handleButton(interaction) {
        const adminIds = ['295980447849250817'];
        
        if (!adminIds.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 권한이 없습니다.',
                ephemeral: true
            });
        }

        const [action, ...params] = interaction.customId.split('_');

        if (action === 'backup') {
            switch (params[0]) {
                case 'now':
                    await interaction.deferUpdate();
                    
                    const backupEmbed = new EmbedBuilder()
                        .setColor('#f39c12')
                        .setTitle('🔄 백업 진행 중...')
                        .setDescription('데이터를 백업하고 있습니다. 잠시만 기다려주세요.')
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [backupEmbed],
                        components: []
                    });

                    const result = await backupSystem.performFullBackup(true);

                    if (result) {
                        const successEmbed = new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setTitle('✅ 백업 완료!')
                            .setDescription(`모든 데이터가 성공적으로 백업되었습니다.`)
                            .addFields(
                                { name: '📁 백업 위치', value: `\`${result}\``, inline: false },
                                { name: '🕐 백업 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
                            )
                            .setTimestamp();

                        await interaction.editReply({
                            embeds: [successEmbed]
                        });
                    } else {
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#e74c3c')
                            .setTitle('❌ 백업 실패')
                            .setDescription('백업 중 오류가 발생했습니다. 로그를 확인해주세요.')
                            .setTimestamp();

                        await interaction.editReply({
                            embeds: [errorEmbed]
                        });
                    }
                    break;

                case 'list':
                    await interaction.deferUpdate();
                    
                    const backups = await backupSystem.listBackups();
                    
                    const listEmbed = new EmbedBuilder()
                        .setColor('#3498db')
                        .setTitle('📋 백업 목록')
                        .setDescription(`총 ${backups.length}개의 백업이 있습니다.`)
                        .setTimestamp();

                    if (backups.length === 0) {
                        listEmbed.addFields({
                            name: '백업 없음',
                            value: '아직 생성된 백업이 없습니다.'
                        });
                    } else {
                        backups.slice(0, 10).forEach((backup, index) => {
                            const date = new Date(backup.timestamp);
                            listEmbed.addFields({
                                name: `${index + 1}. ${backup.type === 'manual' ? '🔧' : '🔄'} ${date.toLocaleString('ko-KR')}`,
                                value: `폴더: \`${backup.folder}\`\n` +
                                       `통계: 유저 ${backup.statistics?.users || 0}명, ` +
                                       `주식 ${backup.statistics?.stocks || 0}개`,
                                inline: false
                            });
                        });

                        if (backups.length > 10) {
                            listEmbed.setFooter({ 
                                text: `... 그리고 ${backups.length - 10}개 더` 
                            });
                        }
                    }

                    await interaction.editReply({
                        embeds: [listEmbed],
                        components: []
                    });
                    break;

                case 'clean':
                    await interaction.deferUpdate();
                    
                    const cleanEmbed = new EmbedBuilder()
                        .setColor('#f39c12')
                        .setTitle('🗑️ 백업 정리 중...')
                        .setDescription('30일 이상 된 백업을 정리하고 있습니다.')
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [cleanEmbed],
                        components: []
                    });

                    const deletedCount = await backupSystem.cleanOldBackups(30);

                    const cleanResultEmbed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle('✅ 정리 완료')
                        .setDescription(`${deletedCount}개의 오래된 백업을 삭제했습니다.`)
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [cleanResultEmbed]
                    });
                    break;

                case 'status':
                    const statusEmbed = new EmbedBuilder()
                        .setColor('#3498db')
                        .setTitle('📊 백업 시스템 상태')
                        .addFields(
                            { 
                                name: '🕐 마지막 백업', 
                                value: backupSystem.lastBackup ? 
                                    new Date(backupSystem.lastBackup).toLocaleString('ko-KR') : 
                                    '아직 백업 기록 없음',
                                inline: true 
                            },
                            { 
                                name: '🔄 백업 상태', 
                                value: backupSystem.isRunning ? '진행 중' : '대기 중',
                                inline: true 
                            },
                            {
                                name: '💾 자동 백업',
                                value: '활성화됨',
                                inline: true
                            }
                        )
                        .setTimestamp();

                    await interaction.update({
                        embeds: [statusEmbed],
                        components: []
                    });
                    break;
            }
        }
    }
};