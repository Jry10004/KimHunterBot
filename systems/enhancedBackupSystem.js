// 향상된 백업 및 복구 시스템
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const crypto = require('crypto');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const mongoose = require('mongoose');

class EnhancedBackupSystem {
    constructor() {
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.models = {
            User: require('../models/User'),
            UserGameStats: require('../models/game/UserGameStats'),
            UserInventory: require('../models/game/UserInventory'),
            UserEconomy: require('../models/game/UserEconomy'),
            Stock: require('../models/Stock'),
            Word: require('../models/Word'),
            ArtifactCompany: require('../models/ArtifactCompany')
        };
        
        this.config = {
            maxBackups: 30,
            compressionLevel: 9,
            incrementalEnabled: true,
            encryptionEnabled: false,
            autoBackupInterval: 24 * 60 * 60 * 1000, // 24시간
            retentionDays: 30
        };
        
        this.isRunning = false;
        this.lastFullBackup = null;
        this.lastIncrementalBackup = null;
        this.backupHistory = [];
    }
    
    // 초기화
    async initialize() {
        await this.ensureBackupDir();
        await this.loadBackupHistory();
        console.log('✅ 향상된 백업 시스템 초기화 완료');
    }
    
    // 백업 디렉토리 확인
    async ensureBackupDir() {
        try {
            await fs.access(this.backupDir);
        } catch {
            await fs.mkdir(this.backupDir, { recursive: true });
        }
        
        // 서브 디렉토리 생성
        const subdirs = ['full', 'incremental', 'temp'];
        for (const subdir of subdirs) {
            const subdirPath = path.join(this.backupDir, subdir);
            try {
                await fs.access(subdirPath);
            } catch {
                await fs.mkdir(subdirPath, { recursive: true });
            }
        }
    }
    
    // MongoDB 연결 대기
    async waitForConnection(maxWaitTime = 30000) {
        const startTime = Date.now();
        
        while (mongoose.connection.readyState !== 1) {
            if (Date.now() - startTime > maxWaitTime) {
                throw new Error('MongoDB 연결 시간 초과');
            }
            
            console.log('⏳ MongoDB 연결 대기중...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('✅ MongoDB 연결 확인됨');
        return true;
    }
    
    // 전체 백업
    async createFullBackup(metadata = {}) {
        if (this.isRunning) {
            throw new Error('백업이 이미 진행 중입니다.');
        }
        
        this.isRunning = true;
        const startTime = Date.now();
        const backupId = this.generateBackupId();
        
        console.log('🔄 전체 백업 시작...');
        
        try {
            // MongoDB 연결 확인
            await this.waitForConnection();
            const backupData = {
                id: backupId,
                type: 'full',
                timestamp: new Date(),
                metadata,
                collections: {}
            };
            
            // 모든 컬렉션 백업
            for (const [modelName, Model] of Object.entries(this.models)) {
                console.log(`  📊 ${modelName} 백업 중...`);
                const data = await Model.find({}).lean();
                backupData.collections[modelName] = {
                    count: data.length,
                    data: data
                };
            }
            
            // 압축 및 저장
            const compressed = await this.compressData(backupData);
            const backupPath = path.join(this.backupDir, 'full', `backup_${backupId}.gz`);
            await fs.writeFile(backupPath, compressed);
            
            // 체크섬 생성
            const checksum = this.generateChecksum(compressed);
            await fs.writeFile(backupPath + '.checksum', checksum);
            
            // 백업 정보 저장
            const backupInfo = {
                id: backupId,
                type: 'full',
                path: backupPath,
                size: compressed.length,
                checksum,
                timestamp: new Date(),
                duration: Date.now() - startTime,
                collections: Object.keys(backupData.collections).map(name => ({
                    name,
                    count: backupData.collections[name].count
                }))
            };
            
            this.backupHistory.push(backupInfo);
            this.lastFullBackup = backupInfo;
            await this.saveBackupHistory();
            
            // 오래된 백업 정리
            await this.cleanupOldBackups();
            
            console.log(`✅ 전체 백업 완료 (${(backupInfo.duration / 1000).toFixed(2)}초)`);
            return backupInfo;
            
        } finally {
            this.isRunning = false;
        }
    }
    
    // 증분 백업
    async createIncrementalBackup(metadata = {}) {
        if (!this.lastFullBackup) {
            console.log('⚠️ 전체 백업이 없어 전체 백업을 수행합니다.');
            return await this.createFullBackup(metadata);
        }
        
        if (this.isRunning) {
            throw new Error('백업이 이미 진행 중입니다.');
        }
        
        this.isRunning = true;
        const startTime = Date.now();
        const backupId = this.generateBackupId();
        
        console.log('🔄 증분 백업 시작...');
        
        try {
            const backupData = {
                id: backupId,
                type: 'incremental',
                baseBackupId: this.lastFullBackup.id,
                timestamp: new Date(),
                metadata,
                changes: {}
            };
            
            // 변경사항만 백업
            const lastBackupTime = new Date(this.lastFullBackup.timestamp);
            
            for (const [modelName, Model] of Object.entries(this.models)) {
                const changes = await Model.find({
                    $or: [
                        { updatedAt: { $gt: lastBackupTime } },
                        { createdAt: { $gt: lastBackupTime } }
                    ]
                }).lean();
                
                if (changes.length > 0) {
                    console.log(`  📊 ${modelName}: ${changes.length}개 변경사항`);
                    backupData.changes[modelName] = changes;
                }
            }
            
            // 압축 및 저장
            const compressed = await this.compressData(backupData);
            const backupPath = path.join(this.backupDir, 'incremental', `backup_${backupId}.gz`);
            await fs.writeFile(backupPath, compressed);
            
            // 체크섬 생성
            const checksum = this.generateChecksum(compressed);
            await fs.writeFile(backupPath + '.checksum', checksum);
            
            // 백업 정보 저장
            const backupInfo = {
                id: backupId,
                type: 'incremental',
                baseBackupId: this.lastFullBackup.id,
                path: backupPath,
                size: compressed.length,
                checksum,
                timestamp: new Date(),
                duration: Date.now() - startTime,
                changes: Object.keys(backupData.changes).map(name => ({
                    name,
                    count: backupData.changes[name].length
                }))
            };
            
            this.backupHistory.push(backupInfo);
            this.lastIncrementalBackup = backupInfo;
            await this.saveBackupHistory();
            
            console.log(`✅ 증분 백업 완료 (${(backupInfo.duration / 1000).toFixed(2)}초)`);
            return backupInfo;
            
        } finally {
            this.isRunning = false;
        }
    }
    
    // 백업 복원
    async restore(backupId, options = {}) {
        const {
            collections = null, // null이면 전체, 아니면 특정 컬렉션만
            dryRun = false,
            validate = true
        } = options;
        
        console.log(`🔄 백업 복원 시작 (ID: ${backupId})...`);
        
        // 백업 찾기
        const backupInfo = this.backupHistory.find(b => b.id === backupId);
        if (!backupInfo) {
            throw new Error('백업을 찾을 수 없습니다.');
        }
        
        // 체크섬 검증
        if (validate) {
            await this.validateBackup(backupInfo);
        }
        
        // 백업 데이터 로드
        const compressed = await fs.readFile(backupInfo.path);
        const backupData = await this.decompressData(compressed);
        
        if (dryRun) {
            console.log('🔍 드라이런 모드 - 실제 복원하지 않음');
            return this.analyzeBackupData(backupData);
        }
        
        // 복원 전 현재 데이터 백업
        console.log('💾 복원 전 현재 데이터 백업...');
        await this.createFullBackup({ reason: 'pre-restore', restoringFrom: backupId });
        
        // 데이터 복원
        const results = {};
        
        if (backupInfo.type === 'full') {
            // 전체 백업 복원
            for (const [modelName, data] of Object.entries(backupData.collections)) {
                if (collections && !collections.includes(modelName)) continue;
                
                console.log(`  📥 ${modelName} 복원 중...`);
                const Model = this.models[modelName];
                
                // 기존 데이터 삭제
                await Model.deleteMany({});
                
                // 새 데이터 삽입
                if (data.data.length > 0) {
                    await Model.insertMany(data.data);
                }
                
                results[modelName] = {
                    restored: data.data.length,
                    status: 'success'
                };
            }
        } else {
            // 증분 백업 복원
            // 먼저 기본 백업 복원
            await this.restore(backupData.baseBackupId, { collections, dryRun: false, validate });
            
            // 변경사항 적용
            for (const [modelName, changes] of Object.entries(backupData.changes)) {
                if (collections && !collections.includes(modelName)) continue;
                
                console.log(`  📥 ${modelName} 변경사항 적용 중...`);
                const Model = this.models[modelName];
                
                for (const doc of changes) {
                    await Model.findOneAndUpdate(
                        { _id: doc._id },
                        doc,
                        { upsert: true }
                    );
                }
                
                results[modelName] = {
                    updated: changes.length,
                    status: 'success'
                };
            }
        }
        
        console.log('✅ 백업 복원 완료');
        return results;
    }
    
    // 백업 검증
    async validateBackup(backupInfo) {
        console.log('🔍 백업 무결성 검증 중...');
        
        const checksumFile = backupInfo.path + '.checksum';
        const expectedChecksum = await fs.readFile(checksumFile, 'utf8');
        const compressed = await fs.readFile(backupInfo.path);
        const actualChecksum = this.generateChecksum(compressed);
        
        if (expectedChecksum !== actualChecksum) {
            throw new Error('백업 파일이 손상되었습니다.');
        }
        
        console.log('✅ 백업 무결성 검증 완료');
        return true;
    }
    
    // 백업 목록 조회
    async listBackups(options = {}) {
        const { type = null, limit = 20 } = options;
        
        let backups = [...this.backupHistory];
        
        if (type) {
            backups = backups.filter(b => b.type === type);
        }
        
        // 최신순 정렬
        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return backups.slice(0, limit);
    }
    
    // 백업 삭제
    async deleteBackup(backupId) {
        const backupInfo = this.backupHistory.find(b => b.id === backupId);
        if (!backupInfo) {
            throw new Error('백업을 찾을 수 없습니다.');
        }
        
        // 파일 삭제
        await fs.unlink(backupInfo.path);
        await fs.unlink(backupInfo.path + '.checksum').catch(() => {});
        
        // 기록에서 제거
        this.backupHistory = this.backupHistory.filter(b => b.id !== backupId);
        await this.saveBackupHistory();
        
        console.log(`🗑️ 백업 삭제됨: ${backupId}`);
    }
    
    // 오래된 백업 정리
    async cleanupOldBackups() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        
        const oldBackups = this.backupHistory.filter(b => 
            new Date(b.timestamp) < cutoffDate
        );
        
        for (const backup of oldBackups) {
            await this.deleteBackup(backup.id);
        }
        
        // 최대 개수 제한
        const fullBackups = this.backupHistory.filter(b => b.type === 'full');
        if (fullBackups.length > this.config.maxBackups) {
            const toDelete = fullBackups
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .slice(0, fullBackups.length - this.config.maxBackups);
            
            for (const backup of toDelete) {
                await this.deleteBackup(backup.id);
            }
        }
    }
    
    // 유틸리티 함수들
    generateBackupId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    generateChecksum(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    
    async compressData(data) {
        const json = JSON.stringify(data);
        return await gzip(json, { level: this.config.compressionLevel });
    }
    
    async decompressData(compressed) {
        const json = await gunzip(compressed);
        return JSON.parse(json.toString());
    }
    
    async saveBackupHistory() {
        const historyPath = path.join(this.backupDir, 'backup_history.json');
        await fs.writeFile(historyPath, JSON.stringify(this.backupHistory, null, 2));
    }
    
    async loadBackupHistory() {
        const historyPath = path.join(this.backupDir, 'backup_history.json');
        try {
            const data = await fs.readFile(historyPath, 'utf8');
            this.backupHistory = JSON.parse(data);
            
            // 마지막 백업 정보 복원
            const lastFull = this.backupHistory
                .filter(b => b.type === 'full')
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            
            if (lastFull) {
                this.lastFullBackup = lastFull;
            }
        } catch {
            this.backupHistory = [];
        }
    }
    
    analyzeBackupData(backupData) {
        const analysis = {
            type: backupData.type,
            timestamp: backupData.timestamp,
            collections: {}
        };
        
        if (backupData.type === 'full') {
            for (const [name, data] of Object.entries(backupData.collections)) {
                analysis.collections[name] = {
                    count: data.count,
                    sampleData: data.data.slice(0, 3)
                };
            }
        } else {
            for (const [name, changes] of Object.entries(backupData.changes)) {
                analysis.collections[name] = {
                    changeCount: changes.length,
                    sampleChanges: changes.slice(0, 3)
                };
            }
        }
        
        return analysis;
    }
    
    // 자동 백업 스케줄링
    startAutoBackup() {
        // 일일 백업
        this.autoBackupInterval = setInterval(async () => {
            try {
                await this.createFullBackup({ reason: 'scheduled' });
            } catch (error) {
                console.error('자동 백업 실패:', error);
            }
        }, this.config.autoBackupInterval);
        
        console.log('⏰ 자동 백업 스케줄 시작');
    }
    
    stopAutoBackup() {
        if (this.autoBackupInterval) {
            clearInterval(this.autoBackupInterval);
            console.log('⏰ 자동 백업 스케줄 중지');
        }
    }
}

// 싱글톤 인스턴스
const backupSystem = new EnhancedBackupSystem();

module.exports = backupSystem;