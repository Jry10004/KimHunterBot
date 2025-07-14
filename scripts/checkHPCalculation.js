const fs = require('fs');
const path = require('path');

// 데이터 파일 로드
const statePath = path.join(__dirname, '../data/dogBotRescueState.json');
const stateData = JSON.parse(fs.readFileSync(statePath, 'utf8'));

console.log('📊 댕댕봇 구출 이벤트 HP 계산 검증\n');

// 3층 데이터
const floor3MaxHP = 240000;
const floor3CurrentHP = stateData.floors['3'].currentHP;

console.log(`3층 체력 정보:`);
console.log(`- 최대 HP: ${floor3MaxHP.toLocaleString()}`);
console.log(`- 현재 HP: ${floor3CurrentHP.toLocaleString()}`);
console.log(`- HP 퍼센트: ${((floor3CurrentHP / floor3MaxHP) * 100).toFixed(2)}%`);
console.log(`- 받은 데미지: ${(floor3MaxHP - floor3CurrentHP).toLocaleString()}`);

// 공격 로그에서 3층 총 데미지 계산
const floor3Damage = stateData.statistics.attackLog
    .filter(log => log.floor === 3)
    .reduce((sum, log) => sum + log.damage, 0);

console.log(`\n공격 로그 검증:`);
console.log(`- 3층 총 데미지 (로그): ${floor3Damage.toLocaleString()}`);
console.log(`- 예상 남은 HP: ${(floor3MaxHP - floor3Damage).toLocaleString()}`);
console.log(`- 실제 남은 HP: ${floor3CurrentHP.toLocaleString()}`);
console.log(`- 차이: ${Math.abs((floor3MaxHP - floor3Damage) - floor3CurrentHP).toLocaleString()}`);

// 전체 층 정보
console.log(`\n전체 층 현황:`);
for (let i = 1; i <= 5; i++) {
    const floor = stateData.floors[i.toString()];
    const maxHP = [120000, 180000, 240000, 300000, 360000][i-1];
    const percentage = ((floor.currentHP / maxHP) * 100).toFixed(2);
    console.log(`${i}층: ${floor.currentHP.toLocaleString()} / ${maxHP.toLocaleString()} (${percentage}%)`);
}

// 사용자별 3층 데미지 합계
console.log(`\n3층 사용자별 데미지:`);
const userFloor3Damage = {};
stateData.statistics.attackLog
    .filter(log => log.floor === 3)
    .forEach(log => {
        userFloor3Damage[log.userId] = (userFloor3Damage[log.userId] || 0) + log.damage;
    });

Object.entries(userFloor3Damage)
    .sort((a, b) => b[1] - a[1])
    .forEach(([userId, damage]) => {
        console.log(`- ${userId}: ${damage.toLocaleString()}`);
    });

// 가능한 문제점 확인
console.log(`\n가능한 문제점:`);

// 1. 이전 층 데미지가 포함되었는지 확인
const floor1and2Damage = stateData.statistics.attackLog
    .filter(log => log.floor === 1 || log.floor === 2)
    .reduce((sum, log) => sum + log.damage, 0);

if (floor1and2Damage > 0) {
    console.log(`⚠️  1-2층 데미지가 존재: ${floor1and2Damage.toLocaleString()}`);
}

// 2. 98% 표시가 나올 수 있는 경우 찾기
// 98%가 되려면 남은 HP가 4,800 정도여야 함 (240,000의 2%)
const possibleHP98 = Math.round(floor3MaxHP * 0.02);
console.log(`\n💡 98% 표시가 나오려면 남은 HP가 약 ${possibleHP98.toLocaleString()} 정도여야 합니다.`);

// 백업 파일 체크
console.log(`\n📁 백업 파일 확인:`);
const backupDir = path.join(__dirname, '../backups/dogbot_old_with_duplicates');
if (fs.existsSync(backupDir)) {
    const backupFiles = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 3);
    
    backupFiles.forEach(file => {
        const backupData = JSON.parse(fs.readFileSync(path.join(backupDir, file), 'utf8'));
        const backupFloor3HP = backupData.floors['3'].currentHP;
        const backupPercentage = ((backupFloor3HP / floor3MaxHP) * 100).toFixed(2);
        console.log(`- ${file}: 3층 HP ${backupFloor3HP.toLocaleString()} (${backupPercentage}%)`);
    });
}