// 통합 백그라운드 작업 스케줄러
const cron = require('node-cron');
const { errorHandler } = require('../systems/enhancedErrorHandler');

class SchedulerService {
    constructor() {
        this.jobs = new Map();
        this.running = false;
        this.jobStats = new Map();
        
        // 작업 우선순위
        this.priorities = {
            CRITICAL: 1,
            HIGH: 2,
            NORMAL: 3,
            LOW: 4
        };
    }
    
    // 작업 등록
    registerJob(id, config) {
        const {
            name,
            schedule,
            handler,
            priority = this.priorities.NORMAL,
            enabled = true,
            runOnStart = false,
            maxRetries = 3,
            timeout = 30000
        } = config;
        
        if (this.jobs.has(id)) {
            console.warn(`⚠️ 작업 ${id}가 이미 등록되어 있습니다.`);
            return;
        }
        
        const job = {
            id,
            name,
            schedule,
            handler,
            priority,
            enabled,
            maxRetries,
            timeout,
            task: null,
            isRunning: false,
            lastRun: null,
            nextRun: null
        };
        
        // 통계 초기화
        this.jobStats.set(id, {
            runs: 0,
            successes: 0,
            failures: 0,
            totalDuration: 0,
            averageDuration: 0,
            lastError: null
        });
        
        // cron 작업 생성
        if (enabled) {
            job.task = cron.schedule(schedule, () => this.executeJob(id), {
                scheduled: false
            });
        }
        
        this.jobs.set(id, job);
        console.log(`📅 작업 등록: ${name} (${schedule})`);
        
        // 시작 시 실행
        if (runOnStart && enabled) {
            this.executeJob(id);
        }
    }
    
    // 작업 실행
    async executeJob(id) {
        const job = this.jobs.get(id);
        if (!job || job.isRunning) return;
        
        job.isRunning = true;
        job.lastRun = new Date();
        
        const stats = this.jobStats.get(id);
        const startTime = Date.now();
        
        console.log(`⚡ 작업 시작: ${job.name}`);
        
        let retries = 0;
        let success = false;
        let lastError = null;
        
        while (retries < job.maxRetries && !success) {
            try {
                // 타임아웃 처리
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('작업 타임아웃')), job.timeout)
                );
                
                await Promise.race([
                    job.handler(),
                    timeoutPromise
                ]);
                
                success = true;
                stats.successes++;
                
            } catch (error) {
                lastError = error;
                retries++;
                
                if (retries < job.maxRetries) {
                    console.warn(`⚠️ 작업 실패, 재시도 ${retries}/${job.maxRetries}: ${job.name}`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                }
            }
        }
        
        const duration = Date.now() - startTime;
        stats.runs++;
        stats.totalDuration += duration;
        stats.averageDuration = stats.totalDuration / stats.runs;
        
        if (!success) {
            stats.failures++;
            stats.lastError = lastError;
            console.error(`❌ 작업 최종 실패: ${job.name}`, lastError?.message);
            
            await errorHandler.handleError(lastError, {
                job: job.name,
                jobId: id,
                retries: retries
            });
        } else {
            console.log(`✅ 작업 완료: ${job.name} (${duration}ms)`);
        }
        
        job.isRunning = false;
        
        // 다음 실행 시간 계산
        if (job.task) {
            const cronExpression = cron.parseExpression(job.schedule);
            job.nextRun = cronExpression.next().toDate();
        }
    }
    
    // 스케줄러 시작
    start() {
        if (this.running) return;
        
        console.log('🚀 스케줄러 시작...');
        this.running = true;
        
        // 활성화된 작업들 시작
        for (const [id, job] of this.jobs) {
            if (job.enabled && job.task) {
                job.task.start();
                
                // 다음 실행 시간 계산
                const cronExpression = cron.parseExpression(job.schedule);
                job.nextRun = cronExpression.next().toDate();
            }
        }
        
        // 상태 모니터링 시작 (5분마다)
        this.monitoringInterval = setInterval(() => this.logStatus(), 5 * 60 * 1000);
        
        console.log(`✅ ${this.jobs.size}개 작업 스케줄링 시작`);
    }
    
    // 스케줄러 중지
    stop() {
        if (!this.running) return;
        
        console.log('🛑 스케줄러 중지...');
        this.running = false;
        
        // 모든 작업 중지
        for (const job of this.jobs.values()) {
            if (job.task) {
                job.task.stop();
            }
        }
        
        // 모니터링 중지
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        console.log('✅ 스케줄러 중지됨');
    }
    
    // 작업 활성화/비활성화
    toggleJob(id, enabled) {
        const job = this.jobs.get(id);
        if (!job) return false;
        
        job.enabled = enabled;
        
        if (enabled && job.task) {
            job.task.start();
        } else if (!enabled && job.task) {
            job.task.stop();
        }
        
        console.log(`📅 작업 ${enabled ? '활성화' : '비활성화'}: ${job.name}`);
        return true;
    }
    
    // 즉시 실행
    runNow(id) {
        const job = this.jobs.get(id);
        if (!job) return false;
        
        console.log(`▶️ 작업 즉시 실행: ${job.name}`);
        this.executeJob(id);
        return true;
    }
    
    // 작업 상태 조회
    getJobStatus(id) {
        const job = this.jobs.get(id);
        const stats = this.jobStats.get(id);
        
        if (!job) return null;
        
        return {
            ...job,
            stats,
            handler: undefined // 함수는 제외
        };
    }
    
    // 전체 상태 조회
    getAllStatus() {
        const status = {
            running: this.running,
            totalJobs: this.jobs.size,
            activeJobs: 0,
            runningJobs: 0,
            jobs: []
        };
        
        for (const [id, job] of this.jobs) {
            if (job.enabled) status.activeJobs++;
            if (job.isRunning) status.runningJobs++;
            
            status.jobs.push({
                id,
                name: job.name,
                schedule: job.schedule,
                enabled: job.enabled,
                isRunning: job.isRunning,
                lastRun: job.lastRun,
                nextRun: job.nextRun,
                stats: this.jobStats.get(id)
            });
        }
        
        return status;
    }
    
    // 상태 로깅
    logStatus() {
        const status = this.getAllStatus();
        console.log('\n📊 스케줄러 상태:');
        console.log(`  활성 작업: ${status.activeJobs}/${status.totalJobs}`);
        console.log(`  실행 중: ${status.runningJobs}`);
        
        // 문제가 있는 작업 표시
        for (const job of status.jobs) {
            if (job.stats.failures > 0) {
                const failureRate = (job.stats.failures / job.stats.runs * 100).toFixed(1);
                console.log(`  ⚠️ ${job.name}: ${failureRate}% 실패율`);
            }
        }
    }
    
    // 작업 제거
    removeJob(id) {
        const job = this.jobs.get(id);
        if (!job) return false;
        
        if (job.task) {
            job.task.stop();
        }
        
        this.jobs.delete(id);
        this.jobStats.delete(id);
        
        console.log(`🗑️ 작업 제거됨: ${job.name}`);
        return true;
    }
}

// 싱글톤 인스턴스
const scheduler = new SchedulerService();

// 기본 작업들 등록
function registerDefaultJobs() {
    const { config } = require('../config');
    
    // 날씨 업데이트 (30분마다)
    scheduler.registerJob('weather-update', {
        name: '날씨 업데이트',
        schedule: '*/30 * * * *',
        handler: async () => {
            const environmentSystem = require('../systems/environmentSystem');
            await environmentSystem.updateWeather();
        },
        priority: scheduler.priorities.LOW
    });
    
    // 주식 시장 업데이트 (5분마다)
    scheduler.registerJob('stock-update', {
        name: '주식 시장 업데이트',
        schedule: '*/5 * * * *',
        handler: async () => {
            const marketSystem = require('../systems/marketSystem');
            await marketSystem.updateStockPrices();
        },
        priority: scheduler.priorities.HIGH
    });
    
    // 뉴스 생성 (15분마다)
    scheduler.registerJob('news-generation', {
        name: '뉴스 생성',
        schedule: '*/15 * * * *',
        handler: async () => {
            const newsSystem = require('../systems/newsSystem');
            await newsSystem.generateNews();
        },
        priority: scheduler.priorities.NORMAL
    });
    
    // 보스 스폰 체크 (1시간마다)
    scheduler.registerJob('boss-spawn', {
        name: '보스 스폰 체크',
        schedule: '0 * * * *',
        handler: async () => {
            const bossSystem = require('../data/bossSystem');
            await bossSystem.checkBossSpawn();
        },
        priority: scheduler.priorities.HIGH
    });
    
    // 캐시 정리 (1시간마다)
    scheduler.registerJob('cache-cleanup', {
        name: '캐시 정리',
        schedule: '0 * * * *',
        handler: async () => {
            const cacheService = require('./CacheService');
            cacheService.flushAll();
            console.log('🗑️ 캐시 정리 완료');
        },
        priority: scheduler.priorities.LOW
    });
    
    // 일일 리셋 (매일 자정)
    scheduler.registerJob('daily-reset', {
        name: '일일 리셋',
        schedule: '0 0 * * *',
        handler: async () => {
            const User = require('../models/User');
            await User.updateMany({}, {
                $set: {
                    'dailyLimits.questsCompleted': 0,
                    'dailyLimits.workCount': 0,
                    'dailyLimits.dailyRewardClaimed': false
                }
            });
            console.log('🔄 일일 리셋 완료');
        },
        priority: scheduler.priorities.CRITICAL
    });
    
    // 백업 (매일 새벽 3시)
    scheduler.registerJob('daily-backup', {
        name: '일일 백업',
        schedule: '0 3 * * *',
        handler: async () => {
            const backupSystem = require('../systems/backupSystem');
            await backupSystem.createDailyBackup();
        },
        priority: scheduler.priorities.CRITICAL
    });
    
    // 오래된 데이터 정리 (매주 일요일)
    scheduler.registerJob('data-cleanup', {
        name: '오래된 데이터 정리',
        schedule: '0 4 * * 0',
        handler: async () => {
            const { DatabaseOptimizer } = require('../database/optimization');
            const optimizer = new DatabaseOptimizer();
            await optimizer.cleanupOldData();
        },
        priority: scheduler.priorities.LOW
    });
}

module.exports = {
    scheduler,
    registerDefaultJobs
};