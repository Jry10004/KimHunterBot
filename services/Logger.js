const winston = require('winston');
const path = require('path');
const fs = require('fs');

// 로그 디렉토리 생성
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 커스텀 로그 레벨
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
};

// 레벨별 색상
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'grey'
};

winston.addColors(colors);

// 로그 포맷
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// 콘솔 출력 포맷
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `${timestamp} [${level}] ${message}`;
        
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        
        return msg;
    })
);

// 로거 생성
class Logger {
    constructor() {
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            levels,
            format: logFormat,
            defaultMeta: { service: 'kimhunter-bot' },
            transports: [
                // 에러 로그
                new winston.transports.File({
                    filename: path.join(logDir, 'error.log'),
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                
                // 전체 로그
                new winston.transports.File({
                    filename: path.join(logDir, 'combined.log'),
                    maxsize: 10485760, // 10MB
                    maxFiles: 10
                }),
                
                // 일별 로그
                new winston.transports.File({
                    filename: path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`),
                    maxsize: 10485760,
                    maxFiles: 30
                })
            ],
            exceptionHandlers: [
                new winston.transports.File({ 
                    filename: path.join(logDir, 'exceptions.log') 
                })
            ],
            rejectionHandlers: [
                new winston.transports.File({ 
                    filename: path.join(logDir, 'rejections.log') 
                })
            ]
        });
        
        // 개발 환경에서는 콘솔 출력 추가
        if (process.env.NODE_ENV !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: consoleFormat,
                handleExceptions: true,
                handleRejections: true
            }));
        }
        
        // 성능 로그
        this.performanceLogs = [];
        
        // 요청 로그
        this.requestLogs = new Map();
    }
    
    // 기본 로그 메서드
    error(message, meta = {}) {
        this.logger.error(message, meta);
    }
    
    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }
    
    info(message, meta = {}) {
        this.logger.info(message, meta);
    }
    
    http(message, meta = {}) {
        this.logger.http(message, meta);
    }
    
    verbose(message, meta = {}) {
        this.logger.verbose(message, meta);
    }
    
    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }
    
    // 구조화된 로깅
    logCommand(commandName, userId, guildId, options = {}) {
        this.info('Command executed', {
            type: 'command',
            command: commandName,
            userId,
            guildId,
            options,
            timestamp: new Date()
        });
    }
    
    logInteraction(interactionType, customId, userId, values = null) {
        this.info('Interaction received', {
            type: 'interaction',
            interactionType,
            customId,
            userId,
            values,
            timestamp: new Date()
        });
    }
    
    logDatabase(operation, collection, duration, success = true, error = null) {
        const level = success ? 'info' : 'error';
        this.logger[level]('Database operation', {
            type: 'database',
            operation,
            collection,
            duration,
            success,
            error: error?.message,
            timestamp: new Date()
        });
    }
    
    logAPI(method, url, status, duration, error = null) {
        const level = status >= 400 ? 'error' : 'info';
        this.logger[level]('API call', {
            type: 'api',
            method,
            url,
            status,
            duration,
            error: error?.message,
            timestamp: new Date()
        });
    }
    
    // 성능 측정
    startTimer(label) {
        const startTime = Date.now();
        return {
            end: (metadata = {}) => {
                const duration = Date.now() - startTime;
                this.logPerformance(label, duration, metadata);
                return duration;
            }
        };
    }
    
    logPerformance(label, duration, metadata = {}) {
        const log = {
            label,
            duration,
            ...metadata,
            timestamp: new Date()
        };
        
        this.performanceLogs.push(log);
        
        // 최근 1000개만 유지
        if (this.performanceLogs.length > 1000) {
            this.performanceLogs.shift();
        }
        
        // 느린 작업 경고
        if (duration > 1000) {
            this.warn(`Slow operation detected: ${label}`, { duration, ...metadata });
        }
        
        this.verbose('Performance metric', {
            type: 'performance',
            ...log
        });
    }
    
    // 요청 추적
    trackRequest(requestId, userId, endpoint) {
        this.requestLogs.set(requestId, {
            userId,
            endpoint,
            startTime: Date.now(),
            logs: []
        });
    }
    
    addRequestLog(requestId, message, metadata = {}) {
        const request = this.requestLogs.get(requestId);
        if (request) {
            request.logs.push({
                message,
                metadata,
                timestamp: Date.now()
            });
        }
    }
    
    endRequest(requestId, status = 'success') {
        const request = this.requestLogs.get(requestId);
        if (request) {
            const duration = Date.now() - request.startTime;
            
            this.info('Request completed', {
                type: 'request',
                requestId,
                userId: request.userId,
                endpoint: request.endpoint,
                duration,
                status,
                logCount: request.logs.length
            });
            
            this.requestLogs.delete(requestId);
        }
    }
    
    // 통계 및 분석
    getPerformanceStats(label = null) {
        let logs = this.performanceLogs;
        
        if (label) {
            logs = logs.filter(log => log.label === label);
        }
        
        if (logs.length === 0) return null;
        
        const durations = logs.map(log => log.duration);
        const sorted = durations.sort((a, b) => a - b);
        
        return {
            count: logs.length,
            total: durations.reduce((sum, d) => sum + d, 0),
            average: durations.reduce((sum, d) => sum + d, 0) / logs.length,
            median: sorted[Math.floor(sorted.length / 2)],
            min: sorted[0],
            max: sorted[sorted.length - 1],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
        };
    }
    
    // 로그 검색
    async searchLogs(criteria) {
        const { level, startDate, endDate, message, limit = 100 } = criteria;
        
        // 실제 구현은 로그 파일을 읽어서 검색
        // 여기서는 간단한 예시만
        return {
            query: criteria,
            results: [],
            count: 0
        };
    }
    
    // 로그 정리
    async cleanupOldLogs(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const files = fs.readdirSync(logDir);
        let deletedCount = 0;
        
        for (const file of files) {
            const filePath = path.join(logDir, file);
            const stats = fs.statSync(filePath);
            
            if (stats.mtime < cutoffDate) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }
        
        this.info(`Cleaned up ${deletedCount} old log files`);
        return deletedCount;
    }
    
    // 로그 레벨 동적 변경
    setLevel(level) {
        this.logger.level = level;
        this.info(`Log level changed to ${level}`);
    }
    
    // 커스텀 트랜스포트 추가
    addTransport(transport) {
        this.logger.add(transport);
    }
    
    // 로그 스트림 (Express 미들웨어용)
    stream() {
        return {
            write: (message) => {
                this.http(message.trim());
            }
        };
    }
}

// 싱글톤 인스턴스
const logger = new Logger();

// 전역 에러 핸들러 연동
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { 
        reason: reason?.stack || reason,
        promise: promise
    });
});

module.exports = logger;