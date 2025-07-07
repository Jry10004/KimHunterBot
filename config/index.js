// 설정 파일 통합 인덱스
const gameConfig = require('./gameConfig');
const constants = require('./constants');
const enhancementConfig = require('./enhancementConfig');

// 환경 변수 검증
function validateEnvironment() {
    const required = [
        'TOKEN',
        'CLIENT_ID',
        'MONGODB_URI'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ 필수 환경 변수가 누락되었습니다:', missing.join(', '));
        process.exit(1);
    }
}

// 설정 병합 함수
function mergeConfig(...configs) {
    return configs.reduce((merged, config) => {
        return { ...merged, ...config };
    }, {});
}

// 설정 가져오기 함수
function getConfig(path) {
    const keys = path.split('.');
    let value = config;
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return undefined;
        }
    }
    
    return value;
}

// 전체 설정 객체
const config = {
    // 기본 설정들
    ...gameConfig,
    
    // 상수
    constants,
    
    // 강화 설정
    enhancement: {
        ...gameConfig.enhancement,
        ...enhancementConfig
    },
    
    // Discord 봇 설정
    discord: {
        token: process.env.TOKEN,
        clientId: process.env.CLIENT_ID,
        intents: [
            'Guilds',
            'GuildMessages',
            'MessageContent',
            'GuildMessageReactions',
            'DirectMessages',
            'GuildMembers'
        ]
    },
    
    // 데이터베이스 설정
    database: {
        uri: process.env.MONGODB_URI,
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
    },
    
    // API 설정
    api: {
        weather: {
            enabled: true,
            updateInterval: 30 * 60 * 1000 // 30분
        },
        stock: {
            enabled: true,
            updateInterval: 5 * 60 * 1000 // 5분
        },
        news: {
            enabled: true,
            generateInterval: 15 * 60 * 1000 // 15분
        }
    },
    
    // 웹 서버 설정
    webServer: {
        port: process.env.PORT || 3000,
        enabled: true
    }
};

// 헬퍼 함수들 내보내기
module.exports = {
    config,
    getConfig,
    validateEnvironment,
    
    // 자주 사용되는 설정들 직접 내보내기
    gameConfig: config.game,
    pvpConfig: config.pvp,
    dungeonConfig: config.dungeon,
    shopConfig: config.shop,
    economyConfig: config.economy,
    miniGamesConfig: config.miniGames,
    channelsConfig: config.channels,
    securityConfig: config.security,
    
    // 상수들
    ADMIN_IDS: constants.ADMIN_IDS,
    DEV_MODE: constants.DEV_MODE,
    
    // 유틸리티 함수
    isAdmin: (userId) => constants.ADMIN_IDS.includes(userId),
    isDevelopment: () => constants.DEV_MODE,
    
    // 설정 업데이트 함수 (런타임 변경용)
    updateConfig: (path, value) => {
        const keys = path.split('.');
        let target = config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }
        
        target[keys[keys.length - 1]] = value;
        console.log(`✅ 설정 업데이트: ${path} = ${JSON.stringify(value)}`);
    }
};