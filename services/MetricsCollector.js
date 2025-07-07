// 메트릭 수집 서비스
const os = require('os');
const v8 = require('v8');
const logger = require('./Logger');

class MetricsCollector {
    constructor() {
        this.metrics = {
            system: {},
            bot: {
                commands: new Map(),
                events: new Map(),
                users: new Map(),
                guilds: new Map()
            },
            database: {
                queries: [],
                connections: {
                    active: 0,
                    total: 0,
                    errors: 0
                }
            },
            cache: {
                hits: 0,
                misses: 0,
                sets: 0,
                deletes: 0
            },
            custom: new Map()
        };
        
        this.intervals = {
            system: null,
            aggregation: null
        };
        
        this.config = {
            systemMetricsInterval: 30000, // 30초
            aggregationInterval: 300000, // 5분
            retentionPeriod: 86400000 // 24시간
        };
    }
    
    // 시작
    start() {
        // 시스템 메트릭 수집
        this.intervals.system = setInterval(() => {
            this.collectSystemMetrics();
        }, this.config.systemMetricsInterval);
        
        // 메트릭 집계 및 정리
        this.intervals.aggregation = setInterval(() => {
            this.aggregateMetrics();
            this.cleanupOldMetrics();
        }, this.config.aggregationInterval);
        
        logger.info('Metrics collector started');
    }
    
    // 중지
    stop() {
        if (this.intervals.system) {
            clearInterval(this.intervals.system);
        }
        if (this.intervals.aggregation) {
            clearInterval(this.intervals.aggregation);
        }
        
        logger.info('Metrics collector stopped');
    }
    
    // 시스템 메트릭 수집
    collectSystemMetrics() {
        const timestamp = Date.now();
        
        // CPU 사용률
        const cpus = os.cpus();
        const cpuUsage = cpus.map(cpu => {
            const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
            const idle = cpu.times.idle;
            return ((total - idle) / total) * 100;
        });
        
        // 메모리 사용률
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        // 프로세스 메모리
        const processMemory = process.memoryUsage();
        
        // V8 힙 통계
        const heapStats = v8.getHeapStatistics();
        
        this.metrics.system = {
            timestamp,
            cpu: {
                usage: cpuUsage.reduce((sum, usage) => sum + usage, 0) / cpuUsage.length,
                cores: cpuUsage.length,
                loadavg: os.loadavg()
            },
            memory: {
                total: totalMem,
                free: freeMem,
                used: usedMem,
                percentage: (usedMem / totalMem) * 100
            },
            process: {
                uptime: process.uptime(),
                pid: process.pid,
                memory: {
                    rss: processMemory.rss,
                    heapUsed: processMemory.heapUsed,
                    heapTotal: processMemory.heapTotal,
                    external: processMemory.external,
                    arrayBuffers: processMemory.arrayBuffers
                },
                v8: {
                    totalHeapSize: heapStats.total_heap_size,
                    usedHeapSize: heapStats.used_heap_size,
                    heapSizeLimit: heapStats.heap_size_limit,
                    mallocedMemory: heapStats.malloced_memory,
                    peakMallocedMemory: heapStats.peak_malloced_memory
                }
            }
        };
    }
    
    // 명령어 메트릭
    recordCommand(commandName, userId, guildId, duration, success = true) {
        const key = commandName;
        
        if (!this.metrics.bot.commands.has(key)) {
            this.metrics.bot.commands.set(key, {
                total: 0,
                success: 0,
                failure: 0,
                durations: [],
                users: new Set(),
                guilds: new Set()
            });
        }
        
        const cmdMetrics = this.metrics.bot.commands.get(key);
        cmdMetrics.total++;
        
        if (success) {
            cmdMetrics.success++;
        } else {
            cmdMetrics.failure++;
        }
        
        cmdMetrics.durations.push(duration);
        cmdMetrics.users.add(userId);
        cmdMetrics.guilds.add(guildId);
        
        // 최근 1000개만 유지
        if (cmdMetrics.durations.length > 1000) {
            cmdMetrics.durations.shift();
        }
    }
    
    // 이벤트 메트릭
    recordEvent(eventName, metadata = {}) {
        const key = eventName;
        
        if (!this.metrics.bot.events.has(key)) {
            this.metrics.bot.events.set(key, {
                count: 0,
                lastOccurred: null,
                metadata: []
            });
        }
        
        const eventMetrics = this.metrics.bot.events.get(key);
        eventMetrics.count++;
        eventMetrics.lastOccurred = new Date();
        
        if (Object.keys(metadata).length > 0) {
            eventMetrics.metadata.push({
                timestamp: Date.now(),
                data: metadata
            });
            
            // 최근 100개만 유지
            if (eventMetrics.metadata.length > 100) {
                eventMetrics.metadata.shift();
            }
        }
    }
    
    // 사용자 활동 메트릭
    recordUserActivity(userId, activityType, metadata = {}) {
        if (!this.metrics.bot.users.has(userId)) {
            this.metrics.bot.users.set(userId, {
                activities: new Map(),
                lastActive: null,
                totalActions: 0
            });
        }
        
        const userMetrics = this.metrics.bot.users.get(userId);
        userMetrics.lastActive = new Date();
        userMetrics.totalActions++;
        
        if (!userMetrics.activities.has(activityType)) {
            userMetrics.activities.set(activityType, 0);
        }
        
        userMetrics.activities.set(
            activityType,
            userMetrics.activities.get(activityType) + 1
        );
    }
    
    // 데이터베이스 메트릭
    recordDatabaseQuery(operation, collection, duration, success = true) {
        this.metrics.database.queries.push({
            operation,
            collection,
            duration,
            success,
            timestamp: Date.now()
        });
        
        // 최근 5000개만 유지
        if (this.metrics.database.queries.length > 5000) {
            this.metrics.database.queries = this.metrics.database.queries.slice(-5000);
        }
    }
    
    recordDatabaseConnection(event) {
        switch (event) {
            case 'connect':
                this.metrics.database.connections.active++;
                this.metrics.database.connections.total++;
                break;
            case 'disconnect':
                this.metrics.database.connections.active--;
                break;
            case 'error':
                this.metrics.database.connections.errors++;
                break;
        }
    }
    
    // 캐시 메트릭
    recordCacheOperation(operation) {
        switch (operation) {
            case 'hit':
                this.metrics.cache.hits++;
                break;
            case 'miss':
                this.metrics.cache.misses++;
                break;
            case 'set':
                this.metrics.cache.sets++;
                break;
            case 'delete':
                this.metrics.cache.deletes++;
                break;
        }
    }
    
    // 커스텀 메트릭
    recordCustomMetric(name, value, type = 'gauge') {
        if (!this.metrics.custom.has(name)) {
            this.metrics.custom.set(name, {
                type,
                values: [],
                current: null
            });
        }
        
        const metric = this.metrics.custom.get(name);
        
        switch (type) {
            case 'counter':
                metric.current = (metric.current || 0) + value;
                break;
            case 'gauge':
                metric.current = value;
                break;
            case 'histogram':
                metric.values.push({
                    value,
                    timestamp: Date.now()
                });
                
                // 최근 1000개만 유지
                if (metric.values.length > 1000) {
                    metric.values.shift();
                }
                break;
        }
    }
    
    // 메트릭 집계
    aggregateMetrics() {
        const aggregated = {
            timestamp: Date.now(),
            system: this.metrics.system,
            bot: {
                commands: {},
                events: {},
                activeUsers: this.metrics.bot.users.size,
                activeGuilds: this.metrics.bot.guilds.size
            },
            database: {
                totalQueries: this.metrics.database.queries.length,
                avgQueryTime: this.calculateAverage(
                    this.metrics.database.queries.map(q => q.duration)
                ),
                querySuccessRate: this.calculateSuccessRate(
                    this.metrics.database.queries
                ),
                connections: { ...this.metrics.database.connections }
            },
            cache: {
                ...this.metrics.cache,
                hitRate: this.calculateCacheHitRate()
            },
            custom: {}
        };
        
        // 명령어 집계
        for (const [cmd, metrics] of this.metrics.bot.commands) {
            aggregated.bot.commands[cmd] = {
                total: metrics.total,
                successRate: (metrics.success / metrics.total) * 100,
                avgDuration: this.calculateAverage(metrics.durations),
                uniqueUsers: metrics.users.size,
                uniqueGuilds: metrics.guilds.size
            };
        }
        
        // 이벤트 집계
        for (const [event, metrics] of this.metrics.bot.events) {
            aggregated.bot.events[event] = {
                count: metrics.count,
                lastOccurred: metrics.lastOccurred
            };
        }
        
        // 커스텀 메트릭 집계
        for (const [name, metric] of this.metrics.custom) {
            if (metric.type === 'histogram') {
                const values = metric.values.map(v => v.value);
                aggregated.custom[name] = {
                    type: metric.type,
                    count: values.length,
                    avg: this.calculateAverage(values),
                    min: Math.min(...values),
                    max: Math.max(...values),
                    p50: this.calculatePercentile(values, 50),
                    p95: this.calculatePercentile(values, 95),
                    p99: this.calculatePercentile(values, 99)
                };
            } else {
                aggregated.custom[name] = {
                    type: metric.type,
                    value: metric.current
                };
            }
        }
        
        // 로그에 기록
        logger.verbose('Metrics aggregated', aggregated);
        
        return aggregated;
    }
    
    // 오래된 메트릭 정리
    cleanupOldMetrics() {
        const cutoff = Date.now() - this.config.retentionPeriod;
        
        // 데이터베이스 쿼리 정리
        this.metrics.database.queries = this.metrics.database.queries.filter(
            q => q.timestamp > cutoff
        );
        
        // 커스텀 메트릭 히스토그램 정리
        for (const metric of this.metrics.custom.values()) {
            if (metric.type === 'histogram') {
                metric.values = metric.values.filter(v => v.timestamp > cutoff);
            }
        }
        
        // 이벤트 메타데이터 정리
        for (const event of this.metrics.bot.events.values()) {
            event.metadata = event.metadata.filter(m => m.timestamp > cutoff);
        }
    }
    
    // 유틸리티 함수들
    calculateAverage(values) {
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    calculateSuccessRate(queries) {
        if (queries.length === 0) return 100;
        const successful = queries.filter(q => q.success).length;
        return (successful / queries.length) * 100;
    }
    
    calculateCacheHitRate() {
        const total = this.metrics.cache.hits + this.metrics.cache.misses;
        if (total === 0) return 0;
        return (this.metrics.cache.hits / total) * 100;
    }
    
    calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        const sorted = values.slice().sort((a, b) => a - b);
        const index = Math.floor((percentile / 100) * sorted.length);
        return sorted[index];
    }
    
    // 현재 메트릭 가져오기
    getMetrics() {
        return this.aggregateMetrics();
    }
    
    // 특정 메트릭 가져오기
    getMetric(path) {
        const parts = path.split('.');
        let current = this.metrics;
        
        for (const part of parts) {
            if (current[part] !== undefined) {
                current = current[part];
            } else {
                return null;
            }
        }
        
        return current;
    }
    
    // 메트릭 리셋
    reset() {
        this.metrics.bot.commands.clear();
        this.metrics.bot.events.clear();
        this.metrics.bot.users.clear();
        this.metrics.bot.guilds.clear();
        this.metrics.database.queries = [];
        this.metrics.cache = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        this.metrics.custom.clear();
        
        logger.info('Metrics reset');
    }
}

// 싱글톤 인스턴스
const metricsCollector = new MetricsCollector();

module.exports = metricsCollector;