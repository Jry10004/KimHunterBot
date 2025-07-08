const fs = require('fs');
const path = require('path');

// 직접 파일을 읽고 수정
const dataPath = path.join(__dirname, '../data/dogBotRescueState.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('=== 현재 데이터 상태 ===');
console.log('userDamage:', data.statistics.userDamage);
console.log('userAttackCount:', data.statistics.userAttackCount);

// 1. 1282609444151681186을 424480594542592009로 병합
const oldId = '1282609444151681186';
const newId = '424480594542592009';

if (data.statistics.userDamage[oldId]) {
    // 데미지 병합
    data.statistics.userDamage[newId] = 
        (data.statistics.userDamage[newId] || 0) + 
        data.statistics.userDamage[oldId];
    delete data.statistics.userDamage[oldId];
    
    // 공격 횟수 병합
    data.statistics.userAttackCount[newId] = 
        (data.statistics.userAttackCount[newId] || 0) + 
        data.statistics.userAttackCount[oldId];
    delete data.statistics.userAttackCount[oldId];
    
    // 마지막 공격 시간
    delete data.statistics.lastAttackTime[oldId];
    
    // participants 배열에서 제거
    data.statistics.participants = data.statistics.participants.filter(id => id !== oldId);
    
    console.log('\n✅ 데이터 병합 완료!');
}

// 2. floor3 -> 3 중복 제거
if (data.statistics.floorMVP['floor3']) {
    // floor3 데이터를 무조건 삭제 (3층 데이터는 '3'에만 저장)
    delete data.statistics.floorMVP['floor3'];
    console.log('✅ 중복 MVP 데이터(floor3) 삭제 완료!');
}

console.log('\n=== 수정 후 데이터 ===');
console.log('userDamage:', data.statistics.userDamage);
console.log('userAttackCount:', data.statistics.userAttackCount);
console.log('floorMVP:', data.statistics.floorMVP);

// 파일에 저장
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('\n✅ 모든 수정 완료!');