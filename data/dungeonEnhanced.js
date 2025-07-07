// 🏰 던전 향상 시스템

// 던전 테마와 특수 효과
const DUNGEON_THEMES = {
    1: { 
        name: '슬라임 동굴', 
        emoji: '🟢', 
        bgColor: '#4CAF50',
        effect: '독성 늪 - 매 라운드 5% 추가 데미지',
        ambience: '끈적거리는 소리가 들려온다...'
    },
    10: { 
        name: '화염 제단', 
        emoji: '🔥', 
        bgColor: '#FF5722',
        effect: '화염 지대 - 치명타 확률 +10%',
        ambience: '뜨거운 열기가 피부를 태운다...'
    },
    20: { 
        name: '번개 첨탑', 
        emoji: '⚡', 
        bgColor: '#673AB7',
        effect: '전기장 - 공격 속도 +20%',
        ambience: '공기가 전기로 가득 차 있다...'
    },
    30: { 
        name: '죽음의 묘지', 
        emoji: '💀', 
        bgColor: '#263238',
        effect: '저주 - 회복 효과 -50%',
        ambience: '죽은 자들의 신음소리가 들린다...'
    },
    40: { 
        name: '지옥문', 
        emoji: '👹', 
        bgColor: '#B71C1C',
        effect: '지옥불 - 모든 피해 2배',
        ambience: '악마들의 웃음소리가 울려퍼진다...'
    },
    50: { 
        name: '어둠의 왕좌', 
        emoji: '🌟', 
        bgColor: '#000000',
        effect: '절대 어둠 - 회피율 0%, 치명타 확률 100%',
        ambience: '모든 빛이 사라진다...'
    }
};

// 특수 이벤트
const DUNGEON_EVENTS = {
    treasure: {
        name: '보물상자 발견!',
        emoji: '📦',
        description: '숨겨진 보물상자를 발견했습니다!',
        choices: [
            { action: 'open', label: '상자 열기', risk: 'low' },
            { action: 'careful', label: '신중히 열기', risk: 'none' },
            { action: 'smash', label: '부수기', risk: 'high' }
        ]
    },
    merchant: {
        name: '떠돌이 상인',
        emoji: '🧙',
        description: '신비한 상인이 나타났습니다!',
        choices: [
            { action: 'heal', label: 'HP 회복 (30%)', cost: 500 },
            { action: 'buff', label: '일시적 강화', cost: 1000 },
            { action: 'skip', label: '무시하고 진행', cost: 0 }
        ]
    },
    trap: {
        name: '함정 발동!',
        emoji: '🕳️',
        description: '바닥이 무너지며 함정에 빠졌습니다!',
        choices: [
            { action: 'dodge', label: '회피 시도', stat: 'agility' },
            { action: 'endure', label: '버티기', stat: 'vitality' },
            { action: 'break', label: '파괴하기', stat: 'strength' }
        ]
    },
    riddle: {
        name: '수수께끼의 문',
        emoji: '🚪',
        description: '거대한 문이 길을 막고 있습니다. 수수께끼를 풀어야 합니다!',
        riddles: [
            { 
                question: '나는 걸을 수록 뒤로 가고, 멈추면 앞으로 간다. 나는 무엇인가?', 
                answer: '시계',
                hints: ['시간과 관련있다', '바늘이 있다']
            },
            { 
                question: '낮에는 하나, 밤에는 수천 개. 이것은 무엇인가?', 
                answer: '별',
                hints: ['하늘에 있다', '빛난다']
            }
        ]
    },
    miniBoss: {
        name: '중간 보스 등장!',
        emoji: '👺',
        description: '강력한 중간 보스가 길을 막고 있습니다!',
        rewards: {
            gold: 1000,
            exp: 500,
            items: ['특수 장비 조각']
        }
    }
};

// 던전 버프/디버프 시스템
const DUNGEON_BUFFS = {
    berserk: {
        name: '광폭화',
        emoji: '🔴',
        duration: 3,
        effects: { attack: 1.5, defense: 0.8 }
    },
    shield: {
        name: '방어 태세',
        emoji: '🛡️',
        duration: 2,
        effects: { attack: 0.9, defense: 1.5 }
    },
    swift: {
        name: '신속',
        emoji: '💨',
        duration: 4,
        effects: { evasion: 1.3, accuracy: 1.2 }
    },
    regeneration: {
        name: '재생',
        emoji: '💚',
        duration: 5,
        effects: { healPerTurn: 0.05 } // 턴당 5% 회복
    },
    curse: {
        name: '저주',
        emoji: '💀',
        duration: 3,
        effects: { allStats: 0.8 }
    }
};

// PVP 펜듈럼 스킬 시스템 (자동 발동)
const PENDULUM_SKILLS = {
    high: {  // 별똥베기
        name: '별똥베기',
        emoji: '⭐',
        levels: {
            1: { chance: 10, effect: 1.2, description: 'Lv.1: 10% 확률로 데미지 20% 증가' },
            2: { chance: 15, effect: 1.3, description: 'Lv.2: 15% 확률로 데미지 30% 증가' },
            3: { chance: 20, effect: 1.4, description: 'Lv.3: 20% 확률로 데미지 40% 증가' },
            4: { chance: 25, effect: 1.5, description: 'Lv.4: 25% 확률로 데미지 50% 증가' },
            5: { chance: 30, effect: 1.6, description: 'Lv.5: 30% 확률로 데미지 60% 증가' },
            6: { chance: 35, effect: 1.8, description: 'Lv.6: 35% 확률로 데미지 80% 증가' },
            7: { chance: 40, effect: 2.0, description: 'Lv.7: 40% 확률로 데미지 100% 증가' }
        }
    },
    middle: {  // 슈가스팅
        name: '슈가스팅',
        emoji: '🍄',
        levels: {
            1: { chance: 10, heal: 0.05, description: 'Lv.1: 10% 확률로 HP 5% 회복' },
            2: { chance: 15, heal: 0.08, description: 'Lv.2: 15% 확률로 HP 8% 회복' },
            3: { chance: 20, heal: 0.10, description: 'Lv.3: 20% 확률로 HP 10% 회복' },
            4: { chance: 25, heal: 0.12, description: 'Lv.4: 25% 확률로 HP 12% 회복' },
            5: { chance: 30, heal: 0.15, description: 'Lv.5: 30% 확률로 HP 15% 회복' },
            6: { chance: 35, heal: 0.18, description: 'Lv.6: 35% 확률로 HP 18% 회복' },
            7: { chance: 40, heal: 0.20, description: 'Lv.7: 40% 확률로 HP 20% 회복' }
        }
    },
    low: {  // 버섯팡
        name: '버섯팡',
        emoji: '💥',
        levels: {
            1: { chance: 10, counter: 0.3, description: 'Lv.1: 10% 확률로 반격 (받은 데미지의 30%)' },
            2: { chance: 15, counter: 0.4, description: 'Lv.2: 15% 확률로 반격 (받은 데미지의 40%)' },
            3: { chance: 20, counter: 0.5, description: 'Lv.3: 20% 확률로 반격 (받은 데미지의 50%)' },
            4: { chance: 25, counter: 0.6, description: 'Lv.4: 25% 확률로 반격 (받은 데미지의 60%)' },
            5: { chance: 30, counter: 0.7, description: 'Lv.5: 30% 확률로 반격 (받은 데미지의 70%)' },
            6: { chance: 35, counter: 0.8, description: 'Lv.6: 35% 확률로 반격 (받은 데미지의 80%)' },
            7: { chance: 40, counter: 1.0, description: 'Lv.7: 40% 확률로 반격 (받은 데미지의 100%)' }
        }
    }
};

// 던전 아이템 시스템
const DUNGEON_ITEMS = {
    consumables: {
        healthPotion: {
            name: 'HP 포션',
            emoji: '🧪',
            effect: { heal: 0.3 }, // 30% 회복
            price: 100
        },
        strengthPotion: {
            name: '힘의 물약',
            emoji: '💪',
            effect: { buff: 'berserk' },
            price: 200
        },
        smokeGrenade: {
            name: '연막탄',
            emoji: '💨',
            effect: { escape: true },
            price: 150
        }
    },
    equipment: {
        dungeonSword: {
            name: '던전 브레이커',
            emoji: '🗡️',
            stats: { attack: 50, critRate: 10 },
            dropRate: 0.05
        },
        shadowCloak: {
            name: '그림자 망토',
            emoji: '🥷',
            stats: { evasion: 30, defense: 20 },
            dropRate: 0.03
        }
    }
};

// 던전 랭킹 시스템
const DUNGEON_ACHIEVEMENTS = {
    speedRunner: {
        name: '스피드러너',
        description: '10층을 5분 내에 클리어',
        reward: { title: '⚡ 질주하는', gold: 5000 }
    },
    noDamage: {
        name: '무상처',
        description: '데미지를 받지 않고 10층 클리어',
        reward: { title: '🛡️ 철벽의', gold: 10000 }
    },
    perfectClear: {
        name: '완벽한 정복',
        description: '모든 층을 클리어',
        reward: { title: '👑 던전 정복자', gold: 50000 }
    }
};

// 파티 시스템
const PARTY_ROLES = {
    tank: {
        name: '탱커',
        emoji: '🛡️',
        bonuses: { defense: 1.3, aggro: 2.0 }
    },
    dps: {
        name: '딜러',
        emoji: '⚔️',
        bonuses: { attack: 1.3, critRate: 1.2 }
    },
    healer: {
        name: '힐러',
        emoji: '💚',
        bonuses: { healPower: 1.5, manaRegen: 1.3 }
    },
    support: {
        name: '서포터',
        emoji: '✨',
        bonuses: { buffDuration: 1.5, debuffResist: 1.3 }
    }
};

// 던전 점수 계산
function calculateDungeonScore(sessionData) {
    let score = 0;
    
    // 기본 점수 (층수 기반)
    score += sessionData.currentFloor * 100;
    
    // 시간 보너스
    const timeElapsed = Date.now() - sessionData.startTime;
    const timeBonus = Math.max(0, 10000 - Math.floor(timeElapsed / 1000));
    score += timeBonus;
    
    // 노데미지 보너스
    if (sessionData.damageTaken === 0) {
        score += 5000;
    }
    
    // 연속 처치 보너스
    score += sessionData.killStreak * 200;
    
    // 아이템 수집 보너스
    score += sessionData.itemsCollected * 150;
    
    return score;
}

// 몬스터 AI 패턴
const MONSTER_AI_PATTERNS = {
    aggressive: {
        name: '공격적',
        attackPreference: ['low', 'middle', 'high'],
        counterChance: 0.7
    },
    defensive: {
        name: '방어적',
        attackPreference: ['high', 'middle', 'low'],
        counterChance: 0.3
    },
    random: {
        name: '예측불가',
        attackPreference: null, // 완전 랜덤
        counterChance: 0.5
    },
    intelligent: {
        name: '지능적',
        attackPreference: null, // 플레이어 패턴 분석
        counterChance: 0.6,
        analyzePlayer: true
    }
};

module.exports = {
    DUNGEON_THEMES,
    DUNGEON_EVENTS,
    DUNGEON_BUFFS,
    PENDULUM_SKILLS,
    DUNGEON_ITEMS,
    DUNGEON_ACHIEVEMENTS,
    PARTY_ROLES,
    calculateDungeonScore,
    MONSTER_AI_PATTERNS
};