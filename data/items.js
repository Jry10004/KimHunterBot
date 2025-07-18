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
        stat_reset_scroll: {
            id: 'stat_reset_scroll',
            name: '스탯 초기화 주문서',
            type: 'consumable',
            rarity: 'epic',
            effect: { resetStats: true, goldCost: 0 },
            description: '스탯을 초기화하고 포인트를 돌려받습니다 (무료)',
            tradeable: false
        },
        stat_reset_scroll_basic: {
            id: 'stat_reset_scroll_basic',
            name: '기본 스탯 초기화 주문서',
            type: 'consumable',
            rarity: 'rare',
            effect: { resetStats: true, goldCost: 5000000 },
            description: '스탯을 초기화합니다 (50% 할인)',
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
        },
        // 티켓류
        hunting_ticket_bundle: {
            id: 'hunting_ticket_bundle',
            name: '사냥 티켓 묶음',
            type: 'consumable',
            rarity: 'uncommon',
            effect: { huntingTickets: 10 },
            description: '사냥 티켓 10장을 획득합니다',
            tradeable: true
        },
        dungeon_ticket_bundle: {
            id: 'dungeon_ticket_bundle',
            name: '던전 티켓 묶음',
            type: 'consumable',
            rarity: 'rare',
            effect: { dungeonTickets: 5 },
            description: '던전 티켓 5장을 획득합니다',
            tradeable: true
        },
        pvp_ticket_bundle: {
            id: 'pvp_ticket_bundle',
            name: 'PVP 티켓 묶음',
            type: 'consumable',
            rarity: 'uncommon',
            effect: { pvpTickets: 10 },
            description: 'PVP 티켓 10장을 획득합니다',
            tradeable: true
        },
        stat_point_box: {
            id: 'stat_point_box',
            name: '스탯 포인트 상자',
            type: 'consumable',
            rarity: 'epic',
            effect: { statPoints: 5 },
            description: '스탯 포인트 5점을 획득합니다',
            tradeable: false
        },
        // 버프 아이템
        attack_buff_potion: {
            id: 'attack_buff_potion',
            name: '공격력 증가 물약',
            type: 'consumable',
            rarity: 'uncommon',
            effect: { attackBuff: 50, duration: 1800000 }, // 30분
            description: '30분간 공격력이 50 증가합니다',
            tradeable: true
        },
        defense_buff_potion: {
            id: 'defense_buff_potion',
            name: '방어력 증가 물약',
            type: 'consumable',
            rarity: 'uncommon',
            effect: { defenseBuff: 50, duration: 1800000 }, // 30분
            description: '30분간 방어력이 50 증가합니다',
            tradeable: true
        },
        all_stat_buff: {
            id: 'all_stat_buff',
            name: '올스탯 버프 물약',
            type: 'consumable',
            rarity: 'epic',
            effect: { allStatBuff: 10, duration: 3600000 }, // 1시간
            description: '1시간 동안 모든 스탯이 10 증가합니다',
            tradeable: true
        },
        // 완벽한 엠블럼 강화석 (소비 아이템으로 추가)
        emblem_enhancement_stone_perfect_consumable: {
            id: 'emblem_enhancement_stone_perfect',
            name: '완벽한 엠블럼 강화석',
            type: 'consumable',
            rarity: 'legendary',
            effect: { emblemEnhance: 1, successRate: 100 },
            description: '엠블럼을 100% 확률로 강화합니다',
            tradeable: false
        },
        // 헌터 승급서 시리즈
        hunter_upgrade_immortal: {
            id: 'hunter_upgrade_immortal',
            name: '불멸헌터 승급서',
            type: 'consumable',
            rarity: 'legendary',
            effect: { upgradeRank: 'immortal_hunter', fromRank: 'hunter_16', toRank: 'immortal_hunter' },
            description: '헌터 17강에서 불멸헌터로 승급시킵니다',
            tradeable: false
        },
        hunter_upgrade_cosmic: {
            id: 'hunter_upgrade_cosmic',
            name: '우주헌터 승급서',
            type: 'consumable',
            rarity: 'legendary',
            effect: { upgradeRank: 'cosmic_hunter', fromRank: 'immortal_hunter', toRank: 'cosmic_hunter' },
            description: '불멸헌터에서 우주헌터로 승급시킵니다',
            tradeable: false
        },
        hunter_upgrade_spacetime: {
            id: 'hunter_upgrade_spacetime',
            name: '시공헌터 승급서',
            type: 'consumable',
            rarity: 'legendary',
            effect: { upgradeRank: 'spacetime_hunter', fromRank: 'cosmic_hunter', toRank: 'spacetime_hunter' },
            description: '우주헌터에서 시공헌터로 승급시킵니다',
            tradeable: false
        },
        hunter_upgrade_destruction: {
            id: 'hunter_upgrade_destruction',
            name: '파멸헌터 승급서',
            type: 'consumable',
            rarity: 'legendary',
            effect: { upgradeRank: 'destruction_hunter', fromRank: 'spacetime_hunter', toRank: 'destruction_hunter' },
            description: '시공헌터에서 파멸헌터로 승급시킵니다',
            tradeable: false
        },
        hunter_upgrade_absolute: {
            id: 'hunter_upgrade_absolute',
            name: '절대헌터 승급서',
            type: 'consumable',
            rarity: 'legendary',
            effect: { upgradeRank: 'absolute_hunter', fromRank: 'destruction_hunter', toRank: 'absolute_hunter' },
            description: '파멸헌터에서 절대헌터로 승급시킵니다',
            tradeable: false
        },
        hunter_upgrade_kim: {
            id: 'hunter_upgrade_kim',
            name: '김헌터 승급서',
            type: 'consumable',
            rarity: 'legendary',
            effect: { upgradeRank: 'kim_hunter', fromRank: 'absolute_hunter', toRank: 'kim_hunter' },
            description: '절대헌터에서 김헌터로 승급시킵니다',
            tradeable: false
        },
        hunter_upgrade_god: {
            id: 'hunter_upgrade_god',
            name: '신 승급서',
            type: 'consumable',
            rarity: 'legendary',
            effect: { upgradeRank: 'god', fromRank: 'kim_hunter', toRank: 'god' },
            description: '김헌터에서 신으로 승급시킵니다',
            tradeable: false
        },
        // 엠블럼 보호 주문서
        emblem_protection_scroll_consumable: {
            id: 'emblem_protection_scroll_consumable',
            name: '엠블럼 보호 주문서',
            type: 'consumable',
            rarity: 'epic',
            effect: { emblemProtect: true },
            description: '엠블럼 강화 실패 시 파괴를 막아줍니다',
            tradeable: true
        },
        // 아이템 보호 주문서
        item_protection_scroll: {
            id: 'item_protection_scroll',
            name: '아이템 보호 주문서',
            type: 'consumable',
            rarity: 'epic',
            effect: { itemProtect: true },
            description: '아이템 강화 실패 시 파괴를 막아줍니다',
            tradeable: true
        },
        // 강화 확률 증가 주문서
        enhancement_rate_5: {
            id: 'enhancement_rate_5',
            name: '강화 확률 증가 주문서 5%',
            type: 'consumable',
            rarity: 'uncommon',
            effect: { enhanceRateBoost: 5 },
            description: '다음 강화 시 성공률이 5% 증가합니다',
            tradeable: true
        },
        enhancement_rate_10: {
            id: 'enhancement_rate_10',
            name: '강화 확률 증가 주문서 10%',
            type: 'consumable',
            rarity: 'rare',
            effect: { enhanceRateBoost: 10 },
            description: '다음 강화 시 성공률이 10% 증가합니다',
            tradeable: true
        },
        enhancement_rate_20: {
            id: 'enhancement_rate_20',
            name: '강화 확률 증가 주문서 20%',
            type: 'consumable',
            rarity: 'rare',
            effect: { enhanceRateBoost: 20 },
            description: '다음 강화 시 성공률이 20% 증가합니다',
            tradeable: true
        },
        enhancement_rate_30: {
            id: 'enhancement_rate_30',
            name: '강화 확률 증가 주문서 30%',
            type: 'consumable',
            rarity: 'epic',
            effect: { enhanceRateBoost: 30 },
            description: '다음 강화 시 성공률이 30% 증가합니다',
            tradeable: true
        },
        enhancement_rate_50: {
            id: 'enhancement_rate_50',
            name: '강화 확률 증가 주문서 50%',
            type: 'consumable',
            rarity: 'epic',
            effect: { enhanceRateBoost: 50 },
            description: '다음 강화 시 성공률이 50% 증가합니다',
            tradeable: true
        },
        enhancement_rate_70: {
            id: 'enhancement_rate_70',
            name: '강화 확률 증가 주문서 70%',
            type: 'consumable',
            rarity: 'legendary',
            effect: { enhanceRateBoost: 70 },
            description: '다음 강화 시 성공률이 70% 증가합니다',
            tradeable: false
        },
        enhancement_rate_100: {
            id: 'enhancement_rate_100',
            name: '강화 확률 증가 주문서 100%',
            type: 'consumable',
            rarity: 'legendary',
            effect: { enhanceRateBoost: 100 },
            description: '다음 강화가 100% 성공합니다',
            tradeable: false
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
        },
        // 엠블럼 관련 아이템
        emblem_enhancement_stone_basic: {
            id: 'emblem_enhancement_stone_basic',
            name: '엠블럼 강화석',
            type: 'special',
            rarity: 'rare',
            effect: { emblemEnhance: 1 },
            description: '엠블럼을 강화합니다 (성공률 30%)',
            tradeable: true
        },
        emblem_enhancement_stone_advanced: {
            id: 'emblem_enhancement_stone_advanced',
            name: '고급 엠블럼 강화석',
            type: 'special',
            rarity: 'epic',
            effect: { emblemEnhance: 1, successRate: 50 },
            description: '엠블럼을 강화합니다 (성공률 50%)',
            tradeable: true
        },
        emblem_enhancement_stone_perfect: {
            id: 'emblem_enhancement_stone_perfect',
            name: '완벽한 엠블럼 강화석',
            type: 'special',
            rarity: 'legendary',
            effect: { emblemEnhance: 1, successRate: 100 },
            description: '엠블럼을 100% 확률로 강화합니다',
            tradeable: false
        },
        emblem_blessing_scroll: {
            id: 'emblem_blessing_scroll',
            name: '엠블럼 축복 주문서',
            type: 'special',
            rarity: 'epic',
            effect: { emblemBless: true },
            description: '엠블럼 강화 시 실패해도 강화 수치가 떨어지지 않습니다',
            tradeable: true
        },
        emblem_protection_scroll: {
            id: 'emblem_protection_scroll',
            name: '엠블럼 보호 주문서',
            type: 'special',
            rarity: 'legendary',
            effect: { emblemProtect: true },
            description: '엠블럼 강화 실패 시 파괴를 막아줍니다',
            tradeable: false
        },
        emblem_reset_scroll: {
            id: 'emblem_reset_scroll',
            name: '엠블럼 초기화 주문서',
            type: 'special',
            rarity: 'epic',
            effect: { emblemReset: true },
            description: '엠블럼 강화 수치를 0으로 초기화합니다',
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
        },
        // 이벤트용 특별 아이템
        event_box_basic: {
            id: 'event_box_basic',
            name: '이벤트 상자 (기본)',
            type: 'special',
            rarity: 'rare',
            effect: { eventBox: 'basic' },
            description: '랜덤한 보상을 획득합니다',
            tradeable: false,
            adminItem: true
        },
        event_box_premium: {
            id: 'event_box_premium',
            name: '이벤트 상자 (프리미엄)',
            type: 'special',
            rarity: 'epic',
            effect: { eventBox: 'premium' },
            description: '좋은 보상을 획득합니다',
            tradeable: false,
            adminItem: true
        },
        event_box_legendary: {
            id: 'event_box_legendary',
            name: '이벤트 상자 (전설)',
            type: 'special',
            rarity: 'legendary',
            effect: { eventBox: 'legendary' },
            description: '최고급 보상을 획득합니다',
            tradeable: false,
            adminItem: true
        },
        // 보상용 특별 아이템
        compensation_package: {
            id: 'compensation_package',
            name: '보상 패키지',
            type: 'special',
            rarity: 'epic',
            effect: { compensation: true },
            description: '서버 점검 보상',
            tradeable: false,
            adminItem: true
        },
        premium_pass_30days: {
            id: 'premium_pass_30days',
            name: '프리미엄 패스 (30일)',
            type: 'special',
            rarity: 'legendary',
            effect: { premiumDays: 30 },
            description: '30일간 프리미엄 혜택',
            tradeable: false,
            adminItem: true
        },
        instant_level_100: {
            id: 'instant_level_100',
            name: '즉시 레벨 100',
            type: 'special',
            rarity: 'legendary',
            effect: { instantLevel: 100 },
            description: '즉시 레벨 100으로 상승',
            tradeable: false,
            adminItem: true
        },
        gold_million_box: {
            id: 'gold_million_box',
            name: '100만 골드 상자',
            type: 'special',
            rarity: 'legendary',
            effect: { gold: 1000000 },
            description: '100만 골드를 획득합니다',
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
        id: `${itemId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        quantity: quantity,
        enhancement: enhancement,
        createdAt: new Date(),
        foundAt: new Date(),
        appraisedAt: new Date(),
        setName: baseItem.type || '아이템',
        // 기본 스탯 설정 (없는 경우)
        stats: baseItem.stats || {},
        score: baseItem.score || 0,
        emoji: rarityEmojis[baseItem.rarity] || '⚪',
        color: rarityColors[baseItem.rarity] || '#808080'
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