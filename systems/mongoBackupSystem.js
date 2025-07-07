// MongoDB 백업 시스템 (연결 문제 해결 버전)
const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const { databaseConnection } = require('../database/enhancedConnection');

class MongoBackupSystem {
    constructor() {
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.isRunning = false;
    }
    
    // 초기화
    async initialize() {
        await this.ensureBackupDir();
        console.log('✅ MongoDB 백업 시스템 초기화 완료');
    }
    
    // 백업 디렉토리 확인
    async ensureBackupDir() {
        try {
            await fs.access(this.backupDir);
        } catch {
            await fs.mkdir(this.backupDir, { recursive: true });
        }
    }
    
    // 전체 백업 (JSON 형식)
    async createBackup(metadata = {}) {
        if (this.isRunning) {
            throw new Error('백업이 이미 진행 중입니다.');
        }
        
        this.isRunning = true;
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
        const backupPath = path.join(this.backupDir, `mongodb-backup-${timestamp}`);
        
        console.log('🔄 MongoDB 백업 시작...');
        
        try {
            // MongoDB 연결 확인
            if (!databaseConnection.isConnected()) {
                console.log('⏳ MongoDB 연결 대기중...');
                await this.waitForConnection();
            }
            
            // 백업 디렉토리 생성
            await fs.mkdir(backupPath, { recursive: true });
            
            // 메타데이터 저장
            const backupMeta = {
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                ...metadata,
                collections: []
            };
            
            // 모든 컬렉션 백업
            const db = mongoose.connection.db;
            const collections = await db.listCollections().toArray();
            
            for (const collectionInfo of collections) {
                const collectionName = collectionInfo.name;
                
                // 시스템 컬렉션 제외
                if (collectionName.startsWith('system.')) continue;
                
                console.log(`  📊 ${collectionName} 백업 중...`);
                
                try {
                    const collection = db.collection(collectionName);
                    const documents = await collection.find({}).toArray();
                    
                    // 컬렉션 데이터 저장
                    const collectionPath = path.join(backupPath, `${collectionName}.json`);
                    await fs.writeFile(
                        collectionPath,
                        JSON.stringify(documents, null, 2),
                        'utf8'
                    );
                    
                    backupMeta.collections.push({
                        name: collectionName,
                        count: documents.length,
                        size: Buffer.byteLength(JSON.stringify(documents))
                    });
                    
                    console.log(`    ✓ ${documents.length}개 문서 백업됨`);
                    
                } catch (error) {
                    console.error(`    ❌ ${collectionName} 백업 실패:`, error.message);
                }
            }
            
            // 메타데이터 파일 저장
            await fs.writeFile(
                path.join(backupPath, 'backup-metadata.json'),
                JSON.stringify(backupMeta, null, 2),
                'utf8'
            );
            
            // 백업 요약
            const totalDocs = backupMeta.collections.reduce((sum, col) => sum + col.count, 0);
            const totalSize = backupMeta.collections.reduce((sum, col) => sum + col.size, 0);
            
            console.log('\n✅ MongoDB 백업 완료!');
            console.log(`📁 백업 위치: ${backupPath}`);
            console.log(`📊 총 ${backupMeta.collections.length}개 컬렉션`);
            console.log(`📄 총 ${totalDocs.toLocaleString()}개 문서`);
            console.log(`💾 총 크기: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
            
            return {
                path: backupPath,
                metadata: backupMeta,
                success: true
            };
            
        } catch (error) {
            console.error('❌ 백업 실패:', error);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }
    
    // 백업 복원
    async restoreBackup(backupPath) {
        console.log('🔄 MongoDB 백업 복원 시작...');
        
        try {
            // MongoDB 연결 확인
            if (!databaseConnection.isConnected()) {
                await this.waitForConnection();
            }
            
            // 메타데이터 읽기
            const metadataPath = path.join(backupPath, 'backup-metadata.json');
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            
            console.log(`📅 백업 날짜: ${metadata.timestamp}`);
            console.log(`📊 컬렉션 수: ${metadata.collections.length}`);
            
            const db = mongoose.connection.db;
            
            // 각 컬렉션 복원
            for (const collectionInfo of metadata.collections) {
                const collectionName = collectionInfo.name;
                console.log(`  📥 ${collectionName} 복원 중...`);
                
                try {
                    // 컬렉션 데이터 읽기
                    const dataPath = path.join(backupPath, `${collectionName}.json`);
                    const documents = JSON.parse(await fs.readFile(dataPath, 'utf8'));
                    
                    // 기존 컬렉션 삭제
                    const collection = db.collection(collectionName);
                    await collection.deleteMany({});
                    
                    // 데이터 삽입
                    if (documents.length > 0) {
                        await collection.insertMany(documents);
                    }
                    
                    console.log(`    ✓ ${documents.length}개 문서 복원됨`);
                    
                } catch (error) {
                    console.error(`    ❌ ${collectionName} 복원 실패:`, error.message);
                }
            }
            
            console.log('\n✅ MongoDB 백업 복원 완료!');
            return true;
            
        } catch (error) {
            console.error('❌ 복원 실패:', error);
            throw error;
        }
    }
    
    // 백업 목록
    async listBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = [];
            
            for (const file of files) {
                if (file.startsWith('mongodb-backup-')) {
                    const backupPath = path.join(this.backupDir, file);
                    const stat = await fs.stat(backupPath);
                    
                    if (stat.isDirectory()) {
                        try {
                            const metadataPath = path.join(backupPath, 'backup-metadata.json');
                            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
                            
                            backups.push({
                                name: file,
                                path: backupPath,
                                timestamp: metadata.timestamp,
                                collections: metadata.collections.length,
                                totalDocuments: metadata.collections.reduce((sum, col) => sum + col.count, 0)
                            });
                        } catch {
                            // 메타데이터가 없는 백업
                        }
                    }
                }
            }
            
            // 최신순 정렬
            backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            return backups;
            
        } catch (error) {
            console.error('❌ 백업 목록 조회 실패:', error);
            return [];
        }
    }
    
    // MongoDB 연결 대기
    async waitForConnection(maxWaitTime = 30000) {
        const startTime = Date.now();
        
        while (!databaseConnection.isConnected()) {
            if (Date.now() - startTime > maxWaitTime) {
                throw new Error('MongoDB 연결 시간 초과');
            }
            
            console.log('⏳ MongoDB 연결 대기중...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('✅ MongoDB 연결 확인됨');
        return true;
    }
    
    // 백업 삭제
    async deleteBackup(backupName) {
        try {
            const backupPath = path.join(this.backupDir, backupName);
            
            // 디렉토리 재귀적 삭제
            await fs.rm(backupPath, { recursive: true, force: true });
            
            console.log(`🗑️ 백업 삭제됨: ${backupName}`);
            return true;
            
        } catch (error) {
            console.error('❌ 백업 삭제 실패:', error);
            return false;
        }
    }
    
    // 오래된 백업 정리
    async cleanupOldBackups(daysToKeep = 30) {
        const backups = await this.listBackups();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        let deletedCount = 0;
        
        for (const backup of backups) {
            if (new Date(backup.timestamp) < cutoffDate) {
                await this.deleteBackup(backup.name);
                deletedCount++;
            }
        }
        
        console.log(`✅ ${deletedCount}개의 오래된 백업 정리됨`);
        return deletedCount;
    }
}

// 싱글톤 인스턴스
const mongoBackupSystem = new MongoBackupSystem();

module.exports = mongoBackupSystem;