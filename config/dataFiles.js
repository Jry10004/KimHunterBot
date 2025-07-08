const path = require('path');

// 환경별 데이터 파일 경로 설정
const getDataFilePath = (fileName) => {
    const basePath = path.join(__dirname, '..');
    // 항상 프로덕션 경로 사용
    return path.join(basePath, 'data', fileName);
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

// 테스트 환경 초기화 - 더 이상 사용하지 않음
const initializeTestDataFolder = () => {
    // 아무것도 하지 않음
};

module.exports = {
    DATA_FILES,
    initializeTestDataFolder,
    getDataFilePath
};