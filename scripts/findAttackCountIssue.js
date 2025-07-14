const fs = require('fs');
const path = require('path');

console.log('🔍 공격 횟수 1로 초기화 문제 원인 찾기\n');

// 현재 데이터 확인
const dataPath = path.join(__dirname, '../data/dogBotRescueState.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 로그 파일 확인 (있다면)
const logPath = path.join(__dirname, '../logs');
if (fs.existsSync(logPath)) {
    console.log('📄 로그 파일 확인:');
    const logFiles = fs.readdirSync(logPath)
        .filter(f => f.endsWith('.log'))
        .sort()
        .reverse()
        .slice(0, 3);
    
    logFiles.forEach(file => {
        console.log(`- ${file}`);
    });
    console.log('');
}

// 최근 공격 시간 분석
console.log('⏰ 최근 공격 시간 분석:');
Object.entries(data.statistics.lastAttackTime).forEach(([userId, time]) => {
    const date = new Date(time);
    const now = Date.now();
    const diffMinutes = Math.floor((now - time) / 1000 / 60);
    console.log(`- ${userId}: ${date.toLocaleString()} (${diffMinutes}분 전)`);
});

// 공격 로그 분석
console.log('\n📊 공격 로그 분석:');
console.log(`- 총 로그 수: ${data.statistics.attackLog.length}개`);
console.log(`- 첫 공격: ${new Date(data.statistics.attackLog[0].timestamp).toLocaleString()}`);
console.log(`- 마지막 공격: ${new Date(data.statistics.attackLog[data.statistics.attackLog.length - 1].timestamp).toLocaleString()}`);

// 유저별 최근 공격 패턴
console.log('\n👥 유저별 최근 공격 패턴:');
const userRecentAttacks = {};
data.statistics.attackLog.slice(-20).forEach(log => {
    if (!userRecentAttacks[log.userId]) {
        userRecentAttacks[log.userId] = [];
    }
    userRecentAttacks[log.userId].push(new Date(log.timestamp).toLocaleTimeString());
});

Object.entries(userRecentAttacks).forEach(([userId, times]) => {
    console.log(`- ${userId}: ${times.join(', ')}`);
});

// 백업 파일들의 userAttackCount 비교
console.log('\n📁 백업 파일들의 userAttackCount 비교:');
const backupDir = path.join(__dirname, '../backups/dogbot');
if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 5);
    
    files.forEach(file => {
        try {
            const backupData = JSON.parse(fs.readFileSync(path.join(backupDir, file), 'utf8'));
            const counts = backupData.statistics.userAttackCount || {};
            console.log(`\n${file}:`);
            Object.entries(counts).forEach(([userId, count]) => {
                const currentCount = data.statistics.userAttackCount[userId] || 0;
                const diff = currentCount - count;
                const status = diff === 0 ? '=' : (diff > 0 ? `+${diff}` : diff);
                console.log(`  - ${userId}: ${count}회 → 현재 ${currentCount}회 (${status})`);
            });
        } catch (e) {
            console.log(`  - 읽기 실패: ${e.message}`);
        }
    });
}

// 가능한 원인들
console.log('\n💡 가능한 원인:');
console.log('1. 봇이 재시작될 때 validateAndRepairData가 실행됨');
console.log('2. 백업 복원 시 오래된 데이터로 덮어씌워짐');
console.log('3. 다른 코드에서 userAttackCount를 직접 수정');
console.log('4. 병렬 처리로 인한 경쟁 상태');

// dogBotStateManager 인스턴스 정보
console.log('\n🔧 권장 사항:');
console.log('1. validateAndRepairData에서 userAttackCount 재계산 로직 제거 ✅');
console.log('2. 백업 시스템이 userAttackCount를 보존하도록 확인');
console.log('3. 공격 처리 시 로깅 추가하여 문제 발생 시점 파악');
console.log('4. stateManager를 global 싱글톤으로 변경 고려');