// 봇 성능 최적화 서비스
const v8 = require('v8');
const os = require('os');

class PerformanceOptimizer {
    constructor() {
        this.metrics = {
            commandExecutions: new Map(),
            responseTime: [],
            memoryUsage: [],
            cpuUsage: []
        };
        
        this.monitoring = false;
        this.optimizations = {
            cacheEnabled: true,
            lazyLoading: true,
            commandThrottling: true,
            memoryLimit: 512 * 1024 * 1024, // 512MB
            gcInterval: 5 * 60 * 1000 // 5분
        };
        
        // 명령어 쿨다운 관리
        this.cooldowns = new Map();
        
        // 메모리 풀
        this.objectPools = {
            embeds: [],
            buttons: [],
            selectMenus: []
        };
    }
    
    // 성능 모니터링 시작
    startMonitoring() {
        if (this.monitoring) return;
        
        console.log('📊 성능 모니터링 시작...');
        this.monitoring = true;
        
        // 메모리 사용량 추적
        this.memoryMonitor = setInterval(() => {
            const usage = process.memoryUsage();
            this.metrics.memoryUsage.push({
                timestamp: Date.now(),
                heapUsed: usage.heapUsed,
                heapTotal: usage.heapTotal,
                rss: usage.rss,
                external: usage.external
            });
            
            // 최근 100개만 유지
            if (this.metrics.memoryUsage.length > 100) {
                this.metrics.memoryUsage.shift();
            }
            
            // 메모리 임계값 확인
            if (usage.heapUsed > this.optimizations.memoryLimit) {
                this.performGarbageCollection();
            }
        }, 30 * 1000); // 30초마다
        
        // CPU 사용량 추적
        this.cpuMonitor = setInterval(() => {
            const cpus = os.cpus();
            const usage = cpus.reduce((acc, cpu) => {
                const total = Object.values(cpu.times).reduce((a, b) => a + b);
                const idle = cpu.times.idle;
                return acc + ((total - idle) / total);
            }, 0) / cpus.length;
            
            this.metrics.cpuUsage.push({
                timestamp: Date.now(),
                usage: usage * 100
            });
            
            if (this.metrics.cpuUsage.length > 100) {
                this.metrics.cpuUsage.shift();
            }
        }, 5 * 1000); // 5초마다
        
        // 정기적인 가비지 컬렉션
        this.gcInterval = setInterval(() => {
            if (global.gc) {
                this.performGarbageCollection();
            }
        }, this.optimizations.gcInterval);
    }
    
    // 성능 모니터링 중지
    stopMonitoring() {
        if (!this.monitoring) return;
        
        console.log('📊 성능 모니터링 중지...');
        this.monitoring = false;
        
        clearInterval(this.memoryMonitor);
        clearInterval(this.cpuMonitor);
        clearInterval(this.gcInterval);
    }
    
    // 명령어 실행 추적
    trackCommandExecution(commandName, startTime) {
        const duration = Date.now() - startTime;
        
        if (!this.metrics.commandExecutions.has(commandName)) {
            this.metrics.commandExecutions.set(commandName, {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                minTime: Infinity,
                maxTime: 0
            });
        }
        
        const stats = this.metrics.commandExecutions.get(commandName);
        stats.count++;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.count;
        stats.minTime = Math.min(stats.minTime, duration);
        stats.maxTime = Math.max(stats.maxTime, duration);
        
        // 전체 응답 시간 추적
        this.metrics.responseTime.push({
            command: commandName,
            duration,
            timestamp: Date.now()
        });
        
        if (this.metrics.responseTime.length > 1000) {
            this.metrics.responseTime.shift();
        }
        
        // 느린 명령어 경고
        if (duration > 3000) {
            console.warn(`⚠️ 느린 명령어 감지: ${commandName} (${duration}ms)`);
        }
    }
    
    // 명령어 스로틀링
    canExecuteCommand(userId, commandName, cooldownMs = 1000) {
        if (!this.optimizations.commandThrottling) return true;
        
        const key = `${userId}:${commandName}`;
        const now = Date.now();
        const lastExecution = this.cooldowns.get(key);
        
        if (lastExecution && now - lastExecution < cooldownMs) {
            return false;
        }
        
        this.cooldowns.set(key, now);
        
        // 오래된 쿨다운 정리
        if (this.cooldowns.size > 1000) {
            const cutoff = now - 60000; // 1분 이상 된 것들
            for (const [k, time] of this.cooldowns) {
                if (time < cutoff) {
                    this.cooldowns.delete(k);
                }
            }
        }
        
        return true;
    }
    
    // 가비지 컬렉션 수행
    performGarbageCollection() {
        if (!global.gc) {
            console.warn('⚠️ 가비지 컬렉션을 사용하려면 --expose-gc 플래그로 실행하세요.');
            return;
        }
        
        const before = process.memoryUsage().heapUsed;
        global.gc();
        const after = process.memoryUsage().heapUsed;
        
        const freed = (before - after) / 1024 / 1024;
        console.log(`🗑️ 가비지 컬렉션 완료: ${freed.toFixed(2)}MB 해제됨`);
    }
    
    // 객체 풀에서 가져오기
    getFromPool(type) {
        const pool = this.objectPools[type];
        if (pool && pool.length > 0) {
            return pool.pop();
        }
        return null;
    }
    
    // 객체 풀에 반환
    returnToPool(type, object) {
        const pool = this.objectPools[type];
        if (pool && pool.length < 50) { // 최대 50개까지만
            // 객체 초기화
            if (type === 'embeds' && object.data) {
                object.data = {};
            }
            pool.push(object);
        }
    }
    
    // 메모리 최적화 제안
    getOptimizationSuggestions() {
        const suggestions = [];
        const memoryUsage = process.memoryUsage();
        
        // 메모리 사용량 확인
        if (memoryUsage.heapUsed > 400 * 1024 * 1024) {
            suggestions.push({
                type: 'memory',
                severity: 'high',
                message: '메모리 사용량이 높습니다. 캐시 정리를 고려하세요.',
                action: 'clearCache'
            });
        }
        
        // 느린 명령어 확인
        for (const [command, stats] of this.metrics.commandExecutions) {
            if (stats.avgTime > 2000) {
                suggestions.push({
                    type: 'performance',
                    severity: 'medium',
                    message: `${command} 명령어가 느립니다 (평균 ${stats.avgTime.toFixed(0)}ms)`,
                    action: 'optimizeCommand'
                });
            }
        }
        
        // CPU 사용량 확인
        const recentCpu = this.metrics.cpuUsage.slice(-10);
        const avgCpu = recentCpu.reduce((sum, m) => sum + m.usage, 0) / recentCpu.length;
        
        if (avgCpu > 80) {
            suggestions.push({
                type: 'cpu',
                severity: 'high',
                message: `CPU 사용량이 높습니다 (${avgCpu.toFixed(1)}%)`,
                action: 'reduceLoad'
            });
        }
        
        return suggestions;
    }
    
    // 성능 리포트 생성
    generateReport() {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        return {
            uptime: {
                seconds: uptime,
                formatted: this.formatUptime(uptime)
            },
            memory: {
                used: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                total: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
                rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
                percentage: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2) + '%'
            },
            commands: {
                total: Array.from(this.metrics.commandExecutions.values())
                    .reduce((sum, stats) => sum + stats.count, 0),
                byCommand: Object.fromEntries(
                    Array.from(this.metrics.commandExecutions.entries())
                        .map(([cmd, stats]) => [cmd, {
                            count: stats.count,
                            avgTime: `${stats.avgTime.toFixed(0)}ms`
                        }])
                )
            },
            performance: {
                avgResponseTime: this.calculateAvgResponseTime(),
                slowCommands: this.getSlowCommands(),
                suggestions: this.getOptimizationSuggestions()
            },
            system: {
                platform: os.platform(),
                cpus: os.cpus().length,
                totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
                freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`
            }
        };
    }
    
    // 평균 응답 시간 계산
    calculateAvgResponseTime() {
        if (this.metrics.responseTime.length === 0) return '0ms';
        
        const sum = this.metrics.responseTime.reduce((acc, m) => acc + m.duration, 0);
        return `${(sum / this.metrics.responseTime.length).toFixed(0)}ms`;
    }
    
    // 느린 명령어 목록
    getSlowCommands(threshold = 2000) {
        const slow = [];
        
        for (const [command, stats] of this.metrics.commandExecutions) {
            if (stats.avgTime > threshold) {
                slow.push({
                    command,
                    avgTime: stats.avgTime,
                    count: stats.count
                });
            }
        }
        
        return slow.sort((a, b) => b.avgTime - a.avgTime);
    }
    
    // 업타임 포맷
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        return `${days}일 ${hours}시간 ${minutes}분 ${secs}초`;
    }
    
    // 메모리 누수 감지
    detectMemoryLeaks() {
        if (this.metrics.memoryUsage.length < 10) return null;
        
        // 최근 10개 샘플의 추세 분석
        const recent = this.metrics.memoryUsage.slice(-10);
        const trend = recent.reduce((acc, curr, idx) => {
            if (idx === 0) return 0;
            return acc + (curr.heapUsed - recent[idx - 1].heapUsed);
        }, 0);
        
        const avgIncrease = trend / (recent.length - 1);
        
        if (avgIncrease > 1024 * 1024) { // 1MB 이상 증가
            return {
                detected: true,
                avgIncrease: `${(avgIncrease / 1024 / 1024).toFixed(2)} MB/sample`,
                severity: avgIncrease > 5 * 1024 * 1024 ? 'high' : 'medium'
            };
        }
        
        return { detected: false };
    }
    
    // 성능 최적화 적용
    applyOptimizations() {
        console.log('⚡ 성능 최적화 적용 중...');
        
        // 1. 캐시 크기 제한
        const cacheService = require('./CacheService');
        cacheService.setMaxKeys('user', 1000);
        cacheService.setMaxKeys('temp', 500);
        
        // 2. 이벤트 리스너 정리
        const client = require('../index').client;
        if (client) {
            const maxListeners = 20;
            client.setMaxListeners(maxListeners);
        }
        
        // 3. 가비지 컬렉션 실행
        this.performGarbageCollection();
        
        console.log('✅ 성능 최적화 적용 완료');
    }
}

// 싱글톤 인스턴스
const performanceOptimizer = new PerformanceOptimizer();

// 자동 시작
if (process.env.NODE_ENV !== 'test') {
    performanceOptimizer.startMonitoring();
}

module.exports = performanceOptimizer;