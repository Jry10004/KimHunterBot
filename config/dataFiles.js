const path = require('path');

// 환경별 데이터 파일 경로 설정
const getDataFilePath = (fileName) => {
    const basePath = path.join(__dirname, '..');
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.BOT_TOKEN === process.env.TEST_BOT_TOKEN;
    
    if (isTestEnv) {
        // 테스트 환경: data/test/ 폴더 사용
        return path.join(basePath, 'data', 'test', fileName);
    } else {
        // 프로덕션 환경: data/ 폴더 직접 사용
        return path.join(basePath, 'data', fileName);
    }
};

// 데이터 파일 경로들
const DATA_FILES = {
    // 댕댕봇 구출 이벤트 상태
    DOGBOT_RESCUE_STATE: () => getDataFilePath('dogBotRescueState.json'),
    
    // 사전강화 이벤트 데이터
    PRELAUNCH_EVENT_DATA: () => path.join(__dirname, '..', 'prelaunchEventData.json'), // 이건 공유
    
    // 카운트다운 상태
    COUNTDOWN_STATE: () => path.join(__dirname, '..', 'countdownState.json'), // 이것도 공유
};

// 테스트 환경 초기화
const initializeTestDataFolder = () => {
    const fs = require('fs');
    const testDataPath = path.join(__dirname, '..', 'data', 'test');
    
    // 테스트 데이터 폴더 생성
    if (!fs.existsSync(testDataPath)) {
        fs.mkdirSync(testDataPath, { recursive: true });
        console.log('📁 테스트 데이터 폴더 생성됨:', testDataPath);
    }
    
    // 필요한 파일들 초기화
    const dogBotTestFile = path.join(testDataPath, 'dogBotRescueState.json');
    if (!fs.existsSync(dogBotTestFile)) {
        const initialState = {
            status: {
                isActive: false,
                startTime: null,
                currentFloor: 1,
                totalFloors: 5,
                rescueComplete: false
            },
            floors: {
                "1": { currentHP: 120000 },
                "2": { currentHP: 180000 },
                "3": { currentHP: 240000 },
                "4": { currentHP: 300000 },
                "5": { currentHP: 360000 }
            },
            statistics: {
                totalAttacks: 0,
                totalDamage: 0,
                participants: [],
                attackLog: [],
                mvp: {},
                floorMVP: {},
                userDamage: {},
                userAttackCount: {},
                lastAttackTime: {}
            },
            hostages: {
                activeHostages: {},
                hostageHistory: []
            }
        };
        fs.writeFileSync(dogBotTestFile, JSON.stringify(initialState, null, 2));
        console.log('📝 테스트 댕댕봇 상태 파일 생성됨');
    }
};

module.exports = {
    DATA_FILES,
    initializeTestDataFolder,
    getDataFilePath
};