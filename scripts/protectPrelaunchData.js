const fs = require('fs');
const path = require('path');

// 사전강화 데이터 보호 스크립트
const PRELAUNCH_FILE = path.join(__dirname, '../prelaunchEventData.json');
const BACKUP_DIR = path.join(__dirname, '../backups/prelaunch_protection');

// 백업 디렉토리 생성
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// 실시간 모니터링
console.log('🛡️ 사전강화 데이터 보호 시스템 시작...');

// 파일 변경 감지
let lastContent = fs.readFileSync(PRELAUNCH_FILE, 'utf8');
let lastSize = lastContent.length;

fs.watchFile(PRELAUNCH_FILE, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime > prev.mtime) {
        const currentContent = fs.readFileSync(PRELAUNCH_FILE, 'utf8');
        const currentSize = currentContent.length;
        
        // 파일 크기가 급격히 줄어들거나 중첩 구조가 감지되면
        if (currentSize < lastSize * 0.5 || currentContent.includes('"eventData": {\n    "eventData": {')) {
            console.log('⚠️ 위험한 변경 감지! 백업에서 복원합니다...');
            
            // 자동 백업
            const backupName = `emergency_backup_${Date.now()}.json`;
            fs.writeFileSync(path.join(BACKUP_DIR, backupName), currentContent);
            
            // 마지막 정상 상태로 복원
            fs.writeFileSync(PRELAUNCH_FILE, lastContent);
            console.log('✅ 데이터 복원 완료!');
        } else {
            // 정상적인 변경
            console.log(`📝 데이터 업데이트 감지 (${new Date().toLocaleTimeString()})`);
            lastContent = currentContent;
            lastSize = currentSize;
            
            // 정기 백업
            const backupName = `regular_backup_${Date.now()}.json`;
            fs.writeFileSync(path.join(BACKUP_DIR, backupName), currentContent);
        }
    }
});

console.log('📊 현재 데이터 상태:');
const data = JSON.parse(lastContent);
if (data.eventData) {
    const users = Object.keys(data.eventData);
    console.log(`- 사용자 수: ${users.length}명`);
    console.log(`- 파일 크기: ${(lastSize / 1024).toFixed(2)} KB`);
}

console.log('\n종료하려면 Ctrl+C를 누르세요.');