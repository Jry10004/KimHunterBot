// 관리자 ID 목록
const ADMIN_IDS = [
    '424480594542592009',   // 요리
    '295980447849250817',   // 하연94
    '1374702838541168650'    // 해물파전 (인프)
];

// 개발 모드 설정
const DEV_MODE = process.env.DEV_MODE === 'true';
const DEV_CHANNEL_IDS = process.env.DEV_CHANNEL_IDS ? process.env.DEV_CHANNEL_IDS.split(',') : [];

module.exports = {
    ADMIN_IDS,
    DEV_MODE,
    DEV_CHANNEL_IDS
};