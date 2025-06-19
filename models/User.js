const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    nickname: {
        type: String,
        required: false,
        maxLength: 12
    },
    email: {
        type: String,
        required: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationCode: {
        type: String,
        default: null
    },
    emailVerificationExpires: {
        type: Date,
        default: null
    },
    gender: {
        type: String,
        required: false,
        enum: ['남', '여']
    },
    referral: {
        type: String,
        required: false
    },
    gold: {
        type: Number,
        default: 1000
    },
    level: {
        type: Number,
        default: 1
    },
    exp: {
        type: Number,
        default: 0
    },
    lastDaily: {
        type: String,
        default: null
    },
    lastWork: {
        type: Number,
        default: 0
    },
    attendanceStreak: {
        type: Number,
        default: 0
    },
    weeklyAttendance: {
        type: [Boolean],
        default: [false, false, false, false, false, false, false]
    },
    weekStart: {
        type: Date,
        default: null
    },
    unlockedAreas: {
        type: [Number],
        default: [1] // 1번 지역(꽃잎 마을)부터 시작
    },
    lastHunt: {
        type: Number,
        default: 0
    },
    huntingArea: {
        type: Number,
        default: 0
    },
    registered: {
        type: Boolean,
        default: false
    },
    registeredAt: {
        type: Date,
        default: null
    },
    popularity: {
        type: Number,
        default: 0
    },
    dailyPopularityGain: {
        type: Number,
        default: 0
    },
    dailyPopularityLoss: {
        type: Number,
        default: 0
    },
    lastPopularityReset: {
        type: String,
        default: null
    },
    lastPopularityUpdate: {
        type: Date,
        default: null
    },
    popularityHistory: [{
        messageId: String,
        emoji: String,
        value: Number,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    stats: {
        strength: { type: Number, default: 10 },
        agility: { type: Number, default: 10 },
        intelligence: { type: Number, default: 10 },
        vitality: { type: Number, default: 10 },
        luck: { type: Number, default: 10 }
    },
    statPoints: {
        type: Number,
        default: 0
    },
    skills: [{
        id: String,
        name: String,
        level: { type: Number, default: 1 },
        exp: { type: Number, default: 0 }
    }],
    inventory: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, required: true },
        rarity: { type: String, required: true },
        setName: { type: String, required: true },
        level: { type: Number, default: 1 }, // 아이템 착용 가능 레벨
        quantity: { type: Number, default: 1 },
        enhanceLevel: { type: Number, default: 0 }, // 강화 단계 (0~30성)
        stats: {
            attack: { type: Number, default: 0 },
            defense: { type: Number, default: 0 },
            dodge: { type: Number, default: 0 },
            luck: { type: Number, default: 0 }
        },
        price: { type: Number, default: 0 },
        description: { type: String, default: '' },
        equipped: { type: Boolean, default: false }, // 장착 여부
        inventorySlot: { type: Number, required: false }, // 인벤토리 슬롯 번호
        randomOptions: [{ // 랜덤 추가 옵션
            name: { type: String },
            type: { type: String },
            value: { type: Number },
            displayValue: { type: String }
        }]
    }],
    maxInventorySlots: { type: Number, default: 50 }, // 인벤토리 최대 슬롯
    equipment: {
        weapon: { type: Number, default: -1 }, // 인벤토리 슬롯 번호 (-1은 미착용)
        armor: { type: Number, default: -1 },
        helmet: { type: Number, default: -1 },
        gloves: { type: Number, default: -1 },
        boots: { type: Number, default: -1 },
        accessory: { type: Number, default: -1 }
    },
    protectionScrolls: { type: Number, default: 0 }, // 보호권 개수
    enhancementLevel: {
        type: Number,
        default: 0
    },
    // 강화 통계
    enhanceStats: {
        totalAttempts: { type: Number, default: 0 }, // 총 강화 시도 횟수
        totalCost: { type: Number, default: 0 }, // 총 사용 골드
        destroyCount: { type: Number, default: 0 }, // 파괴 횟수
        successCount: { type: Number, default: 0 }, // 성공 횟수
        maxEnhanceLevel: { type: Number, default: 0 } // 최고 강화 단계
    },
    // 엠블럼 시스템
    emblem: {
        type: String,
        default: null // null이면 엠블럼 없음, 문자열이면 엠블럼 이름
    },
    // 레이싱 통계
    racingStats: {
        totalRaces: { type: Number, default: 0 }, // 총 참가 횟수
        wins: { type: Number, default: 0 }, // 우승 횟수
        totalWinnings: { type: Number, default: 0 }, // 총 획득 상금
        totalSpent: { type: Number, default: 0 }, // 총 베팅 금액
        longestWinStreak: { type: Number, default: 0 }, // 최장 연승
        currentWinStreak: { type: Number, default: 0 }, // 현재 연승
        biggestWin: { type: Number, default: 0 }, // 최대 상금
        lastRaceDate: { type: Date, default: null } // 마지막 레이스 참가일
    },
    // 에너지 조각 시스템
    energyFragments: {
        fragments: { type: Map, of: Number, default: new Map() }, // 단계별 조각 보유량 (key: 단계, value: 개수)
        lastMine: { type: Date, default: null }, // 마지막 채굴 시간
        dailyFusions: { type: Number, default: 0 }, // 오늘 융합 횟수
        dailyFusionDate: { type: String, default: null }, // 융합 횟수 날짜
        totalFusions: { type: Number, default: 0 }, // 총 융합 시도
        successfulFusions: { type: Number, default: 0 }, // 성공한 융합
        failureStack: { type: Number, default: 0 }, // 실패 스택
        highestLevel: { type: Number, default: 0 }, // 최고 달성 레벨
        fusionTickets: { type: Number, default: 0 }, // 무제한 융합권
        permanentSuccessBonus: { type: Number, default: 0 }, // 영구 성공률 보너스
        weeklyRankingBonus: { type: Number, default: 0 }, // 주간 랭킹 보너스
        consecutiveSuccess: { type: Number, default: 0 }, // 연속 성공
        totalInvested: { type: Number, default: 0 }, // 총 투자 골드
        godBlessingUsed: { type: Date, default: null } // 강화신의 축복 사용일
    },
    // PVP 시스템
    pvp: {
        rating: { type: Number, default: 1000 }, // ELO 레이팅
        tier: { type: String, default: 'Bronze' }, // 티어
        division: { type: Number, default: 5 }, // 티어 내 등급 (5-1)
        duelTickets: { type: Number, default: 20 }, // 결투권
        lastTicketRegen: { type: Date, default: null }, // 마지막 티켓 충전 시간
        lastDuelDate: { type: String, default: null }, // 마지막 결투 날짜
        totalDuels: { type: Number, default: 0 }, // 총 결투 횟수
        wins: { type: Number, default: 0 }, // 승리 횟수
        losses: { type: Number, default: 0 }, // 패배 횟수
        winStreak: { type: Number, default: 0 }, // 연승
        maxWinStreak: { type: Number, default: 0 }, // 최고 연승
        seasonWins: { type: Number, default: 0 }, // 시즌 승리
        seasonLosses: { type: Number, default: 0 }, // 시즌 패배
        highestRating: { type: Number, default: 1000 }, // 최고 레이팅
        lastMatchTime: { type: Date, default: null }, // 마지막 매치 시간
        matchHistory: [{ // 최근 10경기 기록
            opponent: String, // 상대방 닉네임
            opponentRating: Number, // 상대방 레이팅
            result: String, // 'win' or 'lose'
            ratingChange: Number, // 레이팅 변화량
            date: { type: Date, default: Date.now }
        }],
        // PVP 전용 강화 시스템
        attackEnhancement: {
            high: { type: Number, default: 0 }, // 별똥베기 강화 (0~30)
            middle: { type: Number, default: 0 }, // 슈가스팅 강화 (0~30)
            low: { type: Number, default: 0 } // 버섯팡 강화 (0~30)
        },
        pvpEnhanceHistory: {
            totalAttempts: { type: Number, default: 0 }, // 총 강화 시도
            totalGoldUsed: { type: Number, default: 0 }, // 사용한 골드
            destroyCount: { type: Number, default: 0 }, // 파괴 횟수
            maxLevel: { type: Number, default: 0 } // 최고 달성 레벨
        }
    },
    // 홀짝 게임 통계
    oddEvenStats: {
        totalGames: { type: Number, default: 0 }, // 총 게임 횟수
        totalBets: { type: Number, default: 0 }, // 총 베팅 금액
        totalWinnings: { type: Number, default: 0 }, // 총 획득 금액
        wins: { type: Number, default: 0 }, // 승리 횟수
        losses: { type: Number, default: 0 }, // 패배 횟수
        currentStreak: { type: Number, default: 0 }, // 현재 연승/연패
        longestWinStreak: { type: Number, default: 0 }, // 최장 연승
        longestLossStreak: { type: Number, default: 0 }, // 최장 연패
        biggestWin: { type: Number, default: 0 }, // 최대 당첨금
        biggestLoss: { type: Number, default: 0 }, // 최대 손실
        lastPlayDate: { type: Date, default: null }, // 마지막 플레이 날짜
        favoriteNumbers: [{ type: Number }], // 선호하는 숫자들
        luckyNumbers: [{ type: Number }], // 행운의 숫자들 (당첨시 기록)
        recentResults: [{ // 최근 10게임 결과
            number: Number, // 나온 숫자
            bet: String, // 베팅 타입
            amount: Number, // 베팅 금액
            won: Boolean, // 당첨 여부
            payout: Number, // 당첨금
            date: { type: Date, default: Date.now }
        }],
        // 현재 진행 중인 베팅 (중복 베팅용)
        currentBets: [{
            betType: String, // 'odd', 'even', 'small', 'big', 'lucky7', 'jackpot'
            amount: Number,
            targetNumber: Number, // 잭팟용
            timestamp: { type: Date, default: Date.now }
        }]
    },
    // 주식 포트폴리오 시스템
    stockPortfolio: {
        stocks: {
            type: Map,
            of: {
                shares: { type: Number, default: 0 }, // 보유 주식 수
                avgPrice: { type: Number, default: 0 } // 평균 매수가
            },
            default: new Map()
        },
        totalInvested: { type: Number, default: 0 }, // 총 투자금액
        lastUpdate: { type: Date, default: Date.now } // 마지막 업데이트
    },
    // 유물 인벤토리 시스템
    artifacts: [{
        name: { type: String, required: true }, // 유물 이름
        emoji: { type: String, required: true }, // 이모지
        rarity: { type: String, required: true }, // 등급
        value: { type: Number, required: true }, // 판매가치
        baseValue: { type: Number, required: true }, // 기본 가치
        currentPrice: { type: Number, required: true }, // 현재 시세
        priceHistory: [{ // 가격 변동 기록
            price: Number,
            date: { type: Date, default: Date.now }
        }],
        description: { type: String, required: true }, // 설명
        foundDate: { type: Date, default: Date.now }, // 발견일
        company: { type: String, required: false }, // 발견한 회사
        region: { type: String, required: false } // 발견 지역
    }],
    // 유물탐사 통계
    explorationStats: {
        totalExplorations: { type: Number, default: 0 }, // 총 탐사 횟수
        totalInvested: { type: Number, default: 0 }, // 총 투자 금액
        totalEarned: { type: Number, default: 0 }, // 총 수익
        successfulFinds: { type: Number, default: 0 }, // 성공한 발견
        rareFinds: { type: Number, default: 0 }, // 레어 이상 발견
        lastExploration: { type: Date, default: null }, // 마지막 탐사일
        favoriteCompany: { type: String, default: null }, // 선호 회사
        biggestFind: { type: Number, default: 0 } // 최고가 발견품
    },
    // 메뉴 커스터마이징 설정
    menuSettings: {
        menuOrder: {
            type: [String],
            default: ['hunting', 'equipment', 'shop', 'stocks', 'artifacts', 'daily', 'profile']
        },
        favoriteMenus: {
            type: [String], 
            default: []
        },
        hiddenMenus: {
            type: [String],
            default: []
        },
        menuStyle: {
            type: String,
            enum: ['grid', 'list', 'compact'],
            default: 'list'
        }
    },
    // 운동하기 방치형 시스템
    fitness: {
        // 피트니스 스탯 (일반 스탯과 별개)
        stats: {
            strength: { type: Number, default: 1 },      // 근력
            stamina: { type: Number, default: 1 },       // 체력
            flexibility: { type: Number, default: 1 },   // 유연성
            agility: { type: Number, default: 1 },       // 민첩
            mental: { type: Number, default: 1 }         // 정신력
        },
        level: { type: Number, default: 1 },            // 피트니스 레벨
        exp: { type: Number, default: 0 },               // 피트니스 경험치
        
        // 현재 운동 상태
        currentExercise: {
            type: { type: String, default: null },       // 운동 종류
            startTime: { type: Date, default: null },    // 시작 시간
            duration: { type: Number, default: 0 },      // 예정 시간 (밀리초)
            accumulated: { type: Number, default: 0 }    // 누적 시간
        },
        
        // 피로도 시스템
        fatigue: { type: Number, default: 0 },          // 현재 피로도 (0-100)
        lastRecovery: { type: Date, default: Date.now }, // 마지막 회복 시간
        
        // 연속 운동 기록
        streak: { type: Number, default: 0 },           // 연속 일수
        lastExerciseDate: { type: String, default: null }, // 마지막 운동 날짜
        
        // 운동 장비
        equipment: {
            clothes: { type: String, default: 'basic' }, // basic, brand, pro
            shoes: { type: String, default: 'basic' },   // basic, running, pro
            activeBooster: {
                type: { type: String, default: null },   // protein, bcaa, booster
                expiresAt: { type: Date, default: null }
            }
        },
        
        // 운동 통계
        totalExerciseTime: { type: Number, default: 0 }, // 총 운동 시간
        exerciseHistory: [{
            exerciseType: { type: String },              // 운동 종류
            duration: { type: Number },                  // 운동 시간
            rewards: {
                gold: { type: Number },
                exp: { type: Number },
                fitnessExp: { type: Number }
            },
            date: { type: Date, default: Date.now }
        }],
        
        // 운동 잠금 해제
        unlockedExercises: {
            type: [String],
            default: ['pushup', 'jogging', 'stretching'] // 기본 운동
        },
        
        // 헬스장/프리미엄 이용권
        memberships: {
            gym: { 
                active: { type: Boolean, default: false },
                expiresAt: { type: Date, default: null }
            },
            premium: {
                active: { type: Boolean, default: false },
                expiresAt: { type: Date, default: null }
            }
        },
        
        // 일일/주간 목표 진행도
        goals: {
            daily: {
                minutes30: { type: Boolean, default: false },
                minutes60: { type: Boolean, default: false },
                minutes180: { type: Boolean, default: false },
                claimed30: { type: Boolean, default: false },
                claimed60: { type: Boolean, default: false },
                claimed180: { type: Boolean, default: false },
                lastReset: { type: String, default: null }
            },
            weekly: {
                totalMinutes: { type: Number, default: 0 },
                specificExercises: { type: Map, of: Number, default: new Map() },
                startDate: { type: String, default: null }
            }
        }
    }
}, {
    timestamps: true
});

// 장비 및 데이터 무결성 확인 pre-save 미들웨어
userSchema.pre('save', function(next) {
    const equipmentSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
    
    // 장비 슬롯 데이터 타입 확인
    equipmentSlots.forEach(slot => {
        // undefined를 -1로 변환
        if (this.equipment[slot] === undefined || this.equipment[slot] === null) {
            this.equipment[slot] = -1;
        }
        // ObjectId나 다른 객체 타입이면 -1로 변환
        else if (this.equipment[slot] && typeof this.equipment[slot] === 'object') {
            console.log(`[Pre-save] ${this.discordId}의 ${slot} 슬롯 ObjectId 제거: ${this.equipment[slot]} -> -1`);
            this.equipment[slot] = -1;
        }
        // 문자열인 경우 숫자로 변환 시도
        else if (typeof this.equipment[slot] === 'string') {
            const num = parseInt(this.equipment[slot]);
            this.equipment[slot] = isNaN(num) ? -1 : num;
        }
        // 유효하지 않은 슬롯 번호 확인
        else if (typeof this.equipment[slot] === 'number' && this.equipment[slot] !== -1) {
            const item = this.inventory.find(i => i.inventorySlot === this.equipment[slot]);
            if (!item) {
                console.log(`[Pre-save] ${this.discordId}의 ${slot} 슬롯에 해당하는 아이템 없음: ${this.equipment[slot]} -> -1`);
                this.equipment[slot] = -1;
            }
        }
    });
    
    // 인벤토리 아이템의 inventorySlot 확인
    if (this.inventory && Array.isArray(this.inventory)) {
        const usedSlots = new Set();
        const itemsToReassign = [];
        
        // 1단계: 중복 슬롯 검사
        this.inventory.forEach((item, index) => {
            // inventorySlot이 없으면 재할당 필요
            if (item.inventorySlot === undefined || item.inventorySlot === null) {
                itemsToReassign.push(item);
            }
            // 중복된 슬롯이면 재할당 필요
            else if (usedSlots.has(item.inventorySlot)) {
                console.log(`[Pre-save] 중복 슬롯 발견: ${item.name} (슬롯 ${item.inventorySlot})`);
                itemsToReassign.push(item);
            } else {
                usedSlots.add(item.inventorySlot);
            }
            
            // 기본 필드 초기화
            if (item.enhanceLevel === undefined) {
                item.enhanceLevel = 0;
            }
            if (!item.stats) {
                item.stats = { attack: 0, defense: 0, dodge: 0, luck: 0 };
            }
            if (item.equipped === undefined) {
                item.equipped = false;
            }
        });
        
        // 2단계: 새 슬롯 할당
        itemsToReassign.forEach(item => {
            let newSlot = 0;
            while (usedSlots.has(newSlot)) {
                newSlot++;
            }
            item.inventorySlot = newSlot;
            usedSlots.add(newSlot);
            console.log(`[Pre-save] ${item.name}에 새 슬롯 ${newSlot} 할당`);
        });
        
        // 3단계: equipment와 inventory의 equipped 상태 동기화
        // 먼저 모든 아이템의 equipped를 false로 설정
        this.inventory.forEach(item => {
            item.equipped = false;
        });
        
        // equipment 슬롯에 있는 아이템만 equipped = true
        equipmentSlots.forEach(slot => {
            const slotIndex = this.equipment[slot];
            if (slotIndex !== -1 && slotIndex !== null && slotIndex !== undefined) {
                const equippedItem = this.inventory.find(item => item.inventorySlot === slotIndex);
                if (equippedItem) {
                    if (equippedItem.type === slot) {
                        equippedItem.equipped = true;
                    } else {
                        // 잘못된 타입의 아이템이 장착됨
                        console.log(`[Pre-save] ${this.discordId}의 ${slot} 슬롯에 잘못된 타입: ${equippedItem.type}`);
                        this.equipment[slot] = -1;
                    }
                } else {
                    // 장착된 슬롯에 아이템이 없음
                    this.equipment[slot] = -1;
                }
            }
        });
    }
    
    // 출석 데이터 타입 확인
    if (this.lastDaily !== null && typeof this.lastDaily !== 'string') {
        this.lastDaily = this.lastDaily ? this.lastDaily.toString() : null;
    }
    
    // 주간 출석 배열 확인
    if (!Array.isArray(this.weeklyAttendance) || this.weeklyAttendance.length !== 7) {
        this.weeklyAttendance = [false, false, false, false, false, false, false];
    }
    
    next();
});

module.exports = mongoose.model('User', userSchema);