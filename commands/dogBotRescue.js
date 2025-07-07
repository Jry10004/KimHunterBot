const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const stateManager = require('../systems/dogBotStateManager');
const { DOGBOT_RESCUE_EVENT, getCurrentFloor, getHPPercentage, createProgressBar } = require('../data/dogBotRescueEvent');
const User = require('../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('댕댕봇납치')
        .setDescription('댕댕봇 납치 이벤트 현황을 확인합니다'),
    
    async execute(interaction) {
        // state가 로드되지 않았을 경우 처리
        if (!stateManager.state || !stateManager.state.status) {
            return await interaction.reply({
                content: '⏳ 이벤트 데이터를 로드중입니다. 잠시 후 다시 시도해주세요.',
                ephemeral: true
            });
        }
        
        // 이벤트 활성화 체크
        if (!stateManager.state.status.isActive) {
            return await interaction.reply({
                content: '🚫 현재 댕댕봇 구출 이벤트가 진행중이지 않습니다.',
                ephemeral: true
            });
        }
        
        // 이미 구출 완료
        if (stateManager.state.status.rescueComplete) {
            return await interaction.reply({
                content: '🎉 댕댕봇은 이미 구출되었습니다!',
                ephemeral: true
            });
        }
        
        const currentFloor = getCurrentFloor();
        const floorNum = stateManager.state.status.currentFloor;
        const hpPercentage = getHPPercentage(currentFloor);
        const progressBar = createProgressBar(hpPercentage);
        
        const embed = new EmbedBuilder()
            .setColor(currentFloor.color)
            .setTitle(`🏰 댕댕봇 구출 작전 - ${floorNum}층`)
            .setDescription(currentFloor.description)
            .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723787/dogbot.png');
        
        // 회원가입 확인
        const user = await User.findOne({ discordId: interaction.user.id });
        const isRegistered = user && user.registered;
        
        if (!isRegistered) {
            embed.addFields({
                name: '⚠️ 회원가입 필요',
                value: '이벤트에 참여하려면 **#join 채널**에서 가입해주세요!\n사전강화 데이터는 자동 연동됩니다.',
                inline: false
            });
        }
        
        embed.addFields(
                {
                    name: `${currentFloor.emoji || '🏰'} ${currentFloor.name}`,
                    value: currentFloor.bossQuote,
                    inline: false
                },
                {
                    name: '❤️ 보스 체력',
                    value: `${progressBar}\n${currentFloor.currentHP.toLocaleString()}/${currentFloor.maxHP.toLocaleString()} HP`,
                    inline: false
                },
                {
                    name: '📊 진행 상황',
                    value: `현재 층: **${floorNum}/${stateManager.state.status.totalFloors}층**\n참여자: **${stateManager.state.statistics.participants.length}명**`,
                    inline: true
                },
                {
                    name: '⚔️ 공격 정보',
                    value: '• 10분마다 1회 공격 가능\n• 무기 강화로 데미지 증가\n• 10% 크리티컬 확률',
                    inline: true
                }
            );
        
        // 현재 MVP 정보
        if (stateManager.state.statistics.mvp.userId) {
            embed.addFields({
                name: '🏆 현재 MVP',
                value: `<@${stateManager.state.statistics.mvp.userId}> - ${stateManager.state.statistics.mvp.damage.toLocaleString()} 데미지`,
                inline: false
            });
        }
        
        // 버튼 생성
        const buttons = new ActionRowBuilder();
        
        if (!isRegistered) {
            // 미가입자용 버튼
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId('register')
                    .setLabel('✅ 회원가입 하기')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('dogbot_status')
                    .setLabel('📊 현황 보기')
                    .setStyle(ButtonStyle.Secondary)
            );
        } else {
            // 가입자용 버튼
            buttons.addComponents(
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
        }
        
        await interaction.reply({ embeds: [embed], components: [buttons] });
    }
};