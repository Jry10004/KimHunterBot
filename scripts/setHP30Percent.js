const fs = require('fs');
const path = require('path');

// HP를 30%로 고정
const dataPath = path.join(__dirname, '../data/dogBotRescueState.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 3층 HP를 30%로 설정
data.floors['3'].currentHP = 72000;

// 파일 저장
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log('✅ 3층 HP를 30%로 설정했습니다: 72,000 / 240,000');

// dogBotStateManager의 파일 감시 비활성화를 위해 파일 시간 업데이트
const now = new Date();
fs.utimesSync(dataPath, now, now);