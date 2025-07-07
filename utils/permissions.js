// 권한 및 채널 확인 유틸리티

const { ADMIN_IDS, DEV_MODE, DEV_CHANNEL_IDS } = require('../config/constants');

// 베타 테스터 확인
function isBetaTester(userId) {
    const betaTesters = ['424480594542592009', '295980447849250817', '592659577384730645'];
    return betaTesters.includes(userId);
}

// 베타 채널 확인
function isBetaChannel(channelId) {
    const betaChannels = ['1195019551406641183'];
    return betaChannels.includes(channelId);
}

// 관리자 채널 확인
function isAdminChannel(channelId) {
    const adminChannels = ['1195019551406641183', '1290664565184401504', '1192510507995529357'];
    return adminChannels.includes(channelId);
}

// 개발자 확인
function isDeveloper(userId) {
    return userId === '424480594542592009';
}

// 프로덕션 테스트 권한 확인
function canUseInProductionTest(userId) {
    const allowedUsers = [
        '424480594542592009', // 개발자
        '295980447849250817', // 테스터1
        '592659577384730645'  // 테스터2
    ];
    return allowedUsers.includes(userId);
}

// 미니게임 채널 확인
function isMinigameChannel(channelId) {
    const minigameChannels = [
        '1195019551406641183', // 베타 채널
        '1290664565184401504', // 관리자 채널
        '1192510507995529357'  // 테스트 채널
    ];
    return minigameChannels.includes(channelId);
}

// 개발 모드에서 사용 가능한 채널인지 확인
function isDevChannel(channelId) {
    if (!DEV_MODE) return true; // 개발 모드가 아니면 모든 채널 허용
    return DEV_CHANNEL_IDS.includes(channelId);
}

module.exports = {
    isBetaTester,
    isBetaChannel,
    isAdminChannel,
    isDeveloper,
    canUseInProductionTest,
    isMinigameChannel,
    isDevChannel
};