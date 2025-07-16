// 상점 가챠 로깅 시스템
const fs = require('fs').promises;
const path = require('path');

class ShopGachaLogger {
    static LOG_DIR = path.join(__dirname, '..', 'logs', 'shop-gacha');
    static MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
    static MAX_LOG_FILES = 5;
    
    // 로그 디렉토리 확인 및 생성
    static async ensureLogDir() {
        try {
            await fs.mkdir(this.LOG_DIR, { recursive: true });
        } catch (error) {
            console.error('[GachaLogger] 로그 디렉토리 생성 실패:', error);
        }
    }
    
    // 현재 로그 파일 경로
    static getCurrentLogPath() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.LOG_DIR, `gacha-${date}.log`);
    }
    
    // 로그 작성
    static async log(level, message, data = {}) {
        await this.ensureLogDir();
        
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...data
        };
        
        const logLine = JSON.stringify(logEntry) + '\n';
        const logPath = this.getCurrentLogPath();
        
        try {
            await fs.appendFile(logPath, logLine, 'utf8');
            
            // 파일 크기 확인
            const stats = await fs.stat(logPath);
            if (stats.size > this.MAX_LOG_SIZE) {
                await this.rotateLog(logPath);
            }
        } catch (error) {
            console.error('[GachaLogger] 로그 작성 실패:', error);
        }
    }
    
    // 로그 파일 순환
    static async rotateLog(currentPath) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedPath = currentPath.replace('.log', `-${timestamp}.log`);
            await fs.rename(currentPath, rotatedPath);
            
            // 오래된 로그 파일 삭제
            await this.cleanupOldLogs();
        } catch (error) {
            console.error('[GachaLogger] 로그 순환 실패:', error);
        }
    }
    
    // 오래된 로그 파일 정리
    static async cleanupOldLogs() {
        try {
            const files = await fs.readdir(this.LOG_DIR);
            const logFiles = files
                .filter(f => f.startsWith('gacha-') && f.endsWith('.log'))
                .sort()
                .reverse();
            
            if (logFiles.length > this.MAX_LOG_FILES) {
                for (let i = this.MAX_LOG_FILES; i < logFiles.length; i++) {
                    await fs.unlink(path.join(this.LOG_DIR, logFiles[i]));
                }
            }
        } catch (error) {
            console.error('[GachaLogger] 로그 정리 실패:', error);
        }
    }
    
    // 가챠 시작 로그
    static async logGachaStart(userId, type, slot, goldCost) {
        await this.log('INFO', 'Gacha Started', {
            userId,
            type,
            slot,
            goldCost,
            action: 'gacha_start'
        });
    }
    
    // 가챠 성공 로그
    static async logGachaSuccess(userId, type, slot, items, goldSpent) {
        const itemsSummary = Array.isArray(items) 
            ? items.map(i => ({ name: i.name, rarity: i.rarity, score: i.score }))
            : [{ name: items.name, rarity: items.rarity, score: items.score }];
            
        await this.log('INFO', 'Gacha Success', {
            userId,
            type,
            slot,
            goldSpent,
            itemCount: Array.isArray(items) ? items.length : 1,
            items: itemsSummary,
            action: 'gacha_success'
        });
    }
    
    // 가챠 실패 로그
    static async logGachaFail(userId, type, slot, error, phase) {
        await this.log('ERROR', 'Gacha Failed', {
            userId,
            type,
            slot,
            error: error.message || error,
            errorStack: error.stack,
            phase, // 'gold_deduction', 'item_generation', 'item_save' 등
            action: 'gacha_fail'
        });
    }
    
    // 트랜잭션 실패 로그
    static async logTransactionFail(userId, type, error) {
        await this.log('ERROR', 'Transaction Failed', {
            userId,
            type,
            error: error.message || error,
            errorStack: error.stack,
            action: 'transaction_fail'
        });
    }
    
    // 골드 복구 로그
    static async logGoldRecovery(userId, amount, success) {
        await this.log(success ? 'INFO' : 'ERROR', 'Gold Recovery', {
            userId,
            amount,
            success,
            action: 'gold_recovery'
        });
    }
    
    // 중복 클릭 방지 로그
    static async logDuplicateClick(userId, type, slot) {
        await this.log('WARN', 'Duplicate Click Prevented', {
            userId,
            type,
            slot,
            action: 'duplicate_click'
        });
    }
    
    // 통계 조회
    static async getStats(date = null) {
        try {
            const logPath = date 
                ? path.join(this.LOG_DIR, `gacha-${date}.log`)
                : this.getCurrentLogPath();
                
            const content = await fs.readFile(logPath, 'utf8');
            const lines = content.trim().split('\n');
            
            const stats = {
                total: 0,
                success: 0,
                failed: 0,
                duplicateClicks: 0,
                errors: [],
                bySlot: {},
                byUser: {}
            };
            
            for (const line of lines) {
                try {
                    const log = JSON.parse(line);
                    
                    if (log.action === 'gacha_start') {
                        stats.total++;
                        stats.bySlot[log.slot] = (stats.bySlot[log.slot] || 0) + 1;
                        stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1;
                    } else if (log.action === 'gacha_success') {
                        stats.success++;
                    } else if (log.action === 'gacha_fail') {
                        stats.failed++;
                        stats.errors.push({
                            userId: log.userId,
                            slot: log.slot,
                            error: log.error,
                            phase: log.phase,
                            timestamp: log.timestamp
                        });
                    } else if (log.action === 'duplicate_click') {
                        stats.duplicateClicks++;
                    }
                } catch (e) {
                    // 파싱 실패한 라인 무시
                }
            }
            
            return stats;
        } catch (error) {
            console.error('[GachaLogger] 통계 조회 실패:', error);
            return null;
        }
    }
}

module.exports = ShopGachaLogger;