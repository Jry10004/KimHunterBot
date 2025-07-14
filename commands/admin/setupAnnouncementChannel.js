const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../../handlers/common/utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('공지채널설정')
        .setDescription('[관리자] 공지사항 채널을 설정합니다')
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
                name: '📢│공지사항',
                topic: '김헌터 공식 공지 | 🔔 알림 ON 권장'
            });

            // 공지사항 안내 임베드
            const announcementEmbed = new EmbedBuilder()
                .setTitle('📢 김헌터 공지사항')
                .setDescription(
                    '**김헌터의 중요한 소식을 전달하는 공간입니다!**\n\n' +
                    '🔔 **알림을 켜두시면 중요한 업데이트를 놓치지 않습니다.**'
                )
                .addFields(
                    {
                        name: '📋 공지 유형',
                        value: '• 🆕 신규 기능 업데이트\n' +
                               '• 🎉 이벤트 안내\n' +
                               '• 🛠️ 점검 및 패치 노트\n' +
                               '• ⚠️ 중요 변경사항\n' +
                               '• 🏆 대회 및 랭킹 정보',
                        inline: false
                    },
                    {
                        name: '🔔 알림 설정 방법',
                        value: '1. 채널 우클릭\n' +
                               '2. 알림 설정 클릭\n' +
                               '3. 모든 메시지 선택',
                        inline: true
                    },
                    {
                        name: '💬 문의사항',
                        value: '공지와 관련된 문의는\n' +
                               '티켓이나 DM으로 보내주세요.',
                        inline: true
                    }
                )
                .setColor('#2196F3')
                .setFooter({ text: '김헌터 운영팀 | 항상 더 나은 서비스를 위해 노력하겠습니다.' })
                .setTimestamp();

            // 공지 관련 버튼들 (선택사항)
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('announcement_history')
                        .setLabel('📜 지난 공지 보기')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('announcement_subscribe')
                        .setLabel('🔔 알림 받기')
                        .setStyle(ButtonStyle.Success)
                );

            // 메시지 전송
            const message = await channel.send({
                embeds: [announcementEmbed],
                components: [row]
            });

            // 환경 변수에 채널 ID 저장을 위한 안내
            await interaction.editReply({
                content: `✅ 공지사항 채널 설정이 완료되었습니다!\n` +
                        `채널: ${channel}\n` +
                        `채널 ID: ${channel.id}\n\n` +
                        `💡 .env 파일의 ANNOUNCEMENT_CHANNEL_ID를 ${channel.id}로 설정해주세요.`
            });

        } catch (error) {
            console.error('공지 채널 설정 오류:', error);
            await interaction.editReply({
                content: '❌ 채널 설정 중 오류가 발생했습니다.'
            });
        }
    }
};