const logger = require('../services/Logger');
const metricsCollector = require('../services/MetricsCollector');
const { v4: uuidv4 } = require('../utils/uuid');

// 명령어 로깅 미들웨어
function logCommand(commandName) {
    return async (interaction) => {
        const requestId = uuidv4();
        const timer = logger.startTimer(`command:${commandName}`);
        
        // 요청 추적 시작
        logger.trackRequest(requestId, interaction.user.id, commandName);
        
        try {
            // 명령어 로그
            logger.logCommand(
                commandName,
                interaction.user.id,
                interaction.guild?.id,
                {
                    channel: interaction.channel?.id,
                    options: interaction.options?.data
                }
            );
            
            // 메트릭 기록
            const startTime = Date.now();
            
            // 컨텍스트 정보 추가
            interaction.requestId = requestId;
            interaction.startTime = startTime;
            
            return {
                requestId,
                timer,
                startTime
            };
        } catch (error) {
            logger.error('Command logging error', {
                command: commandName,
                error: error.message,
                stack: error.stack
            });
        }
    };
}

// 명령어 완료 로깅
function logCommandComplete(commandName, context, success = true, error = null) {
    if (!context) return;
    
    const { requestId, timer, startTime } = context;
    const duration = Date.now() - startTime;
    
    // 타이머 종료
    if (timer) {
        timer.end({ success, command: commandName });
    }
    
    // 메트릭 기록
    metricsCollector.recordCommand(
        commandName,
        context.userId || 'unknown',
        context.guildId || 'dm',
        duration,
        success
    );
    
    // 요청 종료
    logger.endRequest(requestId, success ? 'success' : 'error');
    
    if (!success && error) {
        logger.error(`Command failed: ${commandName}`, {
            error: error.message,
            stack: error.stack,
            duration,
            requestId
        });
    }
}

// 상호작용 로깅 미들웨어
function logInteraction() {
    return async (interaction) => {
        const interactionType = interaction.isButton() ? 'button' : 
                              interaction.isSelectMenu() ? 'select' : 
                              interaction.isModalSubmit() ? 'modal' : 'unknown';
        
        logger.logInteraction(
            interactionType,
            interaction.customId,
            interaction.user.id,
            interaction.values
        );
        
        // 메트릭 기록
        metricsCollector.recordUserActivity(
            interaction.user.id,
            `interaction:${interactionType}`,
            {
                customId: interaction.customId,
                guildId: interaction.guild?.id
            }
        );
    };
}

// 데이터베이스 작업 로깅
function logDatabase(operation, collection) {
    const timer = logger.startTimer(`db:${operation}:${collection}`);
    const startTime = Date.now();
    
    return {
        success: () => {
            const duration = Date.now() - startTime;
            timer.end({ operation, collection });
            
            logger.logDatabase(operation, collection, duration, true);
            metricsCollector.recordDatabaseQuery(operation, collection, duration, true);
        },
        error: (error) => {
            const duration = Date.now() - startTime;
            timer.end({ operation, collection, error: true });
            
            logger.logDatabase(operation, collection, duration, false, error);
            metricsCollector.recordDatabaseQuery(operation, collection, duration, false);
        }
    };
}

// API 호출 로깅
function logAPI(method, url) {
    const timer = logger.startTimer(`api:${method}:${new URL(url).pathname}`);
    const startTime = Date.now();
    
    return {
        success: (status) => {
            const duration = Date.now() - startTime;
            timer.end({ method, status });
            
            logger.logAPI(method, url, status, duration);
        },
        error: (error, status = 0) => {
            const duration = Date.now() - startTime;
            timer.end({ method, status, error: true });
            
            logger.logAPI(method, url, status, duration, error);
        }
    };
}

// 성능 추적 데코레이터
function trackPerformance(label) {
    return function(target, propertyName, descriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args) {
            const timer = logger.startTimer(label || propertyName);
            
            try {
                const result = await originalMethod.apply(this, args);
                timer.end({ success: true });
                return result;
            } catch (error) {
                timer.end({ success: false, error: error.message });
                throw error;
            }
        };
        
        return descriptor;
    };
}

// 에러 로깅 헬퍼
function logError(error, context = {}) {
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        code: error.code,
        ...context
    };
    
    // 에러 타입별 처리
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
        logger.error('Database error', errorInfo);
        metricsCollector.recordDatabaseConnection('error');
    } else if (error.name === 'DiscordAPIError') {
        logger.error('Discord API error', errorInfo);
        metricsCollector.recordEvent('discord_api_error', {
            code: error.code,
            method: error.method,
            path: error.path
        });
    } else if (error.response) {
        // HTTP 에러
        logger.error('HTTP error', {
            ...errorInfo,
            status: error.response.status,
            statusText: error.response.statusText,
            url: error.config?.url
        });
    } else {
        logger.error('Application error', errorInfo);
    }
}

// 사용자 활동 로깅
function logUserActivity(userId, activity, metadata = {}) {
    logger.info('User activity', {
        userId,
        activity,
        ...metadata,
        timestamp: new Date()
    });
    
    metricsCollector.recordUserActivity(userId, activity, metadata);
}

// 시스템 이벤트 로깅
function logSystemEvent(event, data = {}) {
    logger.info('System event', {
        event,
        ...data,
        timestamp: new Date()
    });
    
    metricsCollector.recordEvent(event, data);
}

// Express 미들웨어 (웹 서버용)
function expressLogging() {
    return (req, res, next) => {
        const startTime = Date.now();
        const requestId = uuidv4();
        
        // 요청 정보 로깅
        logger.http('Incoming request', {
            requestId,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
        
        // 응답 로깅
        const originalSend = res.send;
        res.send = function(data) {
            const duration = Date.now() - startTime;
            
            logger.http('Request completed', {
                requestId,
                method: req.method,
                url: req.url,
                status: res.statusCode,
                duration
            });
            
            originalSend.call(this, data);
        };
        
        next();
    };
}

module.exports = {
    logCommand,
    logCommandComplete,
    logInteraction,
    logDatabase,
    logAPI,
    trackPerformance,
    logError,
    logUserActivity,
    logSystemEvent,
    expressLogging
};