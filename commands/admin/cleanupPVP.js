const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pvpSystem = require('../../systems/pvpSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pvp정리')
        .setDescription('멈춘 PVP 채널들을 정리합니다 (관리자 전용)'),
    
    async execute(interaction) {
        // 관리자 확인
        const ADMIN_IDS = ['424480594542592009', '532128778175619084', '295980447849250817'];
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const pvp = pvpSystem.getInstance();
            
            // 정리 시작
            const startEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🧹 PVP 채널 정리 시작')
                .setDescription('멈춘 PVP 채널들을 정리하고 있습니다...')
                .setTimestamp();
            
            await interaction.editReply({ embeds: [startEmbed] });
            
            // 수동으로 채널 확인 및 정리
            const guild = interaction.guild;
            let cleanedCount = 0;
            
            // PVP 경기장 카테고리 찾기
            const pvpCategory = guild.channels.cache.find(c => 
                c.name === '🔥 PVP 경기장' && c.type === 4 // GuildCategory
            );
            
            if (pvpCategory) {
                // 카테고리 내 모든 채널 확인
                const channels = guild.channels.cache.filter(c => 
                    c.parentId === pvpCategory.id && c.type === 0 // GuildText
                );
                
                console.log(`[PVP 정리] ${channels.size}개의 PVP 채널 발견`);
                
                for (const channel of channels.values()) {
                    try {
                        console.log(`[PVP 정리] 채널 삭제 중: ${channel.name} (ID: ${channel.id})`);
                        await channel.delete('관리자 명령어로 PVP 채널 정리');
                        cleanedCount++;
                    } catch (err) {
                        console.error(`[PVP 정리] 채널 삭제 실패: ${channel.name}`, err);
                    }
                }
            }
            
            // 시스템 정리도 실행
            await pvp.cleanupPVPChannels();
            pvp.cleanupOldMatches();
            
            // 완료 메시지
            const completeEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ PVP 채널 정리 완료!')
                .setDescription(`${cleanedCount}개의 PVP 채널이 정리되었습니다.`)
                .addFields(
                    { name: '🗑️ 정리된 채널', value: `${cleanedCount}개`, inline: true },
                    { name: '📊 정리 항목', value: '• 비활성 PVP 채널\n• 오래된 매치 기록', inline: false },
                    { name: '⏰ 자동 정리', value: '10분마다 자동으로 정리됩니다', inline: false }
                )
                .setFooter({ text: `실행자: ${interaction.user.username}` })
                .setTimestamp();
            
            try {
                await interaction.editReply({ embeds: [completeEmbed] });
            } catch (editError) {
                // 인터랙션이 만료된 경우 무시
                if (editError.code === 10008) {
                    console.log('[PVP 정리] 인터랙션이 만료되어 응답할 수 없습니다.');
                } else {
                    console.error('[PVP 정리] 응답 오류:', editError);
                }
            }
            
            console.log(`[PVP 정리] ${interaction.user.username}님이 PVP 채널 정리 실행`);
            
        } catch (error) {
            console.error('PVP 채널 정리 오류:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ PVP 채널 정리 실패')
                .setDescription('채널 정리 중 오류가 발생했습니다.')
                .addFields({
                    name: '오류 메시지',
                    value: `\`\`\`${error.message}\`\`\``
                })
                .setTimestamp();
            
            try {
                await interaction.editReply({ embeds: [errorEmbed] });
            } catch (editError) {
                // 인터랙션이 만료된 경우 무시
                if (editError.code === 10008) {
                    console.log('[PVP 정리] 오류 응답 실패 - 인터랙션 만료');
                } else {
                    console.error('[PVP 정리] 오류 응답 실패:', editError);
                }
            }
        }
    }
};