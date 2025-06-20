// 환경별 설정 관리
const environments = {
    // 개발 환경 (테스트 서버)
    development: {
        name: '김헌터 (개발)',
        botStatus: '🔧 개발 중',
        features: {
            debugMode: true,
            errorDetails: true,
            testCommands: true,
            autoRestart: true
        }
    },
    
    // 베타 환경 (클로즈 베타)
    beta: {
        name: '김헌터 (베타)',
        botStatus: '🧪 베타 테스트',
        features: {
            debugMode: false,
            errorDetails: true,
            testCommands: false,
            autoRestart: true
        }
    },
    
    // 프로덕션 환경 (정식 서비스)
    production: {
        name: '김헌터',
        botStatus: '🎮 서비스 중',
        features: {
            debugMode: false,
            errorDetails: false,
            testCommands: false,
            autoRestart: true
        }
    }
};

// 현재 환경 가져오기
function getEnvironment() {
    const env = process.env.ENV_TYPE || 'development';
    return environments[env] || environments.development;
}

module.exports = {
    environments,
    getEnvironment,
    isDevelopment: () => process.env.ENV_TYPE === 'development',
    isBeta: () => process.env.ENV_TYPE === 'beta',
    isProduction: () => process.env.ENV_TYPE === 'production'
};