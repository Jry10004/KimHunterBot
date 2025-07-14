const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const DailyMission = require('../../models/DailyMission');
const User = require('../../models/User');
const { getUser } = require('../common/utils');
const { applyGoldBonus } = require('../common/specialEffects');

// 일일미션 목록
const DAILY_MISSIONS = {
    attendance: { name: '📅 출석하기', desc: '게임에 접속하기' },
    miniGames: { name: '🎮 미니게임 3회', desc: '아무 미니게임이나 3회 플레이' },
    pvpBattles: { name: '⚔️ PVP 대전 10회', desc: '승패 무관하게 10회 대전' },
    earnGold: { name: '💰 골드 50,000 벌기', desc: '어떤 방법이든 50,000골드 획득' },
    enhanceTries: { name: '🔨 강화 시도 3회', desc: '김헌터 계급 강화 3회 시도' },
    exercise: { name: '💪 운동하기 1회', desc: '헬스장에서 운동 1회' },
    hunting: { name: '🏹 사냥 5회', desc: '아무 사냥터에서 5회 사냥' },
    stockTrade: { name: '📊 주식 거래 1회', desc: '매수 또는 매도 1회' },
    artifactExplore: { name: '🏺 유물 탐사 3회', desc: '광산이나 탐사회사 3회' },
    energyMining: { name: '⚡ 에너지 채굴 10회', desc: '에너지 조각 10회 채굴' }
};

// 주간미션 목록
const WEEKLY_MISSIONS = {
    totalPvpWins: { name: '🏆 PVP 승리 30회', desc: '일주일간 PVP 30승 달성' },
    totalGoldEarned: { name: '💎 골드 100만 벌기', desc: '일주일간 총 100만 골드 획득' },
    totalEnhanceSuccess: { name: '✨ 강화 성공 10회', desc: '일주일간 강화 10회 성공' },
    totalMiniGames: { name: '🎯 미니게임 50회', desc: '일주일간 미니게임 50회 플레이' },
    totalHunting: { name: '🦌 사냥 100회', desc: '일주일간 사냥 100회 완료' },
    dailyMissionComplete: { name: '📅 일일미션 5일 완료', desc: '일주일 중 5일 일일미션 완료' }
};

// 일일미션 표시
async function showDailyMissions(interaction) {
    let missionData = await DailyMission.findOne({ userId: interaction.user.id });
    if (!missionData) {
        // 미션 데이터가 없으면 생성
        missionData = new DailyMission({ userId: interaction.user.id });
        await missionData.save();
    }
    
    // 리셋 체크
    const wasReset = missionData.resetDaily();
    if (wasReset) {
        console.log(`[미션] ${interaction.user.id}의 일일미션이 리셋되었습니다.`);
        await missionData.save();
    }
    
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🎯 일일미션')
        .setDescription(`오늘의 미션을 완료하고 보상을 받으세요!\n완료: ${missionData.dailyCompletedCount}/10`)
        .setThumbnail('https://media.giphy.com/media/3o7TKVfu4Wr3pxKBDq/giphy.gif');
    
    // 미션 목록 표시
    let missionText = '';
    Object.entries(DAILY_MISSIONS).forEach(([key, mission]) => {
        const progress = missionData.dailyMissions[key];
        const isCompleted = progress.completed;
        const emoji = isCompleted ? '✅' : '⬜';
        const progressBar = createProgressBar(progress.progress, progress.target);
        
        missionText += `${emoji} **${mission.name}**\n`;
        missionText += `${progressBar} (${progress.progress}/${progress.target})\n`;
        missionText += `└ ${mission.desc}\n\n`;
    });
    
    embed.addFields({ name: '📋 미션 목록', value: missionText || '미션이 없습니다.' });
    
    // 보상 정보
    const canClaim = missionData.dailyCompletedCount >= 10 && !missionData.dailyRewardClaimed;
    embed.addFields({
        name: '🎁 완료 보상',
        value: '💰 100,000 골드\n💎 엠블럼 강화석 x1',
        inline: true
    });
    
    embed.addFields({
        name: '📊 진행 상황',
        value: `전체: ${missionData.dailyCompletedCount}/10\n상태: ${canClaim ? '✅ 수령 가능!' : missionData.dailyRewardClaimed ? '✓ 수령 완료' : '🔒 미완료'}`,
        inline: true
    });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('claim_daily_mission_reward')
                .setLabel('🎁 보상 수령')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!canClaim),
            new ButtonBuilder()
                .setCustomId('daily')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.reply({
        embeds: [embed],
        components: [buttons],
        flags: 64
    });
}

// 주간미션 표시
async function showWeeklyMissions(interaction) {
    let missionData = await DailyMission.findOne({ userId: interaction.user.id });
    if (!missionData) {
        // 미션 데이터가 없으면 생성
        missionData = new DailyMission({ userId: interaction.user.id });
        await missionData.save();
    }
    
    // 리셋 체크
    missionData.resetWeekly();
    await missionData.save();
    
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🏆 주간미션')
        .setDescription(`이번 주 미션을 완료하고 특별 보상을 받으세요!\n완료: ${missionData.weeklyCompletedCount}/6`)
        .setThumbnail('https://media.giphy.com/media/xT5LMXR7iA0mSSxOhO/giphy.gif');
    
    // 미션 목록 표시
    let missionText = '';
    Object.entries(WEEKLY_MISSIONS).forEach(([key, mission]) => {
        const progress = missionData.weeklyMissions[key];
        const isCompleted = progress.completed;
        const emoji = isCompleted ? '✅' : '⬜';
        const progressBar = createProgressBar(progress.progress, progress.target);
        
        missionText += `${emoji} **${mission.name}**\n`;
        missionText += `${progressBar} (${progress.progress}/${progress.target})\n`;
        missionText += `└ ${mission.desc}\n\n`;
    });
    
    embed.addFields({ name: '📋 미션 목록', value: missionText || '미션이 없습니다.' });
    
    // 보상 정보
    const canClaim = missionData.weeklyCompletedCount >= 6 && !missionData.weeklyRewardClaimed;
    embed.addFields({
        name: '💎 완료 보상',
        value: '💰 500,000 골드\n💎 엠블럼 강화석 x5\n🎁 프리미엄 코인 x1',
        inline: true
    });
    
    embed.addFields({
        name: '📊 진행 상황',
        value: `전체: ${missionData.weeklyCompletedCount}/6\n상태: ${canClaim ? '✅ 수령 가능!' : missionData.weeklyRewardClaimed ? '✓ 수령 완료' : '🔒 미완료'}`,
        inline: true
    });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('claim_weekly_mission_reward')
                .setLabel('💎 보상 수령')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!canClaim),
            new ButtonBuilder()
                .setCustomId('daily')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.reply({
        embeds: [embed],
        components: [buttons],
        flags: 64
    });
}

// 진행도 바 생성
function createProgressBar(current, max) {
    const percentage = Math.floor((current / max) * 100);
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;
    return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${percentage}%`;
}

// 일일미션 보상 수령
async function claimDailyMissionReward(interaction) {
    const missionData = await DailyMission.findOne({ userId: interaction.user.id });
    const user = await getUser(interaction.user.id);
    
    if (!missionData || missionData.dailyCompletedCount < 10 || missionData.dailyRewardClaimed) {
        return await interaction.reply({ content: '❌ 보상을 수령할 수 없습니다.', flags: 64 });
    }
    
    // 보상 지급 (칭호 효과 적용)
    const goldReward = applyGoldBonus(100000, user);
    user.gold += goldReward;
    user.inventory.push({
        name: '엠블럼 강화석',
        type: 'consumable',
        rarity: 'rare',
        quantity: 1,
        description: '엠블럼을 강화할 수 있는 특별한 돌'
    });
    await user.save();
    
    // 골드 획득 미션 업데이트
    const MissionHelper = require('../../utils/missionHelper');
    await MissionHelper.updateGoldEarned(interaction.user.id, 100000);
    
    // 보상 수령 처리
    missionData.dailyRewardClaimed = true;
    missionData.dailyStreak++;
    missionData.lastStreakDate = new Date();
    
    // 주간미션 진행도 업데이트
    missionData.updateWeeklyProgress('dailyMissionComplete', 1);
    await missionData.save();
    
    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🎁 일일미션 보상 수령!')
        .setDescription('축하합니다! 오늘의 미션을 모두 완료했습니다!')
        .addFields(
            { name: '획득 보상', value: '💰 100,000 골드\n💎 엠블럼 강화석 x1', inline: true },
            { name: '연속 출석', value: `🔥 ${missionData.dailyStreak}일 연속!`, inline: true }
        )
        .setThumbnail('https://media.giphy.com/media/g9582DNuQppxC/giphy.gif');
    
    await interaction.reply({
        embeds: [embed],
        flags: 64
    });
}

// 주간미션 보상 수령
async function claimWeeklyMissionReward(interaction) {
    const missionData = await DailyMission.findOne({ userId: interaction.user.id });
    const user = await getUser(interaction.user.id);
    
    if (!missionData || missionData.weeklyCompletedCount < 6 || missionData.weeklyRewardClaimed) {
        return await interaction.reply({ content: '❌ 보상을 수령할 수 없습니다.', flags: 64 });
    }
    
    // 보상 지급 (칭호 효과 적용)
    const weeklyGoldReward = applyGoldBonus(500000, user);
    user.gold += weeklyGoldReward;
    for (let i = 0; i < 5; i++) {
        user.inventory.push({
            name: '엠블럼 강화석',
            type: 'consumable',
            rarity: 'rare',
            quantity: 1,
            description: '엠블럼을 강화할 수 있는 특별한 돌'
        });
    }
    user.inventory.push({
        name: '프리미엄 코인',
        type: 'consumable',
        rarity: 'legendary',
        quantity: 1,
        description: '특별한 아이템과 교환할 수 있는 프리미엄 화폐'
    });
    await user.save();
    
    // 골드 획득 미션 업데이트
    const MissionHelper = require('../../utils/missionHelper');
    await MissionHelper.updateGoldEarned(interaction.user.id, 500000);
    
    // 보상 수령 처리
    missionData.weeklyRewardClaimed = true;
    await missionData.save();
    
    const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('💎 주간미션 보상 수령!')
        .setDescription('대단합니다! 이번 주 미션을 모두 완료했습니다!')
        .addFields(
            { name: '획득 보상', value: '💰 500,000 골드\n💎 엠블럼 강화석 x5\n🎁 프리미엄 코인 x1', inline: false }
        )
        .setImage('https://media.giphy.com/media/xT0xezQGU5xCDJuCPe/giphy.gif');
    
    await interaction.reply({
        embeds: [embed],
        flags: 64
    });
}

module.exports = {
    showDailyMissions,
    showWeeklyMissions,
    claimDailyMissionReward,
    claimWeeklyMissionReward
};