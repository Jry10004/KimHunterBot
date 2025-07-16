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

// 직업별 강화 스탯 (레벨당) - 밸런스 조정
const EMBLEM_ENHANCE_STATS = {
    warrior: {
        name: '전사',
        stats: { strength: 0.5, vitality: 0.3 }  // 0.7 → 0.5, 0.4 → 0.3
    },
    archer: {
        name: '궁수',
        stats: { agility: 0.5, luck: 0.3 }
    },
    defender: {
        name: '수호자',
        stats: { vitality: 0.5, strength: 0.3 }  // 0.6 → 0.5, 0.2 → 0.3
    },
    wizard: {
        name: '마법사',
        stats: { intelligence: 0.5, luck: 0.3 }  // 0.6 → 0.5, 0.2 → 0.3
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
    
    // 보유 주문서 확인
    const hasBlessingScroll = user.inventory?.some(item => 
        item.id === 'emblem_blessing_scroll' && (item.quantity || 0) > 0
    );
    
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
    
    // 기본 엠블럼 이름만 추출 (강화 레벨 제거)
    const baseEmblemName = user.emblem.replace(/\s*\+\d+$/, '');
    
    const embed = new EmbedBuilder()
        .setColor(enhanceData.level >= 70 ? '#ff0000' : enhanceData.level >= 50 ? '#ff6b00' : enhanceData.level >= 30 ? '#ffd700' : '#00ff00')
        .setTitle('🔨 엠블럼 강화')
        .setDescription(`${baseEmblemName} **+${enhanceData.level}**`)
        .addFields(
            { 
                name: '📊 강화 정보', 
                value: [
                    `현재 레벨: **+${enhanceData.level}**`,
                    `성공 확률: **${rates.success}%**${hasBlessingScroll ? ' (축복 시 ' + Math.min(100, rates.success * 2) + '%)' : ''}`,
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
                name: '💎 엠블럼강화조각', 
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
            maxLevel: 0,
            appliedStats: {}
        };
    }
    
    // 강화석 확인
    if (!user.items?.emblemEnhanceStone || user.items.emblemEnhanceStone < 1) {
        return { success: false, message: '엠블럼강화조각이 부족합니다!' };
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
    
    // 엠블럼 이름 업데이트 (기본 이름 + 강화 레벨)
    const baseEmblemName = user.emblem.replace(/\s*\+\d+$/, ''); // 기존 강화 레벨 제거
    if (newLevel > 0) {
        user.emblem = `${baseEmblemName} +${newLevel}`;
    } else {
        user.emblem = baseEmblemName;
    }
    
    // 스탯 재계산
    const jobData = EMBLEM_ENHANCE_STATS[emblemType];
    user.emblemEnhancement.stats = {};
    user.emblemEnhancement.appliedStats = {}; // appliedStats도 업데이트
    
    for (const [stat, value] of Object.entries(jobData.stats)) {
        let statValue = Math.floor(value * newLevel);
        
        // 10, 20, 30 등 특정 구간 보너스
        if (newLevel >= 10) statValue += 5;
        if (newLevel >= 20) statValue += 10;
        if (newLevel >= 30) statValue += 15;
        if (newLevel >= 40) statValue += 20;
        if (newLevel >= 50) statValue += 30;
        if (newLevel >= 60) statValue += 40;
        if (newLevel >= 70) statValue += 50;
        if (newLevel >= 80) statValue += 60;
        if (newLevel >= 90) statValue += 70;
        if (newLevel >= 100) statValue += 100;
        
        user.emblemEnhancement.stats[stat] = statValue;
        user.emblemEnhancement.appliedStats[stat] = statValue; // appliedStats에도 동일하게 저장
    }
    
    // 레벨이 변경되었으므로 저장하지 않고 반환
    // enhanceEmblem 함수에서 applyEmblemStats를 호출한 후 저장할 것임
    
    return {
        success: true,
        result: result,
        message: resultMessage,
        previousLevel: currentLevel,
        newLevel: newLevel
    };
}

// 강화 버튼 생성
function createEmblemEnhanceButtons(hasStones, user) {
    // 기본적으로 user 파라미터가 없을 경우를 대비
    if (!user) {
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
                    .setStyle(ButtonStyle.Secondary)
            );
    }
    
    // 주문서 확인
    const hasBlessingScroll = user.inventory?.some(item => 
        item.id === 'emblem_blessing_scroll' && (item.quantity || 0) > 0
    );
    const hasProtectionScroll = user.inventory?.some(item => 
        item.id === 'emblem_protection_scroll' && (item.quantity || 0) > 0
    );
    
    const buttons = [
        new ButtonBuilder()
            .setCustomId('emblem_enhance_try')
            .setLabel('🔨 강화하기')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!hasStones),
        new ButtonBuilder()
            .setCustomId('emblem_enhance_info')
            .setLabel('📊 강화 정보')
            .setStyle(ButtonStyle.Secondary)
    ];
    
    // 주문서 버튼 추가
    const scrollButtons = [];
    if (hasBlessingScroll || hasProtectionScroll) {
        if (hasBlessingScroll) {
            scrollButtons.push(
                new ButtonBuilder()
                    .setCustomId('emblem_use_blessing')
                    .setLabel('✨ 축복 주문서')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!hasStones)
            );
        }
        if (hasProtectionScroll) {
            scrollButtons.push(
                new ButtonBuilder()
                    .setCustomId('emblem_use_protection')
                    .setLabel('🛡️ 보호 주문서')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!hasStones)
            );
        }
        
        // 버튼 배치 - 두 줄로 나누기
        return [
            new ActionRowBuilder().addComponents(buttons),
            new ActionRowBuilder().addComponents(scrollButtons)
        ];
    }
    
    // 주문서가 없으면 기본 버튼만
    return new ActionRowBuilder().addComponents(buttons);
}

// 주문서를 사용한 강화 시도 함수
function attemptEmblemEnhanceWithScroll(currentLevel, scrollType) {
    const rates = EMBLEM_ENHANCE_RATES[currentLevel] || EMBLEM_ENHANCE_RATES[99];
    const random = Math.random() * 100;
    
    let successRate = rates.success;
    
    // 축복 주문서 효과: 성공률 2배 (최대 100%)
    if (scrollType === 'blessing') {
        successRate = Math.min(100, successRate * 2);
    }
    
    if (random <= successRate) {
        return 'success';
    } else {
        // 보호 주문서 효과: 실패 시 레벨 유지
        if (scrollType === 'protection') {
            return 'maintain';
        }
        
        // 일반 실패 처리
        const failRandom = Math.random() * 100;
        if (failRandom <= FAIL_PENALTIES.reset) {
            return 'reset';
        } else if (failRandom <= FAIL_PENALTIES.nothing) {
            return 'maintain';
        } else {
            return 'downgrade';
        }
    }
}

// 주문서를 사용한 강화 결과 처리
async function processEmblemEnhancementWithScroll(user, emblemType, scrollType) {
    if (!user.emblemEnhancement) {
        user.emblemEnhancement = {
            level: 0,
            stats: {},
            totalAttempts: 0,
            totalStonesUsed: 0,
            maxLevel: 0,
            appliedStats: {}
        };
    }
    
    // 강화석 확인
    if (!user.items?.emblemEnhanceStone || user.items.emblemEnhanceStone < 1) {
        return { success: false, message: '엠블럼강화조각이 부족합니다!' };
    }
    
    // 강화석 소모
    user.items.emblemEnhanceStone -= 1;
    user.emblemEnhancement.totalStonesUsed += 1;
    user.emblemEnhancement.totalAttempts += 1;
    
    const currentLevel = user.emblemEnhancement.level;
    const result = attemptEmblemEnhanceWithScroll(currentLevel, scrollType);
    
    let resultMessage = '';
    let newLevel = currentLevel;
    
    switch (result) {
        case 'success':
            newLevel = currentLevel + 1;
            resultMessage = `🎉 강화 성공! **+${currentLevel} → +${newLevel}**\n${scrollType === 'blessing' ? '✨ 축복 주문서의 효과로 성공률이 증가했습니다!' : ''}`;
            break;
        case 'downgrade':
            newLevel = Math.max(0, currentLevel - 1);
            resultMessage = `💔 강화 실패... **+${currentLevel} → +${newLevel}**`;
            break;
        case 'maintain':
            resultMessage = `🛡️ 강화 실패! ${scrollType === 'protection' ? '보호 주문서의 효과로 레벨이 유지되었습니다!' : '하지만 레벨이 유지되었습니다!'} **+${currentLevel}**`;
            break;
        case 'reset':
            newLevel = 0;
            resultMessage = `💥 대실패! 강화 레벨이 초기화되었습니다! **+${currentLevel} → 0**`;
            break;
    }
    
    user.emblemEnhancement.level = newLevel;
    user.emblemEnhancement.maxLevel = Math.max(user.emblemEnhancement.maxLevel, newLevel);
    
    // 엠블럼 이름 업데이트
    const baseEmblemName = user.emblem.replace(/\s*\+\d+$/, '');
    if (newLevel > 0) {
        user.emblem = `${baseEmblemName} +${newLevel}`;
    } else {
        user.emblem = baseEmblemName;
    }
    
    // 스탯 재계산
    const jobData = EMBLEM_ENHANCE_STATS[emblemType];
    user.emblemEnhancement.stats = {};
    user.emblemEnhancement.appliedStats = {}; // appliedStats도 업데이트
    
    for (const [stat, value] of Object.entries(jobData.stats)) {
        let statValue = Math.floor(value * newLevel);
        
        // 특정 구간 보너스
        if (newLevel >= 10) statValue += 5;
        if (newLevel >= 20) statValue += 10;
        if (newLevel >= 30) statValue += 15;
        if (newLevel >= 40) statValue += 20;
        if (newLevel >= 50) statValue += 30;
        if (newLevel >= 60) statValue += 40;
        if (newLevel >= 70) statValue += 50;
        if (newLevel >= 80) statValue += 60;
        if (newLevel >= 90) statValue += 70;
        if (newLevel >= 100) statValue += 100;
        
        user.emblemEnhancement.stats[stat] = statValue;
        user.emblemEnhancement.appliedStats[stat] = statValue; // appliedStats에도 동일하게 저장
    }
    
    return {
        success: true,
        result: result,
        message: resultMessage,
        previousLevel: currentLevel,
        newLevel: newLevel
    };
}

// 엠블럼 강화 시도 함수
async function tryEnhanceEmblem(interaction, count = 1) {
    try {
        // InteractionHandler에서 이미 defer했으므로 제거
        
        const { getUser } = require('../handlers/common/utils');
        const user = await getUser(interaction.user.id);
        
        if (!user || !user.emblem) {
            await interaction.followUp({
                content: '❌ 엠블럼을 착용하고 있지 않습니다!',
                flags: 64
            });
            return;
        }
        
        if (!user.items?.emblemEnhanceStone || user.items.emblemEnhanceStone < count) {
            await interaction.followUp({
                content: `❌ 엠블럼 강화조각이 부족합니다! (필요: ${count}개)`,
                flags: 64
            });
            return;
        }
        
        let totalSuccess = 0;
        let totalFail = 0;
        let results = [];
        
        const actualCount = count === 'max' ? user.items.emblemEnhanceStone : count;
        
        // 엠블럼 타입 찾기
        const { EMBLEMS } = require('./emblemShop');
        const baseEmblemName = user.emblem.replace(/\s*\+\d+$/, '');
        const emblemType = Object.keys(EMBLEMS).find(type => 
            EMBLEMS[type].emblems.some(e => e.name === baseEmblemName)
        );
        
        if (!emblemType) {
            await interaction.followUp({
                content: '❌ 알 수 없는 엠블럼 타입입니다!',
                flags: 64
            });
            return;
        }
        
        for (let i = 0; i < actualCount; i++) {
            const result = await processEmblemEnhancement(user, emblemType);
            if (result.success) {
                if (result.result === 'success') {
                    totalSuccess++;
                } else {
                    totalFail++;
                }
            }
            results.push(result);
            
            if (user.items.emblemEnhanceStone <= 0) break;
        }
        
        await user.save();
        
        // 결과 표시
        const embed = createEmblemEnhanceEmbed(user, emblemType);
        const hasStones = user.items?.emblemEnhanceStone > 0;
        const components = createEmblemEnhanceButtons(hasStones, user);
        
        let resultMessage = '';
        if (actualCount === 1) {
            resultMessage = results[0].message;
        } else {
            resultMessage = `🎰 ${actualCount}회 강화 결과:\n✅ 성공: ${totalSuccess}회\n❌ 실패: ${totalFail}회\n최종 레벨: **+${user.emblemEnhancement.level}**`;
        }
        
        // 버튼 배열 처리 및 뒤로가기 버튼 추가
        const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('emblem')
                    .setLabel('◀️ 엠블럼으로 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        const buttonRows = Array.isArray(components) ? components : [components];
        
        await interaction.editReply({
            embeds: [embed],
            components: [...buttonRows, backButton]
        });
        
        await interaction.followUp({
            content: resultMessage,
            flags: 64
        });
        
    } catch (error) {
        console.error('엠블럼 강화 오류:', error);
        await interaction.followUp({
            content: '❌ 강화 중 오류가 발생했습니다.',
            flags: 64
        });
    }
}

module.exports = {
    EMBLEM_ENHANCE_RATES,
    EMBLEM_ENHANCE_STATS,
    FAIL_PENALTIES,
    attemptEmblemEnhance,
    createEmblemEnhanceEmbed,
    processEmblemEnhancement,
    createEmblemEnhanceButtons,
    processEmblemEnhancementWithScroll,
    tryEnhanceEmblem
};