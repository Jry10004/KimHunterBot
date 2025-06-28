const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 엠블럼 강화 확률 시스템 (100강까지)
const EMBLEM_ENHANCE_RATES = {
    // 0~10강: 높은 성공률
    0: { success: 100, fail: 0, destroy: 0 },
    1: { success: 95, fail: 5, destroy: 0 },
    2: { success: 90, fail: 10, destroy: 0 },
    3: { success: 85, fail: 15, destroy: 0 },
    4: { success: 80, fail: 20, destroy: 0 },
    5: { success: 75, fail: 25, destroy: 0 },
    6: { success: 70, fail: 30, destroy: 0 },
    7: { success: 65, fail: 35, destroy: 0 },
    8: { success: 60, fail: 40, destroy: 0 },
    9: { success: 55, fail: 45, destroy: 0 },
    
    // 10~30강: 중간 난이도
    10: { success: 50, fail: 49, destroy: 1 },
    11: { success: 48, fail: 51, destroy: 1 },
    12: { success: 46, fail: 53, destroy: 1 },
    13: { success: 44, fail: 55, destroy: 1 },
    14: { success: 42, fail: 57, destroy: 1 },
    15: { success: 40, fail: 59, destroy: 1 },
    16: { success: 38, fail: 61, destroy: 1 },
    17: { success: 36, fail: 63, destroy: 1 },
    18: { success: 34, fail: 65, destroy: 1 },
    19: { success: 32, fail: 67, destroy: 1 },
    20: { success: 30, fail: 69, destroy: 1 },
    21: { success: 28, fail: 71, destroy: 1 },
    22: { success: 26, fail: 73, destroy: 1 },
    23: { success: 24, fail: 75, destroy: 1 },
    24: { success: 22, fail: 77, destroy: 1 },
    25: { success: 20, fail: 79, destroy: 1 },
    26: { success: 18, fail: 81, destroy: 1 },
    27: { success: 16, fail: 83, destroy: 1 },
    28: { success: 14, fail: 85, destroy: 1 },
    29: { success: 12, fail: 87, destroy: 1 },
    
    // 30~50강: 높은 난이도
    30: { success: 10, fail: 89, destroy: 1 },
    31: { success: 9.5, fail: 89.5, destroy: 1 },
    32: { success: 9, fail: 90, destroy: 1 },
    33: { success: 8.5, fail: 90.5, destroy: 1 },
    34: { success: 8, fail: 91, destroy: 1 },
    35: { success: 7.5, fail: 91.5, destroy: 1 },
    36: { success: 7, fail: 92, destroy: 1 },
    37: { success: 6.5, fail: 92.5, destroy: 1 },
    38: { success: 6, fail: 93, destroy: 1 },
    39: { success: 5.5, fail: 93.5, destroy: 1 },
    40: { success: 5, fail: 94, destroy: 1 },
    41: { success: 4.8, fail: 94.2, destroy: 1 },
    42: { success: 4.6, fail: 94.4, destroy: 1 },
    43: { success: 4.4, fail: 94.6, destroy: 1 },
    44: { success: 4.2, fail: 94.8, destroy: 1 },
    45: { success: 4, fail: 95, destroy: 1 },
    46: { success: 3.8, fail: 95.2, destroy: 1 },
    47: { success: 3.6, fail: 95.4, destroy: 1 },
    48: { success: 3.4, fail: 95.6, destroy: 1 },
    49: { success: 3.2, fail: 95.8, destroy: 1 },
    
    // 50~70강: 매우 높은 난이도
    50: { success: 3, fail: 96, destroy: 1 },
    51: { success: 2.9, fail: 96.1, destroy: 1 },
    52: { success: 2.8, fail: 96.2, destroy: 1 },
    53: { success: 2.7, fail: 96.3, destroy: 1 },
    54: { success: 2.6, fail: 96.4, destroy: 1 },
    55: { success: 2.5, fail: 96.5, destroy: 1 },
    56: { success: 2.4, fail: 96.6, destroy: 1 },
    57: { success: 2.3, fail: 96.7, destroy: 1 },
    58: { success: 2.2, fail: 96.8, destroy: 1 },
    59: { success: 2.1, fail: 96.9, destroy: 1 },
    60: { success: 2, fail: 97, destroy: 1 },
    61: { success: 1.9, fail: 97.1, destroy: 1 },
    62: { success: 1.8, fail: 97.2, destroy: 1 },
    63: { success: 1.7, fail: 97.3, destroy: 1 },
    64: { success: 1.6, fail: 97.4, destroy: 1 },
    65: { success: 1.5, fail: 97.5, destroy: 1 },
    66: { success: 1.4, fail: 97.6, destroy: 1 },
    67: { success: 1.3, fail: 97.7, destroy: 1 },
    68: { success: 1.2, fail: 97.8, destroy: 1 },
    69: { success: 1.1, fail: 97.9, destroy: 1 },
    
    // 70~100강: 극한 난이도
    70: { success: 1, fail: 98, destroy: 1 },
    71: { success: 0.95, fail: 98.05, destroy: 1 },
    72: { success: 0.9, fail: 98.1, destroy: 1 },
    73: { success: 0.85, fail: 98.15, destroy: 1 },
    74: { success: 0.8, fail: 98.2, destroy: 1 },
    75: { success: 0.75, fail: 98.25, destroy: 1 },
    76: { success: 0.7, fail: 98.3, destroy: 1 },
    77: { success: 0.65, fail: 98.35, destroy: 1 },
    78: { success: 0.6, fail: 98.4, destroy: 1 },
    79: { success: 0.55, fail: 98.45, destroy: 1 },
    80: { success: 0.5, fail: 98.5, destroy: 1 },
    81: { success: 0.48, fail: 98.52, destroy: 1 },
    82: { success: 0.46, fail: 98.54, destroy: 1 },
    83: { success: 0.44, fail: 98.56, destroy: 1 },
    84: { success: 0.42, fail: 98.58, destroy: 1 },
    85: { success: 0.4, fail: 98.6, destroy: 1 },
    86: { success: 0.38, fail: 98.62, destroy: 1 },
    87: { success: 0.36, fail: 98.64, destroy: 1 },
    88: { success: 0.34, fail: 98.66, destroy: 1 },
    89: { success: 0.32, fail: 98.68, destroy: 1 },
    90: { success: 0.3, fail: 98.7, destroy: 1 },
    91: { success: 0.28, fail: 98.72, destroy: 1 },
    92: { success: 0.26, fail: 98.74, destroy: 1 },
    93: { success: 0.24, fail: 98.76, destroy: 1 },
    94: { success: 0.22, fail: 98.78, destroy: 1 },
    95: { success: 0.2, fail: 98.8, destroy: 1 },
    96: { success: 0.18, fail: 98.82, destroy: 1 },
    97: { success: 0.16, fail: 98.84, destroy: 1 },
    98: { success: 0.14, fail: 98.86, destroy: 1 },
    99: { success: 0.12, fail: 98.88, destroy: 1 }
};

// 하락 및 초기화 확률
const FAIL_PENALTIES = {
    nothing: 70,       // 70% 확률로 레벨 유지
    downgrade: 29.9,   // 29.9% 확률로 1레벨 하락
    reset: 0.1         // 0.1% 확률로 0으로 초기화
};

// 직업별 강화 스탯 (레벨당)
const EMBLEM_ENHANCE_STATS = {
    warrior: {
        name: '전사',
        stats: { strength: 0.5, vitality: 0.3 }
    },
    archer: {
        name: '궁수',
        stats: { agility: 0.5, luck: 0.3 }
    },
    defender: {
        name: '수호자',
        stats: { vitality: 0.6, strength: 0.2 }
    },
    wizard: {
        name: '마법사',
        stats: { intelligence: 0.6, luck: 0.2 }
    },
    rogue: {
        name: '도적',
        stats: { agility: 0.4, luck: 0.4 }
    }
};

// 강화 시도 함수
function attemptEmblemEnhance(currentLevel) {
    const rates = EMBLEM_ENHANCE_RATES[currentLevel] || EMBLEM_ENHANCE_RATES[99];
    const random = Math.random() * 100;
    
    if (random <= rates.success) {
        return 'success';
    } else if (random <= rates.success + rates.fail) {
        // 실패 시 추가 판정
        const failRandom = Math.random() * 100;
        if (failRandom <= FAIL_PENALTIES.reset) {
            return 'reset';  // 0.1% 확률로 초기화
        } else if (failRandom <= FAIL_PENALTIES.nothing) {
            return 'maintain';  // 70% 확률로 유지
        } else {
            return 'downgrade';  // 29.9% 확률로 하락
        }
    } else {
        return 'downgrade';  // destroy도 하락으로 처리
    }
}

// 강화 UI 생성
function createEmblemEnhanceEmbed(user, emblemType) {
    const enhanceData = user.emblemEnhancement || { level: 0, stats: {} };
    const jobData = EMBLEM_ENHANCE_STATS[emblemType];
    const rates = EMBLEM_ENHANCE_RATES[enhanceData.level] || EMBLEM_ENHANCE_RATES[99];
    
    // 현재 추가 스탯 계산
    const currentStats = [];
    for (const [stat, value] of Object.entries(jobData.stats)) {
        const statValue = Math.floor(value * enhanceData.level);
        if (statValue > 0) {
            const statNames = {
                strength: '💪 힘',
                agility: '🏃 민첩',
                intelligence: '🧠 지능',
                vitality: '❤️ 체력',
                luck: '🍀 행운'
            };
            currentStats.push(`${statNames[stat]}: +${statValue}`);
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor(enhanceData.level >= 70 ? '#ff0000' : enhanceData.level >= 50 ? '#ff6b00' : enhanceData.level >= 30 ? '#ffd700' : '#00ff00')
        .setTitle('🔨 엠블럼 강화')
        .setDescription(`${user.emblem} **+${enhanceData.level}**`)
        .addFields(
            { 
                name: '📊 강화 정보', 
                value: [
                    `현재 레벨: **+${enhanceData.level}**`,
                    `성공 확률: **${rates.success}%**`,
                    `실패 확률: **${rates.fail + rates.destroy}%**`,
                    ``,
                    `실패 시:`,
                    `• 유지: **70%**`,
                    `• 하락 (-1): **29.9%**`,
                    `• 초기화 (0): **0.1%**`
                ].join('\n'),
                inline: true
            },
            { 
                name: '💎 강화석', 
                value: [
                    `필요: **1개**`,
                    `보유: **${user.items?.emblemEnhanceStone || 0}개**`
                ].join('\n'),
                inline: true
            }
        );
    
    if (currentStats.length > 0) {
        embed.addFields({
            name: '✨ 추가 능력치',
            value: currentStats.join('\n'),
            inline: false
        });
    }
    
    if (enhanceData.level >= 90) {
        embed.setFooter({ text: '⚠️ 극한의 난이도! 신중하게 도전하세요!' });
    } else if (enhanceData.level >= 70) {
        embed.setFooter({ text: '🔥 매우 높은 난이도입니다!' });
    } else if (enhanceData.level >= 50) {
        embed.setFooter({ text: '💫 높은 레벨일수록 성공이 어렵습니다!' });
    }
    
    return embed;
}

// 강화 결과 처리
async function processEmblemEnhancement(user, emblemType) {
    if (!user.emblemEnhancement) {
        user.emblemEnhancement = {
            level: 0,
            stats: {},
            totalAttempts: 0,
            totalStonesUsed: 0,
            maxLevel: 0
        };
    }
    
    // 강화석 확인
    if (!user.items?.emblemEnhanceStone || user.items.emblemEnhanceStone < 1) {
        return { success: false, message: '엠블럼 강화석이 부족합니다!' };
    }
    
    // 강화석 소모
    user.items.emblemEnhanceStone -= 1;
    user.emblemEnhancement.totalStonesUsed += 1;
    user.emblemEnhancement.totalAttempts += 1;
    
    const currentLevel = user.emblemEnhancement.level;
    const result = attemptEmblemEnhance(currentLevel);
    
    let resultMessage = '';
    let newLevel = currentLevel;
    
    switch (result) {
        case 'success':
            newLevel = currentLevel + 1;
            resultMessage = `🎉 강화 성공! **+${currentLevel} → +${newLevel}**`;
            break;
        case 'downgrade':
            newLevel = Math.max(0, currentLevel - 1);
            resultMessage = `💔 강화 실패... **+${currentLevel} → +${newLevel}**`;
            break;
        case 'maintain':
            resultMessage = `🛡️ 강화 실패! 하지만 레벨이 유지되었습니다! **+${currentLevel}**`;
            break;
        case 'reset':
            newLevel = 0;
            resultMessage = `💥 대실패! 강화 레벨이 초기화되었습니다! **+${currentLevel} → 0**`;
            break;
    }
    
    user.emblemEnhancement.level = newLevel;
    user.emblemEnhancement.maxLevel = Math.max(user.emblemEnhancement.maxLevel, newLevel);
    
    // 스탯 재계산
    const jobData = EMBLEM_ENHANCE_STATS[emblemType];
    user.emblemEnhancement.stats = {};
    for (const [stat, value] of Object.entries(jobData.stats)) {
        user.emblemEnhancement.stats[stat] = Math.floor(value * newLevel);
    }
    
    await user.save();
    
    return {
        success: true,
        result: result,
        message: resultMessage,
        previousLevel: currentLevel,
        newLevel: newLevel
    };
}

// 강화 버튼 생성
function createEmblemEnhanceButtons(hasStones) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('emblem_enhance_try')
                .setLabel('🔨 강화하기')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!hasStones),
            new ButtonBuilder()
                .setCustomId('emblem_enhance_info')
                .setLabel('📊 강화 정보')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('emblem_enhance_ranking')
                .setLabel('🏆 강화 랭킹')
                .setStyle(ButtonStyle.Secondary)
        );
}

module.exports = {
    EMBLEM_ENHANCE_RATES,
    EMBLEM_ENHANCE_STATS,
    FAIL_PENALTIES,
    attemptEmblemEnhance,
    createEmblemEnhanceEmbed,
    processEmblemEnhancement,
    createEmblemEnhanceButtons
};