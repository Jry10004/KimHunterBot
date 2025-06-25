// 📚 데이터베이스 마이그레이션 시스템
const fs = require('fs');
const path = require('path');

// 마이그레이션 추적 파일
const MIGRATION_TRACKING_FILE = path.join(__dirname, '..', 'migration-history.json');

// 마이그레이션 히스토리 로드
function loadMigrationHistory() {
    try {
        if (fs.existsSync(MIGRATION_TRACKING_FILE)) {
            return JSON.parse(fs.readFileSync(MIGRATION_TRACKING_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('마이그레이션 히스토리 로드 실패:', error);
    }
    return { applied: [], version: '1.0.0' };
}

// 마이그레이션 히스토리 저장
function saveMigrationHistory(history) {
    try {
        fs.writeFileSync(MIGRATION_TRACKING_FILE, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error('마이그레이션 히스토리 저장 실패:', error);
    }
}

// 마이그레이션 실행
async function runMigration(name, migrationFunc) {
    const history = loadMigrationHistory();
    
    // 이미 적용된 마이그레이션인지 확인
    if (history.applied.includes(name)) {
        console.log(`⏭️  마이그레이션 '${name}' 건너뜀 (이미 적용됨)`);
        return false;
    }
    
    try {
        console.log(`🔄 마이그레이션 '${name}' 실행 중...`);
        const result = await migrationFunc();
        
        // 성공 시 히스토리에 추가
        history.applied.push(name);
        history.lastApplied = name;
        history.lastAppliedAt = new Date().toISOString();
        saveMigrationHistory(history);
        
        console.log(`✅ 마이그레이션 '${name}' 완료!`);
        return result;
    } catch (error) {
        console.error(`❌ 마이그레이션 '${name}' 실패:`, error);
        throw error;
    }
}

// 모든 마이그레이션 실행
async function runAllMigrations(migrations) {
    console.log('🚀 데이터베이스 마이그레이션 시작...');
    
    let appliedCount = 0;
    for (const [name, func] of Object.entries(migrations)) {
        const applied = await runMigration(name, func);
        if (applied !== false) appliedCount++;
    }
    
    if (appliedCount > 0) {
        console.log(`✨ ${appliedCount}개의 마이그레이션이 적용되었습니다.`);
    } else {
        console.log('ℹ️  적용할 새로운 마이그레이션이 없습니다.');
    }
}

// 마이그레이션 초기화 (개발용)
function resetMigrations() {
    const history = { applied: [], version: '1.0.0' };
    saveMigrationHistory(history);
    console.log('🔄 마이그레이션 히스토리가 초기화되었습니다.');
}

module.exports = {
    runMigration,
    runAllMigrations,
    loadMigrationHistory,
    resetMigrations
};