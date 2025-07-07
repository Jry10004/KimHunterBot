const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { DOGBOT_RESCUE_EVENT } = require('../data/dogBotRescueEvent');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('구출이벤트시작')
        .setDescription('댕댕봇 구출 이벤트를 시작합니다 (관리자 전용)'),
    
    async execute(interaction) {
        // 관리자 체크
        const ADMIN_IDS = ['424480594542592009', '295980447849250817', '592659577384730645'];
        
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
                ephemeral: true
            });
        }
        
        // 이미 진행중인지 체크
        if (DOGBOT_RESCUE_EVENT.status.isActive) {
            return await interaction.reply({
                content: '⚠️ 이미 구출 이벤트가 진행중입니다!',
                ephemeral: true
            });
        }
        
        // 이벤트 초기화
        DOGBOT_RESCUE_EVENT.status.isActive = true;
        DOGBOT_RESCUE_EVENT.status.startTime = Date.now();
        DOGBOT_RESCUE_EVENT.status.currentFloor = 1;
        DOGBOT_RESCUE_EVENT.status.rescueComplete = false;
        
        // 모든 층 HP 초기화
        for (let i = 1; i <= 5; i++) {
            DOGBOT_RESCUE_EVENT.floors[i].currentHP = DOGBOT_RESCUE_EVENT.floors[i].maxHP;
        }
        
        // 통계 초기화
        DOGBOT_RESCUE_EVENT.statistics = {
            totalAttacks: 0,
            totalDamage: 0,
            participants: new Set(),
            attackLog: [],
            mvp: { userId: null, damage: 0 },
            floorMVP: {}
        };
        
        // 공지 임베드
        const startEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🚨 긴급 속보! 댕댕봇 납치 사건!')
            .setDescription(DOGBOT_RESCUE_EVENT.messages.start.join('\n'))
            .addFields(
                {
                    name: '🏰 디버그 타워 현황',
                    value: '```\n' +
                           '5층: 개발자의 방 [잠김]\n' +
                           '4층: 무한 루프의 미로 [잠김]\n' +
                           '3층: NullPointer의 함정 [잠김]\n' +
                           '2층: StackOverflow의 늪 [잠김]\n' +
                           '1층: SyntaxError의 문 [공략 가능]\n' +
                           '```',
                    inline: false
                },
                {
                    name: '⚔️ 공격 방법',
                    value: '• `/댕댕봇납치` 명령어 사용\n' +
                           '• 10분마다 1회 공격 가능\n' +
                           '• 사전강화 무기 보유 시 추가 데미지',
                    inline: true
                },
                {
                    name: '🎁 보상',
                    value: '• 층별 클리어 보상\n' +
                           '• 참여자 특별 칭호\n' +
                           '• MVP 추가 보상',
                    inline: true
                }
            )
            .setImage('https://i.imgur.com/YourDogBotKidnappedImage.png') // 실제 이미지로 교체
            .setFooter({ text: '개발자의 메시지: "2일만... 제발 2일만 쉬게 해줘..."' });
        
        await interaction.reply({ embeds: [startEmbed] });
        
        // 모든 채널에 공지 (옵션)
        try {
            const guild = interaction.guild;
            const newsChannel = guild.channels.cache.find(ch => 
                ch.name === 'announcements' || ch.name === '공지' || ch.name === '📢공지사항'
            );
            
            if (newsChannel) {
                await newsChannel.send({ embeds: [startEmbed] });
            }
        } catch (error) {
            console.error('공지 전송 실패:', error);
        }
    }
};