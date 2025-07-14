const fs = require('fs');
const path = require('path');

console.log('🔍 중복 유저 문제 분석\n');

// 현재 데이터 확인
const dataPath = path.join(__dirname, '../data/dogBotRescueState.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 닉네임 캐시 확인
const nicknameCachePath = path.join(__dirname, '../data/userNicknameCache.json');
let nicknameCache = {};
if (fs.existsSync(nicknameCachePath)) {
    nicknameCache = JSON.parse(fs.readFileSync(nicknameCachePath, 'utf8'));
}

console.log('👥 현재 참여자 목록:');
data.statistics.participants.forEach(userId => {
    const damage = data.statistics.userDamage[userId] || 0;
    const attacks = data.statistics.userAttackCount[userId] || 0;
    const nickname = nicknameCache[userId] || '알 수 없음';
    console.log(`- ${userId}: ${nickname} (${damage.toLocaleString()} 데미지, ${attacks}회)`);
});

// 최근 공격 로그에서 유저 확인
console.log('\n📊 최근 10개 공격 로그의 유저:');
const recentLogs = data.statistics.attackLog.slice(-10);
const recentUsers = new Set();
recentLogs.forEach(log => {
    recentUsers.add(log.userId);
    const time = new Date(log.timestamp).toLocaleTimeString();
    const nickname = nicknameCache[log.userId] || '미확인';
    console.log(`- ${time}: ${log.userId} (${nickname}) - ${log.damage} 데미지`);
});

// 닉네임이 같은 유저들 찾기
console.log('\n🔄 닉네임이 같은 Discord ID들:');
const nicknameToIds = {};
Object.entries(nicknameCache).forEach(([id, nickname]) => {
    if (!nicknameToIds[nickname]) {
        nicknameToIds[nickname] = [];
    }
    nicknameToIds[nickname].push(id);
});

Object.entries(nicknameToIds).forEach(([nickname, ids]) => {
    if (ids.length > 1) {
        console.log(`\n"${nickname}" 닉네임을 사용하는 ID들:`);
        ids.forEach(id => {
            const inStats = data.statistics.userDamage[id] ? '✅ 통계에 있음' : '❌ 통계에 없음';
            const damage = data.statistics.userDamage[id] || 0;
            const attacks = data.statistics.userAttackCount[id] || 0;
            console.log(`  - ${id}: ${inStats} (${damage} 데미지, ${attacks}회)`);
        });
    }
});

// 가능한 중복 ID 매핑
console.log('\n💡 가능한 중복 ID 매핑:');
const possibleDuplicates = {
    '592659577384730645': '1374702838541168650', // 인프
    // 다른 중복 가능성 있는 ID들 추가
};

Object.entries(possibleDuplicates).forEach(([oldId, newId]) => {
    const oldInStats = data.statistics.userDamage[oldId] ? true : false;
    const newInStats = data.statistics.userDamage[newId] ? true : false;
    
    if (oldInStats && newInStats) {
        console.log(`⚠️  중복 발견: ${oldId} → ${newId}`);
        console.log(`   구 ID: ${data.statistics.userDamage[oldId]} 데미지, ${data.statistics.userAttackCount[oldId] || 0}회`);
        console.log(`   신 ID: ${data.statistics.userDamage[newId]} 데미지, ${data.statistics.userAttackCount[newId] || 0}회`);
    }
});

// 권장사항
console.log('\n🔧 해결 방법:');
console.log('1. User 모델에서 Discord ID 업데이트 확인');
console.log('2. 공격 시 구 ID를 신 ID로 자동 리다이렉트 (이미 적용됨)');
console.log('3. 닉네임 캐시 업데이트');
console.log('4. 중복 데이터 병합 스크립트 실행');