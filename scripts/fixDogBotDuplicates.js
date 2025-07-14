// 댕댕봇 구출 이벤트 중복 데이터 정리 스크립트
const fs = require('fs');
const path = require('path');

async function fixDuplicates() {
    try {
        // 데이터 파일 읽기
        const dataPath = path.join(__dirname, '../data/dogBotRescueState.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(rawData);
        
        console.log('🔧 댕댕봇 구출 이벤트 데이터 정리 시작...');
        
        // 1. floor3 중복 제거 - floor3 키 삭제
        if (data.statistics.floorMVP['floor3']) {
            console.log('📍 floor3 중복 키 발견:', data.statistics.floorMVP['floor3']);
            delete data.statistics.floorMVP['floor3'];
            console.log('✅ floor3 중복 키 제거 완료');
        }
        
        // 2. 인프 데이터 병합 (592659577384730645 → 1374702838541168650)
        const oldInfpId = '592659577384730645';
        const newInfpId = '1374702838541168650';
        
        if (data.statistics.userDamage[oldInfpId]) {
            console.log(`📍 인프 중복 발견: ${oldInfpId}`);
            
            // 데미지 병합
            const oldDamage = data.statistics.userDamage[oldInfpId] || 0;
            const newDamage = data.statistics.userDamage[newInfpId] || 0;
            data.statistics.userDamage[newInfpId] = oldDamage + newDamage;
            delete data.statistics.userDamage[oldInfpId];
            console.log(`✅ 데미지 병합: ${oldDamage} + ${newDamage} = ${data.statistics.userDamage[newInfpId]}`);
            
            // 공격 횟수 병합
            const oldAttacks = data.statistics.userAttackCount[oldInfpId] || 0;
            const newAttacks = data.statistics.userAttackCount[newInfpId] || 0;
            data.statistics.userAttackCount[newInfpId] = oldAttacks + newAttacks;
            delete data.statistics.userAttackCount[oldInfpId];
            console.log(`✅ 공격 횟수 병합: ${oldAttacks} + ${newAttacks} = ${data.statistics.userAttackCount[newInfpId]}`);
            
            // 마지막 공격 시간 업데이트
            const oldTime = data.statistics.lastAttackTime[oldInfpId];
            const newTime = data.statistics.lastAttackTime[newInfpId];
            if (oldTime && (!newTime || oldTime > newTime)) {
                data.statistics.lastAttackTime[newInfpId] = oldTime;
            }
            delete data.statistics.lastAttackTime[oldInfpId];
            
            // participants 배열에서 중복 제거
            const participantIndex = data.statistics.participants.indexOf(oldInfpId);
            if (participantIndex > -1) {
                data.statistics.participants.splice(participantIndex, 1);
                console.log('✅ participants 배열에서 중복 제거');
            }
            
            // attackLog의 userId 변경
            let changedLogs = 0;
            data.statistics.attackLog.forEach(log => {
                if (log.userId === oldInfpId) {
                    log.userId = newInfpId;
                    changedLogs++;
                }
            });
            console.log(`✅ ${changedLogs}개의 공격 로그 ID 변경`);
        }
        
        // 3. totalDamage 재계산
        const calculatedTotal = Object.values(data.statistics.userDamage).reduce((sum, damage) => sum + damage, 0);
        const oldTotal = data.statistics.totalDamage;
        data.statistics.totalDamage = calculatedTotal;
        console.log(`📊 총 데미지 재계산: ${oldTotal} → ${calculatedTotal}`);
        
        // 4. totalAttacks 재계산
        const calculatedAttacks = Object.values(data.statistics.userAttackCount).reduce((sum, count) => sum + count, 0);
        const oldAttacks = data.statistics.totalAttacks;
        data.statistics.totalAttacks = calculatedAttacks;
        console.log(`📊 총 공격 횟수 재계산: ${oldAttacks} → ${calculatedAttacks}`);
        
        // 5. 현재 체력 재계산 (3층)
        const floor3Damage = data.statistics.attackLog
            .filter(log => log.floor === 3)
            .reduce((sum, log) => sum + log.damage, 0);
        const floor3HP = 240000 - floor3Damage;
        data.floors['3'].currentHP = floor3HP;
        console.log(`📊 3층 체력 재계산: ${floor3HP}`);
        
        // 파일 저장
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        console.log('✅ 데이터 정리 완료!');
        
        // 결과 출력
        console.log('\n📊 최종 통계:');
        console.log(`참여자: ${data.statistics.participants.length}명`);
        console.log(`총 공격: ${data.statistics.totalAttacks}회`);
        console.log(`총 데미지: ${data.statistics.totalDamage.toLocaleString()}`);
        console.log('\n👥 사용자별 데이터:');
        for (const [userId, damage] of Object.entries(data.statistics.userDamage)) {
            const attacks = data.statistics.userAttackCount[userId];
            console.log(`${userId}: ${damage.toLocaleString()} 데미지, ${attacks}회 공격`);
        }
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    }
}

// 스크립트 실행
fixDuplicates();