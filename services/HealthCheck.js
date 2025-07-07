const mongoose = require('mongoose');
const os = require('os');
const logger = require('./Logger');
const metricsCollector = require('./MetricsCollector');
const cacheService = require('./CacheService');
const { databaseConnection } = require('../database/enhancedConnection');

class HealthCheck {
    constructor() {
        this.checks = new Map();
        this.lastCheck = null;
        this.status = 'unknown';
        
        // 기본 체크 등록
        this.registerDefaultChecks();
    }
    
    // 기본 헬스 체크 등록
    registerDefaultChecks() {
        // 데이터베이스 체크
        this.register('database', async () => {
            try {
                const state = mongoose.connection.readyState;
                const states = {
                    0: 'disconnected',
                    1: 'connected',
                    2: 'connecting',
                    3: 'disconnecting'
                };
                
                if (state !== 1) {
                    return {
                        status: 'unhealthy',
                        message: `Database is ${states[state]}`,
                        details: databaseConnection.getConnectionStatus()
                    };
                }
                
                // Ping 테스트
                const start = Date.now();
                await mongoose.connection.db.admin().ping();
                const latency = Date.now() - start;
                
                return {
                    status: 'healthy',
                    message: 'Database connection is healthy',
                    details: {
                        latency: `${latency}ms`,
                        ...databaseConnection.getConnectionStatus()
                    }
                };
            } catch (error) {
                return {
                    status: 'unhealthy',
                    message: 'Database connection failed',
                    error: error.message
                };
            }
        });
        
        // 메모리 체크
        this.register('memory', async () => {
            const memUsage = process.memoryUsage();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const processMemPercentage = (memUsage.rss / totalMem) * 100;
            
            const status = processMemPercentage > 80 ? 'warning' : 'healthy';
            
            return {
                status,
                message: `Memory usage: ${processMemPercentage.toFixed(2)}%`,
                details: {
                    process: {
                        rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
                        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
                        external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`
                    },
                    system: {
                        total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                        free: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
                        used: `${((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(2)} GB`
                    }
                }
            };
        });
        
        // CPU 체크
        this.register('cpu', async () => {
            const cpus = os.cpus();
            const loadAvg = os.loadavg();
            const cpuCount = cpus.length;
            
            // 1분 평균 로드를 CPU 개수로 나눔
            const loadPercentage = (loadAvg[0] / cpuCount) * 100;
            
            const status = loadPercentage > 80 ? 'warning' : 'healthy';
            
            return {
                status,
                message: `CPU load: ${loadPercentage.toFixed(2)}%`,
                details: {
                    cores: cpuCount,
                    loadAverage: {
                        '1min': loadAvg[0].toFixed(2),
                        '5min': loadAvg[1].toFixed(2),
                        '15min': loadAvg[2].toFixed(2)
                    },
                    model: cpus[0].model
                }
            };
        });
        
        // 캐시 체크
        this.register('cache', async () => {
            const stats = cacheService.getStats();
            const allHealthy = Object.values(stats).every(layer => 
                layer.hitRate ? parseFloat(layer.hitRate) > 20 : true
            );
            
            return {
                status: allHealthy ? 'healthy' : 'warning',
                message: 'Cache service is operational',
                details: stats
            };
        });
        
        // 디스크 공간 체크
        this.register('disk', async () => {
            try {
                const { execSync } = require('child_process');
                const dfOutput = execSync('df -h /').toString();
                const lines = dfOutput.trim().split('\n');
                const dataLine = lines[1];
                const parts = dataLine.split(/\s+/);
                const usagePercent = parseInt(parts[4]);
                
                const status = usagePercent > 90 ? 'critical' : 
                              usagePercent > 80 ? 'warning' : 'healthy';
                
                return {
                    status,
                    message: `Disk usage: ${usagePercent}%`,
                    details: {
                        filesystem: parts[0],
                        size: parts[1],
                        used: parts[2],
                        available: parts[3],
                        mountPoint: parts[5]
                    }
                };
            } catch (error) {
                return {
                    status: 'unknown',
                    message: 'Unable to check disk space',
                    error: error.message
                };
            }
        });
        
        // 업타임 체크
        this.register('uptime', async () => {
            const uptime = process.uptime();
            const systemUptime = os.uptime();
            
            return {
                status: 'healthy',
                message: 'System is running',
                details: {
                    process: this.formatUptime(uptime),
                    system: this.formatUptime(systemUptime)
                }
            };
        });
        
        // 외부 서비스 체크 (예: Discord API)
        this.register('discord', async () => {
            try {
                const client = require('../index').client;
                
                if (!client || !client.isReady()) {
                    return {
                        status: 'unhealthy',
                        message: 'Discord client is not ready'
                    };
                }
                
                return {
                    status: 'healthy',
                    message: 'Discord client is connected',
                    details: {
                        ping: `${client.ws.ping}ms`,
                        guilds: client.guilds.cache.size,
                        users: client.users.cache.size,
                        uptime: this.formatUptime(client.uptime / 1000)
                    }
                };
            } catch (error) {
                return {
                    status: 'unhealthy',
                    message: 'Discord client error',
                    error: error.message
                };
            }
        });
    }
    
    // 헬스 체크 등록
    register(name, checkFunction) {
        this.checks.set(name, checkFunction);
        logger.debug(`Health check registered: ${name}`);
    }
    
    // 헬스 체크 제거
    unregister(name) {
        this.checks.delete(name);
        logger.debug(`Health check unregistered: ${name}`);
    }
    
    // 모든 체크 실행
    async runAllChecks() {
        const results = {};
        const startTime = Date.now();
        
        for (const [name, checkFn] of this.checks) {
            try {
                const checkStart = Date.now();
                results[name] = await checkFn();
                results[name].duration = Date.now() - checkStart;
            } catch (error) {
                results[name] = {
                    status: 'error',
                    message: 'Check failed',
                    error: error.message,
                    duration: Date.now() - startTime
                };
            }
        }
        
        // 전체 상태 계산
        const statuses = Object.values(results).map(r => r.status);
        
        if (statuses.includes('critical') || statuses.includes('error')) {
            this.status = 'critical';
        } else if (statuses.includes('unhealthy')) {
            this.status = 'unhealthy';
        } else if (statuses.includes('warning')) {
            this.status = 'warning';
        } else {
            this.status = 'healthy';
        }
        
        this.lastCheck = {
            timestamp: new Date(),
            duration: Date.now() - startTime,
            status: this.status,
            checks: results
        };
        
        // 메트릭 기록
        metricsCollector.recordCustomMetric('health_check_duration', this.lastCheck.duration);
        metricsCollector.recordCustomMetric('health_check_status', 
            this.status === 'healthy' ? 1 : 0, 'gauge'
        );
        
        // 문제 발생 시 로깅
        if (this.status !== 'healthy') {
            logger.warn('Health check detected issues', {
                status: this.status,
                issues: Object.entries(results)
                    .filter(([_, result]) => result.status !== 'healthy')
                    .map(([name, result]) => ({
                        check: name,
                        status: result.status,
                        message: result.message
                    }))
            });
        }
        
        return this.lastCheck;
    }
    
    // 특정 체크 실행
    async runCheck(name) {
        const checkFn = this.checks.get(name);
        if (!checkFn) {
            throw new Error(`Health check not found: ${name}`);
        }
        
        try {
            const startTime = Date.now();
            const result = await checkFn();
            result.duration = Date.now() - startTime;
            return result;
        } catch (error) {
            return {
                status: 'error',
                message: 'Check failed',
                error: error.message
            };
        }
    }
    
    // 간단한 상태 확인
    async getStatus() {
        if (!this.lastCheck || Date.now() - this.lastCheck.timestamp > 60000) {
            await this.runAllChecks();
        }
        
        return {
            status: this.status,
            lastCheck: this.lastCheck?.timestamp,
            summary: this.getStatusSummary()
        };
    }
    
    // 상태 요약
    getStatusSummary() {
        if (!this.lastCheck) return 'No health check data available';
        
        const counts = {
            healthy: 0,
            warning: 0,
            unhealthy: 0,
            critical: 0,
            error: 0
        };
        
        for (const result of Object.values(this.lastCheck.checks)) {
            counts[result.status] = (counts[result.status] || 0) + 1;
        }
        
        return counts;
    }
    
    // 상세 리포트
    async getDetailedReport() {
        await this.runAllChecks();
        
        return {
            status: this.status,
            timestamp: this.lastCheck.timestamp,
            duration: this.lastCheck.duration,
            checks: this.lastCheck.checks,
            metrics: {
                system: metricsCollector.getMetric('system'),
                database: metricsCollector.getMetric('database'),
                cache: metricsCollector.getMetric('cache')
            },
            logs: {
                recentErrors: await this.getRecentErrors(),
                performanceIssues: logger.getPerformanceStats()
            }
        };
    }
    
    // 최근 에러 조회
    async getRecentErrors(limit = 10) {
        // 실제로는 로그 파일에서 읽어옴
        return [];
    }
    
    // Express 엔드포인트용
    async handleHealthRequest(req, res) {
        const verbose = req.query.verbose === 'true';
        
        if (verbose) {
            const report = await this.getDetailedReport();
            res.status(this.status === 'healthy' ? 200 : 503).json(report);
        } else {
            const status = await this.getStatus();
            res.status(this.status === 'healthy' ? 200 : 503).json(status);
        }
    }
    
    // 업타임 포맷
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
        
        return parts.join(' ');
    }
    
    // 자동 모니터링 시작
    startMonitoring(interval = 60000) {
        this.monitoringInterval = setInterval(async () => {
            await this.runAllChecks();
            
            // 중요한 문제 발생 시 알림
            if (this.status === 'critical' || this.status === 'unhealthy') {
                logger.error('Health check critical', {
                    status: this.status,
                    summary: this.getStatusSummary()
                });
            }
        }, interval);
        
        logger.info('Health monitoring started', { interval });
    }
    
    // 모니터링 중지
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            logger.info('Health monitoring stopped');
        }
    }
}

// 싱글톤 인스턴스
const healthCheck = new HealthCheck();

module.exports = healthCheck;