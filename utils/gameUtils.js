// 게임 유틸리티 함수들

function getUserTitle(level) {
    if (level >= 100) return '전설의 영웅';
    if (level >= 80) return '대마법사';
    if (level >= 60) return '마스터';
    if (level >= 40) return '숙련자';
    if (level >= 20) return '모험가';
    return '초보자';
}

function getCategoryName(category) {
    const names = {
        all: '전체',
        basic: '기본',
        weapon: '무기',
        armor: '방어구',
        potion: '포션',
        material: '재료',
        special: '특수'
    };
    return names[category] || '기타';
}

function getCategoryEmoji(category) {
    const emojis = {
        all: '📦',
        basic: '🎯',
        weapon: '⚔️',
        armor: '🛡️',
        potion: '🧪',
        material: '🔧',
        special: '✨'
    };
    return emojis[category] || '📦';
}

function getRarityEmoji(rarity) {
    const emojis = {
        '일반': '⚪',
        '레어': '🔵',
        '에픽': '🟣',
        '레전드리': '🟡',
        '신화': '🔴'
    };
    return emojis[rarity] || '⚪';
}

function generateExpBar(currentExp, requiredExp) {
    const percentage = Math.min(100, Math.floor((currentExp / requiredExp) * 100));
    const filledBlocks = Math.floor(percentage / 10);
    const emptyBlocks = 10 - filledBlocks;
    
    return '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks) + ` ${percentage}%`;
}

function generateRandomStats(level, rarity) {
    const rarityMultipliers = {
        '일반': 1.0,
        '레어': 1.5,
        '에픽': 2.0,
        '레전드리': 3.0,
        '신화': 5.0
    };
    
    const multiplier = rarityMultipliers[rarity] || 1.0;
    const baseStats = Math.floor(level * multiplier);
    
    return {
        attack: Math.floor(baseStats * (0.8 + Math.random() * 0.4)),
        defense: Math.floor(baseStats * (0.6 + Math.random() * 0.4)),
        hp: Math.floor(baseStats * (5 + Math.random() * 5)),
        dodge: Math.floor(Math.random() * 10 * multiplier),
        luck: Math.floor(Math.random() * 5 * multiplier)
    };
}

function generateRandomOptions(level, rarity) {
    const options = [];
    const rarityOptionsCount = {
        '일반': 0,
        '레어': 1,
        '에픽': 2,
        '레전드리': 3,
        '신화': 4
    };
    
    const optionTypes = [
        { name: '크리티컬 확률', value: Math.floor(Math.random() * 10) + 1 },
        { name: '크리티컬 데미지', value: Math.floor(Math.random() * 20) + 10 },
        { name: '흡혈', value: Math.floor(Math.random() * 5) + 1 },
        { name: '경험치 보너스', value: Math.floor(Math.random() * 20) + 5 },
        { name: '골드 보너스', value: Math.floor(Math.random() * 20) + 5 },
        { name: '아이템 드롭률', value: Math.floor(Math.random() * 10) + 5 }
    ];
    
    const optionCount = rarityOptionsCount[rarity] || 0;
    const shuffled = optionTypes.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < optionCount && i < shuffled.length; i++) {
        options.push(shuffled[i]);
    }
    
    return options;
}

module.exports = {
    getUserTitle,
    getCategoryName,
    getCategoryEmoji,
    getRarityEmoji,
    generateExpBar,
    generateRandomStats,
    generateRandomOptions
};