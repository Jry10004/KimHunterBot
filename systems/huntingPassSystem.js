// 사냥 패스 시스템
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const { formatNumber } = require('../handlers/common/utils');

// 패스 레벨별 보상
const PASS_REWARDS = {
    1: { gold: 10000, exp: 5000, items: { slime_jelly: 5 } },
    2: { gold: 15000, exp: 7500, items: { butterfly_dust: 3 } },
    3: { gold: 20000, exp: 10000, items: { rabbit_foot: 2 } },
    4: { gold: 25000, exp: 12500, items: { mushroom_spore: 3 } },
    5: { gold: 30000, exp: 15000, items: { emblemFragments: 5 }, premium: true },
    6: { gold: 40000, exp: 20000, items: { rainbow_flower: 2 } },
    7: { gold: 50000, exp: 25000, items: { crystal_shard: 3 } },
    8: { gold: 60000, exp: 30000, items: { cat_whisker: 2 } },
    9: { gold: 70000, exp: 35000, items: { frog_tongue: 1 } },
    10: { gold: 100000, exp: 50000, items: { emblemLuckyScroll: 1 }, premium: true },
    11: { gold: 120000, exp: 60000, items: { acorn: 10 } },
    12: { gold: 140000, exp: 70000, items: { owl_feather: 5 } },
    13: { gold: 160000, exp: 80000, items: { monkey_tail: 3 } },
    14: { gold: 180000, exp: 90000, items: { tree_essence: 2 } },
    15: { gold: 200000, exp: 100000, items: { emblemProtectionScroll: 1 }, premium: true },
    16: { gold: 250000, exp: 125000, items: { crystal_shard: 5 } },
    17: { gold: 300000, exp: 150000, items: { turtle_shell: 2 } },
    18: { gold: 350000, exp: 175000, items: { diamond_dust: 3 } },
    19: { gold: 400000, exp: 200000, items: { wolf_fang: 2 } },
    20: { gold: 500000, exp: 250000, items: { emblemBlessingScroll: 1, king_crown: 1 }, premium: true }
};

// 패스 미션
const PASS_MISSIONS = {
    daily: [
        { id: 'hunt_10', description: '몬스터 10마리 사냥', requirement: 10, exp: 100 },
        { id: 'boss_1', description: '보스 몬스터 1마리 처치', requirement: 1, exp: 200 },
        { id: 'rare_5', description: '희귀 몬스터 5마리 사냥', requirement: 5, exp: 150 }
    ],
    weekly: [
        { id: 'hunt_100', description: '몬스터 100마리 사냥', requirement: 100, exp: 1000 },
        { id: 'boss_10', description: '보스 몬스터 10마리 처치', requirement: 10, exp: 2000 },
        { id: 'streak_50', description: '연속 사냥 50회 달성', requirement: 50, exp: 1500 }
    ]
};

// 패스 메인 메뉴
async function showHuntingPassMenu(interaction, userId) {
    const user = await User.findOne({ discordId: userId });
    
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
            flags: 64 
        });
    }
    
    // 사냥 패스 데이터 초기화
    if (!user.huntingPass) {
        user.huntingPass = {
            level: 0,
            exp: 0,
            premium: false,
            claimedRewards: [],
            missions: {
                daily: {},
                weekly: {}
            },
            lastReset: {
                daily: new Date(),
                weekly: new Date()
            }
        };
        await user.save();
    }
    
    const passData = user.huntingPass;
    const currentLevel = passData.level;
    const nextLevel = currentLevel + 1;
    const expNeeded = nextLevel * 500; // 레벨당 500 경험치 필요
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎫 사냥 패스')
        .setDescription(`시즌 1 진행 중! ${passData.premium ? '✨ **프리미엄 패스**' : '🎯 무료 패스'}`)
        .addFields(
            { 
                name: '📊 현재 진행도', 
                value: `레벨 ${currentLevel} → ${nextLevel}\n경험치: ${passData.exp}/${expNeeded}`, 
                inline: true 
            },
            { 
                name: '🏆 다음 보상', 
                value: getRewardPreview(nextLevel), 
                inline: true 
            },
            { 
                name: '💎 프리미엄 혜택', 
                value: passData.premium ? 
                    '✅ 프리미엄 보상 획득 가능\n✅ 경험치 2배 획득\n✅ 특별 미션 해금' : 
                    '❌ 프리미엄 패스 구매 필요', 
                inline: true 
            }
        );
    
    // 진행도 바
    const progressBar = createProgressBar(passData.exp, expNeeded);
    embed.addFields({ 
        name: '진행도', 
        value: progressBar, 
        inline: false 
    });
    
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`pass_rewards_${userId}`)
                .setLabel('🎁 보상 확인')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`pass_missions_${userId}`)
                .setLabel('📋 미션')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`pass_buy_premium_${userId}`)
                .setLabel('💎 프리미엄 구매 (100,000G)')
                .setStyle(ButtonStyle.Success)
                .setDisabled(passData.premium)
        );
    
    await interaction.reply({ 
        embeds: [embed], 
        components: [row1, row2],
        flags: 64 
    });
}

// 보상 미리보기
function getRewardPreview(level) {
    const reward = PASS_REWARDS[level];
    if (!reward) return '최대 레벨 도달!';
    
    let preview = `💰 ${formatNumber(reward.gold)}G\n⚡ ${formatNumber(reward.exp)} EXP`;
    
    if (reward.items) {
        for (const [itemId, quantity] of Object.entries(reward.items)) {
            if (itemId === 'emblemFragments') {
                preview += `\n🔷 엠블럼 조각 x${quantity}`;
            } else if (itemId === 'emblemLuckyScroll') {
                preview += `\n🍀 행운의 주문서 x${quantity}`;
            } else if (itemId === 'emblemProtectionScroll') {
                preview += `\n🛡️ 보호의 주문서 x${quantity}`;
            } else if (itemId === 'emblemBlessingScroll') {
                preview += `\n✨ 축복의 주문서 x${quantity}`;
            }
        }
    }
    
    if (reward.premium) {
        preview += '\n⭐ 프리미엄 전용';
    }
    
    return preview;
}

// 진행도 바 생성
function createProgressBar(current, max) {
    const percentage = Math.floor((current / max) * 100);
    const filled = Math.floor(percentage / 5);
    const empty = 20 - filled;
    
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}

// 패스 경험치 추가
async function addPassExp(user, amount) {
    if (!user.huntingPass) {
        user.huntingPass = {
            level: 0,
            exp: 0,
            premium: false,
            claimedRewards: [],
            missions: { daily: {}, weekly: {} },
            lastReset: { daily: new Date(), weekly: new Date() }
        };
    }
    
    // 프리미엄은 경험치 2배
    if (user.huntingPass.premium) {
        amount *= 2;
    }
    
    user.huntingPass.exp += amount;
    
    // 레벨업 체크
    const expNeeded = (user.huntingPass.level + 1) * 500;
    while (user.huntingPass.exp >= expNeeded) {
        user.huntingPass.level++;
        user.huntingPass.exp -= expNeeded;
    }
    
    await user.save();
    return user.huntingPass.level;
}

// 미션 진행도 업데이트
async function updateMissionProgress(user, missionType, value) {
    if (!user.huntingPass) return;
    
    const today = new Date().toDateString();
    const thisWeek = getWeekNumber(new Date());
    
    // 일일 미션 리셋
    if (new Date(user.huntingPass.lastReset.daily).toDateString() !== today) {
        user.huntingPass.missions.daily = {};
        user.huntingPass.lastReset.daily = new Date();
    }
    
    // 주간 미션 리셋
    if (getWeekNumber(new Date(user.huntingPass.lastReset.weekly)) !== thisWeek) {
        user.huntingPass.missions.weekly = {};
        user.huntingPass.lastReset.weekly = new Date();
    }
    
    // 미션 진행도 업데이트
    const dailyMissions = PASS_MISSIONS.daily.filter(m => m.id.includes(missionType));
    const weeklyMissions = PASS_MISSIONS.weekly.filter(m => m.id.includes(missionType));
    
    for (const mission of dailyMissions) {
        if (!user.huntingPass.missions.daily[mission.id]) {
            user.huntingPass.missions.daily[mission.id] = 0;
        }
        user.huntingPass.missions.daily[mission.id] += value;
        
        // 미션 완료 체크
        if (user.huntingPass.missions.daily[mission.id] >= mission.requirement &&
            !user.huntingPass.missions.daily[`${mission.id}_claimed`]) {
            await addPassExp(user, mission.exp);
            user.huntingPass.missions.daily[`${mission.id}_claimed`] = true;
        }
    }
    
    for (const mission of weeklyMissions) {
        if (!user.huntingPass.missions.weekly[mission.id]) {
            user.huntingPass.missions.weekly[mission.id] = 0;
        }
        user.huntingPass.missions.weekly[mission.id] += value;
        
        // 미션 완료 체크
        if (user.huntingPass.missions.weekly[mission.id] >= mission.requirement &&
            !user.huntingPass.missions.weekly[`${mission.id}_claimed`]) {
            await addPassExp(user, mission.exp);
            user.huntingPass.missions.weekly[`${mission.id}_claimed`] = true;
        }
    }
    
    await user.save();
}

// 주차 계산
function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// 보상 수령
async function claimPassReward(interaction, userId, level) {
    const user = await User.findOne({ discordId: userId });
    const reward = PASS_REWARDS[level];
    
    if (!reward) {
        return await interaction.reply({ 
            content: '❌ 해당 레벨의 보상이 없습니다.', 
            flags: 64 
        });
    }
    
    if (user.huntingPass.claimedRewards.includes(level)) {
        return await interaction.reply({ 
            content: '❌ 이미 수령한 보상입니다.', 
            flags: 64 
        });
    }
    
    if (user.huntingPass.level < level) {
        return await interaction.reply({ 
            content: '❌ 아직 해당 레벨에 도달하지 못했습니다.', 
            flags: 64 
        });
    }
    
    if (reward.premium && !user.huntingPass.premium) {
        return await interaction.reply({ 
            content: '❌ 프리미엄 패스가 필요한 보상입니다.', 
            flags: 64 
        });
    }
    
    // 보상 지급
    user.gold += reward.gold;
    user.exp += reward.exp;
    
    if (reward.items) {
        for (const [itemId, quantity] of Object.entries(reward.items)) {
            if (itemId === 'emblemFragments') {
                user.emblemFragments = (user.emblemFragments || 0) + quantity;
            } else if (itemId.startsWith('emblem')) {
                if (!user.items) user.items = {};
                user.items[itemId] = (user.items[itemId] || 0) + quantity;
            } else {
                // 재료 아이템
                const existingItem = user.inventory.find(i => i.id === itemId);
                if (existingItem) {
                    existingItem.quantity = (existingItem.quantity || 1) + quantity;
                } else {
                    user.inventory.push({
                        id: itemId,
                        name: itemId.replace(/_/g, ' '),
                        type: 'material',
                        quantity: quantity,
                        inventorySlot: user.inventory.length
                    });
                }
            }
        }
    }
    
    user.huntingPass.claimedRewards.push(level);
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ 보상 수령 완료!')
        .setDescription(`레벨 ${level} 보상을 받았습니다!`)
        .addFields(
            { name: '💰 골드', value: `+${formatNumber(reward.gold)}G`, inline: true },
            { name: '⚡ 경험치', value: `+${formatNumber(reward.exp)}`, inline: true }
        );
    
    await interaction.reply({ embeds: [embed], flags: 64 });
}

module.exports = {
    showHuntingPassMenu,
    addPassExp,
    updateMissionProgress,
    claimPassReward
};