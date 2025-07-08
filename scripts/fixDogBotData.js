const fs = require('fs');
const path = require('path');

// 직접 파일을 읽고 수정
const dataPath = path.join(__dirname, '../data/dogBotRescueState.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('병합 전 데이터:');
console.log('1282609444151681186:', {
    damage: data.statistics.userDamage['1282609444151681186'],
    attacks: data.statistics.userAttackCount['1282609444151681186']
});
console.log('424480594542592009:', {
    damage: data.statistics.userDamage['424480594542592009'],
    attacks: data.statistics.userAttackCount['424480594542592009']
});

// 데이터 병합
const oldId = '1282609444151681186';
const newId = '424480594542592009';

// 데미지 병합
data.statistics.userDamage[newId] = 
    (data.statistics.userDamage[newId] || 0) + 
    (data.statistics.userDamage[oldId] || 0);
delete data.statistics.userDamage[oldId];

// 공격 횟수 병합
data.statistics.userAttackCount[newId] = 
    (data.statistics.userAttackCount[newId] || 0) + 
    (data.statistics.userAttackCount[oldId] || 0);
delete data.statistics.userAttackCount[oldId];

// 마지막 공격 시간
const oldTime = data.statistics.lastAttackTime[oldId] || 0;
const newTime = data.statistics.lastAttackTime[newId] || 0;
data.statistics.lastAttackTime[newId] = Math.max(oldTime, newTime);
delete data.statistics.lastAttackTime[oldId];

// participants 배열 정리
data.statistics.participants = data.statistics.participants.filter(id => id !== oldId);

// attackLog 업데이트는 너무 오래된 데이터라 생략 (최근 100개만 유지)

console.log('\n병합 후 데이터:');
console.log('424480594542592009:', {
    damage: data.statistics.userDamage['424480594542592009'],
    attacks: data.statistics.userAttackCount['424480594542592009']
});

// 파일에 저장
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('\n✅ 데이터 병합 완료!');