// 사냥 토너먼트 시스템
const HUNTING_TOURNAMENT = {
    // 주간 랭킹 설정
    weeklyRanking: {
        name: "주간 사냥왕",
        emoji: "🏆",
        resetDay: 1,                    // 월요일 리셋 (0=일요일, 1=월요일)
        resetHour: 6,                   // 오전 6시 리셋
        
        // 보상 설정
        rewards: {
            1: {
                title: "👑 이번 주 사냥왕",
                gold: 50000,
                items: [
                    { name: "사냥왕의 왕관", emoji: "👑", value: 100000, stats: { all: 10 } }
                ],
                specialEffect: { hunting: 50 },  // 다음 주 사냥 데미지 +50%
                badge: "🏆"
            },
            2: {
                title: "🥈 사냥 준우승",
                gold: 30000,
                items: [
                    { name: "은빛 사냥 훈장", emoji: "🥈", value: 50000, stats: { all: 5 } }
                ],
                specialEffect: { hunting: 30 },
                badge: "🥈"
            },
            3: {
                title: "🥉 사냥 3위",
                gold: 20000,
                items: [
                    { name: "동빛 사냥 훈장", emoji: "🥉", value: 30000, stats: { all: 3 } }
                ],
                specialEffect: { hunting: 20 },
                badge: "🥉"
            },
            "4-10": {
                title: "🎖️ 사냥 상위권",
                gold: 10000,
                specialEffect: { hunting: 10 },
                badge: "🎖️"
            },
            "11-50": {
                title: "🎯 사냥 참가상",
                gold: 5000,
                badge: "🎯"
            }
        },
        
        // 점수 계산 방식
        scoring: {
            normal: 1,          // 일반 몬스터
            rare: 3,            // 희귀 몬스터
            boss: 10,           // 보스 몬스터
            mutated: 5,         // 변이 몬스터
            perfect: 2          // 무피해 승리 보너스
        }
    },
    
    // 속도 사냥 이벤트
    speedHunt: {
        name: "번개 사냥",
        emoji: "⚡",
        duration: 300000,               // 5분 제한
        
        // 타겟 몬스터 (매일 변경)
        dailyTargets: [
            {
                name: "포근 양",
                area: 1,
                targetCount: 20,
                difficulty: "easy"
            },
            {
                name: "무지개 고양이",
                area: 2,
                targetCount: 15,
                difficulty: "medium"
            },
            {
                name: "현자곰",
                area: 3,
                targetCount: 10,
                difficulty: "hard"
            },
            {
                name: "다이아몬드 킹",
                area: 4,
                targetCount: 5,
                difficulty: "extreme"
            }
        ],
        
        // 시간별 보상
        rewards: {
            // S랭크: 1분 이내
            S: {
                title: "⚡ 번개 사냥꾼",
                gold: 20000,
                items: [
                    { name: "번개의 부적", emoji: "⚡", value: 50000, stats: { agility: 20 } }
                ],
                timeLimit: 60000
            },
            // A랭크: 2분 이내
            A: {
                title: "🏃 스피드 헌터",
                gold: 10000,
                items: [
                    { name: "바람의 깃털", emoji: "🪶", value: 20000, stats: { agility: 10 } }
                ],
                timeLimit: 120000
            },
            // B랭크: 3분 이내
            B: {
                title: "⏱️ 민첩한 사냥꾼",
                gold: 5000,
                timeLimit: 180000
            },
            // C랭크: 5분 이내
            C: {
                title: "🎯 목표 달성",
                gold: 2000,
                timeLimit: 300000
            }
        },
        
        // 일일 참여 제한
        dailyAttempts: 3,
        
        // 리더보드
        leaderboard: {
            size: 10,           // 상위 10명 표시
            resetDaily: true    // 매일 리셋
        }
    },
    
    // 특별 이벤트 사냥
    specialEvents: {
        // 월드 보스 레이드
        worldBoss: {
            name: "월드 보스 출현",
            emoji: "🐲",
            schedule: "weekend",        // 주말에만
            duration: 3600000,          // 1시간
            
            bosses: [
                {
                    name: "암흑룡 테네브리스",
                    hp: 1000000,
                    emoji: "🐉",
                    weakness: "light",
                    rewards: {
                        participation: 5000,    // 참여 보상
                        topDamage: 50000,       // 최고 데미지 보상
                        lastHit: 30000          // 마지막 타격 보상
                    }
                }
            ]
        },
        
        // 보물 고블린 이벤트
        treasureGoblin: {
            name: "보물 고블린 출현",
            emoji: "💰",
            spawnChance: 0.01,          // 1% 확률
            escapeTime: 30000,          // 30초 내 처치
            
            rewards: {
                gold: [10000, 50000],   // 랜덤 골드
                items: "random_legendary" // 랜덤 전설 아이템
            }
        }
    },
    
    // 토너먼트 참가 조건
    requirements: {
        minLevel: 10,
        minHunts: 50               // 최소 50회 이상 사냥 경험
    }
};

// 주간 랭킹 점수 계산
function calculateWeeklyScore(huntResult) {
    const scoring = HUNTING_TOURNAMENT.weeklyRanking.scoring;
    let score = 0;
    
    // 기본 점수
    if (huntResult.isBoss) {
        score += scoring.boss;
    } else if (huntResult.isRare) {
        score += scoring.rare;
    } else {
        score += scoring.normal;
    }
    
    // 변이 보너스
    if (huntResult.mutation) {
        score += scoring.mutated;
    }
    
    // 무피해 보너스
    if (huntResult.isPerfect) {
        score += scoring.perfect;
    }
    
    return score;
}

// 속도 사냥 랭크 계산
function calculateSpeedRank(elapsedTime) {
    const rewards = HUNTING_TOURNAMENT.speedHunt.rewards;
    
    if (elapsedTime <= rewards.S.timeLimit) return 'S';
    if (elapsedTime <= rewards.A.timeLimit) return 'A';
    if (elapsedTime <= rewards.B.timeLimit) return 'B';
    if (elapsedTime <= rewards.C.timeLimit) return 'C';
    
    return 'F'; // 실패
}

// 오늘의 속도 사냥 타겟
function getTodaySpeedTarget() {
    const today = new Date().getDay();
    const targets = HUNTING_TOURNAMENT.speedHunt.dailyTargets;
    return targets[today % targets.length];
}

module.exports = {
    HUNTING_TOURNAMENT,
    calculateWeeklyScore,
    calculateSpeedRank,
    getTodaySpeedTarget
};