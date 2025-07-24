// 게임 전체 설정 파일
module.exports = {
    // 서버 설정
    server: {
        development: {
            enabled: process.env.DEV_MODE === 'true',
            channels: process.env.DEV_CHANNEL_IDS ? process.env.DEV_CHANNEL_IDS.split(',') : []
        },
        maintenance: {
            enabled: false,
            message: '🔧 현재 유지보수 중입니다. 잠시 후 다시 시도해주세요.'
        }
    },
    
    // 게임 기본 설정
    game: {
        startingGold: 10000,
        maxLevel: 300, // 시즌2 확장
        expFormula: (level) => {
            if (level <= 100) {
                // 1-100: 빠른 성장 (2-3일)
                return (level * 1000 + (level - 1) * 500);
            } else if (level <= 150) {
                // 101-150: 초반 (1개월)
                return Math.floor(80000 * Math.pow(1.018, level - 100));
            } else if (level <= 200) {
                // 151-200: 중반 (3개월)  
                return Math.floor(150000 * Math.pow(1.022, level - 150) * 1.2);
            } else if (level <= 250) {
                // 201-250: 후반 (4개월) - 50% 단축
                return Math.floor(300000 * Math.pow(1.02, level - 200) * 1);
            } else {
                // 251-300: 최종 (6개월) - 50% 단축
                return Math.floor(800000 * Math.pow(1.025, level - 250) * 1.5);
            }
        },
        
        // 일일 제한 (시즌2 통합 밸런스)
        dailyLimits: {
            work: 10,
            quests: 5,
            pvp: 20,
            dungeonRuns: 3,
            fishing: 5,           // 낚시 제한
            energyFusion: 20,     // 에너지 융합 제한  
            energyMining: 20,     // 에너지 채굴 제한
            exercise: {           // 운동 시간 제한 (분)
                basic: 120,       // 기본: 2시간
                premium: 240,     // 프리미엄: 4시간  
                vip: 360          // VIP: 6시간
            }
        },
        
        // 쿨다운 (밀리초)
        cooldowns: {
            work: 60 * 60 * 1000,      // 1시간
            hunt: 10 * 60 * 1000,       // 10분
            daily: 24 * 60 * 60 * 1000, // 24시간
            pvp: 5 * 60 * 1000          // 5분
        }
    },
    
    // 사냥 설정
    hunting: {
        ticketRegen: {
            interval: 30 * 60 * 1000, // 30분
            amount: 1,
            maxTickets: 20
        },
        areas: {
            unlockLevels: [1, 10, 20, 30, 40, 50, 60, 70, 80, 90],
            dropRateBonus: {
                rare: 0.1,
                epic: 0.05,
                legendary: 0.01
            }
        }
    },
    
    // PVP 설정
    pvp: {
        matchmaking: {
            ratingRange: 200,
            searchTimeout: 30000, // 30초
            botMatchAfter: 20000  // 20초 후 봇 매칭
        },
        rewards: {
            win: { gold: 5000, exp: 1000, rating: 25 },
            loss: { gold: 1000, exp: 500, rating: -20 },
            draw: { gold: 2000, exp: 750, rating: 0 }
        },
        betting: {
            enabled: true,
            minBet: 1000,
            maxBet: 100000,
            taxRate: 0.1 // 10% 수수료
        }
    },
    
    // 던전 설정
    dungeon: {
        entryFee: 10000,
        maxFloors: 5,
        rewards: {
            floorMultiplier: 1.5,
            bossBonus: 5,
            treasureChance: 0.1
        },
        difficulty: {
            trapChanceIncrease: 0.05,
            monsterHpMultiplier: 1.2,
            monsterDamageMultiplier: 1.1
        }
    },
    
    // 보스 레이드 설정
    bossRaid: {
        spawnInterval: 60 * 60 * 1000,     // 1시간
        duration: 30 * 60 * 1000,          // 30분
        minParticipants: 2,                // 3명에서 2명으로 변경
        maxParticipants: 20,
        rewards: {
            participation: { gold: 10000, exp: 2000 },
            mvp: { gold: 50000, exp: 10000 },
            top3: { gold: 30000, exp: 5000 }
        }
    },
    
    // 미니게임 설정
    miniGames: {
        // 가위바위보
        rps: {
            entryFee: 1000,
            rewards: {
                vsBot: { win: 5000, draw: 1000 },
                vsPlayer: { winnerTakeRate: 0.9 }
            },
            ticketRegen: 30 * 60 * 1000, // 30분
            maxTickets: 10
        },
        
        // 독버섯
        mushroom: {
            entryFee: 10000,
            survivalBonus: 5000,
            maxRounds: 10,
            poisonChance: 0.3,
            rewards: {
                perRound: 2000,
                completion: 50000
            }
        },
        
        // 홀짝
        oddEven: {
            minBet: 1000,
            maxBet: 1000000,
            vipMaxBet: 10000000,
            payouts: {
                oddEven: 1.95,
                smallBig: 1.95,
                lucky7: 13.0,
                exact: 99.0
            }
        },
        
        // 슬롯머신
        slotMachine: {
            betAmounts: [1000, 5000, 10000, 50000, 100000],
            jackpot: {
                baseAmount: 1000000,
                contribution: 0.01
            }
        }
    },
    
    // 경제 설정
    economy: {
        tax: {
            trade: 0.05,      // 5% 거래 수수료
            auction: 0.1,     // 10% 경매 수수료
            mail: 0.02        // 2% 우편 수수료
        },
        inflation: {
            enabled: true,
            rate: 0.001,      // 0.1% 일일 인플레이션
            maxGoldSupply: 1000000000
        }
    },
    
    // 상점 설정
    shop: {
        refreshInterval: 24 * 60 * 60 * 1000, // 24시간
        discountRange: [0.1, 0.3],            // 10-30% 할인
        vipDiscount: 0.1,                     // VIP 추가 10% 할인
        buybackRate: 0.5                      // 판매가의 50%로 구매
    },
    
    // 강화 설정
    enhancement: {
        maxLevel: 20,
        costMultiplier: 1.5,
        successRates: {
            // 레벨별 성공률은 enhancementConfig.js에서 관리
        },
        protectionItems: {
            scroll: { preventDestroy: true, preventDowngrade: true },
            blessing: { increaseRate: 0.1 }
        }
    },
    
    // 엠블럼 설정
    emblem: {
        types: ['warrior', 'mage', 'archer', 'assassin', 'priest'],
        maxTier: 10,
        evolutionCost: (tier) => tier * 100000,
        bonusPerTier: {
            stats: 5,     // 5% 스탯 증가
            exp: 10,      // 10% 경험치 보너스
            gold: 5       // 5% 골드 보너스
        }
    },
    
    // 채널 설정
    channels: {
        registration: process.env.REGISTRATION_CHANNEL_ID,
        announcement: process.env.ANNOUNCEMENT_CHANNEL_ID,
        news: process.env.NEWS_CHANNEL_ID,
        emblem: process.env.EMBLEM_CHANNEL_ID,
        pvp: process.env.PVP_CHANNEL_ID,
        raid: process.env.RAID_CHANNEL_ID
    },
    
    // 보안 설정
    security: {
        antiMacro: {
            enabled: true,
            minResponseTime: 500,
            maxActionsPerMinute: 20,
            verificationTimeout: 20000
        },
        rateLimits: {
            commands: { points: 10, duration: 60000 },
            buttons: { points: 20, duration: 60000 },
            api: { points: 100, duration: 60000 }
        }
    },
    
    // 로깅 설정
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        errorReporting: true,
        performanceMonitoring: true,
        auditLog: true
    }
};