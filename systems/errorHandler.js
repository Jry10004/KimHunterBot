const qaLogger = require('./qaLogger');

// 전역 에러 핸들러 설치
function setupErrorHandlers(client) {
    // 처리되지 않은 Promise 거부
    process.on('unhandledRejection', async (error, promise) => {
        console.error('🚨 처리되지 않은 Promise 거부:', error);
        
        await qaLogger.logError('시스템', error, {
            type: 'unhandledRejection',
            promise: promise.toString(),
            timestamp: new Date().toISOString()
        });
    });

    // 처리되지 않은 예외
    process.on('uncaughtException', async (error) => {
        console.error('🚨 처리되지 않은 예외:', error);
        
        await qaLogger.logError('시스템', error, {
            type: 'uncaughtException',
            timestamp: new Date().toISOString()
        });
        
        // 심각한 에러의 경우 프로세스 종료
        process.exit(1);
    });

    // Discord.js 에러
    client.on('error', async (error) => {
        console.error('🚨 Discord 클라이언트 에러:', error);
        
        await qaLogger.logError('Discord 클라이언트', error, {
            timestamp: new Date().toISOString()
        });
    });

    // interactionCreate 이벤트는 discordEvents.js에서 처리하므로 여기서는 제거

    console.log('✅ 전역 에러 핸들러 설치 완료');
}

// 특정 함수를 에러 추적과 함께 래핑
function wrapWithErrorTracking(functionName, originalFunction) {
    return async function(...args) {
        const startTime = Date.now();
        
        try {
            const result = await originalFunction.apply(this, args);
            
            // 성능 모니터링
            const executionTime = Date.now() - startTime;
            if (executionTime > 2000) {
                await qaLogger.logPerformance(functionName, executionTime, 2000);
            }
            
            return result;
        } catch (error) {
            // 에러 자동 로깅
            await qaLogger.logError(functionName, error, {
                arguments: args.map(arg => {
                    if (typeof arg === 'object' && arg !== null) {
                        return arg.constructor.name;
                    }
                    return typeof arg;
                }),
                executionTime: Date.now() - startTime
            });
            
            throw error; // 에러는 다시 던져서 상위에서 처리
        }
    };
}

// 자주 에러가 발생하는 함수들에 자동 추적 추가
function addErrorTrackingTo(targetObject, functionNames) {
    functionNames.forEach(name => {
        if (typeof targetObject[name] === 'function') {
            targetObject[name] = wrapWithErrorTracking(name, targetObject[name]);
        }
    });
}

module.exports = {
    setupErrorHandlers,
    wrapWithErrorTracking,
    addErrorTrackingTo
};