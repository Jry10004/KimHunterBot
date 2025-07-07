// QA 로깅 통합 예시
const qaLogger = require('./qaLogger');

// 에러 로깅 예시
function logGameError(gameName, error, context) {
    qaLogger.logError(gameName, error, {
        userId: context.userId,
        action: context.action,
        timestamp: Date.now()
    });
}

// 성능 모니터링 예시
async function monitorPerformance(feature, asyncFunction, ...args) {
    const startTime = Date.now();
    
    try {
        const result = await asyncFunction(...args);
        const executionTime = Date.now() - startTime;
        
        // 1초 이상 걸리면 성능 문제로 기록
        await qaLogger.logPerformance(feature, executionTime, 1000);
        
        return result;
    } catch (error) {
        await qaLogger.logError(feature, error, { args });
        throw error;
    }
}

// 기능 테스트 로깅
async function testFeature(featureName, testFunction) {
    try {
        const result = await testFunction();
        await qaLogger.logFeatureTest(featureName, true, { result });
        return { success: true, result };
    } catch (error) {
        await qaLogger.logFeatureTest(featureName, false, { 
            error: error.message,
            stack: error.stack 
        });
        return { success: false, error };
    }
}

// 게임별 통합 예시
const gameQAHandlers = {
    // 독버섯 게임
    mushroom: {
        onError: (error, context) => {
            qaLogger.logError('독버섯 게임', error, context);
        },
        onWarning: (message, context) => {
            qaLogger.logWarning('독버섯 게임', message, context);
        },
        onSessionTimeout: (sessionId) => {
            qaLogger.logWarning('독버섯 게임', '세션 타임아웃', { sessionId });
        }
    },
    
    // 워드 게임
    wordGame: {
        onValidationError: (word, userId) => {
            qaLogger.logWarning('워드 게임', `단어 검증 실패: ${word}`, { userId });
        },
        onAPIError: (error) => {
            qaLogger.logError('워드 게임', error, { api: '국립국어원' });
        },
        onSessionConflict: (userId) => {
            qaLogger.logWarning('워드 게임', '세션 충돌', { userId });
        }
    },
    
    // 운동 시스템
    exercise: {
        onModalError: (error, userId) => {
            qaLogger.logError('운동 시스템', error, { type: 'modal', userId });
        },
        onFatigueWarning: (userId, fatigue) => {
            qaLogger.logWarning('운동 시스템', '피로도 경고', { userId, fatigue });
        }
    },
    
    // 광산
    mine: {
        onEntryLimitExceeded: (userId, mineType) => {
            qaLogger.logWarning('광산', '입장 제한 초과', { userId, mineType });
        },
        onRewardError: (error, context) => {
            qaLogger.logError('광산', error, { type: 'reward', ...context });
        }
    }
};

// 자동 QA 테스트 스위트
async function runDailyQATests() {
    console.log('🔍 일일 QA 테스트 시작...');
    
    const tests = [
        {
            name: '단어 API 연결',
            test: async () => {
                const { validateWordAPI } = require('../utils/wordValidator');
                return await validateWordAPI('테스트');
            }
        },
        {
            name: '데이터베이스 연결',
            test: async () => {
                const mongoose = require('mongoose');
                return mongoose.connection.readyState === 1;
            }
        },
        {
            name: '백업 시스템',
            test: async () => {
                const backupSystem = require('./backupSystem');
                return await backupSystem.testBackup();
            }
        }
    ];
    
    for (const { name, test } of tests) {
        await testFeature(name, test);
    }
    
    console.log('✅ 일일 QA 테스트 완료');
}

module.exports = {
    logGameError,
    monitorPerformance,
    testFeature,
    gameQAHandlers,
    runDailyQATests
};