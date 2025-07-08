const fs = require('fs').promises;
const path = require('path');

class DogBotAutoBackup {
    constructor() {
        this.backupDir = path.join(__dirname, '../backups/dogbot');
        this.maxBackups = 10;
        this.backupInterval = null;
    }

    async initialize() {
        try {
            // 백업 디렉토리 생성
            await fs.mkdir(this.backupDir, { recursive: true });
            console.log('[DogBot Backup] 백업 디렉토리 생성 완료');
            
            // 5분마다 자동 백업
            this.startAutoBackup();
        } catch (error) {
            console.error('[DogBot Backup] 초기화 실패:', error);
        }
    }

    async createBackup() {
        try {
            const sourcePath = path.join(__dirname, '../data/dogBotRescueState.json');
            const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const backupPath = path.join(this.backupDir, `dogbot_${timestamp}.json`);
            
            // 파일 복사
            const data = await fs.readFile(sourcePath, 'utf8');
            const state = JSON.parse(data);
            
            // 이벤트가 활성화되고 데이터가 있을 때만 백업
            if (state && state.status && state.status.isActive && state.statistics && state.statistics.totalAttacks > 0) {
                await fs.writeFile(backupPath, JSON.stringify(state, null, 2));
                console.log(`[DogBot Backup] 백업 생성: ${backupPath}`);
                console.log(`  - 현재 층: ${state.status.currentFloor}`);
                console.log(`  - 총 공격: ${state.statistics.totalAttacks}`);
                console.log(`  - 총 데미지: ${state.statistics.totalDamage}`);
                
                // 오래된 백업 삭제
                await this.cleanOldBackups();
            } else {
                console.log('[DogBot Backup] 백업 스킵 - 이벤트 비활성화 또는 데이터 없음');
            }
        } catch (error) {
            console.error('[DogBot Backup] 백업 생성 실패:', error);
        }
    }

    async cleanOldBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = files
                .filter(f => f.startsWith('dogbot_') && f.endsWith('.json'))
                .sort()
                .reverse();
            
            // 최대 개수 초과 시 삭제
            if (backupFiles.length > this.maxBackups) {
                const filesToDelete = backupFiles.slice(this.maxBackups);
                for (const file of filesToDelete) {
                    await fs.unlink(path.join(this.backupDir, file));
                    console.log(`[DogBot Backup] 오래된 백업 삭제: ${file}`);
                }
            }
        } catch (error) {
            console.error('[DogBot Backup] 백업 정리 실패:', error);
        }
    }

    async getLatestBackup() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = files
                .filter(f => f.startsWith('dogbot_') && f.endsWith('.json'))
                .sort()
                .reverse();
            
            if (backupFiles.length > 0) {
                const latestFile = backupFiles[0];
                const data = await fs.readFile(path.join(this.backupDir, latestFile), 'utf8');
                return {
                    filename: latestFile,
                    data: JSON.parse(data)
                };
            }
            return null;
        } catch (error) {
            console.error('[DogBot Backup] 최신 백업 로드 실패:', error);
            return null;
        }
    }

    async restoreFromBackup(backupFilename = null) {
        try {
            let backupData;
            
            if (backupFilename) {
                // 특정 백업 파일 복원
                const data = await fs.readFile(path.join(this.backupDir, backupFilename), 'utf8');
                backupData = JSON.parse(data);
            } else {
                // 최신 백업 복원
                const latest = await this.getLatestBackup();
                if (!latest) {
                    console.log('[DogBot Backup] 복원할 백업이 없습니다.');
                    return false;
                }
                backupData = latest.data;
            }
            
            // 원본 파일에 복원
            const targetPath = path.join(__dirname, '../data/dogBotRescueState.json');
            await fs.writeFile(targetPath, JSON.stringify(backupData, null, 2));
            
            console.log('[DogBot Backup] 백업 복원 완료');
            console.log(`  - 현재 층: ${backupData.status.currentFloor}`);
            console.log(`  - 총 공격: ${backupData.statistics.totalAttacks}`);
            console.log(`  - 총 데미지: ${backupData.statistics.totalDamage}`);
            
            return true;
        } catch (error) {
            console.error('[DogBot Backup] 백업 복원 실패:', error);
            return false;
        }
    }

    startAutoBackup() {
        // 5분마다 백업
        this.backupInterval = setInterval(() => {
            this.createBackup();
        }, 5 * 60 * 1000);
        
        // 즉시 한번 백업
        this.createBackup();
        
        console.log('[DogBot Backup] 자동 백업 시작 (5분 간격)');
    }

    stopAutoBackup() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
            console.log('[DogBot Backup] 자동 백업 중지');
        }
    }
}

module.exports = new DogBotAutoBackup();