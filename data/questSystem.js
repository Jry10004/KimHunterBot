const QUEST_SYSTEM = {
    // 일일 퀘스트
    dailyQuests: {
        hunt_10: {
            id: 'hunt_10',
            name: '몬스터 사냥 I',
            description: '몬스터 10마리 처치',
            type: 'daily',
            category: 'hunt',
            requirements: {
                type: 'kill_count',
                target: 'any',
                count: 10
            },
            rewards: {
                gold: 5000,
                exp: 1000,
                items: []
            },
            resetDaily: true
        },
        hunt_30: {
            id: 'hunt_30',
            name: '몬스터 사냥 II',
            description: '몬스터 30마리 처치',
            type: 'daily',
            category: 'hunt',
            requirements: {
                type: 'kill_count',
                target: 'any',
                count: 30
            },
            rewards: {
                gold: 15000,
                exp: 3000,
                items: [{ name: '체력 포션', quantity: 5 }]
            },
            resetDaily: true
        },
        exercise_20: {
            id: 'exercise_20',
            name: '일일 운동',
            description: '20분 이상 운동하기',
            type: 'daily',
            category: 'fitness',
            requirements: {
                type: 'exercise_time',
                minutes: 20
            },
            rewards: {
                gold: 3000,
                exp: 500,
                items: []
            },
            resetDaily: true
        },
        enhance_attempt: {
            id: 'enhance_attempt',
            name: '강화 도전',
            description: '장비 강화 3회 시도',
            type: 'daily',
            category: 'enhance',
            requirements: {
                type: 'enhance_attempts',
                count: 3
            },
            rewards: {
                gold: 4000,
                exp: 800,
                items: []
            },
            resetDaily: true
        },
        daily_login: {
            id: 'daily_login',
            name: '일일 접속',
            description: '오늘 접속하기',
            type: 'daily',
            category: 'login',
            requirements: {
                type: 'login',
                count: 1
            },
            rewards: {
                gold: 1000,
                exp: 200,
                items: []
            },
            resetDaily: true
        }
    },
    
    // 주간 퀘스트
    weeklyQuests: {
        hunt_boss: {
            id: 'hunt_boss',
            name: '보스 사냥꾼',
            description: '보스 몬스터 5마리 처치',
            type: 'weekly',
            category: 'hunt',
            requirements: {
                type: 'kill_boss',
                count: 5
            },
            rewards: {
                gold: 50000,
                exp: 10000,
                items: [{ name: '강화 보호권', quantity: 1 }]
            },
            resetWeekly: true
        },
        pvp_wins: {
            id: 'pvp_wins',
            name: 'PVP 챔피언',
            description: 'PVP 10승 달성',
            type: 'weekly',
            category: 'pvp',
            requirements: {
                type: 'pvp_wins',
                count: 10
            },
            rewards: {
                gold: 30000,
                exp: 5000,
                items: [{ name: '결투권', quantity: 10 }]
            },
            resetWeekly: true
        },
        enhance_success: {
            id: 'enhance_success',
            name: '강화 마스터',
            description: '강화 성공 10회',
            type: 'weekly',
            category: 'enhance',
            requirements: {
                type: 'enhance_success',
                count: 10
            },
            rewards: {
                gold: 40000,
                exp: 8000,
                items: [{ name: '축복의 주문서', quantity: 1 }]
            },
            resetWeekly: true
        }
    },
    
    // 업적 퀘스트
    achievements: {
        first_level_50: {
            id: 'first_level_50',
            name: '반세기의 여정',
            description: '레벨 50 달성',
            type: 'achievement',
            category: 'level',
            requirements: {
                type: 'reach_level',
                level: 50
            },
            rewards: {
                gold: 100000,
                exp: 0,
                items: [{ name: '영웅의 증표', quantity: 1 }],
                title: '베테랑'
            },
            oneTime: true
        },
        millionaire: {
            id: 'millionaire',
            name: '백만장자',
            description: '100만 골드 보유',
            type: 'achievement',
            category: 'economy',
            requirements: {
                type: 'gold_amount',
                amount: 1000000
            },
            rewards: {
                gold: 50000,
                exp: 10000,
                items: [],
                title: '부자'
            },
            oneTime: true
        },
        enhance_20: {
            id: 'enhance_20',
            name: '강화의 달인',
            description: '장비를 20강까지 강화',
            type: 'achievement',
            category: 'enhance',
            requirements: {
                type: 'enhance_level',
                level: 20
            },
            rewards: {
                gold: 200000,
                exp: 20000,
                items: [{ name: '전설의 강화석', quantity: 1 }],
                title: '강화왕'
            },
            oneTime: true
        }
    }
};

// 퀘스트 진행도 체크
function checkQuestProgress(user, questType, action, value = 1) {
    if (!user.quests) {
        user.quests = {
            daily: {},
            weekly: {},
            achievements: {},
            lastDailyReset: new Date().toDateString(),
            lastWeeklyReset: new Date()
        };
    }
    
    // 일일/주간 리셋 체크
    const today = new Date().toDateString();
    if (user.quests.lastDailyReset !== today) {
        user.quests.daily = {};
        user.quests.lastDailyReset = today;
    }
    
    const thisWeek = getWeekNumber(new Date());
    const lastWeek = getWeekNumber(new Date(user.quests.lastWeeklyReset));
    if (thisWeek !== lastWeek) {
        user.quests.weekly = {};
        user.quests.lastWeeklyReset = new Date();
    }
    
    const completedQuests = [];
    
    // 각 퀘스트 타입별로 체크
    ['daily', 'weekly', 'achievements'].forEach(type => {
        const questList = type === 'daily' ? QUEST_SYSTEM.dailyQuests :
                         type === 'weekly' ? QUEST_SYSTEM.weeklyQuests :
                         QUEST_SYSTEM.achievements;
        
        Object.values(questList).forEach(quest => {
            // 이미 완료된 퀘스트는 스킵
            if (user.quests[type][quest.id]?.completed) return;
            
            // 퀘스트 진행도 초기화
            if (!user.quests[type][quest.id]) {
                user.quests[type][quest.id] = {
                    progress: 0,
                    completed: false,
                    claimedReward: false
                };
            }
            
            const questProgress = user.quests[type][quest.id];
            
            // 액션이 퀘스트 요구사항과 일치하는지 체크
            let shouldUpdate = false;
            
            switch (quest.requirements.type) {
                case 'kill_count':
                    if (action === 'kill' && (quest.requirements.target === 'any' || quest.requirements.target === value.monsterType)) {
                        shouldUpdate = true;
                    }
                    break;
                case 'kill_boss':
                    if (action === 'kill_boss') {
                        shouldUpdate = true;
                    }
                    break;
                case 'exercise_time':
                    if (action === 'exercise') {
                        questProgress.progress += value;
                        shouldUpdate = false; // 누적이므로 별도 처리
                    }
                    break;
                case 'enhance_attempts':
                    if (action === 'enhance_attempt') {
                        shouldUpdate = true;
                    }
                    break;
                case 'enhance_success':
                    if (action === 'enhance_success') {
                        shouldUpdate = true;
                    }
                    break;
                case 'pvp_wins':
                    if (action === 'pvp_win') {
                        shouldUpdate = true;
                    }
                    break;
                case 'login':
                    if (action === 'login') {
                        shouldUpdate = true;
                    }
                    break;
                case 'reach_level':
                    if (action === 'level_up' && value >= quest.requirements.level) {
                        questProgress.progress = quest.requirements.level;
                        shouldUpdate = false;
                    }
                    break;
                case 'gold_amount':
                    if (action === 'gold_check' && value >= quest.requirements.amount) {
                        questProgress.progress = quest.requirements.amount;
                        shouldUpdate = false;
                    }
                    break;
                case 'enhance_level':
                    if (action === 'enhance_level' && value >= quest.requirements.level) {
                        questProgress.progress = quest.requirements.level;
                        shouldUpdate = false;
                    }
                    break;
            }
            
            if (shouldUpdate) {
                questProgress.progress += 1;
            }
            
            // 완료 체크
            const targetProgress = quest.requirements.count || quest.requirements.minutes || 
                                 quest.requirements.level || quest.requirements.amount || 1;
            
            if (questProgress.progress >= targetProgress && !questProgress.completed) {
                questProgress.completed = true;
                completedQuests.push({
                    type: type,
                    quest: quest
                });
            }
        });
    });
    
    return completedQuests;
}

// 주 번호 계산 함수
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

module.exports = { QUEST_SYSTEM, checkQuestProgress };