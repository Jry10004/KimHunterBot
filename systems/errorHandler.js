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

    // 상호작용 에러 자동 캐치
    client.on('interactionCreate', async (interaction) => {
        try {
            // 기존 핸들러는 그대로 실행
        } catch (error) {
            console.error('🚨 상호작용 처리 중 에러:', error);
            
            // 에러 로깅
            await qaLogger.logError('상호작용', error, {
                type: interaction.type,
                commandName: interaction.commandName || 'N/A',
                customId: interaction.customId || 'N/A',
                userId: interaction.user?.id,
                channelId: interaction.channel?.id,
                guildId: interaction.guild?.id
            });

            // 사용자에게 에러 알림
            try {
                const errorMessage = {
                    content: '❌ 오류가 발생했습니다. `/버그발견` 명령어로 신고해주세요!',
                    ephemeral: true
                };

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                console.error('에러 응답 실패:', replyError);
            }
        }
    });

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