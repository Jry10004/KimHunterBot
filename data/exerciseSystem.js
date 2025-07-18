// 🏃 운동하기 방치형 시스템 데이터
const EXERCISE_SYSTEM = {
    // 운동 종류 정의
    exercises: {
        // 💪 힘 특화 운동
        pushup: {
            id: 'pushup',
            name: '팔굽혀펴기',
            emoji: '💪',
            category: 'basic',
            description: '힘 +1/시간',
            requirements: null,
            statGains: {
                strength: 1  // 시간당 스탯
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 50,
                fitnessExpPerMinute: 10
            },
            fatigueRate: 1.2  // 30분 운동 = 36 피로도  // 30분 운동 = 24 피로도
        },
        weight: {
            id: 'weight',
            name: '웨이트 트레이닝',
            emoji: '🏋️',
            category: 'gym',
            description: '힘 +2, 체력 +1/시간',
            requirements: 'gym',
            statGains: {
                strength: 2,
                vitality: 1
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 100,
                fitnessExpPerMinute: 15
            },
            fatigueRate: 1.2  // 30분 운동 = 36 피로도
        },
        powerlifting: {
            id: 'powerlifting',
            name: '파워리프팅',
            emoji: '🏋️‍♂️',
            category: 'premium',
            description: '힘 +3/시간',
            requirements: 'premium',
            statGains: {
                strength: 3
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 150,
                fitnessExpPerMinute: 20
            },
            fatigueRate: 1.5  // 30분 운동 = 45 피로도
        },
        
        // 🏃 민첩 특화 운동
        jogging: {
            id: 'jogging',
            name: '조깅',
            emoji: '🏃',
            category: 'basic',
            description: '민첩 +1/시간',
            requirements: null,
            statGains: {
                agility: 1
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 60,
                fitnessExpPerMinute: 10
            },
            fatigueRate: 1.2  // 30분 운동 = 36 피로도  // 30분 운동 = 24 피로도
        },
        spinning: {
            id: 'spinning',
            name: '스피닝',
            emoji: '🚴',
            category: 'gym',
            description: '민첩 +2, 체력 +1/시간',
            requirements: 'gym',
            statGains: {
                agility: 2,
                vitality: 1
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 140,
                fitnessExpPerMinute: 15
            },
            fatigueRate: 1.2  // 30분 운동 = 36 피로도
        },
        parkour: {
            id: 'parkour',
            name: '파쿠르',
            emoji: '🤸‍♂️',
            category: 'premium',
            description: '민첩 +3/시간',
            requirements: 'premium',
            statGains: {
                agility: 3
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 200,
                fitnessExpPerMinute: 20
            },
            fatigueRate: 1.5  // 30분 운동 = 45 피로도
        },
        
        // 🧠 지능 특화 운동
        reading: {
            id: 'reading',
            name: '독서',
            emoji: '📚',
            category: 'basic',
            description: '지능 +1/시간',
            requirements: null,
            statGains: {
                intelligence: 1
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 40,
                fitnessExpPerMinute: 10
            },
            fatigueRate: 1.2  // 30분 운동 = 36 피로도  // 30분 운동 = 24 피로도
        },
        meditation: {
            id: 'meditation',
            name: '명상',
            emoji: '🧘',
            category: 'gym',
            description: '지능 +2, 정신력 +1/시간',
            requirements: 'gym',
            statGains: {
                intelligence: 2,
                mental: 1  // 정신력은 전투력에만 영향
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 120,
                fitnessExpPerMinute: 15
            },
            fatigueRate: 1.2  // 30분 운동 = 36 피로도
        },
        braintraining: {
            id: 'braintraining',
            name: '두뇌 트레이닝',
            emoji: '🧠',
            category: 'premium',
            description: '지능 +3/시간',
            requirements: 'premium',
            statGains: {
                intelligence: 3
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 180,
                fitnessExpPerMinute: 20
            },
            fatigueRate: 1.5  // 30분 운동 = 45 피로도
        },
        
        // ❤️ 체력 특화 운동
        jumprope: {
            id: 'jumprope',
            name: '줄넘기',
            emoji: '🪢',
            category: 'basic',
            description: '체력 +1/시간',
            requirements: null,
            statGains: {
                vitality: 1
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 50,
                fitnessExpPerMinute: 10
            },
            fatigueRate: 1.2  // 30분 운동 = 36 피로도  // 30분 운동 = 24 피로도
        },
        swimming: {
            id: 'swimming',
            name: '수영',
            emoji: '🏊',
            category: 'gym',
            description: '체력 +2, 민첩 +1/시간',
            requirements: 'gym',
            statGains: {
                vitality: 2,
                agility: 1
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 150,
                fitnessExpPerMinute: 15
            },
            fatigueRate: 1.2  // 30분 운동 = 36 피로도
        },
        marathon: {
            id: 'marathon',
            name: '마라톤',
            emoji: '🏃‍♀️',
            category: 'premium',
            description: '체력 +3/시간',
            requirements: 'premium',
            statGains: {
                vitality: 3
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 200,
                fitnessExpPerMinute: 20
            },
            fatigueRate: 1.5  // 30분 운동 = 45 피로도
        },
        
        // 🍀 행운 특화 운동
        darts: {
            id: 'darts',
            name: '다트',
            emoji: '🎯',
            category: 'basic',
            description: '행운 +1/시간',
            requirements: null,
            statGains: {
                luck: 1
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 45,
                fitnessExpPerMinute: 10
            },
            fatigueRate: 1.2  // 30분 운동 = 36 피로도  // 30분 운동 = 24 피로도
        },
        archery: {
            id: 'archery',
            name: '양궁',
            emoji: '🏹',
            category: 'gym',
            description: '행운 +2, 민첩 +1/시간',
            requirements: 'gym',
            statGains: {
                luck: 2,
                agility: 1
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제거
                expPerMinute: 130,
                fitnessExpPerMinute: 15
            },
            fatigueRate: 1.2  // 30분 운동 = 36 피로도
        },
        shooting: {
            id: 'shooting',
            name: '정밀 사격',
            emoji: '🎯',
            category: 'premium',
            description: '행운 +3/시간',
            requirements: 'premium',
            statGains: {
                luck: 3
            },
            rewards: {
                goldPerMinute: 0,  // 골드 보상 제겄
                expPerMinute: 190,
                fitnessExpPerMinute: 20
            },
            fatigueRate: 1.5  // 30분 운동 = 45 피로도
        }
    },
    
    // 피트니스 레벨 티어
    levelTiers: {
        1: { 
            name: '운동 초보자', 
            emoji: '🌱', 
            requiredExp: 0,
            benefits: '기본 운동만 가능'
        },
        10: { 
            name: '운동 입문자', 
            emoji: '🌿', 
            requiredExp: 500,
            benefits: '운동 효율 +3%'
        },
        20: { 
            name: '운동 애호가', 
            emoji: '🌳', 
            requiredExp: 2000,
            benefits: '운동 효율 +5%, 피로도 회복 속도 +5%'
        },
        30: { 
            name: '피트니스 매니아', 
            emoji: '💪', 
            requiredExp: 5000,
            benefits: '운동 효율 +8%, 피로도 회복 속도 +10%'
        },
        40: { 
            name: '운동 중독자', 
            emoji: '🔥', 
            requiredExp: 10000,
            benefits: '운동 효율 +12%, 피로도 회복 속도 +15%, 스탯 증가량 +5%'
        },
        50: { 
            name: '세미 프로', 
            emoji: '⭐', 
            requiredExp: 20000,
            benefits: '운동 효율 +15%, 피로도 회복 속도 +20%, 스탯 증가량 +10%'
        },
        60: { 
            name: '프로 운동가', 
            emoji: '🏆', 
            requiredExp: 40000,
            benefits: '운동 효율 +20%, 피로도 회복 속도 +25%, 스탯 증가량 +15%'
        },
        70: { 
            name: '운동 전문가', 
            emoji: '🥇', 
            requiredExp: 80000,
            benefits: '운동 효율 +25%, 피로도 회복 속도 +30%, 스탯 증가량 +20%'
        },
        80: { 
            name: '피트니스 구루', 
            emoji: '🎯', 
            requiredExp: 150000,
            benefits: '운동 효율 +28%, 피로도 회복 속도 +40%, 스탯 증가량 +25%, 일일 보너스 시간 +15분'
        },
        90: { 
            name: '운동의 신', 
            emoji: '⚡', 
            requiredExp: 300000,
            benefits: '운동 효율 +30%, 피로도 회복 속도 +45%, 스탯 증가량 +28%, 일일 보너스 시간 +25분'
        },
        100: { 
            name: '전설의 보디빌더', 
            emoji: '👑', 
            requiredExp: 600000,
            benefits: '운동 효율 +35%, 피로도 회복 속도 +50%, 스탯 증가량 +30%, 일일 보너스 시간 +30분'
        }
    },
    
    // 레벨별 보너스 (누적)
    levelBonuses: {
        10: { efficiency: 1.03, fatigueRecovery: 1.0 },
        20: { efficiency: 1.05, fatigueRecovery: 1.05 },
        30: { efficiency: 1.08, fatigueRecovery: 1.1 },
        40: { efficiency: 1.12, fatigueRecovery: 1.15, statBonus: 1.05 },
        50: { efficiency: 1.15, fatigueRecovery: 1.2, statBonus: 1.1 },
        60: { efficiency: 1.2, fatigueRecovery: 1.25, statBonus: 1.15 },
        70: { efficiency: 1.25, fatigueRecovery: 1.3, statBonus: 1.2 },
        80: { efficiency: 1.28, fatigueRecovery: 1.4, statBonus: 1.25, bonusMinutes: 15 },
        90: { efficiency: 1.3, fatigueRecovery: 1.45, statBonus: 1.28, bonusMinutes: 25 },
        100: { efficiency: 1.35, fatigueRecovery: 1.5, statBonus: 1.3, bonusMinutes: 30 }
    },
    
    // 운동 장비
    equipment: {
        clothes: {
            basic: { name: '기본 운동복', efficiency: 1.0, cost: 0 },
            brand: { name: '브랜드 운동복', efficiency: 1.1, cost: 250000 },  // 5000 -> 250000 (50x)
            pro: { name: '프로 운동복', efficiency: 1.2, cost: 1000000 }     // 20000 -> 1000000 (50x)
        },
        shoes: {
            basic: { name: '기본 운동화', speed: 1.0, cost: 0 },
            running: { name: '러닝화', speed: 1.15, cost: 400000 },      // 8000 -> 400000 (50x)
            pro: { name: '프로 운동화', speed: 1.3, cost: 1500000 }   // 30000 -> 1500000 (50x)
        }
    },
    
    // 보충제
    supplements: {
        protein: {
            name: '프로틴',
            emoji: '🥤',
            duration: 7200000, // 2시간
            effect: { strength: 1.5 },
            cost: 50000,   // 1000 -> 50000 (50x)
            description: '근력 운동 효율 +50%'
        },
        bcaa: {
            name: 'BCAA',
            emoji: '💊',
            duration: 10800000, // 3시간
            effect: { fatigueReduction: 0.7 },
            cost: 75000,   // 1500 -> 75000 (50x)
            description: '피로도 증가 -30%'
        },
        booster: {
            name: '부스터',
            emoji: '⚡',
            duration: 3600000, // 1시간
            effect: { allStats: 1.3 },
            cost: 100000,  // 2000 -> 100000 (50x)
            description: '모든 운동 효율 +30%'
        }
    },
    
    // 연속 운동 보너스
    streakBonus: [
        { days: 3, bonus: 0.1, message: '3일 연속! 효율 +10%' },
        { days: 7, bonus: 0.2, message: '7일 연속! 효율 +20%' },
        { days: 14, bonus: 0.3, message: '2주 연속! 효율 +30%' },
        { days: 30, bonus: 0.5, message: '한달 연속! 효율 +50%' }
    ],
    
    // 일일 운동 시간 제한
    dailyLimits: {
        basic: 120,     // 기본: 2시간 (120분)
        premium: 240,   // 프리미엄: 4시간 (240분)
        vip: 360        // VIP: 6시간 (360분)
    },
    
    // 직업별 추천 운동
    recommendedExercises: {
        '전사': ['pushup', 'weight', 'powerlifting'],
        '궁수': ['jogging', 'archery', 'parkour'],
        '마법사': ['reading', 'meditation', 'braintraining'],
        '도적': ['parkour', 'darts', 'shooting'],
        '수호자': ['jumprope', 'swimming', 'marathon']
    }
};

module.exports = EXERCISE_SYSTEM;