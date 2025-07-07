// 몬스터 변이 시스템 데이터
const MONSTER_MUTATIONS = {
    // 변이 타입과 효과
    types: {
        blazing: {
            name: "불타는",
            emoji: "🔥",
            color: "#ff4444",
            description: "화염에 휩싸여 있습니다",
            effects: {
                powerMultiplier: 1.3,     // 전투력 30% 증가
                goldMultiplier: 1.5,      // 골드 50% 증가
                expMultiplier: 1.5,       // 경험치 50% 증가
                dropRateBonus: 0.2        // 드롭률 20% 추가
            },
            weakness: "water",            // 물 속성에 약함
            resistance: "fire",           // 불 속성에 강함
            specialDrop: {
                id: "blazing_essence",
                name: "불꽃 정수",
                emoji: "🔥",
                rarity: "에픽",
                value: 5000,
                chance: 0.3               // 30% 확률로 드롭
            }
        },
        frozen: {
            name: "얼어붙은",
            emoji: "❄️",
            color: "#44aaff",
            description: "얼음에 둘러싸여 있습니다",
            effects: {
                powerMultiplier: 1.2,
                goldMultiplier: 1.4,
                expMultiplier: 1.4,
                dropRateBonus: 0.15
            },
            weakness: "fire",
            resistance: "ice",
            specialDrop: {
                id: "frozen_crystal",
                name: "얼음 결정",
                emoji: "🧊",
                rarity: "에픽",
                value: 4500,
                chance: 0.3
            }
        },
        toxic: {
            name: "독성",
            emoji: "☠️",
            color: "#44ff44",
            description: "맹독을 품고 있습니다",
            effects: {
                powerMultiplier: 1.25,
                goldMultiplier: 1.6,
                expMultiplier: 1.4,
                dropRateBonus: 0.25
            },
            weakness: "holy",
            resistance: "poison",
            specialDrop: {
                id: "venom_sac",
                name: "맹독 주머니",
                emoji: "🧪",
                rarity: "에픽",
                value: 5500,
                chance: 0.25
            }
        },
        lightning: {
            name: "번개",
            emoji: "⚡",
            color: "#ffff44",
            description: "전기가 흐르고 있습니다",
            effects: {
                powerMultiplier: 1.35,
                goldMultiplier: 1.7,
                expMultiplier: 1.6,
                dropRateBonus: 0.3
            },
            weakness: "earth",
            resistance: "lightning",
            specialDrop: {
                id: "thunder_core",
                name: "천둥 핵",
                emoji: "⚡",
                rarity: "에픽",
                value: 6000,
                chance: 0.35
            }
        },
        shadow: {
            name: "그림자",
            emoji: "🌑",
            color: "#444444",
            description: "어둠 속에서 꿈틀거립니다",
            effects: {
                powerMultiplier: 1.4,
                goldMultiplier: 2.0,
                expMultiplier: 1.8,
                dropRateBonus: 0.4
            },
            weakness: "light",
            resistance: "dark",
            specialDrop: {
                id: "shadow_fragment",
                name: "그림자 파편",
                emoji: "🌑",
                rarity: "레전드",
                value: 10000,
                chance: 0.2
            }
        },
        radiant: {
            name: "빛나는",
            emoji: "✨",
            color: "#ffddaa",
            description: "신성한 빛을 발산합니다",
            effects: {
                powerMultiplier: 1.5,
                goldMultiplier: 2.5,
                expMultiplier: 2.0,
                dropRateBonus: 0.5
            },
            weakness: "dark",
            resistance: "light",
            specialDrop: {
                id: "holy_orb",
                name: "성스러운 구슬",
                emoji: "🔮",
                rarity: "레전드",
                value: 15000,
                chance: 0.15
            }
        }
    },
    
    // 변이 발생 확률 (기본 5%)
    mutationChance: 0.05,
    
    // 연속 사냥 보너스 (연속당 0.5% 증가)
    streakBonus: 0.005,
    
    // 지역별 변이 가중치
    areaWeights: {
        1: { // 꽃잎 마을
            blazing: 20,
            frozen: 20,
            toxic: 30,
            lightning: 15,
            shadow: 10,
            radiant: 5
        },
        2: { // 무지개 초원
            blazing: 25,
            frozen: 15,
            toxic: 20,
            lightning: 20,
            shadow: 10,
            radiant: 10
        },
        3: { // 속삭이는 숲
            blazing: 15,
            frozen: 10,
            toxic: 35,
            lightning: 10,
            shadow: 25,
            radiant: 5
        },
        4: { // 크리스탈 동굴
            blazing: 10,
            frozen: 30,
            toxic: 10,
            lightning: 25,
            shadow: 15,
            radiant: 10
        },
        5: { // 화염 화산
            blazing: 40,
            frozen: 5,
            toxic: 15,
            lightning: 20,
            shadow: 10,
            radiant: 10
        }
    },
    
    // 속성 상성 데미지 배율
    elementalDamage: {
        // 공격자 속성이 방어자 약점일 때
        superEffective: 1.5,    // 50% 추가 데미지
        // 공격자 속성이 방어자 저항일 때
        notVeryEffective: 0.5,  // 50% 감소 데미지
        // 일반 상성
        normal: 1.0
    }
};

// 변이 몬스터 생성 함수
function generateMutation(area, huntingStreak = 0) {
    // 변이 확률 계산 (기본 + 연속 보너스)
    const chance = MONSTER_MUTATIONS.mutationChance + (huntingStreak * MONSTER_MUTATIONS.streakBonus);
    
    if (Math.random() > chance) {
        return null; // 변이 없음
    }
    
    // 지역별 가중치 가져오기
    const weights = MONSTER_MUTATIONS.areaWeights[area.id] || MONSTER_MUTATIONS.areaWeights[1];
    
    // 가중치 기반 랜덤 선택
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (const [type, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) {
            return MONSTER_MUTATIONS.types[type];
        }
    }
    
    // 기본값 (발생하면 안됨)
    return MONSTER_MUTATIONS.types.blazing;
}

// 속성 데미지 계산
function calculateElementalDamage(attackerElement, defenderMutation) {
    if (!defenderMutation) return MONSTER_MUTATIONS.elementalDamage.normal;
    
    if (attackerElement === defenderMutation.weakness) {
        return MONSTER_MUTATIONS.elementalDamage.superEffective;
    }
    
    if (attackerElement === defenderMutation.resistance) {
        return MONSTER_MUTATIONS.elementalDamage.notVeryEffective;
    }
    
    return MONSTER_MUTATIONS.elementalDamage.normal;
}

module.exports = {
    MONSTER_MUTATIONS,
    generateMutation,
    calculateElementalDamage
};