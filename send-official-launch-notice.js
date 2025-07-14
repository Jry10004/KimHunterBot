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
        const channelId = '1386384507569045504'; // 공지 채널
        const channel = await client.channels.fetch(channelId);
        
        if (!channel) {
            console.error('채널을 찾을 수 없습니다!');
            process.exit(1);
        }

        // 공지 임베드
        const noticeEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🚀 김헌터 정식 오픈 안내')
            .setDescription('안녕하세요, 김헌터 개발자입니다.')
            .addFields(
                {
                    name: '📊 정식 오픈',
                    value: '여러분들의 적극적인 참여 덕분에 김헌터가 정식 오픈을 맞이하게 되었습니다.\n' +
                           '베타 테스트 기간 동안 보내주신 피드백과 버그 리포트에 진심으로 감사드립니다.',
                    inline: false
                },
                {
                    name: '⚠️ 초기 안정화 작업',
                    value: '정식 오픈 초기에는 예상치 못한 버그나 서버 불안정이 발생할 수 있습니다.\n' +
                           '• 서버 안정화를 위한 긴급 패치 진행 예정\n' +
                           '• 일시적인 서버 재시작 가능성\n' +
                           '• 데이터 백업 주기: 30분',
                    inline: false
                },
                {
                    name: '🔧 개발 계획',
                    value: '발견되는 모든 이슈에 대해 즉각적으로 대응하겠습니다.\n' +
                           '• 크리티컬 버그: 즉시 수정\n' +
                           '• 일반 버그: 24시간 내 패치\n' +
                           '• 개선 사항: 주간 업데이트로 반영',
                    inline: false
                },
                {
                    name: '🎉 댕댕봇 구출 이벤트 종료',
                    value: '베타 테스트 이벤트였던 **댕댕봇 구출 이벤트**가 종료됩니다.\n' +
                           '이벤트 참여에 감사드리며, 앞으로 새로운 이벤트로 찾아뵙겠습니다.',
                    inline: false
                },
                {
                    name: '🎁 보상 지급 안내',
                    value: '**댕댕봇 구출 이벤트 보상** 및 **사전강화 보상**은\n' +
                           '금일 저녁부터 일괄 처리될 예정입니다.\n' +
                           '• 이벤트 참여 보상\n' +
                           '• 사전강화 아이템 보상\n' +
                           '• 기여도별 추가 보상',
                    inline: false
                },
                {
                    name: '🎮 게임 플레이 안내',
                    value: '이제 신규 채널에서 김헌터의 모든 콘텐츠를 즐기실 수 있습니다.\n' +
                           '• `/게임` - 미니게임 및 사냥\n' +
                           '• `/결투` - PVP 대전\n' +
                           '• `/던전` - 던전 탐험\n' +
                           '자세한 내용은 <#1393397812359598162>을 참고해주세요.',
                    inline: false
                }
            )
            .setFooter({ 
                text: '버그 제보: /버그제보 | 문의: 개발자 DM', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // 기술 정보 임베드
        const techEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('💻 기술 정보')
            .addFields(
                {
                    name: '🔄 서버 상태',
                    value: '```\n' +
                           'Status: ONLINE\n' +
                           'Version: 1.0.0\n' +
                           'Node.js: v18.17.0\n' +
                           'Discord.js: v14.14.1\n' +
                           'Database: MongoDB Atlas\n' +
                           'Uptime: 99.9%\n' +
                           '```',
                    inline: false
                },
                {
                    name: '📈 성능 최적화',
                    value: '• 데이터베이스 쿼리 최적화 완료\n' +
                           '• 메모리 사용량 40% 감소\n' +
                           '• API 응답 시간 평균 200ms\n' +
                           '• 동시 접속자 1000명 처리 가능',
                    inline: false
                },
                {
                    name: '🛡️ 보안 강화',
                    value: '• Rate limiting 적용\n' +
                           '• Input validation 강화\n' +
                           '• SQL injection 방어\n' +
                           '• 자동 백업 시스템 구축',
                    inline: false
                }
            );

        await channel.send({ 
            embeds: [noticeEmbed, techEmbed]
        });
        
        console.log('정식 오픈 공지가 성공적으로 전송되었습니다!');
        
    } catch (error) {
        console.error('공지 전송 중 오류 발생:', error);
    } finally {
        client.destroy();
        process.exit(0);
    }
});

client.login(process.env.BOT_TOKEN);