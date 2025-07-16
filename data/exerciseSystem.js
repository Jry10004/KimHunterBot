// 🏃 운동하기 방치형 시스템 데이터
const EXERCISE_SYSTEM = {
    // 운동 종류 정의
    exercises: {
        // 기본 운동 (무료)
        pushup: {
            id: 'pushup',
            name: '팔굽혀펴기',
            emoji: '💪',
            category: 'basic',
            description: '기본적인 근력 운동',
            requirements: null,
            maxDuration: 3600000, // 1시간
            efficiency: {
                strength: 1.5,
                stamina: 0.5,
                flexibility: 0.3,
                agility: 0.2,
                mental: 0.5
            },
            fatigueRate: 0.8, // 피로도 증가율
            rewards: {
                goldPerMinute: 500,    // 10 -> 500 (50x)
                expPerMinute: 50,      // 5 -> 50 (10x)
                fitnessExpPerMinute: 80  // 8 -> 80 (10x)
            }
        },
        jogging: {
            id: 'jogging',
            name: '조깅',
            emoji: '🏃',
            category: 'basic',
            description: '기본적인 유산소 운동',
            requirements: null,
            maxDuration: 7200000, // 2시간
            efficiency: {
                strength: 0.3,
                stamina: 1.5,
                flexibility: 0.2,
                agility: 0.8,
                mental: 0.7
            },
            fatigueRate: 0.6,
            rewards: {
                goldPerMinute: 400,    // 8 -> 400 (50x)
                expPerMinute: 60,      // 6 -> 60 (10x)
                fitnessExpPerMinute: 100  // 10 -> 100 (10x)
            }
        },
        stretching: {
            id: 'stretching',
            name: '스트레칭',
            emoji: '🧘',
            category: 'basic',
            description: '유연성을 기르는 운동',
            requirements: null,
            maxDuration: 1800000, // 30분
            efficiency: {
                strength: 0.1,
                stamina: 0.3,
                flexibility: 2.0,
                agility: 0.5,
                mental: 1.0
            },
            fatigueRate: 0.3,
            rewards: {
                goldPerMinute: 250,    // 5 -> 250 (50x)
                expPerMinute: 40,      // 4 -> 40 (10x)
                fitnessExpPerMinute: 60  // 6 -> 60 (10x)
            }
        },
        
        // 헬스장 운동 (일일 이용권 필요)
        weight: {
            id: 'weight',
            name: '웨이트 트레이닝',
            emoji: '🏋️',
            category: 'gym',
            description: '전문적인 근력 운동',
            requirements: 'gym',
            maxDuration: 5400000, // 1.5시간
            efficiency: {
                strength: 2.5,
                stamina: 1.0,
                flexibility: 0.2,
                agility: 0.3,
                mental: 0.8
            },
            fatigueRate: 1.2,
            rewards: {
                goldPerMinute: 1000,   // 20 -> 1000 (50x)
                expPerMinute: 100,     // 10 -> 100 (10x)
                fitnessExpPerMinute: 150  // 15 -> 150 (10x)
            }
        },
        treadmill: {
            id: 'treadmill',
            name: '러닝머신',
            emoji: '🏃‍♂️',
            category: 'gym',
            description: '실내 유산소 운동',
            requirements: 'gym',
            maxDuration: 10800000, // 3시간
            efficiency: {
                strength: 0.5,
                stamina: 2.2,
                flexibility: 0.3,
                agility: 1.5,
                mental: 1.0
            },
            fatigueRate: 0.9,
            rewards: {
                goldPerMinute: 750,    // 15 -> 750 (50x)
                expPerMinute: 120,     // 12 -> 120 (10x)
                fitnessExpPerMinute: 180  // 18 -> 180 (10x)
            }
        },
        spinning: {
            id: 'spinning',
            name: '스피닝',
            emoji: '🚴',
            category: 'gym',
            description: '고강도 사이클 운동',
            requirements: 'gym',
            maxDuration: 3600000, // 1시간
            efficiency: {
                strength: 0.8,
                stamina: 2.0,
                flexibility: 0.4,
                agility: 1.8,
                mental: 1.2
            },
            fatigueRate: 1.4,
            rewards: {
                goldPerMinute: 900,    // 18 -> 900 (50x)
                expPerMinute: 140,     // 14 -> 140 (10x)
                fitnessExpPerMinute: 200  // 20 -> 200 (10x)
            }
        },
        
        // 프리미엄 운동 (프리미엄 회원권 필요)
        swimming: {
            id: 'swimming',
            name: '수영',
            emoji: '🏊',
            category: 'premium',
            description: '전신 운동의 최고봉',
            requirements: 'premium',
            maxDuration: 7200000, // 2시간
            efficiency: {
                strength: 1.5,
                stamina: 1.8,
                flexibility: 1.5,
                agility: 1.5,
                mental: 1.2
            },
            fatigueRate: 1.0,
            rewards: {
                goldPerMinute: 1500,   // 30 -> 1500 (50x)
                expPerMinute: 200,     // 20 -> 200 (10x)
                fitnessExpPerMinute: 250  // 25 -> 250 (10x)
            }
        },
        pilates: {
            id: 'pilates',
            name: '필라테스',
            emoji: '🤸',
            category: 'premium',
            description: '코어 강화와 유연성',
            requirements: 'premium',
            maxDuration: 5400000, // 1.5시간
            efficiency: {
                strength: 1.2,
                stamina: 0.8,
                flexibility: 2.5,
                agility: 1.0,
                mental: 1.8
            },
            fatigueRate: 0.7,
            rewards: {
                goldPerMinute: 1250,   // 25 -> 1250 (50x)
                expPerMinute: 180,     // 18 -> 180 (10x)
                fitnessExpPerMinute: 220  // 22 -> 220 (10x)
            }
        },
        crossfit: {
            id: 'crossfit',
            name: '크로스핏',
            emoji: '💥',
            category: 'premium',
            description: '종합 고강도 운동',
            requirements: 'premium',
            maxDuration: 3600000, // 1시간
            efficiency: {
                strength: 2.0,
                stamina: 2.0,
                flexibility: 1.0,
                agility: 2.0,
                mental: 1.5
            },
            fatigueRate: 1.8,
            rewards: {
                goldPerMinute: 1750,   // 35 -> 1750 (50x)
                expPerMinute: 250,     // 25 -> 250 (10x)
                fitnessExpPerMinute: 300  // 30 -> 300 (10x)
            }
        }
    },
    
    // 피트니스 레벨 티어
    levelTiers: {
        1: { name: '운동 초보자', emoji: '🌱', requiredExp: 0 },
        11: { name: '운동 아마추어', emoji: '🌿', requiredExp: 1000 },
        31: { name: '세미 프로', emoji: '🌳', requiredExp: 5000 },
        51: { name: '프로 운동가', emoji: '🏆', requiredExp: 15000 },
        71: { name: '운동 마스터', emoji: '👑', requiredExp: 50000 }
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
    
    // 피로도 설정
    fatigue: {
        maxFatigue: 3600,  // 최대 피로도 (60시간)
        recoveryRate: 60,  // 1시간당 60분 회복
        exerciseLimit: 3600, // 운동 가능 최대치
        warningLevel: 2400,  // 경고 레벨 (40시간)
        fatiguePerMinute: 1  // 1분당 1 피로도
    }
};

module.exports = EXERCISE_SYSTEM;