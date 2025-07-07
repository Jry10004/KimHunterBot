// 상태 관리자 import
const stateManager = require('../systems/dogBotStateManager');

// 댕댕봇 구출 이벤트 데이터
const DOGBOT_RESCUE_EVENT = {
    // 이벤트 상태는 stateManager에서 관리
    get status() {
        return stateManager.state.status;
    },
    set status(value) {
        stateManager.state.status = value;
        stateManager.saveState();
    },
    
    // 층별 데이터
    floors: {
        1: {
            name: 'SyntaxError의 문',
            emoji: '🔴',
            maxHP: 120000,  // 120k
            currentHP: 120000,
            description: '문법 오류로 가득한 첫 번째 관문',
            color: '#FF6B6B',
            bossQuote: '"세미콜론 하나로도 막을 수 있다!"'
        },
        2: {
            name: 'StackOverflow의 늪',
            emoji: '🟠',
            maxHP: 180000,  // 180k
            currentHP: 180000,
            description: '무한 재귀의 늪에 빠진 두 번째 관문',
            color: '#FFA500',
            bossQuote: '"스택이 넘쳐흐른다... 넘쳐흘러..."'
        },
        3: {
            name: 'NullPointer의 함정',
            emoji: '🟡',
            maxHP: 240000,  // 240k
            currentHP: 240000,
            description: 'null과 undefined가 춤추는 세 번째 관문',
            color: '#FFD700',
            bossQuote: '"Cannot read property of null!"'
        },
        4: {
            name: '무한 루프의 미로',
            emoji: '🟣',
            maxHP: 300000,  // 300k
            currentHP: 300000,
            description: 'while(true)가 지배하는 네 번째 관문',
            color: '#9370DB',
            bossQuote: '"탈출구는 없다... break도 없다..."'
        },
        5: {
            name: '개발자의 방',
            emoji: '🔵',
            maxHP: 360000,  // 360k
            currentHP: 360000,
            description: '최종 보스 개발자가 기다리는 마지막 관문',
            color: '#FF1493',
            bossQuote: '"제발... 좀 쉬게 해줘... 버그 리포트가 1000개야..."'
        }
    },
    
    // 공격 설정
    attack: {
        cooldown: 10 * 60 * 1000, // 10분 (캐주얼 플레이)
        baseDamage: {
            min: 100,
            max: 200
        },
        criticalChance: 10, // 10% 확률
        criticalMultiplier: 2,
        
        // 사전강화 무기별 데미지 보너스
        weaponDamage: {
            '🗡️ 나무 검': { min: 10, max: 20 },
            '⚔️ 강철 검': { min: 30, max: 50 },
            '🗡️ 미스릴 검': { min: 60, max: 100 },
            '🔥 화염의 검': { min: 100, max: 150 },
            '❄️ 빙결의 검': { min: 100, max: 150 },
            '⚡ 번개의 창': { min: 150, max: 200 },
            '🏹 바람의 활': { min: 80, max: 180 },
            '🛡️ 수호자의 방패': { min: 50, max: 100 },
            '🌟 전설의 무기': { min: 200, max: 300 }
        }
    },
    
    // 인질 시스템
    hostage: {
        checkInterval: 12 * 60 * 60 * 1000, // 12시간마다 (하루 2번)
        responseTime: 10 * 60 * 1000, // 10분 응답 시간
        healAmount: 5000, // 실패 시 회복량
        activeHostages: new Map(), // userId -> { startTime, responded }
        sleepStartHour: 0, // 수면 시작 시간 (오전 12시)
        sleepEndHour: 9, // 수면 종료 시간 (오전 9시)
        channelId: '1386447256408035399' // 이벤트 채널
    },
    
    // 보상 (현재 보상 없음)
    rewards: {
        perFloor: {
            1: { gold: 0, exp: 0, item: null },
            2: { gold: 0, exp: 0, item: null },
            3: { gold: 0, exp: 0, item: null },
            4: { gold: 0, exp: 0, item: null },
            5: { gold: 0, exp: 0, item: null }
        },
        titles: {
            participant: '댕댕봇 구조대',
            mvp: '버그 헌터',
            hostage: '디버깅의 제물',
            firstBlood: '첫 타격',
            lastHit: '마지막 일격'
        }
    },
    
    // 이벤트 메시지
    messages: {
        start: [
            '🚨 **긴급 속보!**',
            '댕댕봇이 납치되었습니다!',
            '',
            '📹 CCTV 영상 분석 결과...',
            '개발자가 댕댕봇을 끌고 가는 모습이 포착되었습니다!',
            '',
            '📝 현장에서 발견된 메모:',
            '*"유저들이 너무 똑똑해져서... 버그를 너무 빨리 찾아내..."*',
            '*"나도 좀 쉬고 싶다... 제발..."*',
            '',
            '🏰 댕댕봇은 **5층 디버그 타워**에 갇혀있습니다!',
            '`/댕댕봇납치` 명령어로 구출 작전에 참여하세요!'
        ],
        
        floorClear: {
            1: '🎉 첫 번째 관문 돌파! SyntaxError가 수정되었습니다!',
            2: '🎉 두 번째 관문 돌파! Stack이 정상화되었습니다!',
            3: '🎉 세 번째 관문 돌파! Null이 정의되었습니다!',
            4: '🎉 네 번째 관문 돌파! 무한 루프를 탈출했습니다!',
            5: '🎊 댕댕봇 구출 성공! 개발자가 항복했습니다!'
        },
        
        dogBotMessages: [
            '멍멍! 여기야! 구해줘! 🐕',
            '왈왈... 수학 문제 내고 싶어... 😢',
            '힘내세요! 조금만 더! 🐕',
            '개발자가 커피만 마시고 있어요... 😭'
        ],
        
        developerQuotes: {
            high: [
                '하하! 이 정도로는 부족해!',
                '버그의 힘을 얕보지 마라!',
                '커피 한 잔 더 마실 시간이군.',
                'try-catch로 다 막아버리겠어!',
                '아직 내 버그는 999개나 남았다!'
            ],
            medium: [
                '음... 생각보다 빠르네?',
                '조금 불안해지는군...',
                '혹시 내 코드에 버그가...?',
                '스택오버플로우에 질문 좀 올려볼까...',
                '이상하다... 로컬에선 잘 됐는데...'
            ],
            low: [
                '아니... 벌써 여기까지?!',
                '제발... 조금만 더 쉬게...',
                '커피가... 떨어져간다...',
                'npm install 하는 중... 99%에서 멈춤...',
                '마지막 커밋 메시지가... "fix: 임시 수정"...'
            ]
        },
        
        // 콤보 메시지
        comboMessages: {
            2: '🔥 2연속 공격! 댕댕봇이 신나합니다!',
            3: '⚡ 3연속 콤보! 개발자가 당황하기 시작합니다!',
            5: '💥 5연속 콤보! 버그가 흔들리고 있습니다!',
            10: '🌟 10연속 대박 콤보! 댕댕봇이 춤을 춥니다!'
        },
        
        // 특별 이벤트 메시지
        specialEvents: {
            firstBlood: '🩸 **퍼스트 블러드!** 첫 타격을 가했습니다!',
            halfHP: '💔 **절반의 체력!** 보스가 흔들리기 시작합니다!',
            lowHP: '💀 **위기의 보스!** 곧 쓰러질 것 같습니다!',
            nearDeath: '⚠️ **최후의 발악!** 보스가 마지막 힘을 쥐어짜고 있습니다!'
        }
    },
    
    // 통계는 stateManager에서 관리
    get statistics() {
        return stateManager.state.statistics;
    },
    set statistics(value) {
        stateManager.state.statistics = value;
        stateManager.saveState();
    }
};

// 데미지 계산 함수
function calculateDamage(baseMin, baseMax, weaponData, enhanceLevel = 0) {
    const base = Math.floor(Math.random() * (baseMax - baseMin + 1)) + baseMin;
    const weaponBonus = weaponData ? 
        Math.floor(Math.random() * (weaponData.max - weaponData.min + 1)) + weaponData.min : 0;
    const enhanceBonus = enhanceLevel * 10; // 강화 레벨당 10 추가 데미지
    
    const total = base + weaponBonus + enhanceBonus;
    const isCritical = Math.random() * 100 < DOGBOT_RESCUE_EVENT.attack.criticalChance;
    
    return {
        damage: isCritical ? total * DOGBOT_RESCUE_EVENT.attack.criticalMultiplier : total,
        isCritical,
        breakdown: { base, weaponBonus, enhanceBonus }
    };
}

// 현재 층 정보 가져오기
function getCurrentFloor() {
    const { currentFloor } = stateManager.state.status;
    const floorData = { ...DOGBOT_RESCUE_EVENT.floors[currentFloor] };
    // 상태 관리자의 HP 정보와 동기화
    if (stateManager.state.floors && stateManager.state.floors[currentFloor]) {
        floorData.currentHP = stateManager.state.floors[currentFloor].currentHP;
    } else {
        // 기본값 사용
        floorData.currentHP = floorData.maxHP;
    }
    return floorData;
}

// HP 퍼센트 계산
function getHPPercentage(floor) {
    return Math.floor((floor.currentHP / floor.maxHP) * 100);
}

// 진행 바 생성 (던전과 동일한 스타일)
function createProgressBar(percentage, length = 10) {
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;
    return `[${('█'.repeat(filled) + '░'.repeat(empty)).padEnd(length, '░')}] ${percentage}%`;
}

module.exports = {
    DOGBOT_RESCUE_EVENT,
    calculateDamage,
    getCurrentFloor,
    getHPPercentage,
    createProgressBar
};