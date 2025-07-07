const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');

// 게임 상태 스키마
const GameStateSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    lastUpdated: { type: Date, default: Date.now }
});

const GameState = mongoose.model('GameState', GameStateSchema);

class DataManager {
    constructor() {
        this.dataPath = path.join(__dirname, '..', 'data', 'gameState');
        this.backupPath = path.join(__dirname, '..', 'data', 'backups');
        this.saveInterval = null;
        this.isDirty = new Set(); // 변경된 데이터 추적
        
        // 저장해야 할 데이터 레지스트리
        this.dataRegistry = new Map();
        
        // 백업 설정
        this.maxBackups = 10; // 최대 백업 파일 수
        this.backupInterval = 6 * 60 * 60 * 1000; // 6시간마다 백업
    }

    // 시스템 초기화
    async initialize() {
        try {
            // 디렉토리 생성
            await this.ensureDirectories();
            
            // 저장된 데이터 로드
            await this.loadAllData();
            
            // 자동 저장 시작 (30초마다)
            this.startAutoSave(30000);
            
            // 백업 스케줄 시작
            this.startBackupSchedule();
            
            console.log('📁 데이터 매니저 초기화 완료');
        } catch (error) {
            console.error('데이터 매니저 초기화 실패:', error);
        }
    }

    // 디렉토리 확인 및 생성
    async ensureDirectories() {
        const dirs = [this.dataPath, this.backupPath];
        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
            }
        }
    }

    // 데이터 등록
    registerData(key, getter, setter, options = {}) {
        this.dataRegistry.set(key, {
            getter,
            setter,
            saveToFile: options.saveToFile !== false,
            saveToMongo: options.saveToMongo !== false,
            compress: options.compress || false
        });
    }

    // 모든 데이터 로드
    async loadAllData() {
        console.log('📂 저장된 데이터 로드 중...');
        
        for (const [key, config] of this.dataRegistry) {
            try {
                let data = null;
                
                // MongoDB에서 먼저 로드 시도
                if (config.saveToMongo) {
                    const state = await GameState.findOne({ key });
                    if (state) {
                        data = state.data;
                    }
                }
                
                // 파일에서 로드 (MongoDB에 없는 경우)
                if (!data && config.saveToFile) {
                    const filePath = path.join(this.dataPath, `${key}.json`);
                    try {
                        const fileData = await fs.readFile(filePath, 'utf8');
                        data = JSON.parse(fileData);
                    } catch (err) {
                        // 파일이 없는 경우 무시
                    }
                }
                
                // 데이터 복원
                if (data && config.setter) {
                    config.setter(data);
                    console.log(`✅ ${key} 데이터 로드 완료`);
                }
            } catch (error) {
                console.error(`${key} 데이터 로드 실패:`, error);
            }
        }
    }

    // 특정 데이터 저장
    async saveData(key, force = false) {
        if (!force && !this.isDirty.has(key)) {
            return; // 변경사항 없으면 스킵
        }

        const config = this.dataRegistry.get(key);
        if (!config || !config.getter) return;

        try {
            const data = config.getter();
            if (!data) return;

            // MongoDB 저장
            if (config.saveToMongo) {
                await GameState.findOneAndUpdate(
                    { key },
                    { 
                        key,
                        data,
                        lastUpdated: new Date()
                    },
                    { upsert: true, new: true }
                );
            }

            // 파일 저장
            if (config.saveToFile) {
                const filePath = path.join(this.dataPath, `${key}.json`);
                const jsonData = JSON.stringify(data, null, 2);
                await fs.writeFile(filePath, jsonData, 'utf8');
            }

            this.isDirty.delete(key);
        } catch (error) {
            console.error(`${key} 데이터 저장 실패:`, error);
        }
    }

    // 모든 데이터 저장
    async saveAllData() {
        const savePromises = [];
        
        for (const key of this.dataRegistry.keys()) {
            savePromises.push(this.saveData(key));
        }
        
        await Promise.all(savePromises);
    }

    // 데이터 변경 표시
    markDirty(key) {
        this.isDirty.add(key);
    }

    // 자동 저장 시작
    startAutoSave(interval = 30000) {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }

        this.saveInterval = setInterval(async () => {
            if (this.isDirty.size > 0) {
                console.log(`💾 자동 저장 중... (${this.isDirty.size}개 항목)`);
                await this.saveAllData();
            }
        }, interval);

        console.log(`⏰ 자동 저장 활성화 (${interval/1000}초마다)`);
    }

    // 백업 생성
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(this.backupPath, timestamp);
            await fs.mkdir(backupDir, { recursive: true });

            // 모든 데이터 백업
            for (const [key, config] of this.dataRegistry) {
                if (config.getter) {
                    const data = config.getter();
                    if (data) {
                        const backupFile = path.join(backupDir, `${key}.json`);
                        await fs.writeFile(backupFile, JSON.stringify(data, null, 2));
                    }
                }
            }

            console.log(`📦 백업 생성 완료: ${timestamp}`);
            
            // 오래된 백업 정리
            await this.cleanOldBackups();
        } catch (error) {
            console.error('백업 생성 실패:', error);
        }
    }

    // 오래된 백업 정리
    async cleanOldBackups() {
        try {
            const backups = await fs.readdir(this.backupPath);
            
            if (backups.length > this.maxBackups) {
                // 날짜순 정렬
                backups.sort();
                
                // 오래된 백업 삭제
                const toDelete = backups.slice(0, backups.length - this.maxBackups);
                
                for (const backup of toDelete) {
                    const backupPath = path.join(this.backupPath, backup);
                    await fs.rm(backupPath, { recursive: true, force: true });
                    console.log(`🗑️ 오래된 백업 삭제: ${backup}`);
                }
            }
        } catch (error) {
            console.error('백업 정리 실패:', error);
        }
    }

    // 백업 스케줄 시작
    startBackupSchedule() {
        setInterval(() => {
            this.createBackup();
        }, this.backupInterval);
        
        console.log(`📅 백업 스케줄 활성화 (${this.backupInterval / (60 * 60 * 1000)}시간마다)`);
    }

    // 백업 복원
    async restoreFromBackup(backupName) {
        try {
            const backupDir = path.join(this.backupPath, backupName);
            const files = await fs.readdir(backupDir);
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const key = file.replace('.json', '');
                    const config = this.dataRegistry.get(key);
                    
                    if (config && config.setter) {
                        const filePath = path.join(backupDir, file);
                        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
                        config.setter(data);
                        
                        // 복원된 데이터 저장
                        await this.saveData(key, true);
                    }
                }
            }
            
            console.log(`✅ 백업 복원 완료: ${backupName}`);
        } catch (error) {
            console.error('백업 복원 실패:', error);
            throw error;
        }
    }

    // 시스템 종료
    async shutdown() {
        console.log('💾 최종 데이터 저장 중...');
        
        // 모든 데이터 저장
        await this.saveAllData();
        
        // 인터벌 정리
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        
        console.log('✅ 데이터 매니저 종료 완료');
    }

    // 통계 정보
    getStats() {
        return {
            registeredData: this.dataRegistry.size,
            dirtyData: this.isDirty.size,
            dataPath: this.dataPath,
            backupPath: this.backupPath
        };
    }
}

// 싱글톤 인스턴스
const dataManager = new DataManager();

module.exports = dataManager;