const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../../handlers/common/utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('보스채널설정')
        .setDescription('[관리자] 보스레이드 채널을 설정합니다')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // 관리자 권한 확인
        if (!isAdmin(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.channel;
            
            // 채널 이름 변경
            await channel.edit({
                name: '👹│보스레이드',
                topic: '월드보스 레이드 | ⏰ 출현: 매일 정각'
            });

            // 보스레이드 안내 임베드
            const bossEmbed = new EmbedBuilder()
                .setTitle('👹 월드보스 레이드')
                .setDescription(
                    '**강력한 월드보스와 함께 싸워 풍성한 보상을 획득하세요!**\n\n' +
                    '모든 플레이어가 힘을 합쳐 보스를 처치하면 참여도에 따라 보상이 지급됩니다.'
                )
                .addFields(
                    {
                        name: '⏰ 보스 출현 시간',
                        value: '• 매일 정각 (00:00, 06:00, 12:00, 18:00)\n' +
                               '• 출현 30분 전 알림\n' +
                               '• 제한 시간: 2시간',
                        inline: false
                    },
                    {
                        name: '🏆 보상 시스템',
                        value: '**MVP (1위)**: 특별 보상 + 칭호\n' +
                               '**상위 10%**: 레어 아이템 + 대량 골드\n' +
                               '**상위 50%**: 일반 아이템 + 골드\n' +
                               '**참여자 전원**: 기본 보상',
                        inline: false
                    },
                    {
                        name: '⚔️ 전투 팁',
                        value: '• 보스마다 고유한 패턴이 있습니다\n' +
                               '• 적절한 장비와 버프를 준비하세요\n' +
                               '• 팀워크가 중요합니다',
                        inline: false
                    }
                )
                .setColor('#E91E63')
                .setImage('https://i.imgur.com/7WtDOFy.png') // 예시 보스 이미지
                .setFooter({ text: '김헌터 | 최강의 헌터가 되어 보스를 정복하세요!' });

            // 보스 관련 버튼들
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('boss_info')
                        .setLabel('👹 현재 보스 정보')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('boss_ranking')
                        .setLabel('🏆 보스 랭킹')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('boss_schedule')
                        .setLabel('📅 출현 일정')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('boss_rewards')
                        .setLabel('🎁 보상 정보')
                        .setStyle(ButtonStyle.Secondary)
                );

            // 메시지 전송
            const message = await channel.send({
                embeds: [bossEmbed],
                components: [row]
            });

            // 환경 변수에 채널 ID 저장을 위한 안내
            await interaction.editReply({
                content: `✅ 보스레이드 채널 설정이 완료되었습니다!\n` +
                        `채널: ${channel}\n` +
                        `채널 ID: ${channel.id}\n\n` +
                        `💡 .env 파일의 BOSS_CHANNEL_ID를 ${channel.id}로 설정해주세요.`
            });

        } catch (error) {
            console.error('보스 채널 설정 오류:', error);
            await interaction.editReply({
                content: '❌ 채널 설정 중 오류가 발생했습니다.'
            });
        }
    }
};