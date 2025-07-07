const fs = require('fs');
const path = require('path');

// 하연94의 500레벨 데이터 복구
const hayeonData = {
    "295980447849250817": {
        "points": 2550000,  // 500레벨 기준 포인트 (대략적으로 계산)
        "attempts": 8500,
        "currentItem": {
            "name": "🌟 전설의 무기",
            "emoji": "🌟",
            "baseSuccess": 95,
            "difficulty": "legendary",
            "maxLevel": 999
        },
        "currentLevel": 500,
        "successStreak": 1,
        "failStreak": 0,
        "achievements": [
            "firstTry",
            "lucky7",
            "persistence",
            "legendary500"
        ],
        "lastAttempt": Date.now(),
        "dailyAttempts": 100,
        "lastDailyReset": new Date().toDateString()
    }
};

// 기존 데이터 읽기
const dataPath = path.join(__dirname, '..', 'prelaunchEventData.json');
let existingData = {};

try {
    existingData = require(dataPath);
} catch (error) {
    console.log('기존 데이터가 없습니다. 새로 생성합니다.');
}

// 하연94 데이터 업데이트
existingData["295980447849250817"] = hayeonData["295980447849250817"];

// 파일에 저장
fs.writeFileSync(dataPath, JSON.stringify(existingData, null, 2));

console.log('✅ 하연94의 500레벨 사전강화 데이터가 복구되었습니다.');
console.log('포인트:', hayeonData["295980447849250817"].points);
console.log('레벨:', hayeonData["295980447849250817"].currentLevel);