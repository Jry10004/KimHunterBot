// 🍄 독버섯 게임 시스템 데이터
const MUSHROOM_GAME = {
    // 버섯 종류 정의
    mushroomTypes: {
        slime: {
            name: '방울방울 슬라임버섯',
            emoji: '🔵',
            safeDesc: '투명하고 깨끗한 젤리 버섯이 통통 튀어요!',
            poisonDesc: '검은 기포가 보글보글 끓는 위험한 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        cotton: {
            name: '토실토실 솜버섯',
            emoji: '🤍',
            safeDesc: '포근한 양처럼 폭신폭신한 하얀 버섯!',
            poisonDesc: '회색빛 독가스가 스멀스멀 나오는 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        crystal: {
            name: '반짝반짝 크리스탈버섯',
            emoji: '💎',
            safeDesc: '무지개빛으로 반짝이는 투명한 버섯!',
            poisonDesc: '보라색으로 음산하게 빛나는 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        flower: {
            name: '춤추는 꽃버섯',
            emoji: '🌸',
            safeDesc: '꽃잎이 흔들흔들 춤추는 예쁜 버섯!',
            poisonDesc: '시든 꽃잎이 떨어지는 어두운 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        cloud: {
            name: '통통통 구름버섯',
            emoji: '☁️',
            safeDesc: '솜사탕처럼 둥실둥실 떠다니는 버섯!',
            poisonDesc: '먹구름처럼 검은 연기가 나오는 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        unicorn: {
            name: '별빛별빛 유니콘버섯',
            emoji: '⭐',
            safeDesc: '유니콘 뿔처럼 나선형이고 별빛이 반짝!',
            poisonDesc: '뿔이 부러지고 별빛이 꺼져가는 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        golden: {
            name: '황금버섯',
            emoji: '✨',
            safeDesc: '황금빛으로 빛나는 특별한 버섯! 보너스 골드를 획득합니다!',
            poisonDesc: '황금빛 독가스가 나오는 위험한 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        mystery: {
            name: '미스터리버섯',
            emoji: '❓',
            safeDesc: '신비로운 기운이 감도는 버섯! 랜덤 보너스를 획득합니다!',
            poisonDesc: '알 수 없는 독소가 퍼지는 위험한 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        }
    },

    // 봇 캐릭터 정의
    botCharacters: {
        coward: {
            name: '겁쟁이 봇',
            emoji: '😨',
            description: '항상 1→2→3 순서로 선택하는 소심한 봇',
            strategy: 'sequential',
            pattern: [1, 2, 3, 4, 5, 6]
        },
        intuition: {
            name: '직감 봇',
            emoji: '🎲',
            description: '완전 랜덤으로 선택하는 운빨 봇',
            strategy: 'random'
        },
        analyst: {
            name: '분석가 봇',
            emoji: '🧐',
            description: '가장 안전해 보이는 번호를 선택하는 영리한 봇',
            strategy: 'safe_guess'
        },
        adventurer: {
            name: '모험가 봇',
            emoji: '🏃',
            description: '가장 위험해 보이는 번호에 도전하는 용감한 봇',
            strategy: 'dangerous_guess'
        }
    },

    // 게임 설정
    gameSettings: {
        maxRounds: 5,
        baseReward: 1000,
        survivalBonus: 500,
        perfectBonus: 5000,
        botThinkingTime: 3000, // 3초
        revealDelay: 1500, // 1.5초
        matchmakingTimeout: 30000, // 30초 매칭 타임아웃
        mushroomsPerRound: 12, // 라운드당 버섯 개수
        specialMushroomChance: 0.1, // 특수 버섯 등장 확률
        goldenBonus: 2000, // 황금버섯 보너스
        mysteryBonus: 3000, // 미스터리버섯 최대 보너스
        entryFee: 1000, // 멀티플레이어 참가비
        minPlayers: 2, // 최소 플레이어 수
        maxPlayers: 4, // 최대 플레이어 수
        winnerPercentage: 70, // 우승자 상금 비율
        streakBonus: 100, // 연승 보너스
        sabotageItemChance: 0.1 // 아이템 획득 확률
    },

    // 배경 GIF
    backgrounds: {
        gameStart: 'kim_hunting_main.png',
        mushroomSelect: 'kim_hunting_main.png',
        victory: 'kim_hunting_win.gif',
        defeat: 'kim_hunting_lose.gif'
    },

    // 효과 GIF
    effects: {
        gameStart: 'kim_hunting.gif',
        poisonDeath: 'kim_hunting_lose.gif',
        safeSparkle: 'kim_hunting_win.gif',
        victory: 'kim_hunting_win.gif',
        thinking: 'kim_hunting2.gif'
    },

    // 게임 메시지
    messages: {
        gameStart: '🍄 김헌터의 신비한 숲 탐험이 시작됩니다!',
        selectPrompt: '❓ 어떤 버섯을 선택하시겠습니까?',
        poisonSelected: '💀 독버섯을 선택하셨습니다!',
        safeSelected: '✨ 안전한 버섯입니다!',
        botThinking: '🤔 봇이 고민하고 있습니다...',
        gameOver: '🎮 게임이 종료되었습니다!',
        perfectVictory: '🏆 완벽한 승리! 모든 라운드를 통과했습니다!',
        survivalVictory: '🎉 생존 성공! {rounds}라운드를 통과했습니다!'
    },

    // 난이도 설정 (라운드별 독버섯 개수)
    difficultyByRound: {
        1: { poisonCount: 1, message: '🌱 초급 탐험 (독버섯 1개)' },
        2: { poisonCount: 2, message: '🌿 중급 탐험 (독버섯 2개)' },
        3: { poisonCount: 3, message: '🌳 고급 탐험 (독버섯 3개)' },
        4: { poisonCount: 4, message: '🌲 전문가 탐험 (독버섯 4개)' },
        5: { poisonCount: 5, message: '🏔️ 극한 탐험 (독버섯 5개)' }
    }
};

module.exports = MUSHROOM_GAME;