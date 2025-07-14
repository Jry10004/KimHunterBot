const fs = require('fs');
const path = require('path');

// 현재 데이터 확인
const dataPath = path.join(__dirname, '../data/dogBotRescueState.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('🔍 공격 횟수 디버깅\n');

console.log('📊 현재 userAttackCount:');
Object.entries(data.statistics.userAttackCount).forEach(([userId, count]) => {
    console.log(`- ${userId}: ${count}회`);
});

console.log('\n📊 현재 userDamage:');
Object.entries(data.statistics.userDamage).forEach(([userId, damage]) => {
    const count = data.statistics.userAttackCount[userId] || 0;
    const avg = count > 0 ? Math.floor(damage / count) : 0;
    console.log(`- ${userId}: ${damage.toLocaleString()} 데미지 (${count}회, 평균 ${avg})`);
});

// 공격 로그에서 실제 카운트 계산
console.log('\n📊 공격 로그 기반 실제 횟수:');
const actualCounts = {};
data.statistics.attackLog.forEach(log => {
    actualCounts[log.userId] = (actualCounts[log.userId] || 0) + 1;
});

Object.entries(actualCounts).forEach(([userId, count]) => {
    const recorded = data.statistics.userAttackCount[userId] || 0;
    const match = recorded === count ? '✅' : '❌';
    console.log(`- ${userId}: 실제 ${count}회, 기록 ${recorded}회 ${match}`);
});

// 불일치 확인
console.log('\n⚠️  불일치 항목:');
let hasIssue = false;
Object.entries(actualCounts).forEach(([userId, actualCount]) => {
    const recordedCount = data.statistics.userAttackCount[userId] || 0;
    if (actualCount !== recordedCount) {
        console.log(`- ${userId}: 실제 ${actualCount}회 ≠ 기록 ${recordedCount}회`);
        hasIssue = true;
    }
});

// userDamage에는 있지만 userAttackCount에 없는 유저
Object.keys(data.statistics.userDamage).forEach(userId => {
    if (!data.statistics.userAttackCount[userId]) {
        console.log(`- ${userId}: userDamage에만 존재 (공격횟수 누락)`);
        hasIssue = true;
    }
});

if (!hasIssue) {
    console.log('✅ 모든 데이터가 일치합니다.');
}

// 최근 공격 확인
console.log('\n📅 최근 공격 (최근 5개):');
const recentAttacks = data.statistics.attackLog.slice(-5);
recentAttacks.forEach(log => {
    const date = new Date(log.timestamp);
    console.log(`- ${log.userId}: ${log.damage} 데미지 (${date.toLocaleString()})`);
});