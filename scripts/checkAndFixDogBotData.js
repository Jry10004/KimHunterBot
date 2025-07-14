const fs = require('fs');
const path = require('path');

console.log('🔍 댕댕봇 데이터 상태 확인 중...\n');

// 현재 데이터 확인
const dataPath = path.join(__dirname, '../data/dogBotRescueState.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('📊 현재 데이터 상태:');
console.log(`- 3층 HP: ${data.floors['3'].currentHP.toLocaleString()} / 240,000 (${((data.floors['3'].currentHP / 240000) * 100).toFixed(1)}%)`);
console.log(`- 총 데미지: ${data.statistics.totalDamage.toLocaleString()}`);
console.log(`- 총 공격: ${data.statistics.totalAttacks}회`);
console.log(`- 마지막 수정: ${new Date(fs.statSync(dataPath).mtime).toLocaleString()}`);

// 백업 파일들 확인
console.log('\n📁 백업 파일 확인:');
const backupDir = path.join(__dirname, '../backups/dogbot');
if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 3);
    
    files.forEach(file => {
        const backupData = JSON.parse(fs.readFileSync(path.join(backupDir, file), 'utf8'));
        const hp = backupData.floors['3'].currentHP;
        const percent = ((hp / 240000) * 100).toFixed(1);
        console.log(`- ${file}: HP ${hp.toLocaleString()} (${percent}%)`);
    });
}

// 개발/프로덕션 환경 분리 제안
console.log('\n💡 환경 분리 제안:');
console.log('1. 개발 환경에서는 다른 파일명 사용:');
console.log('   - 개발: dogBotRescueState.dev.json');
console.log('   - 프로덕션: dogBotRescueState.json');
console.log('\n2. 환경 변수로 구분:');
console.log('   - DEV_MODE=true 시 .dev.json 파일 사용');

// HP를 30%로 설정할지 물어보기
console.log('\n🔧 HP를 30%로 설정하려면 --fix 옵션을 사용하세요');
console.log('   node scripts/checkAndFixDogBotData.js --fix');

if (process.argv.includes('--fix')) {
    data.floors['3'].currentHP = 72000;
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log('\n✅ 3층 HP를 30%로 수정했습니다: 72,000 / 240,000');
}

// 프로세스 정보
console.log('\n🖥️ 현재 프로세스 정보:');
console.log(`- PID: ${process.pid}`);
console.log(`- 플랫폼: ${process.platform}`);
console.log(`- Node 버전: ${process.version}`);
console.log(`- 작업 디렉토리: ${process.cwd()}`);