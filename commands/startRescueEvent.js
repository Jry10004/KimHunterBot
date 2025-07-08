const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const stateManager = require('../systems/dogBotStateManager');
const { DOGBOT_RESCUE_EVENT } = require('../data/dogBotRescueEvent');
const announcer = require('../systems/dogBotEventAnnouncer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('댕댕봇구출시작')
        .setDescription('댕댕봇 구출 이벤트를 시작합니다 (관리자 전용)')
        .addBooleanOption(option =>
            option.setName('초기화')
                .setDescription('이벤트 데이터를 초기화하고 시작')
                .setRequired(false)),
    
    async execute(interaction) {
        // 관리자 권한 확인
        const adminIds = ['424480594542592009', '295980447849250817', '532128778175619084'];
        if (!adminIds.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!',
                ephemeral: true
            });
        }
        
        const shouldReset = interaction.options.getBoolean('초기화');
        
        // 이미 진행 중인지 확인
        if (stateManager.state.status.isActive && !shouldReset) {
            return await interaction.reply({
                content: '⚠️ 이미 이벤트가 진행 중입니다!',
                ephemeral: true
            });
        }
        
        // 초기화 옵션
        if (shouldReset) {
            await stateManager.resetState(false); // false = 완전 초기화
        } else {
            // 기존 데이터 유지하면서 재시작
            await stateManager.resetState(true); // true = 데이터 유지
        }
        
        // 이벤트 시작
        stateManager.startEvent();
        
        // 자동 공지 시작
        announcer.startAnnouncements(interaction.client);
        
        // 인질 시스템 시작
        const hostageSystem = require('../systems/dogBotHostageSystem');
        hostageSystem.startHostageSystem(interaction.client);
        
        // 시작 메시지 (통합 버전)
        const currentFloor = DOGBOT_RESCUE_EVENT.floors[1];
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🚨 긴급 속보! 댕댕봇 납치 사건!')
            .setDescription(
                '**📢 속보! 댕댕봇이 납치되었습니다!**\n' +
                '개발자가 댕댕봇을 **5층 디버그 타워**에 가뒀습니다!\n\n' +
                '📝 현장에서 발견된 메모:\n' +
                '*"유저들이 너무 똑똑해져서... 버그를 너무 빨리 찾아내..."*\n' +
                '*"나도 좀 쉬고 싶다... 제발..."*\n\n' +
                '**🏰 현재 1층: 🔴 SyntaxError의 문**\n' +
                '[██████████████████████] 100%\n' +
                `체력: ${currentFloor.maxHP.toLocaleString()} HP`
            )
            .addFields(
                {
                    name: '⚠️ 참여 조건',
                    value: '• **회원가입 필수** (#join 채널)\n• 사전강화 무기 자동 연동\n• 10분마다 1회 공격 가능',
                    inline: true
                },
                {
                    name: '⚔️ 전투 정보',
                    value: '• 기본 데미지: 100-200\n• 사전강화 무기 추가뎀\n• 크리티컬 확률: 10%',
                    inline: true
                },
                {
                    name: '📊 이벤트 목표',
                    value: '• 5층 보스 격파\n• 댕댕봇 구출\n• 함께 협력하기',
                    inline: true
                }
            )
            .addFields({
                name: '💡 참여 방법',
                value: '**아래 ⚔️ 공격하기 버튼을 눌러 몬스터를 공격하세요!**\n`/댕댕봇납치` 명령어로 언제든지 현황을 확인할 수 있습니다.',
                inline: false
            })
            .setFooter({ text: '🐕 댕댕봇을 구해주세요! • 20분마다 자동 공지' })
            .setTimestamp();
        
        // 버튼 생성
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('dogbot_attack')
                    .setLabel('⚔️ 공격하기')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('dogbot_ranking')
                    .setLabel('🏆 딜 순위')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('dogbot_status')
                    .setLabel('📊 현황 보기')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.reply({ embeds: [embed], components: [buttons] });
        
        // 이벤트 채널에도 공지
        const eventChannelId = '1386447256408035399';
        try {
            const eventChannel = await interaction.client.channels.fetch(eventChannelId);
            if (eventChannel && eventChannel.isTextBased()) {
                await eventChannel.send({
                    embeds: [embed],
                    components: [buttons]
                });
                console.log('✅ 댕댕봇 구출 이벤트를 이벤트 채널에 공지했습니다.');
            }
        } catch (error) {
            console.error('❌ 이벤트 채널에 공지 실패:', error);
        }
        
        // 현재 채널에도 공지 (관리자 채널인 경우)
        if (interaction.channel.id !== eventChannelId) {
            const channel = interaction.channel;
            await channel.send({
                embeds: [embed],
                components: [buttons]
            });
        }
    }
};