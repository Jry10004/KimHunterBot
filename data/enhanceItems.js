// 엠블럼 강화 보조 아이템
const ENHANCE_ITEMS = {
    // 보호 아이템
    protection: {
        emblemProtectionScroll: {
            id: 'emblemProtectionScroll',
            name: '엠블럼 보호의 주문서',
            description: '강화 실패 시 레벨 하락과 초기화를 방지합니다',
            emoji: '🛡️',
            type: 'protection',
            rarity: 'epic',
            price: 1000000, // 100만 골드
            effect: {
                preventDowngrade: true,
                preventReset: true,
                uses: 1
            }
        },
        emblemPerfectProtection: {
            id: 'emblemPerfectProtection',
            name: '완벽한 보호의 주문서',
            description: '강화 실패 시 엠블럼강화조각도 보호합니다',
            emoji: '🔰',
            type: 'protection',
            rarity: 'legendary',
            price: 5000000, // 500만 골드
            effect: {
                preventDowngrade: true,
                preventReset: true,
                preventStoneConsume: true,
                uses: 1
            }
        }
    },
    
    // 축복 아이템
    blessing: {
        emblemBlessingScroll: {
            id: 'emblemBlessingScroll',
            name: '엠블럼 축복의 주문서',
            description: '강화 성공 확률을 2배로 증가시킵니다',
            emoji: '✨',
            type: 'blessing',
            rarity: 'epic',
            price: 2000000, // 200만 골드
            effect: {
                successMultiplier: 2,
                uses: 1
            }
        },
        emblemLuckyScroll: {
            id: 'emblemLuckyScroll',
            name: '행운의 주문서',
            description: '강화 성공 확률을 1.5배로 증가시킵니다',
            emoji: '🍀',
            type: 'blessing',
            rarity: 'rare',
            price: 500000, // 50만 골드
            effect: {
                successMultiplier: 1.5,
                uses: 1
            }
        },
        emblemMiracleScroll: {
            id: 'emblemMiracleScroll',
            name: '기적의 주문서',
            description: '다음 강화가 100% 성공합니다 (70강까지만 사용 가능)',
            emoji: '🌟',
            type: 'blessing',
            rarity: 'mythic',
            price: 10000000, // 1000만 골드
            maxLevel: 70,
            effect: {
                guaranteeSuccess: true,
                uses: 1
            }
        }
    }
};

// 아이템 드롭 테이블
const ENHANCE_ITEM_DROPS = {
    // 보스별 드롭
    bossDrops: {
        // 중급 보스
        'shadow_assassin': [
            { itemId: 'emblemLuckyScroll', chance: 0.05 }, // 5%
            { itemId: 'emblemProtectionScroll', chance: 0.02 } // 2%
        ],
        'ancient_golem': [
            { itemId: 'emblemLuckyScroll', chance: 0.05 },
            { itemId: 'emblemProtectionScroll', chance: 0.02 }
        ],
        // 상급 보스
        'frost_dragon': [
            { itemId: 'emblemBlessingScroll', chance: 0.03 }, // 3%
            { itemId: 'emblemProtectionScroll', chance: 0.05 }, // 5%
            { itemId: 'emblemPerfectProtection', chance: 0.01 } // 1%
        ],
        'fire_elemental': [
            { itemId: 'emblemBlessingScroll', chance: 0.03 },
            { itemId: 'emblemProtectionScroll', chance: 0.05 },
            { itemId: 'emblemPerfectProtection', chance: 0.01 }
        ],
        // 최상급 보스
        'demon_lord': [
            { itemId: 'emblemBlessingScroll', chance: 0.05 }, // 5%
            { itemId: 'emblemPerfectProtection', chance: 0.03 }, // 3%
            { itemId: 'emblemMiracleScroll', chance: 0.005 } // 0.5%
        ]
    },
    
    // PVP 보상
    pvpRewards: {
        win: [
            { itemId: 'emblemLuckyScroll', chance: 0.01 } // 1%
        ],
        winStreak5: [
            { itemId: 'emblemProtectionScroll', chance: 0.05 } // 5%
        ],
        winStreak10: [
            { itemId: 'emblemBlessingScroll', chance: 0.1 } // 10%
        ]
    },
    
    // 일일 미션 보상
    dailyMissionRewards: {
        allComplete: [
            { itemId: 'emblemLuckyScroll', chance: 0.1 } // 10%
        ]
    },
    
    // 주간 미션 보상
    weeklyMissionRewards: {
        allComplete: [
            { itemId: 'emblemProtectionScroll', chance: 0.2 }, // 20%
            { itemId: 'emblemBlessingScroll', chance: 0.05 } // 5%
        ]
    }
};

module.exports = {
    ENHANCE_ITEMS,
    ENHANCE_ITEM_DROPS
};