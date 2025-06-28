// 🎣 낚시 시스템 데이터
const FISHING_SYSTEM = {
    // 물고기 종류 (10종)
    fishes: {
        // 일반 등급 (70%)
        starlight_trout: {
            id: 'starlight_trout',
            name: '💫 별빛 송어',
            description: '밤하늘의 별처럼 반짝이는 비늘을 가진 송어',
            rarity: 'common',
            minSize: 5,
            maxSize: 150,
            basePrice: { min: 100, max: 300 }
        },
        crystal_carp: {
            id: 'crystal_carp',
            name: '🔮 수정 붕어',
            description: '투명한 수정처럼 맑은 몸체를 가진 붕어',
            rarity: 'common',
            minSize: 8,
            maxSize: 120,
            basePrice: { min: 150, max: 350 }
        },
        moss_catfish: {
            id: 'moss_catfish',
            name: '🌿 이끼 메기',
            description: '등에 이끼가 자라는 신비한 메기',
            rarity: 'common',
            minSize: 10,
            maxSize: 250,
            basePrice: { min: 200, max: 400 }
        },
        
        // 희귀 등급 (20%)
        lightning_eel: {
            id: 'lightning_eel',
            name: '⚡ 번개 뱀장어',
            description: '전기를 내뿜는 위험한 장어',
            rarity: 'rare',
            minSize: 30,
            maxSize: 500,
            basePrice: { min: 500, max: 1000 }
        },
        cherry_goldfish: {
            id: 'cherry_goldfish',
            name: '🌸 벚꽃 금붕어',
            description: '꽃잎처럼 아름다운 지느러미를 가진 금붕어',
            rarity: 'rare',
            minSize: 3,
            maxSize: 80,
            basePrice: { min: 600, max: 1200 }
        },
        lava_piranha: {
            id: 'lava_piranha',
            name: '🔥 용암 피라니아',
            description: '뜨거운 기운을 내뿜는 육식어',
            rarity: 'rare',
            minSize: 8,
            maxSize: 100,
            basePrice: { min: 700, max: 1400 }
        },
        
        // 영웅 등급 (8%)
        abyssal_lord: {
            id: 'abyssal_lord',
            name: '🌊 심해의 군주',
            description: '깊은 바다의 지배자',
            rarity: 'epic',
            minSize: 50,
            maxSize: 800,
            basePrice: { min: 2000, max: 5000 }
        },
        golden_carp_king: {
            id: 'golden_carp_king',
            name: '👑 황금 잉어왕',
            description: '왕관 모양의 지느러미를 가진 잉어',
            rarity: 'epic',
            minSize: 30,
            maxSize: 400,
            basePrice: { min: 2500, max: 6000 }
        },
        
        // 전설 등급 (2%)
        rainbow_whale_shark: {
            id: 'rainbow_whale_shark',
            name: '🌈 무지개 고래상어',
            description: '일곱 빛깔로 빛나는 거대한 상어',
            rarity: 'legendary',
            minSize: 100,
            maxSize: 1500,
            basePrice: { min: 10000, max: 20000 }
        },
        dragon_messenger: {
            id: 'dragon_messenger',
            name: '🐉 용왕의 사자',
            description: '용의 비늘을 가진 신화의 물고기',
            rarity: 'legendary',
            minSize: 80,
            maxSize: 1000,
            basePrice: { min: 15000, max: 30000 }
        }
    },
    
    // 희귀도별 확률
    rarityChances: {
        common: 0.70,    // 70%
        rare: 0.20,      // 20%
        epic: 0.08,      // 8%
        legendary: 0.02  // 2%
    },
    
    // 크기 등급 (괴물 대신 사용)
    sizeGrades: {
        tiny: {
            name: '🐟 미니급',
            description: '이게 물고기야?',
            sizeRange: [0, 0.2], // 최소~20%
            priceMultiplier: 0.3
        },
        small: {
            name: '🐠 소형급',
            description: '귀여운 사이즈네',
            sizeRange: [0.2, 0.4], // 20~40%
            priceMultiplier: 0.6
        },
        medium: {
            name: '🐡 일반급',
            description: '평범한 크기',
            sizeRange: [0.4, 0.6], // 40~60%
            priceMultiplier: 1.0
        },
        large: {
            name: '🦈 대형급',
            description: '오, 꽤 큰데?',
            sizeRange: [0.6, 0.8], // 60~80%
            priceMultiplier: 1.5
        },
        huge: {
            name: '🐋 거물급',
            description: '우와! 엄청나다!',
            sizeRange: [0.8, 0.9], // 80~90%
            priceMultiplier: 2.5
        },
        giant: {
            name: '🦕 거인급',
            description: '전설이다!',
            sizeRange: [0.9, 0.95], // 90~95%
            priceMultiplier: 4.0
        },
        mythic: {
            name: '🌟 신화급',
            description: '역대 최고 기록!',
            sizeRange: [0.95, 1.0], // 95~100%
            priceMultiplier: 10.0
        }
    },
    
    // 유니크 변이
    uniqueVariants: {
        normal: {
            chance: 0.899,
            priceMultiplier: 1,
            prefix: ''
        },
        unique: {
            chance: 0.1,
            priceMultiplier: 7,
            prefix: '✨ 희귀한 '
        },
        legendary: {
            chance: 0.001,
            priceMultiplier: 50,
            prefix: '💎 전설의 '
        }
    },
    
    // 떠돌이 상인 종류
    merchants: {
        noble: {
            name: '🎩 귀족 수집가',
            description: '희귀 물고기를 선호합니다',
            preferences: {
                rare: 1.3,
                epic: 1.5,
                legendary: 2.0,
                common: 0.8
            }
        },
        chef: {
            name: '🍳 요리사',
            description: '특정 물고기를 대량 구매합니다',
            targetFish: null, // 랜덤 선택
            targetBonus: 2.0
        },
        trader: {
            name: '💰 일반 상인',
            description: '평균 시세로 구매합니다',
            preferences: {} // 기본 가격
        },
        wizard: {
            name: '🔮 마법사',
            description: '유니크 변이만 구매합니다',
            uniqueOnly: true,
            uniqueBonus: 3.0
        },
        smuggler: {
            name: '🏴‍☠️ 밀수업자',
            description: '모든 물고기를 할인된 가격에 구매합니다',
            globalDiscount: 0.8
        },
        collector: {
            name: '📏 크기 수집가',
            description: '거물급 이상만 구매합니다',
            sizeRequirement: 'huge',
            sizeBonus: 2.0
        }
    },
    
    // 게임 설정
    settings: {
        maxInventory: 50,           // 최대 보관 가능 물고기
        fishingCooldown: 10000,     // 낚시 쿨다운 (10초)
        merchantStayTime: 1800000,  // 상인 체류 시간 (30분)
        merchantMinInterval: 7200000, // 상인 최소 간격 (2시간)
        priceUpdateInterval: 60000,  // 가격 변동 간격 (1분)
        priceFluctuation: {
            min: 0.5,   // 최소 50%
            max: 2.0    // 최대 200%
        }
    },
    
    // 낚시터 등급
    fishingSpots: {
        pond: {
            name: '🏞️ 마을 연못',
            description: '초보자용 낚시터',
            rarityBonus: { common: 1.2, rare: 0.8 },
            sizeBonus: 0.8,
            unlockLevel: 1
        },
        river: {
            name: '🌊 맑은 강',
            description: '다양한 물고기가 서식',
            rarityBonus: { rare: 1.2 },
            sizeBonus: 1.0,
            unlockLevel: 10
        },
        sea: {
            name: '🌅 푸른 바다',
            description: '큰 물고기들의 서식지',
            rarityBonus: { rare: 1.3, epic: 1.2 },
            sizeBonus: 1.3,
            unlockLevel: 30
        },
        deep_sea: {
            name: '🌑 심해',
            description: '전설의 물고기가 숨어있는 곳',
            rarityBonus: { epic: 1.5, legendary: 2.0 },
            sizeBonus: 1.5,
            unlockLevel: 50
        },
        dragon_palace: {
            name: '🏯 용궁',
            description: '신화의 물고기들이 사는 성역',
            rarityBonus: { legendary: 3.0 },
            sizeBonus: 2.0,
            unlockLevel: 100
        }
    },
    
    // 낚싯대 등급
    fishingRods: {
        wooden: {
            name: '🎣 나무 낚싯대',
            sizeBonus: 1.0,
            rarityBonus: 1.0,
            price: 0
        },
        steel: {
            name: '⚔️ 강철 낚싯대',
            sizeBonus: 1.2,
            rarityBonus: 1.1,
            price: 10000
        },
        mithril: {
            name: '✨ 미스릴 낚싯대',
            sizeBonus: 1.4,
            rarityBonus: 1.3,
            price: 50000
        },
        dragon: {
            name: '🐲 용골 낚싯대',
            sizeBonus: 1.8,
            rarityBonus: 1.5,
            price: 200000
        }
    },
    
    // 미끼 종류
    baits: {
        normal: {
            name: '🪱 일반 미끼',
            effect: '아무 효과 없음',
            bonus: {},
            price: 10
        },
        shiny: {
            name: '✨ 반짝이는 미끼',
            effect: '희귀 물고기 확률 증가',
            bonus: { rare: 1.5 },
            price: 100
        },
        giant: {
            name: '🦴 거대 미끼',
            effect: '크기 보정 +20%',
            bonus: { size: 1.2 },
            price: 200
        },
        legendary: {
            name: '🌟 전설의 미끼',
            effect: '모든 확률 증가',
            bonus: { all: 1.3 },
            price: 1000
        }
    },
    
    // 도감 보상
    collectionRewards: {
        10: {
            title: '🎣 초보 낚시꾼',
            reward: { gold: 5000 }
        },
        25: {
            title: '🐟 견습 낚시꾼',
            reward: { gold: 20000, item: 'shiny_bait_10' }
        },
        50: {
            title: '🦈 숙련 낚시꾼',
            reward: { gold: 50000, fishingBonus: 0.05 }
        },
        75: {
            title: '🐋 낚시 장인',
            reward: { gold: 100000, item: 'mithril_rod' }
        },
        100: {
            title: '🌟 전설의 낚시왕',
            reward: { gold: 500000, item: 'dragon_rod', title: 'legendary_fisher' }
        }
    }
};

// 시스템 상태 관리
let fishingState = {
    currentMerchant: null,
    merchantArrivalTime: null,
    merchantLeaveTime: null,
    nextMerchantTime: null,
    currentPrices: new Map(),
    sizeRecords: new Map(), // 물고기별 최고 기록
    globalRecords: new Map() // 전체 최고 기록
};

module.exports = { FISHING_SYSTEM, fishingState };