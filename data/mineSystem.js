// 🏔️ 광산 시스템 데이터
const MINE_SYSTEM = {
    // 광산 목록
    mines: {
        beginner: {
            id: 'beginner',
            name: '초보자 광산',
            emoji: '⛏️',
            description: '초보 탐사자를 위한 안전한 광산',
            requiredLevel: 0,
            openSchedule: {
                type: 'always', // always, scheduled, random
                message: '항상 개방'
            },
            difficulty: 1,
            rewardMultiplier: 1,
            specialDrops: [],
            entryFee: 500  // 100 → 500 (기본 보상 1000~3000G 예상)
        },
        crystal: {
            id: 'crystal',
            name: '수정 동굴',
            emoji: '💎',
            description: '아름다운 수정이 가득한 신비로운 동굴',
            requiredLevel: 10,
            openSchedule: {
                type: 'scheduled',
                times: [9, 13, 18, 22], // 하루 4번 개방
                duration: 60, // 60분간 개방
                message: '정기 개방 (9시, 13시, 18시, 22시)'
            },
            difficulty: 2,
            rewardMultiplier: 1.5,
            specialDrops: ['crystal_shard', 'mystic_gem'],
            entryFee: 2000  // 500 → 2000 (보상 3000~8000G 예상)
        },
        ancient: {
            id: 'ancient',
            name: '고대 유적',
            emoji: '🏛️',
            description: '잊혀진 문명의 흔적이 남아있는 고대 유적',
            requiredLevel: 25,
            openSchedule: {
                type: 'random',
                minInterval: 120, // 최소 2시간
                maxInterval: 360, // 최대 6시간
                duration: 30, // 30분간 개방
                message: '불규칙 개방'
            },
            difficulty: 3,
            rewardMultiplier: 2,
            specialDrops: ['ancient_artifact', 'rune_stone'],
            entryFee: 5000  // 2000 → 5000 (보상 8000~20000G 예상)
        },
        volcanic: {
            id: 'volcanic',
            name: '화산 광산',
            emoji: '🌋',
            description: '뜨거운 용암이 흐르는 위험한 광산',
            requiredLevel: 40,
            openSchedule: {
                type: 'event',
                eventTrigger: 'volcanic_activity',
                duration: 30, // 30분간 개방
                message: '화산 활동 시 개방'
            },
            difficulty: 4,
            rewardMultiplier: 3,
            specialDrops: ['lava_gem', 'fire_crystal'],
            entryFee: 15000  // 5000 → 15000 (보상 20000~50000G 예상)
        },
        deepDark: {
            id: 'deepDark',
            name: '심연의 광산',
            emoji: '🕳️',
            description: '빛이 닿지 않는 깊고 어두운 광산',
            requiredLevel: 50,
            openSchedule: {
                type: 'scheduled',
                times: [0, 3, 6], // 새벽 시간대만 개방
                duration: 30,
                message: '심야 개방 (0시, 3시, 6시)'
            },
            difficulty: 5,
            rewardMultiplier: 4,
            specialDrops: ['void_stone', 'darkness_essence'],
            entryFee: 30000  // 10000 → 30000 (보상 40000~80000G 예상)
        },
        legendary: {
            id: 'legendary',
            name: '전설의 광산',
            emoji: '⭐',
            description: '전설 속에만 존재한다는 신비한 광산',
            requiredLevel: 75,
            openSchedule: {
                type: 'rare',
                chance: 0.01, // 1% 확률로 매시간 체크
                duration: 10, // 10분간 개방
                message: '극히 희귀하게 개방'
            },
            difficulty: 6,
            rewardMultiplier: 10,
            specialDrops: ['legendary_ore', 'mythic_crystal'],
            entryFee: 100000  // 50000 → 100000 (보상 200000~500000G 예상)
        },
        dragon: {
            id: 'dragon',
            name: '용의 둥지',
            emoji: '🐉',
            description: '고대 용들이 보물을 숨겨둔 비밀 광산',
            requiredLevel: 120,
            openSchedule: {
                type: 'scheduled',
                times: [12, 20], // 정오와 저녁 8시
                duration: 45,
                message: '용의 시간 (12시, 20시)'
            },
            difficulty: 7,
            rewardMultiplier: 15,
            specialDrops: ['dragon_scale', 'dragon_heart', 'ancient_treasure'],
            entryFee: 250000  // 보상 500000~1500000G 예상
        },
        celestial: {
            id: 'celestial',
            name: '천상의 광산',
            emoji: '🌌',
            description: '하늘에 떠있는 신비로운 광산',
            requiredLevel: 180,
            openSchedule: {
                type: 'random',
                minInterval: 240, // 최소 4시간
                maxInterval: 480, // 최대 8시간
                duration: 20,
                message: '별자리가 일치할 때'
            },
            difficulty: 8,
            rewardMultiplier: 25,
            specialDrops: ['celestial_gem', 'star_fragment', 'divine_ore'],
            entryFee: 500000  // 보상 1000000~3000000G 예상
        },
        abyssal: {
            id: 'abyssal',
            name: '심연의 균열',
            emoji: '🌀',
            description: '차원의 틈새에 숨겨진 금지된 광산',
            requiredLevel: 250,
            openSchedule: {
                type: 'event',
                eventTrigger: 'dimensional_rift',
                duration: 15,
                message: '차원의 균열 발생시'
            },
            difficulty: 9,
            rewardMultiplier: 40,
            specialDrops: ['void_crystal', 'chaos_essence', 'dimensional_ore'],
            entryFee: 1000000  // 보상 2000000~5000000G 예상
        }
    },

    // 광산 개방 이벤트
    events: {
        earthquake: {
            name: '지진',
            emoji: '🫨',
            description: '강력한 지진으로 숨겨진 광맥이 드러났습니다!',
            effect: 'hidden_vein',
            duration: 20,
            rewardBonus: 2
        },
        full_moon: {
            name: '보름달',
            emoji: '🌕',
            description: '보름달의 신비한 기운이 광산을 비춥니다',
            effect: 'moon_blessing',
            duration: 60,
            rewardBonus: 1.5
        },
        meteor_shower: {
            name: '유성우',
            emoji: '☄️',
            description: '하늘에서 떨어진 운석이 새로운 광물을 만들었습니다',
            effect: 'meteor_minerals',
            duration: 30,
            rewardBonus: 3
        },
        volcanic_activity: {
            name: '화산 활동',
            emoji: '🌋',
            description: '화산이 활발해지며 희귀한 광물이 표면으로 올라옵니다',
            effect: 'lava_surge',
            duration: 30,
            rewardBonus: 2.5
        }
    },

    // 광산 상태 메시지
    messages: {
        opening: [
            '⚒️ 광산이 곧 개방됩니다! 준비하세요!',
            '🔔 광산 개방 5분 전입니다!',
            '📢 탐사자 여러분, 광산 입구가 열리고 있습니다!'
        ],
        opened: [
            '✨ 광산이 개방되었습니다! 서둘러 입장하세요!',
            '🎉 광산 탐사가 시작되었습니다!',
            '⛏️ 지금이 기회입니다! 광산으로 향하세요!'
        ],
        closing: [
            '⚠️ 광산이 10분 후 폐쇄됩니다!',
            '🚨 서둘러주세요! 광산이 곧 닫힙니다!',
            '⏰ 마지막 기회! 5분 후 광산이 폐쇄됩니다!'
        ],
        closed: [
            '🚪 광산이 폐쇄되었습니다. 다음 개방을 기다려주세요.',
            '💤 광산이 휴식 중입니다...',
            '🔒 광산 입구가 닫혔습니다.'
        ],
        special: [
            '🌟 특별한 일이 일어났습니다! {event}',
            '💫 놀라운 발견! {event}',
            '🎊 대박! {event}'
        ]
    },

    // 광산별 특수 보상
    specialRewards: {
        crystal_shard: { name: '수정 조각', emoji: '💠', rarity: 'rare' },
        mystic_gem: { name: '신비한 보석', emoji: '🔮', rarity: 'epic' },
        ancient_artifact: { name: '고대 유물', emoji: '🏺', rarity: 'epic' },
        rune_stone: { name: '룬 스톤', emoji: '🪬', rarity: 'legendary' },
        lava_gem: { name: '용암 보석', emoji: '🔥', rarity: 'epic' },
        fire_crystal: { name: '불꽃 수정', emoji: '🔥', rarity: 'legendary' },
        void_stone: { name: '공허의 돌', emoji: '⚫', rarity: 'legendary' },
        darkness_essence: { name: '어둠의 정수', emoji: '🌑', rarity: 'mythic' },
        legendary_ore: { name: '전설의 광석', emoji: '✨', rarity: 'mythic' },
        mythic_crystal: { name: '신화의 수정', emoji: '🌟', rarity: 'mythic' },
        // 고레벨 광산 특수 보상
        dragon_scale: { name: '용의 비늘', emoji: '🐲', rarity: 'mythic' },
        dragon_heart: { name: '용의 심장', emoji: '❤️‍🔥', rarity: 'mythic' },
        ancient_treasure: { name: '고대의 보물', emoji: '💎', rarity: 'mythic' },
        celestial_gem: { name: '천상의 보석', emoji: '💫', rarity: 'mythic' },
        star_fragment: { name: '별의 조각', emoji: '⭐', rarity: 'mythic' },
        divine_ore: { name: '신성한 광석', emoji: '✨', rarity: 'mythic' },
        void_crystal: { name: '공허의 수정', emoji: '🔮', rarity: 'mythic' },
        chaos_essence: { name: '혼돈의 정수', emoji: '🌀', rarity: 'mythic' },
        dimensional_ore: { name: '차원의 광석', emoji: '🌌', rarity: 'mythic' }
    }
};

// 광산 개방 상태 관리
class MineManager {
    constructor() {
        this.openMines = new Map(); // 현재 열린 광산들
        this.schedules = new Map(); // 예약된 개방 스케줄
        this.lastRandomOpen = new Map(); // 마지막 랜덤 개방 시간
        this.dailyEntries = new Map(); // 일일 입장 기록 (초보자 광산용) { userId: { date: count } }
    }

    // 광산이 열려있는지 확인
    isOpen(mineId) {
        const mine = MINE_SYSTEM.mines[mineId];
        if (!mine) return false;

        switch (mine.openSchedule.type) {
            case 'always':
                return true;
            
            case 'scheduled':
                const now = new Date();
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                const currentTimeInMinutes = currentHour * 60 + currentMinute;
                
                // 각 개방 시간 확인
                for (const openHour of mine.openSchedule.times) {
                    const openTimeInMinutes = openHour * 60;
                    const closeTimeInMinutes = openTimeInMinutes + mine.openSchedule.duration;
                    
                    if (currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes) {
                        // 개방 중이면 openMines에 추가
                        if (!this.openMines.has(mineId)) {
                            const closesAt = new Date(now);
                            closesAt.setHours(openHour);
                            closesAt.setMinutes(mine.openSchedule.duration);
                            closesAt.setSeconds(0);
                            
                            this.openMines.set(mineId, {
                                openedAt: Date.now(),
                                closesAt: closesAt.getTime(),
                                event: null,
                                visitors: new Set()
                            });
                        }
                        return true;
                    }
                }
                
                // 개방 시간이 아니면 openMines에서 제거
                if (this.openMines.has(mineId)) {
                    this.openMines.delete(mineId);
                }
                return false;
            
            case 'random':
                // 기존 개방 상태 확인
                if (this.openMines.has(mineId)) {
                    const mineState = this.openMines.get(mineId);
                    if (Date.now() < mineState.closesAt) {
                        return true;
                    } else {
                        this.closeMine(mineId);
                    }
                }
                
                // 마지막 개방 시간 확인 후 다음 개방 시간 결정
                const lastOpen = this.lastRandomOpen.get(mineId) || 0;
                const minInterval = mine.openSchedule.minInterval * 60 * 1000;
                const maxInterval = mine.openSchedule.maxInterval * 60 * 1000;
                const nextInterval = minInterval + Math.random() * (maxInterval - minInterval);
                
                if (Date.now() >= lastOpen + nextInterval) {
                    // 랜덤하게 개방
                    this.openMine(mineId, mine.openSchedule.duration);
                    this.lastRandomOpen.set(mineId, Date.now());
                    return true;
                }
                return false;
            
            case 'event':
                // 이벤트는 수동으로 개방
                return this.openMines.has(mineId);
            
            case 'rare':
                // 기존 개방 상태 확인
                if (this.openMines.has(mineId)) {
                    const mineState = this.openMines.get(mineId);
                    if (Date.now() < mineState.closesAt) {
                        return true;
                    } else {
                        this.closeMine(mineId);
                    }
                }
                
                // 1% 확률로 개방
                if (Math.random() < mine.openSchedule.chance) {
                    this.openMine(mineId, mine.openSchedule.duration);
                    return true;
                }
                return false;
            
            default:
                return false;
        }
    }

    // 광산 개방
    openMine(mineId, duration, event = null) {
        const mine = MINE_SYSTEM.mines[mineId];
        if (!mine) return false;

        const openUntil = Date.now() + (duration * 60 * 1000);
        this.openMines.set(mineId, {
            openedAt: Date.now(),
            closesAt: openUntil,
            event: event,
            visitors: new Set()
        });

        return true;
    }

    // 광산 폐쇄
    closeMine(mineId) {
        this.openMines.delete(mineId);
    }

    // 다음 개방 시간 계산
    getNextOpenTime(mineId) {
        const mine = MINE_SYSTEM.mines[mineId];
        if (!mine) return null;

        switch (mine.openSchedule.type) {
            case 'always':
                return { isOpen: true, nextOpen: null };
            
            case 'scheduled':
                const now = new Date();
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                const currentTimeInMinutes = currentHour * 60 + currentMinute;
                const times = mine.openSchedule.times.sort((a, b) => a - b);
                
                // 현재 개방 중인지 확인
                for (const openHour of times) {
                    const openTimeInMinutes = openHour * 60;
                    const closeTimeInMinutes = openTimeInMinutes + mine.openSchedule.duration;
                    
                    if (currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes) {
                        // 현재 개방 중
                        const closesAt = new Date(now);
                        closesAt.setHours(Math.floor(closeTimeInMinutes / 60));
                        closesAt.setMinutes(closeTimeInMinutes % 60);
                        closesAt.setSeconds(0);
                        return { isOpen: true, closesAt, message: '현재 개방 중' };
                    }
                }
                
                // 다음 개방 시간 찾기
                for (const openHour of times) {
                    const openTimeInMinutes = openHour * 60;
                    if (openTimeInMinutes > currentTimeInMinutes) {
                        const nextOpen = new Date(now);
                        nextOpen.setHours(openHour, 0, 0, 0);
                        return { isOpen: false, nextOpen };
                    }
                }
                
                // 다음날 첫 시간
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(times[0], 0, 0, 0);
                return { isOpen: false, nextOpen: tomorrow };
            
            case 'random':
                const lastOpen = this.lastRandomOpen.get(mineId) || 0;
                const minInterval = mine.openSchedule.minInterval * 60 * 1000;
                const maxInterval = mine.openSchedule.maxInterval * 60 * 1000;
                const nextInterval = minInterval + Math.random() * (maxInterval - minInterval);
                const nextOpen = new Date(lastOpen + nextInterval);
                return { isOpen: false, nextOpen };
            
            case 'event':
                return { isOpen: false, nextOpen: null, message: '특별 이벤트 시 개방' };
            
            case 'rare':
                return { isOpen: false, nextOpen: null, message: '언제 열릴지 알 수 없음' };
            
            default:
                return { isOpen: false, nextOpen: null };
        }
    }

    // 광산 입장 가능 여부 확인 (비동기로 변경)
    async canEnter(userId, mineId) {
        const mineState = this.openMines.get(mineId);
        if (!mineState) return { canEnter: false, reason: '광산이 닫혀있습니다' };
        
        if (Date.now() > mineState.closesAt) {
            this.closeMine(mineId);
            return { canEnter: false, reason: '광산이 막 닫혔습니다' };
        }

        // 초보자 광산 일일 제한 체크 (하루 20회)
        if (mineId === 'beginner') {
            const today = new Date().toDateString();
            const userDailyEntries = this.dailyEntries.get(userId) || {};
            const todayCount = userDailyEntries[today] || 0;
            
            if (todayCount >= 20) {
                return { canEnter: false, reason: '오늘의 초보자 광산 입장 횟수(20회)를 모두 사용했습니다' };
            }
        } else {
            // 다른 광산들은 개방 세션당 1회만 입장 가능
            const MineEntry = require('../models/MineEntry');
            const existingEntry = await MineEntry.findOne({
                userId: userId,
                mineId: mineId,
                sessionId: mineState.openedAt
            });
            
            if (existingEntry) {
                return { canEnter: false, reason: '이번 개방 시간에는 이미 입장했습니다. 다음 개방을 기다려주세요' };
            }
        }

        return { canEnter: true, timeLeft: mineState.closesAt - Date.now() };
    }

    // 광산 입장 기록 (비동기로 변경)
    async recordEntry(userId, mineId) {
        const mineState = this.openMines.get(mineId);
        if (!mineState) return;

        // visitors가 Set이 아닌 경우 Set으로 초기화
        if (!mineState.visitors || !(mineState.visitors instanceof Set)) {
            mineState.visitors = new Set();
        }

        // 초보자 광산 일일 입장 기록
        if (mineId === 'beginner') {
            const today = new Date().toDateString();
            const userDailyEntries = this.dailyEntries.get(userId) || {};
            userDailyEntries[today] = (userDailyEntries[today] || 0) + 1;
            this.dailyEntries.set(userId, userDailyEntries);
        } else {
            // 다른 광산 세션별 입장 기록 (DB에 저장)
            const MineEntry = require('../models/MineEntry');
            try {
                await MineEntry.create({
                    userId: userId,
                    mineId: mineId,
                    sessionId: mineState.openedAt
                });
            } catch (error) {
                console.error('광산 입장 기록 실패:', error);
            }
        }

        // 광산 방문자 기록
        mineState.visitors.add(userId);
    }

    // 일일 입장 기록 초기화 (매일 자정)
    resetDailyEntries() {
        this.dailyEntries.clear();
    }

    // 특정 유저의 오늘 초보자 광산 입장 횟수 조회
    getTodayBeginnerEntries(userId) {
        const today = new Date().toDateString();
        const userDailyEntries = this.dailyEntries.get(userId) || {};
        return userDailyEntries[today] || 0;
    }
    
    // 화산 활동 이벤트 트리거 (관리자용)
    triggerVolcanicEvent(duration = 30) {
        if (!this.openMines.has('volcanic')) {
            this.openMine('volcanic', duration, 'volcanic_activity');
            console.log('🌋 화산 활동 이벤트가 시작되었습니다!');
            return true;
        }
        return false;
    }
    
    // 특별 이벤트 트리거 (관리자용)
    triggerSpecialEvent(eventType, affectedMines = []) {
        const event = MINE_SYSTEM.events[eventType];
        if (!event) return false;
        
        affectedMines.forEach(mineId => {
            const mine = MINE_SYSTEM.mines[mineId];
            if (mine && this.openMines.has(mineId)) {
                const mineState = this.openMines.get(mineId);
                mineState.event = eventType;
                console.log(`✨ ${mine.name}에 ${event.name} 이벤트가 적용되었습니다!`);
            }
        });
        
        return true;
    }
}

// 싱글톤 매니저
const mineManager = new MineManager();

// 상태 저장용
const fs = require('fs');
const path = require('path');

// 광산 상태 저장
function saveMineState() {
    const stateFile = path.join(__dirname, 'mineState.json');
    
    // openMines를 저장 가능한 형태로 변환
    const openMinesArray = Array.from(mineManager.openMines.entries()).map(([mineId, mineState]) => {
        return [mineId, {
            ...mineState,
            visitors: mineState.visitors ? Array.from(mineState.visitors) : []
        }];
    });
    
    const state = {
        openMines: openMinesArray,
        lastRandomOpen: Array.from(mineManager.lastRandomOpen.entries()),
        dailyEntries: Array.from(mineManager.dailyEntries.entries()),
        savedAt: Date.now()
    };
    
    try {
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('[MineSystem] 광산 상태 저장 실패:', error);
    }
}

// 광산 상태 불러오기
function loadMineState() {
    const stateFile = path.join(__dirname, 'mineState.json');
    
    try {
        if (fs.existsSync(stateFile)) {
            const data = fs.readFileSync(stateFile, 'utf8');
            const state = JSON.parse(data);
            
            // 상태 복원
            mineManager.openMines = new Map(state.openMines || []);
            mineManager.lastRandomOpen = new Map(state.lastRandomOpen || []);
            mineManager.dailyEntries = new Map(state.dailyEntries || []);
            
            // visitors를 Set으로 복원
            for (const [mineId, mineState] of mineManager.openMines.entries()) {
                // visitors가 배열로 저장되었을 경우 Set으로 변환
                if (mineState.visitors && Array.isArray(mineState.visitors)) {
                    mineState.visitors = new Set(mineState.visitors);
                } else if (!mineState.visitors || !(mineState.visitors instanceof Set)) {
                    mineState.visitors = new Set();
                }
            }
            
            // 만료된 광산 정리
            const now = Date.now();
            for (const [mineId, mineState] of mineManager.openMines.entries()) {
                if (mineState.closesAt <= now) {
                    mineManager.openMines.delete(mineId);
                }
            }
            
            console.log('[MineSystem] 광산 상태 복원 완료');
        }
    } catch (error) {
        console.error('[MineSystem] 광산 상태 불러오기 실패:', error);
    }
}

// 초기화 시 상태 불러오기
loadMineState();

// 상태 저장 (5분마다)
setInterval(() => {
    saveMineState();
}, 5 * 60 * 1000);

module.exports = {
    MINE_SYSTEM,
    mineManager,
    saveMineState,
    loadMineState
};