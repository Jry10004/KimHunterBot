// 에너지 조각 시스템

// 에너지 조각 시스템 데이터
const ENERGY_FRAGMENT_SYSTEM = {
    TIER_NAMES: {
        '1-10': { name: '빛나는 조각', emoji: '✨' },
        '11-25': { name: '불타는 조각', emoji: '🔥' },
        '26-50': { name: '얼어붙은 조각', emoji: '❄️' },
        '51-75': { name: '번개 조각', emoji: '⚡' },
        '76-99': { name: '어둠의 조각', emoji: '🌑' },
        '100': { name: '완성된 에너지 구체', emoji: '🌟' }
    },
    SUCCESS_RATES: {
        '1-25': 70,    // 1-25레벨: 70%
        '26-50': 50,   // 26-50레벨: 50%
        '51-75': 30,   // 51-75레벨: 30%
        '76-99': 20,   // 76-99레벨: 20%
        '99-100': 10   // 99→100레벨: 10%
    },
    REWARDS: {
        '10': { gold: 500000, exp: 50000 },      // 10000 -> 500000 (50x)
        '25': { gold: 2500000, exp: 250000 },    // 50000 -> 2500000 (50x)
        '50': { gold: 10000000, exp: 1000000 },  // 200000 -> 10000000 (50x)
        '75': { gold: 25000000, exp: 2500000 },  // 500000 -> 25000000 (50x)
        '99': { gold: 50000000, exp: 5000000 },  // 1000000 -> 50000000 (50x)
        '100': { gold: 250000000, exp: 20000000 } // 5000000 -> 250000000 (50x)
    }
};

function getFragmentTier(level) {
    if (level >= 1 && level <= 10) return '1-10';
    if (level >= 11 && level <= 25) return '11-25';
    if (level >= 26 && level <= 50) return '26-50';
    if (level >= 51 && level <= 75) return '51-75';
    if (level >= 76 && level <= 99) return '76-99';
    if (level === 100) return '100';
    return null;
}

function getFragmentInfo(level) {
    const tier = getFragmentTier(level);
    return ENERGY_FRAGMENT_SYSTEM.TIER_NAMES[tier] || { name: '알 수 없는 조각', emoji: '❓' };
}

function getSuccessRate(level) {
    if (level >= 1 && level <= 25) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['1-25'];
    if (level >= 26 && level <= 50) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['26-50'];
    if (level >= 51 && level <= 75) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['51-75'];
    if (level >= 76 && level <= 99) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['76-99'];
    if (level === 99) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['99-100'];
    return 70;
}

function calculateFusionCost(level) {
    return level * 1000; // 현재 단계 × 1000골드
}

function calculateCombatPowerFromFragment(level) {
    // 전투력 = (단계 ^ 1.5) × 100
    return Math.floor(Math.pow(level, 1.5) * 100);
}

module.exports = {
    ENERGY_FRAGMENT_SYSTEM,
    getFragmentTier,
    getFragmentInfo,
    getSuccessRate,
    calculateFusionCost,
    calculateCombatPowerFromFragment
};