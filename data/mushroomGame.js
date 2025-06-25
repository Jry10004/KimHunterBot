// 🍄 독버섯 게임 시스템 데이터
const MUSHROOM_GAME = {
    // 버섯 종류 정의 (12종류로 확장)
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
            name: '황금황금 럭키버섯',
            emoji: '🟡',
            safeDesc: '금빛으로 빛나는 행운의 버섯! (+보너스 점수)',
            poisonDesc: '가짜 금빛으로 속이는 위험한 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif',
            special: true,
            bonusMultiplier: 2
        },
        rainbow: {
            name: '무지개 프리즘버섯',
            emoji: '🌈',
            safeDesc: '일곱빛깔 무지개색으로 변하는 신비한 버섯!',
            poisonDesc: '색이 뒤틀려 어지러움을 주는 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        lightning: {
            name: '번쩍번쩍 전기버섯',
            emoji: '⚡',
            safeDesc: '전기가 팡팡 터지는 에너지 버섯!',
            poisonDesc: '감전 위험! 검은 번개가 치는 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        ice: {
            name: '얼음얼음 크리스탈버섯',
            emoji: '🧊',
            safeDesc: '시원하고 투명한 얼음 조각 버섯!',
            poisonDesc: '독이 얼어붙은 위험한 얼음 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        fire: {
            name: '활활 불꽃버섯',
            emoji: '🔥',
            safeDesc: '따뜻한 불꽃이 춤추는 버섯!',
            poisonDesc: '검은 불길이 타오르는 위험한 버섯!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif'
        },
        mystery: {
            name: '???미스터리버섯',
            emoji: '❓',
            safeDesc: '정체불명! 먹어봐야 아는 신비한 버섯! (랜덤 효과)',
            poisonDesc: '위험! 알 수 없는 독성 물질이 들어있어요!',
            safeGif: 'kim_hunting3.gif',
            poisonGif: 'kim_hunting4.gif',
            special: true,
            randomEffect: true
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
        botThinkingTime: 2000, // 2초
        revealDelay: 1500, // 1.5초
        matchmakingTimeout: 30000, // 30초 매칭 타임아웃
        minPlayers: 2,
        maxPlayers: 5,
        mushroomsPerRound: 12, // 12개 버섯 고정
        entryFee: 100, // 참가비
        specialMushroomChance: 0.15, // 15% 확률로 특수 버섯
        goldenBonus: 3000, // 황금버섯 보너스
        mysteryBonus: 2000, // 미스터리버섯 보너스
        roundTimeLimit: 15000, // 15초 제한시간
        sabotageItemChance: 0.10, // 10% 확률로 방해 아이템
        shieldDuration: 1, // 1라운드 보호
        streakBonus: 1000, // 연승 보너스
        comebackBonus: 2000 // 역전 보너스
    },

    // 배경 GIF
    backgrounds: {
        gameStart: 'kim_hunting_main.png',
        mushroomSelect: 'kim_hunting_main.png',
        victory: 'kim_hunting_win.gif',
        defeat: 'kim_hunting_lose.gif',
        tournament: 'kim_hunting_main.png',
        teamBattle: 'kim_hunting_main.png'
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

    // 난이도 설정 (라운드별 독버섯 개수) - 12개 버섯 기준
    difficultyByRound: {
        1: { poisonCount: 3, message: '🌱 초급 탐험 (12개 중 독버섯 3개)' },
        2: { poisonCount: 5, message: '🌿 중급 탐험 (12개 중 독버섯 5개)' },
        3: { poisonCount: 7, message: '🌳 고급 탐험 (12개 중 독버섯 7개)' },
        4: { poisonCount: 9, message: '🌲 전문가 탐험 (12개 중 독버섯 9개)' },
        5: { poisonCount: 11, message: '🏔️ 극한 탐험 (12개 중 독버섯 11개!)' }
    },

    // 순위별 보상 분배 (멀티플레이어)
    rewardDistribution: {
        2: [0.7, 0.3], // 2명: 1위 70%, 2위 30%
        3: [0.5, 0.3, 0.2], // 3명: 1위 50%, 2위 30%, 3위 20%
        4: [0.4, 0.3, 0.2, 0.1], // 4명: 1위 40%, 2위 30%, 3위 20%, 4위 10%
        5: [0.35, 0.25, 0.2, 0.15, 0.05] // 5명: 1위 35%, 2위 25%, 3위 20%, 4위 15%, 5위 5%
    },

    // 멀티플레이 특수 아이템
    specialItems: {
        shield: {
            name: '보호막',
            emoji: '🛡️',
            description: '다음 독버섯을 한 번 막아줍니다',
            effect: 'block_poison',
            duration: 1
        },
        sabotage: {
            name: '방해 폭탄',
            emoji: '💣',
            description: '다른 플레이어의 선택지를 2개 감춥니다',
            effect: 'hide_options',
            targetCount: 2
        },
        reveal: {
            name: '투시 안경',
            emoji: '🔍',
            description: '3개의 안전한 버섯 위치를 보여줍니다',
            effect: 'reveal_safe',
            revealCount: 3
        },
        swap: {
            name: '위치 교환',
            emoji: '🔄',
            description: '선택한 플레이어와 위치를 바꿉니다',
            effect: 'swap_position'
        },
        double: {
            name: '2배 버프',
            emoji: '✨',
            description: '이번 라운드 보상을 2배로 받습니다',
            effect: 'double_reward',
            multiplier: 2
        }
    },


    // 토너먼트 설정
    tournamentSettings: {
        entryFee: 500,
        rounds: [
            { name: '예선', players: 8, advance: 4 },
            { name: '준결승', players: 4, advance: 2 },
            { name: '결승', players: 2, advance: 1 }
        ],
        prizePool: {
            1: 0.5,  // 우승 50%
            2: 0.3,  // 준우승 30%
            3: 0.2   // 3-4위 각 10%
        }
    },

    // 이모티콘 반응
    reactions: {
        taunt: ['😏', '😎', '🤭', '😈'],
        fear: ['😱', '😨', '🫨', '😰'],
        celebrate: ['🎉', '🥳', '💪', '🔥'],
        angry: ['😡', '🤬', '😤', '💢']
    },

    // 연승/특수 업적 보너스
    achievements: {
        firstBlood: { name: '첫 생존', bonus: 500 },
        survivor: { name: '끝까지 생존', bonus: 2000 },
        perfectRun: { name: '무피해 클리어', bonus: 5000 },
        comeback: { name: '대역전', bonus: 3000 },
        mushroomMaster: { name: '버섯 마스터', bonus: 10000 }
    }
};

module.exports = MUSHROOM_GAME;