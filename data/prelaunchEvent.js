// 오픈 전 강화 이벤트 시스템
const ENHANCE_EVENT = {
    // 가상 장비 목록 (메이플스토리 기준)
    virtualItems: [
        { 
            name: '🗡️ 나무 검', 
            emoji: '🗡️',
            baseSuccess: 95, // 기본 성공률
            difficulty: 'easy',
            maxLevel: 999
        },
        { 
            name: '⚔️ 철 검', 
            emoji: '⚔️',
            baseSuccess: 95,
            difficulty: 'normal',
            maxLevel: 999
        },
        { 
            name: '🔥 화염의 대검', 
            emoji: '🔥',
            baseSuccess: 95,
            difficulty: 'hard',
            maxLevel: 999
        },
        { 
            name: '⚡ 번개의 창', 
            emoji: '⚡',
            baseSuccess: 95,
            difficulty: 'expert',
            maxLevel: 999
        },
        { 
            name: '🌟 전설의 무기', 
            emoji: '🌟',
            baseSuccess: 95,
            difficulty: 'legendary',
            maxLevel: 999
        }
    ],
    
    // 강화 성공률 공식 (새로운 확률 시스템)
    getSuccessRate: function(baseRate, currentLevel) {
        // 100/90/80/70/60/30/20/10 시스템
        if (currentLevel === 0) return 100;
        else if (currentLevel <= 10) return 90;
        else if (currentLevel <= 20) return 80;
        else if (currentLevel <= 30) return 70;
        else if (currentLevel <= 50) return 60;
        else if (currentLevel <= 100) return 30;
        else if (currentLevel <= 200) return 20;
        else if (currentLevel <= 999) return 10;
    },
    
    // 특별 이벤트 제거
    specialEffects: {},
    
    // 연속 성공/실패 시스템 (3일 기간 밸런스)
    streakBonus: {
        success: {
            3: { message: '🔥 3연속 성공!', points: 30 },
            5: { message: '🌟 5연속 성공!', points: 80 },
            10: { message: '⚡ 10연속 성공!', points: 200 }
        },
        fail: {
            3: { message: '💔 3연속 실패...', points: 15 },
            5: { message: '😭 5연속 실패...', points: 40 },
            10: { message: '💀 10연속 실패...', points: 100 }
        }
    },
    
    // 랭킹 보상 (2배 상향)
    rankingRewards: {
        daily: {
            1: { points: 6000 },
            2: { points: 4000 },
            3: { points: 2000 },
            '4-10': { points: 1000 }
        },
        total: {
            1: { gold: 400000 },   // 40만 골드
            2: { gold: 300000 },   // 30만 골드
            3: { gold: 200000 },   // 20만 골드
            '4-10': { gold: 100000 },   // 10만 골드
            '11-30': { gold: 60000 },   // 6만 골드
            '31-50': { gold: 40000 },   // 4만 골드
            '51-100': { gold: 20000 }   // 2만 골드
        }
    },
    
    // 도전 과제 (3일 기간 밸런스)
    challenges: {
        firstTry: { 
            name: '🎯 첫 도전!', 
            condition: '첫 강화 시도',
            points: 10 
        },
        lucky7: { 
            name: '🍀 럭키 세븐', 
            condition: '7강 달성',
            points: 30 
        },
        persistence: { 
            name: '💪 불굴의 의지', 
            condition: '100번 시도',
            points: 150 
        },
        miracle: { 
            name: '🌈 기적의 순간', 
            condition: '5% 확률로 성공',
            points: 200 
        },
        allItems: { 
            name: '🏆 모든 무기 정복', 
            condition: '모든 종류 무기 10강 이상',
            points: 500 
        },
        perfectDay: { 
            name: '✨ 완벽한 하루', 
            condition: '하루 동안 실패 없이 10번 성공',
            points: 300 
        }
    },
    
    // 포인트 보상 테이블 (3일 기간 기준)
    pointRewards: {
        100: { 
            name: '🌱 강화 입문자',
            gold: 5000
        },
        500: {
            name: '⭐ 강화 도전자',
            gold: 20000
        },
        1000: {
            name: '🔥 강화 전문가',
            gold: 50000
        },
        2000: {
            name: '🌟 강화의 신',
            gold: 100000
        },
        3000: {
            name: '🌌 강화의 전설',
            gold: 200000
        }
    },
    
    // 기본 강화 포인트 (3일 밸런스)
    basePoints: {
        success: 5,      // 성공 시 기본 포인트
        fail: 2,         // 실패 시 기본 포인트
        levelBonus: 2    // 레벨당 추가 포인트
    }
};

module.exports = ENHANCE_EVENT;