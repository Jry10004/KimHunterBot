// 게임 아이템 데이터베이스
const items = {
    // 무기류
    weapons: {
        // 일반 무기
        basic_sword: {
            id: 'basic_sword',
            name: '기본 검',
            type: 'weapon',
            rarity: 'common',
            stats: { attack: 10, criticalRate: 5 },
            description: '기본적인 철제 검',
            tradeable: true
        },
        iron_sword: {
            id: 'iron_sword',
            name: '철검',
            type: 'weapon',
            rarity: 'common',
            stats: { attack: 20, criticalRate: 7 },
            description: '단단한 철로 만든 검',
            tradeable: true
        },
        steel_blade: {
            id: 'steel_blade',
            name: '강철검',
            type: 'weapon',
            rarity: 'uncommon',
            stats: { attack: 35, criticalRate: 10, accuracy: 5 },
            description: '예리한 강철로 제작된 검',
            tradeable: true
        },
        crystal_sword: {
            id: 'crystal_sword',
            name: '크리스탈 소드',
            type: 'weapon',
            rarity: 'rare',
            stats: { attack: 50, criticalRate: 15, accuracy: 10 },
            description: '신비한 크리스탈로 만든 검',
            tradeable: true
        },
        dragon_slayer: {
            id: 'dragon_slayer',
            name: '용살검',
            type: 'weapon',
            rarity: 'epic',
            stats: { attack: 80, criticalRate: 20, lifesteal: 5 },
            description: '드래곤을 베었다는 전설의 검',
            tradeable: false
        },
        divine_blade: {
            id: 'divine_blade',
            name: '신성한 검',
            type: 'weapon',
            rarity: 'legendary',
            stats: { attack: 120, criticalRate: 25, lifesteal: 10, accuracy: 15 },
            description: '신의 축복이 깃든 검',
            tradeable: false
        }
    },
    
    // 방어구류
    armors: {
        leather_armor: {
            id: 'leather_armor',
            name: '가죽 갑옷',
            type: 'armor',
            rarity: 'common',
            stats: { defense: 10, hp: 50 },
            description: '기본적인 가죽 갑옷',
            tradeable: true
        },
        iron_plate: {
            id: 'iron_plate',
            name: '철갑옷',
            type: 'armor',
            rarity: 'uncommon',
            stats: { defense: 25, hp: 100 },
            description: '철판으로 만든 갑옷',
            tradeable: true
        },
        crystal_armor: {
            id: 'crystal_armor',
            name: '크리스탈 아머',
            type: 'armor',
            rarity: 'rare',
            stats: { defense: 40, hp: 200, evasion: 5 },
            description: '크리스탈로 제작된 갑옷',
            tradeable: true
        },
        dragon_scale: {
            id: 'dragon_scale',
            name: '용비늘 갑옷',
            type: 'armor',
            rarity: 'epic',
            stats: { defense: 70, hp: 350, evasion: 10 },
            description: '드래곤의 비늘로 만든 갑옷',
            tradeable: false
        }
    },
    
    // 소비 아이템
    consumables: {
        health_potion: {
            id: 'health_potion',
            name: '체력 포션',
            type: 'consumable',
            rarity: 'common',
            effect: { heal: 100 },
            description: 'HP를 100 회복합니다',
            tradeable: true
        },
        mega_potion: {
            id: 'mega_potion',
            name: '메가 포션',
            type: 'consumable',
            rarity: 'uncommon',
            effect: { heal: 500 },
            description: 'HP를 500 회복합니다',
            tradeable: true
        },
        exp_boost: {
            id: 'exp_boost',
            name: '경험치 부스터',
            type: 'consumable',
            rarity: 'rare',
            effect: { expBoost: 2, duration: 3600000 }, // 1시간
            description: '1시간 동안 경험치 2배',
            tradeable: true
        },
        gold_boost: {
            id: 'gold_boost',
            name: '골드 부스터',
            type: 'consumable',
            rarity: 'rare',
            effect: { goldBoost: 2, duration: 3600000 }, // 1시간
            description: '1시간 동안 골드 2배',
            tradeable: true
        }
    },
    
    // 특수 아이템
    special: {
        reset_stone: {
            id: 'reset_stone',
            name: '리셋 스톤',
            type: 'special',
            rarity: 'epic',
            effect: { resetStats: true },
            description: '스탯을 초기화합니다',
            tradeable: false
        },
        enhancement_stone: {
            id: 'enhancement_stone',
            name: '강화석',
            type: 'special',
            rarity: 'rare',
            effect: { enhance: 1 },
            description: '장비를 강화합니다',
            tradeable: true
        },
        protection_scroll: {
            id: 'protection_scroll',
            name: '보호 주문서',
            type: 'special',
            rarity: 'epic',
            effect: { protectEnhance: true },
            description: '강화 실패 시 장비를 보호합니다',
            tradeable: true
        }
    },
    
    // 관리자 전용 아이템
    admin: {
        admin_sword: {
            id: 'admin_sword',
            name: '관리자의 검',
            type: 'weapon',
            rarity: 'legendary',
            stats: { attack: 9999, criticalRate: 100 },
            description: '관리자 전용 무기',
            tradeable: false,
            adminItem: true
        },
        admin_armor: {
            id: 'admin_armor',
            name: '관리자의 갑옷',
            type: 'armor',
            rarity: 'legendary',
            stats: { defense: 9999, hp: 99999 },
            description: '관리자 전용 방어구',
            tradeable: false,
            adminItem: true
        },
        gm_blessing: {
            id: 'gm_blessing',
            name: 'GM의 축복',
            type: 'special',
            rarity: 'legendary',
            effect: { allStats: 100 },
            description: '모든 스탯 +100',
            tradeable: false,
            adminItem: true
        }
    }
};

// 모든 아이템을 하나의 객체로 통합
const allItems = {};
Object.values(items).forEach(category => {
    Object.assign(allItems, category);
});

// 아이템 ID로 검색
function getItemById(itemId) {
    return allItems[itemId] || null;
}

// 아이템 생성 (인벤토리 추가용)
function createItem(itemId, quantity = 1, enhancement = 0) {
    const baseItem = getItemById(itemId);
    if (!baseItem) return null;
    
    return {
        ...baseItem,
        quantity: quantity,
        enhancement: enhancement,
        createdAt: new Date()
    };
}

// 레어도별 색상
const rarityColors = {
    common: '#808080',      // 회색
    uncommon: '#00ff00',    // 초록
    rare: '#0099ff',        // 파랑
    epic: '#9933ff',        // 보라
    legendary: '#ff9900'    // 주황
};

// 레어도별 이모지
const rarityEmojis = {
    common: '⚪',
    uncommon: '🟢',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟠'
};

module.exports = {
    items,
    allItems,
    getItemById,
    createItem,
    rarityColors,
    rarityEmojis
};