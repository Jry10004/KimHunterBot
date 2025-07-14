const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const User = require('../models/User');
// 주식 관련 모델들은 나중에 추가
// const Stock = require('../models/Stock');
// const StockHolding = require('../models/StockHolding');
// const StockTransaction = require('../models/StockTransaction');
const mongoose = require('mongoose');

class BackupSystem {
    constructor() {
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.isRunning = false;
        this.lastBackup = null;
        this.initializeBackupDirectory();
    }

    async initializeBackupDirectory() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            console.log('✅ 백업 디렉토리 초기화 완료:', this.backupDir);
        } catch (error) {
            console.error('❌ 백업 디렉토리 초기화 실패:', error);
        }
    }

    // 전체 백업 실행
    async performFullBackup(manual = false) {
        if (this.isRunning) {
            console.log('⚠️ 백업이 이미 진행 중입니다.');
            return false;
        }

        this.isRunning = true;
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
        const backupFolder = path.join(this.backupDir, `backup-${timestamp}`);

        try {
            await fs.mkdir(backupFolder, { recursive: true });
            console.log(`🔄 백업 시작... (${manual ? '수동' : '자동'})`);

            // 1. 유저 데이터 백업
            console.log('📊 유저 데이터 백업 중...');
            const userData = await this.backupUserData();
            await fs.writeFile(
                path.join(backupFolder, 'users.json'),
                JSON.stringify(userData, null, 2),
                'utf8'
            );

            // 2. 주식 시장 데이터 백업 (주식 모델 구현 후 활성화)
            // console.log('📈 주식 시장 데이터 백업 중...');
            // const stockData = await this.backupStockData();
            // await fs.writeFile(
            //     path.join(backupFolder, 'stocks.json'),
            //     JSON.stringify(stockData, null, 2),
            //     'utf8'
            // );
            const stockData = []; // 임시

            // 3. 주식 보유 현황 백업 (주식 모델 구현 후 활성화)
            // console.log('💼 주식 보유 현황 백업 중...');
            // const holdingsData = await this.backupHoldingsData();
            // await fs.writeFile(
            //     path.join(backupFolder, 'holdings.json'),
            //     JSON.stringify(holdingsData, null, 2),
            //     'utf8'
            // );
            const holdingsData = []; // 임시

            // 4. 랭킹 데이터 백업
            console.log('🏆 랭킹 데이터 백업 중...');
            const rankingData = await this.backupRankingData();
            await fs.writeFile(
                path.join(backupFolder, 'rankings.json'),
                JSON.stringify(rankingData, null, 2),
                'utf8'
            );

            // 5. 거래 기록 백업 (주식 모델 구현 후 활성화)
            // console.log('📝 거래 기록 백업 중...');
            // const transactionData = await this.backupTransactionData();
            // await fs.writeFile(
            //     path.join(backupFolder, 'transactions.json'),
            //     JSON.stringify(transactionData, null, 2),
            //     'utf8'
            // );
            const transactionData = []; // 임시

            // 6. 프리런치 이벤트 데이터 백업
            console.log('🎮 프리런치 이벤트 데이터 백업 중...');
            const prelaunchData = require('../prelaunchEventData.json');
            await fs.writeFile(
                path.join(backupFolder, 'prelaunchEvent.json'),
                JSON.stringify(prelaunchData, null, 2),
                'utf8'
            );

            // 백업 메타데이터 생성
            const metadata = {
                timestamp: new Date().toISOString(),
                type: manual ? 'manual' : 'automatic',
                statistics: {
                    users: userData.length,
                    stocks: stockData.length,
                    holdings: holdingsData.length,
                    transactions: transactionData.length
                },
                version: '1.0.0'
            };

            await fs.writeFile(
                path.join(backupFolder, 'metadata.json'),
                JSON.stringify(metadata, null, 2),
                'utf8'
            );

            // 백업 로그 업데이트
            await this.updateBackupLog({
                timestamp: metadata.timestamp,
                folder: backupFolder,
                type: metadata.type,
                success: true,
                statistics: metadata.statistics
            });

            this.lastBackup = new Date();
            console.log(`✅ 백업 완료! 위치: ${backupFolder}`);
            return backupFolder;

        } catch (error) {
            console.error('❌ 백업 실패:', error);
            await this.updateBackupLog({
                timestamp: new Date().toISOString(),
                type: manual ? 'manual' : 'automatic',
                success: false,
                error: error.message
            });
            return false;
        } finally {
            this.isRunning = false;
        }
    }

    // 유저 데이터 백업
    async backupUserData() {
        const users = await User.find({}).lean();
        return users.map(user => ({
            ...user,
            _id: user._id.toString(),
            backupDate: new Date().toISOString()
        }));
    }

    // 주식 시장 데이터 백업 (주식 모델 구현 후 활성화)
    async backupStockData() {
        // const stocks = await Stock.find({}).lean();
        // return stocks.map(stock => ({
        //     ...stock,
        //     _id: stock._id.toString(),
        //     backupDate: new Date().toISOString()
        // }));
        return []; // 임시
    }

    // 주식 보유 현황 백업 (주식 모델 구현 후 활성화)
    async backupHoldingsData() {
        // const holdings = await StockHolding.find({})
        //     .populate('userId')
        //     .populate('stockId')
        //     .lean();
        // return holdings.map(holding => ({
        //     ...holding,
        //     _id: holding._id.toString(),
        //     userId: holding.userId?._id.toString(),
        //     stockId: holding.stockId?._id.toString(),
        //     backupDate: new Date().toISOString()
        // }));
        return []; // 임시
    }

    // 랭킹 데이터 백업
    async backupRankingData() {
        // 레벨 랭킹
        const levelRanking = await User.find({ registered: true })
            .sort({ level: -1, exp: -1 })
            .limit(100)
            .select('nickname level exp')
            .lean();

        // 골드 랭킹
        const goldRanking = await User.find({ registered: true })
            .sort({ gold: -1 })
            .limit(100)
            .select('nickname gold')
            .lean();

        // 전투력 랭킹
        const users = await User.find({ registered: true }).lean();
        const combatPowerRanking = users
            .map(user => {
                const { calculateCombatPower } = require('../handlers/common/combatPower');
                return {
                    nickname: user.nickname,
                    combatPower: calculateCombatPower(user)
                };
            })
            .sort((a, b) => b.combatPower - a.combatPower)
            .slice(0, 100);

        // PVP 랭킹
        const pvpRanking = await User.find({ 
            registered: true,
            'pvp.rating': { $exists: true }
        })
            .sort({ 'pvp.rating': -1 })
            .limit(100)
            .select('nickname pvp.rating pvp.wins pvp.losses')
            .lean();

        return {
            level: levelRanking,
            gold: goldRanking,
            combatPower: combatPowerRanking,
            pvp: pvpRanking,
            timestamp: new Date().toISOString()
        };
    }

    // 거래 기록 백업 (주식 모델 구현 후 활성화)
    async backupTransactionData() {
        // const transactions = await StockTransaction.find({})
        //     .sort({ createdAt: -1 })
        //     .limit(10000) // 최근 10000건만 백업
        //     .lean();
        // return transactions.map(tx => ({
        //     ...tx,
        //     _id: tx._id.toString(),
        //     backupDate: new Date().toISOString()
        // }));
        return []; // 임시
    }

    // 백업 로그 업데이트
    async updateBackupLog(logEntry) {
        const logFile = path.join(this.backupDir, 'backup-log.json');
        let logs = [];

        try {
            const existingLogs = await fs.readFile(logFile, 'utf8');
            logs = JSON.parse(existingLogs);
        } catch (error) {
            // 로그 파일이 없으면 새로 생성
        }

        logs.push(logEntry);
        
        // 최근 100개 로그만 유지
        if (logs.length > 100) {
            logs = logs.slice(-100);
        }

        await fs.writeFile(logFile, JSON.stringify(logs, null, 2), 'utf8');
    }

    // 백업 복원
    async restoreBackup(backupFolder) {
        if (this.isRunning) {
            console.log('⚠️ 백업/복원이 이미 진행 중입니다.');
            return false;
        }

        this.isRunning = true;

        try {
            console.log(`🔄 백업 복원 시작... 폴더: ${backupFolder}`);

            // 메타데이터 확인
            const metadataPath = path.join(backupFolder, 'metadata.json');
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            console.log('📋 백업 정보:', metadata);

            // 복원 전 현재 데이터 백업
            console.log('💾 복원 전 현재 데이터 백업 중...');
            await this.performFullBackup(true);

            // 데이터 복원
            // 주의: 실제 복원은 매우 위험한 작업이므로 추가 확인 필요
            console.log('⚠️ 실제 복원은 수동으로 진행하세요.');
            console.log('📁 백업 파일 위치:', backupFolder);

            return true;
        } catch (error) {
            console.error('❌ 복원 실패:', error);
            return false;
        } finally {
            this.isRunning = false;
        }
    }

    // 자동 백업 스케줄 시작
    startAutoBackup() {
        // 매일 오전 4시에 자동 백업
        cron.schedule('0 4 * * *', async () => {
            console.log('🕐 자동 백업 시작...');
            await this.performFullBackup(false);
        });

        // 매 6시간마다 간단한 백업
        cron.schedule('0 */6 * * *', async () => {
            console.log('🕐 간단한 백업 시작...');
            await this.performQuickBackup();
        });

        console.log('✅ 자동 백업 스케줄 활성화');
    }

    // 간단한 백업 (중요 데이터만)
    async performQuickBackup() {
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
        const backupFile = path.join(this.backupDir, `quick-backup-${timestamp}.json`);

        try {
            // 주요 데이터만 빠르게 백업
            const quickData = {
                timestamp: new Date().toISOString(),
                users: await User.countDocuments(),
                totalGold: await User.aggregate([
                    { $group: { _id: null, total: { $sum: '$gold' } } }
                ])
            };
            
            // prelaunchEventData 파일이 있으면 추가
            try {
                const fs = require('fs').promises;
                const prelaunchPath = path.join(__dirname, '..', 'prelaunchEventData.json');
                const prelaunchContent = await fs.readFile(prelaunchPath, 'utf8');
                if (prelaunchContent && prelaunchContent.trim()) {
                    quickData.prelaunchEvent = JSON.parse(prelaunchContent);
                }
            } catch (err) {
                // 파일이 없거나 파싱 오류시 무시
                console.log('prelaunchEventData.json 읽기 실패 (무시됨)');
            }

            await fs.writeFile(backupFile, JSON.stringify(quickData, null, 2), 'utf8');
            console.log('✅ 간단한 백업 완료');
        } catch (error) {
            console.error('❌ 간단한 백업 실패:', error);
        }
    }

    // 백업 목록 조회
    async listBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = [];

            for (const file of files) {
                const filePath = path.join(this.backupDir, file);
                const stat = await fs.stat(filePath);

                if (stat.isDirectory() && file.startsWith('backup-')) {
                    try {
                        const metadataPath = path.join(filePath, 'metadata.json');
                        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
                        backups.push({
                            folder: file,
                            ...metadata
                        });
                    } catch (error) {
                        // 메타데이터가 없는 백업
                        backups.push({
                            folder: file,
                            timestamp: stat.birthtime.toISOString(),
                            type: 'unknown'
                        });
                    }
                }
            }

            return backups.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            );
        } catch (error) {
            console.error('❌ 백업 목록 조회 실패:', error);
            return [];
        }
    }

    // 오래된 백업 정리
    async cleanOldBackups(daysToKeep = 30) {
        try {
            const backups = await this.listBackups();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            let deletedCount = 0;
            for (const backup of backups) {
                if (new Date(backup.timestamp) < cutoffDate) {
                    const backupPath = path.join(this.backupDir, backup.folder);
                    await fs.rm(backupPath, { recursive: true });
                    deletedCount++;
                    console.log(`🗑️ 오래된 백업 삭제: ${backup.folder}`);
                }
            }

            console.log(`✅ ${deletedCount}개의 오래된 백업을 정리했습니다.`);
            return deletedCount;
        } catch (error) {
            console.error('❌ 백업 정리 실패:', error);
            return 0;
        }
    }
}

module.exports = new BackupSystem();