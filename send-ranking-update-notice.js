const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.once('ready', async () => {
    console.log(`${client.user.tag}으로 로그인했습니다!`);
    
    try {
        const channelId = '1386384507569045504';
        const channel = await client.channels.fetch(channelId);
        
        if (!channel) {
            console.error('채널을 찾을 수 없습니다!');
            process.exit(1);
        }

        // 첫 번째 임베드 - 메인 공지
        const mainEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎉 김헌터 대규모 업데이트 완료!')
            .setDescription('모든 랭킹 시스템이 개선되었습니다!')
            .addFields(
                {
                    name: '📊 랭킹 시스템 전면 개선',
                    value: '이제 모든 랭킹에서 **게임 닉네임**이 표시됩니다!\n' +
                           '더 이상 복잡한 디스코드 ID가 아닌,\n' +
                           '여러분이 설정한 멋진 닉네임으로 랭킹을 확인하세요!',
                    inline: false
                },
                {
                    name: '✨ 개선된 랭킹 목록',
                    value: '`🏋️ 운동 랭킹` `📅 출석 랭킹` `🏺 유물 탐사`\n' +
                           '`⚔️ PVP 랭킹` `🎮 LOL 내전` `⭐ 강화 랭킹`\n' +
                           '`💖 인기도 랭킹` `🐕 댕댕봇 MVP`',
                    inline: false
                }
            )
            .setImage('https://i.imgur.com/4M34hi2.png')
            .setTimestamp();

        // 두 번째 임베드 - 추가 개선사항
        const updateEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🔧 추가 개선사항')
            .addFields(
                {
                    name: '🎫 티켓 시스템 개선',
                    value: '• `/내티켓` 명령어로 모든 티켓 확인\n' +
                           '• 재생성까지 남은 시간 정확히 표시\n' +
                           '• 사냥 티켓 정보 추가',
                    inline: false
                },
                {
                    name: '🎯 미션 시스템',
                    value: '• 일일/주간 미션 정상 작동\n' +
                           '• 미션 진행도 실시간 반영',
                    inline: false
                },
                {
                    name: '🐛 버그 수정',
                    value: '• 틱택토 게임 종료 시 채널 삭제\n' +
                           '• 중복 명령어 표시 문제 해결\n' +
                           '• 각종 승률 계산 오류 수정',
                    inline: false
                }
            );

        // 세 번째 임베드 - 사용 안내
        const guideEmbed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('💡 닉네임 설정 안내')
            .setDescription('아직 게임 닉네임을 설정하지 않으셨나요?')
            .addFields(
                {
                    name: '닉네임 변경 방법',
                    value: '```/닉네임변경 [원하는닉네임]```',
                    inline: false
                },
                {
                    name: '⚠️ 주의사항',
                    value: '• 닉네임은 2-10자 한글/영문/숫자\n' +
                           '• 특수문자 사용 불가\n' +
                           '• 부적절한 닉네임은 제재 대상',
                    inline: false
                }
            )
            .setFooter({ 
                text: '김헌터와 함께 즐거운 시간 보내세요! 💖',
                iconURL: client.user.displayAvatarURL()
            });

        // 메시지 전송
        await channel.send({ 
            content: '@everyone',
            embeds: [mainEmbed, updateEmbed, guideEmbed] 
        });
        
        console.log('공지가 성공적으로 전송되었습니다!');
        
    } catch (error) {
        console.error('공지 전송 중 오류 발생:', error);
    } finally {
        client.destroy();
        process.exit(0);
    }
});

client.login(process.env.BOT_TOKEN);