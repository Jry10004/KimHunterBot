// 상점 아이템 데이터 (레벨 시스템 포함)
const shopItems = [
    // 무기류
    {
        id: 'wooden_sword',
        name: '나무 검',
        category: 'weapon',
        price: 100,
        stats: { attack: 5 },
        level: 1,
        description: '초보자용 나무 검입니다.'
    },
    {
        id: 'iron_sword',
        name: '철 검',
        category: 'weapon',
        price: 500,
        stats: { attack: 15 },
        level: 10,
        description: '단단한 철로 만든 검입니다.'
    },
    {
        id: 'steel_sword',
        name: '강철 검',
        category: 'weapon',
        price: 2000,
        stats: { attack: 30 },
        level: 25,
        description: '날카로운 강철 검입니다.'
    },
    {
        id: 'mithril_sword',
        name: '미스릴 검',
        category: 'weapon',
        price: 8000,
        stats: { attack: 50 },
        level: 40,
        description: '전설의 미스릴로 제작된 검입니다.'
    },
    {
        id: 'dragon_sword',
        name: '드래곤 검',
        category: 'weapon',
        price: 25000,
        stats: { attack: 80 },
        level: 60,
        description: '용의 힘이 깃든 전설의 검입니다.'
    },

    // 갑옷류
    {
        id: 'leather_armor',
        name: '가죽 갑옷',
        category: 'armor',
        price: 200,
        stats: { defense: 8 },
        level: 1,
        description: '기본적인 가죽 갑옷입니다.'
    },
    {
        id: 'chain_armor',
        name: '사슬 갑옷',
        category: 'armor',
        price: 800,
        stats: { defense: 20 },
        level: 15,
        description: '사슬로 엮인 튼튼한 갑옷입니다.'
    },
    {
        id: 'plate_armor',
        name: '판금 갑옷',
        category: 'armor',
        price: 3000,
        stats: { defense: 40 },
        level: 30,
        description: '무거운 판금으로 만든 갑옷입니다.'
    },
    {
        id: 'dragon_armor',
        name: '드래곤 갑옷',
        category: 'armor',
        price: 15000,
        stats: { defense: 70 },
        level: 50,
        description: '용의 비늘로 만든 최고급 갑옷입니다.'
    },

    // 헬멧류
    {
        id: 'leather_helmet',
        name: '가죽 헬멧',
        category: 'helmet',
        price: 150,
        stats: { defense: 3 },
        level: 1,
        description: '기본적인 가죽 헬멧입니다.'
    },
    {
        id: 'iron_helmet',
        name: '철 헬멧',
        category: 'helmet',
        price: 600,
        stats: { defense: 8 },
        level: 12,
        description: '철로 만든 견고한 헬멧입니다.'
    },
    {
        id: 'dragon_helmet',
        name: '드래곤 헬멧',
        category: 'helmet',
        price: 12000,
        stats: { defense: 25 },
        level: 45,
        description: '용의 머리를 본뜬 위엄있는 헬멧입니다.'
    },

    // 장갑류
    {
        id: 'leather_gloves',
        name: '가죽 장갑',
        category: 'gloves',
        price: 100,
        stats: { attack: 2 },
        level: 1,
        description: '기본적인 가죽 장갑입니다.'
    },
    {
        id: 'iron_gauntlets',
        name: '철 건틀릿',
        category: 'gloves',
        price: 400,
        stats: { attack: 6 },
        level: 8,
        description: '철로 만든 튼튼한 건틀릿입니다.'
    },
    {
        id: 'dragon_gloves',
        name: '드래곤 장갑',
        category: 'gloves',
        price: 10000,
        stats: { attack: 15 },
        level: 42,
        description: '용의 발톱이 달린 강력한 장갑입니다.'
    },

    // 부츠류
    {
        id: 'leather_boots',
        name: '가죽 부츠',
        category: 'boots',
        price: 120,
        stats: { agility: 3 },
        level: 1,
        description: '기본적인 가죽 부츠입니다.'
    },
    {
        id: 'speed_boots',
        name: '신속 부츠',
        category: 'boots',
        price: 1500,
        stats: { agility: 12 },
        level: 20,
        description: '이동 속도를 높여주는 마법 부츠입니다.'
    },
    {
        id: 'dragon_boots',
        name: '드래곤 부츠',
        category: 'boots',
        price: 8000,
        stats: { agility: 20 },
        level: 38,
        description: '용의 발톱 형태로 제작된 부츠입니다.'
    },

    // 액세서리류
    {
        id: 'power_ring',
        name: '힘의 반지',
        category: 'accessory',
        price: 1000,
        stats: { strength: 5 },
        level: 10,
        description: '힘을 증가시켜주는 마법 반지입니다.'
    },
    {
        id: 'wisdom_amulet',
        name: '지혜의 부적',
        category: 'accessory',
        price: 1200,
        stats: { intelligence: 8 },
        level: 15,
        description: '지혜를 높여주는 신비한 부적입니다.'
    },
    {
        id: 'luck_charm',
        name: '행운의 부적',
        category: 'accessory',
        price: 3000,
        stats: { luck: 10 },
        level: 25,
        description: '행운을 가져다주는 특별한 부적입니다.'
    },
    {
        id: 'dragon_pendant',
        name: '드래곤 펜던트',
        category: 'accessory',
        price: 20000,
        stats: { strength: 15, intelligence: 15, luck: 10 },
        level: 55,
        description: '모든 능력을 향상시키는 전설의 펜던트입니다.'
    }
];

module.exports = shopItems;