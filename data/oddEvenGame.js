// 🐉 몬스터 배틀 아레나 시스템
const MONSTER_BATTLE = {
    // 배틀 예측 옵션
    betOptions: {
        odd: { name: '홀수 레벨', emoji: '⚡', multiplier: 1.95 },
        even: { name: '짝수 레벨', emoji: '🌙', multiplier: 1.95 },
        small: { name: '약한 몬스터 (1-50)', emoji: '🐛', multiplier: 1.95 },
        big: { name: '강한 몬스터 (51-100)', emoji: '🐲', multiplier: 1.95 },
        lucky7: { name: '세븐 배수 레벨', emoji: '🍀', multiplier: 13.0 },
        jackpot: { name: '정확한 레벨 예측', emoji: '💎', multiplier: 99.0 }
    },

    // 몬스터 종류 (레벨대별 등장)
    monsters: {
        weak: [ // 1-50 레벨
            { name: '슬라임', emoji: '🟢', minLevel: 1, maxLevel: 10 },
            { name: '고블린', emoji: '👺', minLevel: 5, maxLevel: 20 },
            { name: '늑대', emoji: '🐺', minLevel: 10, maxLevel: 30 },
            { name: '오크', emoji: '🐗', minLevel: 20, maxLevel: 40 },
            { name: '트롤', emoji: '👹', minLevel: 30, maxLevel: 50 }
        ],
        strong: [ // 51-100 레벨
            { name: '오우거', emoji: '👾', minLevel: 51, maxLevel: 65 },
            { name: '와이번', emoji: '🦅', minLevel: 60, maxLevel: 75 },
            { name: '미노타우로스', emoji: '🐃', minLevel: 70, maxLevel: 85 },
            { name: '리치', emoji: '💀', minLevel: 80, maxLevel: 95 },
            { name: '드래곤', emoji: '🐉', minLevel: 90, maxLevel: 100 }
        ]
    },

    // 배틀 애니메이션 GIF
    battleAnimations: {
        start: 'kim_battle_start.gif',
        weak: 'kim_battle_weak.gif',
        strong: 'kim_battle_strong.gif',
        victory: 'kim_battle_victory.gif',
        defeat: 'kim_battle_defeat.gif'
    },

    // 특수 배틀 이벤트
    specialEvents: [
        {
            id: 'critical_hit',
            name: '크리티컬 히트',
            probability: 0.05, // 5% 확률
            description: '치명타 발동! 승리 보상이 2배가 됩니다!',
            effect: { type: 'multiply_bet', value: 2 }
        },
        {
            id: 'monster_rage',
            name: '몬스터 각성',
            probability: 0.03, // 3% 확률
            description: '몬스터가 각성하여 모든 보상이 1.5배 증가!',
            effect: { type: 'multiply_payout', value: 1.5 }
        },
        {
            id: 'dimensional_rift',
            name: '차원의 균열',
            probability: 0.02, // 2% 확률
            description: '차원이 뒤틀려 결과가 완전히 바뀝니다!',
            effect: { type: 'chaos_result' }
        }
    ],

    // 연승 보너스 (몬스터 헌터 등급)
    streakBonuses: [
        { streak: 3, bonus: 0.1, message: '🔥 초보 헌터 각성! 보상 +10%' },
        { streak: 5, bonus: 0.25, message: '⚡ 숙련 헌터 승급! 보상 +25%' },
        { streak: 7, bonus: 0.5, message: '🌟 베테랑 헌터! 보상 +50%' },
        { streak: 10, bonus: 1.0, message: '💫 마스터 헌터! 보상 +100%' },
        { streak: 15, bonus: 2.0, message: '👑 전설의 드래곤 슬레이어! 보상 +200%' }
    ],

    // 참가비 한도
    betLimits: {
        min: 1000,  // 최소 1,000원으로 변경
        max: 1000000,
        vip_max: 10000000 // VIP 헌터 (레벨 50+ 또는 특별 등급)
    },

    // 통계 추적
    statistics: {
        totalGames: 0,
        totalBets: 0,
        totalWinnings: 0,
        hotNumbers: [], // 최근 자주 나온 숫자들
        coldNumbers: [], // 최근 안 나온 숫자들
        biggestWin: { amount: 0, user: null, date: null },
        longestStreak: { count: 0, user: null, date: null }
    }
};

module.exports = MONSTER_BATTLE;