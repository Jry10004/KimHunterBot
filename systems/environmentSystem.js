// 환경 시스템 (날씨, 운세, 랜덤 인카운터 등)

const { EmbedBuilder } = require('discord.js');

// 환경 시스템 상태
let currentWeather = '맑음';
let dailyFortune = {};
let lastWeatherUpdate = Date.now();
let lastFortuneUpdate = new Date().toDateString();

// 날씨 업데이트
function updateWeather() {
    const weathers = ['맑음', '흐림', '비', '눈', '안개', '폭풍'];
    currentWeather = weathers[Math.floor(Math.random() * weathers.length)];
    lastWeatherUpdate = Date.now();
}

// 일일 운세 업데이트
function updateDailyFortune() {
    const fortunes = ['대길', '길', '중길', '소길', '평', '흉'];
    const today = new Date().toDateString();
    if (today !== lastFortuneUpdate) {
        dailyFortune = {};
        lastFortuneUpdate = today;
    }
}

// 랜덤 인카운터 체크
function checkRandomEncounter(user) {
    const encounterChance = 0.05; // 5% 확률
    if (Math.random() > encounterChance) return null;
    
    const encounters = [
        { type: 'treasure', reward: { gold: 1000 }, message: '숨겨진 보물을 발견했습니다!' },
        { type: 'merchant', discount: 0.2, message: '떠돌이 상인을 만났습니다!' },
        { type: 'monster', difficulty: 1.5, message: '야생 몬스터가 나타났습니다!' }
    ];
    
    return encounters[Math.floor(Math.random() * encounters.length)];
}

// 미스터리 박스 열기
function openMysteryBox(rarity = '일반') {
    const rewards = {
        '일반': [
            { type: 'gold', amount: 100, chance: 50 },
            { type: 'exp', amount: 50, chance: 30 },
            { type: 'item', name: '체력 포션', chance: 20 }
        ],
        '레어': [
            { type: 'gold', amount: 1000, chance: 40 },
            { type: 'exp', amount: 500, chance: 30 },
            { type: 'item', name: '강철 검', chance: 20 },
            { type: 'fragment', level: 1, chance: 10 }
        ],
        '에픽': [
            { type: 'gold', amount: 10000, chance: 30 },
            { type: 'exp', amount: 5000, chance: 25 },
            { type: 'item', name: '미스릴 검', chance: 25 },
            { type: 'fragment', level: 10, chance: 15 },
            { type: 'emblem', name: '전사', chance: 5 }
        ],
        '레전드리': [
            { type: 'gold', amount: 100000, chance: 25 },
            { type: 'exp', amount: 50000, chance: 20 },
            { type: 'item', name: '용의 검', chance: 20 },
            { type: 'fragment', level: 50, chance: 20 },
            { type: 'emblem', name: '대마법사', chance: 10 },
            { type: 'special', name: '칭호: 행운아', chance: 5 }
        ]
    };
    
    const pool = rewards[rarity] || rewards['일반'];
    const totalChance = pool.reduce((sum, item) => sum + item.chance, 0);
    let random = Math.random() * totalChance;
    
    for (const reward of pool) {
        random -= reward.chance;
        if (random <= 0) {
            return reward;
        }
    }
    
    return pool[0]; // 기본값
}

// 활성 효과 확인
function getActiveEffects(user) {
    const effects = [];
    
    // 날씨 효과
    const weatherEffects = {
        '맑음': { exp: 1.1, description: '경험치 +10%' },
        '비': { gold: 1.2, description: '골드 +20%' },
        '눈': { dropRate: 1.15, description: '드롭률 +15%' },
        '폭풍': { damage: 1.3, description: '데미지 +30%' }
    };
    
    if (weatherEffects[currentWeather]) {
        effects.push({
            name: `날씨: ${currentWeather}`,
            ...weatherEffects[currentWeather]
        });
    }
    
    // 운세 효과
    if (!dailyFortune[user.discordId]) {
        const fortunes = ['대길', '길', '중길', '소길', '평', '흉'];
        dailyFortune[user.discordId] = fortunes[Math.floor(Math.random() * fortunes.length)];
    }
    
    const fortuneEffects = {
        '대길': { all: 1.5, description: '모든 보너스 +50%' },
        '길': { exp: 1.3, gold: 1.3, description: '경험치/골드 +30%' },
        '중길': { luck: 1.2, description: '행운 +20%' },
        '소길': { dropRate: 1.1, description: '드롭률 +10%' },
        '평': { none: true, description: '효과 없음' },
        '흉': { all: 0.8, description: '모든 보너스 -20%' }
    };
    
    const userFortune = dailyFortune[user.discordId];
    if (fortuneEffects[userFortune]) {
        effects.push({
            name: `오늘의 운세: ${userFortune}`,
            ...fortuneEffects[userFortune]
        });
    }
    
    return effects;
}

module.exports = {
    updateWeather,
    updateDailyFortune,
    checkRandomEncounter,
    openMysteryBox,
    getActiveEffects,
    getCurrentWeather: () => currentWeather,
    getDailyFortune: () => dailyFortune
};