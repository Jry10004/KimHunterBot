// 향상된 중앙집중식 에러 처리 시스템
const { EmbedBuilder } = require('discord.js');
const qaLogger = require('./qaLogger');
const fs = require('fs').promises;
const path = require('path');

// 에러 타입 정의
const ErrorTypes = {
    DISCORD_API: 'Discord API',
    DATABASE: 'Database',
    VALIDATION: 'Validation',
    PERMISSION: 'Permission',
    NETWORK: 'Network',
    GAME_LOGIC: 'Game Logic',
    SYSTEM: 'System',
    UNKNOWN: 'Unknown'
};

// 에러 심각도 레벨
const ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

// 사용자 친화적 에러 메시지
const UserFriendlyMessages = {
    10062: '⏰ 이 명령어는 시간이 초과되었습니다. 다시 시도해주세요.',
    50001: '🚫 이 작업을 수행할 권한이 없습니다.',
    50013: '🚫 이 채널에서 메시지를 보낼 권한이 없습니다.',
    10008: '❓ 알 수 없는 메시지입니다. 이미 삭제되었을 수 있습니다.',
    10003: '❓ 알 수 없는 채널입니다. 채널이 삭제되었을 수 있습니다.',
    30005: '📈 최대 역할 수에 도달했습니다.',
    40060: '⚠️ 상호작용이 이미 확인되었습니다.',
    
    // 커스텀 에러 코드
    'INSUFFICIENT_GOLD': '💰 골드가 부족합니다.',
    'INVALID_ITEM': '❌ 유효하지 않은 아이템입니다.',
    'ALREADY_IN_GAME': '🎮 이미 게임에 참여 중입니다.',
    'GAME_NOT_FOUND': '❓ 게임을 찾을 수 없습니다.',
    'USER_NOT_REGISTERED': '📝 먼저 회원가입을 해주세요. `/회원가입` 명령어를 사용하세요.',
    'COOLDOWN_ACTIVE': '⏳ 아직 쿨다운 중입니다. 잠시 후 다시 시도해주세요.',
    'MAINTENANCE': '🔧 현재 유지보수 중입니다. 잠시 후 다시 시도해주세요.'
};

class EnhancedErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 1000;
        this.errorStats = new Map();
        this.maintenanceMode = false;
    }

    // 에러 타입 자동 감지
    detectErrorType(error) {
        if (error.code && error.code >= 10000 && error.code < 60000) {
            return ErrorTypes.DISCORD_API;
        }
        
        if (error.name === 'MongoError' || error.name === 'MongooseError') {
            return ErrorTypes.DATABASE;
        }
        
        if (error.name === 'ValidationError') {
            return ErrorTypes.VALIDATION;
        }
        
        if (error.message && error.message.toLowerCase().includes('permission')) {
            return ErrorTypes.PERMISSION;
        }
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return ErrorTypes.NETWORK;
        }
        
        if (error.customType) {
            return error.customType;
        }
        
        return ErrorTypes.UNKNOWN;
    }

    // 에러 심각도 판단
    detectSeverity(error, errorType) {
        // Critical: 시스템 종료가 필요한 에러
        if (errorType === ErrorTypes.SYSTEM || error.name === 'FatalError') {
            return ErrorSeverity.CRITICAL;
        }
        
        // High: 기능이 작동하지 않는 에러
        if (errorType === ErrorTypes.DATABASE || errorType === ErrorTypes.NETWORK) {
            return ErrorSeverity.HIGH;
        }
        
        // Medium: 일부 기능에 영향을 주는 에러
        if (errorType === ErrorTypes.GAME_LOGIC || errorType === ErrorTypes.VALIDATION) {
            return ErrorSeverity.MEDIUM;
        }
        
        // Low: 사용자 경험에 최소한의 영향
        return ErrorSeverity.LOW;
    }

    // 에러 처리 메인 함수
    async handleError(error, context = {}) {
        const errorType = this.detectErrorType(error);
        const severity = this.detectSeverity(error, errorType);
        const timestamp = new Date();
        
        // 에러 정보 구성
        const errorInfo = {
            id: `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: errorType,
            severity,
            message: error.message,
            stack: error.stack,
            code: error.code,
            timestamp,
            context,
            resolved: false
        };
        
        // 로그에 추가
        this.addToLog(errorInfo);
        
        // 통계 업데이트
        this.updateStats(errorType);
        
        // QA 로거에 기록
        await qaLogger.logError(errorType, error, context);
        
        // 심각도에 따른 처리
        await this.handleBySeverity(errorInfo);
        
        // 사용자 친화적 메시지 반환
        return this.getUserFriendlyMessage(error);
    }

    // 심각도에 따른 처리
    async handleBySeverity(errorInfo) {
        switch (errorInfo.severity) {
            case ErrorSeverity.CRITICAL:
                console.error('🚨🚨🚨 CRITICAL ERROR 🚨🚨🚨');
                console.error(errorInfo);
                // 관리자에게 즉시 알림 (필요한 경우)
                await this.notifyAdmins(errorInfo);
                break;
                
            case ErrorSeverity.HIGH:
                console.error('🚨 HIGH SEVERITY ERROR:');
                console.error(errorInfo.message);
                break;
                
            case ErrorSeverity.MEDIUM:
                console.warn('⚠️ Medium severity error:', errorInfo.message);
                break;
                
            case ErrorSeverity.LOW:
                console.log('ℹ️ Low severity error:', errorInfo.message);
                break;
        }
    }

    // 사용자 친화적 메시지 생성
    getUserFriendlyMessage(error) {
        // 유지보수 모드 확인
        if (this.maintenanceMode) {
            return UserFriendlyMessages.MAINTENANCE;
        }
        
        // 미리 정의된 메시지 확인
        if (error.code && UserFriendlyMessages[error.code]) {
            return UserFriendlyMessages[error.code];
        }
        
        if (error.customCode && UserFriendlyMessages[error.customCode]) {
            return UserFriendlyMessages[error.customCode];
        }
        
        // 기본 메시지
        const errorType = this.detectErrorType(error);
        switch (errorType) {
            case ErrorTypes.DISCORD_API:
                return '⚠️ Discord 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
            case ErrorTypes.DATABASE:
                return '📊 데이터베이스 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
            case ErrorTypes.PERMISSION:
                return '🚫 이 작업을 수행할 권한이 없습니다.';
            case ErrorTypes.VALIDATION:
                return '❌ 입력값이 올바르지 않습니다. 다시 확인해주세요.';
            case ErrorTypes.GAME_LOGIC:
                return '🎮 게임 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
            default:
                return '❌ 오류가 발생했습니다! `/버그발견`으로 신고해주세요.';
        }
    }

    // 로그에 추가
    addToLog(errorInfo) {
        this.errorLog.push(errorInfo);
        
        // 최대 크기 유지
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
    }

    // 통계 업데이트
    updateStats(errorType) {
        if (!this.errorStats.has(errorType)) {
            this.errorStats.set(errorType, {
                count: 0,
                lastOccurred: null,
                firstOccurred: new Date()
            });
        }
        
        const stats = this.errorStats.get(errorType);
        stats.count++;
        stats.lastOccurred = new Date();
    }

    // 에러 리포트 생성
    generateErrorReport() {
        const report = {
            totalErrors: this.errorLog.length,
            errorsByType: {},
            recentErrors: this.errorLog.slice(-10),
            criticalErrors: this.errorLog.filter(e => e.severity === ErrorSeverity.CRITICAL),
            unresolvedErrors: this.errorLog.filter(e => !e.resolved)
        };
        
        // 타입별 통계
        for (const [type, stats] of this.errorStats) {
            report.errorsByType[type] = stats;
        }
        
        return report;
    }

    // 에러 임베드 생성
    createErrorEmbed(error, context = {}) {
        const errorType = this.detectErrorType(error);
        const userMessage = this.getUserFriendlyMessage(error);
        
        const embed = new EmbedBuilder()
            .setTitle('⚠️ 오류 발생')
            .setDescription(userMessage)
            .setColor('#FF0000')
            .setTimestamp();
        
        // 개발 모드에서는 추가 정보 표시
        if (process.env.DEV_MODE === 'true') {
            embed.addFields(
                { name: '에러 타입', value: errorType, inline: true },
                { name: '에러 코드', value: error.code?.toString() || 'N/A', inline: true },
                { name: '상세 메시지', value: error.message.substring(0, 1024) }
            );
        }
        
        return embed;
    }

    // 관리자 알림 (심각한 에러 발생시)
    async notifyAdmins(errorInfo) {
        // 실제 구현시 Discord 채널로 알림 전송
        console.log('🚨 관리자 알림 필요:', errorInfo.id);
    }

    // 에러 패턴 분석
    analyzeErrorPatterns() {
        const patterns = {
            frequentErrors: [],
            errorSpikes: [],
            recurringErrors: []
        };
        
        // 자주 발생하는 에러
        for (const [type, stats] of this.errorStats) {
            if (stats.count > 10) {
                patterns.frequentErrors.push({
                    type,
                    count: stats.count,
                    lastOccurred: stats.lastOccurred
                });
            }
        }
        
        // 반복되는 에러 패턴 감지
        const recentErrors = this.errorLog.slice(-100);
        const errorMessages = recentErrors.map(e => e.message);
        const messageCount = {};
        
        errorMessages.forEach(msg => {
            messageCount[msg] = (messageCount[msg] || 0) + 1;
        });
        
        for (const [message, count] of Object.entries(messageCount)) {
            if (count > 5) {
                patterns.recurringErrors.push({
                    message,
                    count,
                    percentage: (count / recentErrors.length * 100).toFixed(2) + '%'
                });
            }
        }
        
        return patterns;
    }

    // 에러 자동 복구 시도
    async attemptAutoRecovery(error, context) {
        const errorType = this.detectErrorType(error);
        
        switch (errorType) {
            case ErrorTypes.DATABASE:
                console.log('🔄 데이터베이스 재연결 시도...');
                // DB 재연결 로직
                break;
                
            case ErrorTypes.NETWORK:
                console.log('🔄 네트워크 재시도...');
                // 네트워크 요청 재시도
                break;
                
            default:
                // 복구 불가능한 에러
                return false;
        }
        
        return true;
    }

    // 에러 로그 내보내기
    async exportErrorLog(filePath) {
        try {
            const logData = {
                exportDate: new Date(),
                errors: this.errorLog,
                statistics: Object.fromEntries(this.errorStats),
                patterns: this.analyzeErrorPatterns()
            };
            
            await fs.writeFile(
                filePath || path.join(__dirname, '../logs', `error_log_${Date.now()}.json`),
                JSON.stringify(logData, null, 2)
            );
            
            return true;
        } catch (error) {
            console.error('에러 로그 내보내기 실패:', error);
            return false;
        }
    }

    // 전역 에러 핸들러 설정
    setupGlobalHandlers(client) {
        // 처리되지 않은 Promise 거부
        process.on('unhandledRejection', async (reason, promise) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            error.customType = ErrorTypes.SYSTEM;
            
            await this.handleError(error, {
                type: 'unhandledRejection',
                promise: String(promise)
            });
        });

        // 처리되지 않은 예외
        process.on('uncaughtException', async (error) => {
            error.customType = ErrorTypes.SYSTEM;
            
            await this.handleError(error, {
                type: 'uncaughtException'
            });
            
            // 심각한 에러의 경우 안전하게 종료
            if (this.detectSeverity(error, ErrorTypes.SYSTEM) === ErrorSeverity.CRITICAL) {
                console.error('🚨 Critical error detected. Shutting down safely...');
                process.exit(1);
            }
        });

        // Discord.js 에러
        client.on('error', async (error) => {
            error.customType = ErrorTypes.DISCORD_API;
            
            await this.handleError(error, {
                source: 'Discord Client'
            });
        });

        // 경고
        process.on('warning', (warning) => {
            console.warn('⚠️ Warning:', warning.name, warning.message);
        });

        console.log('✅ 향상된 전역 에러 핸들러 설치 완료');
    }
}

// 싱글톤 인스턴스
const errorHandler = new EnhancedErrorHandler();

// 커스텀 에러 클래스들
class GameError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'GameError';
        this.customType = ErrorTypes.GAME_LOGIC;
        this.customCode = code;
    }
}

class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.customType = ErrorTypes.VALIDATION;
        this.field = field;
    }
}

class PermissionError extends Error {
    constructor(message, requiredPermission) {
        super(message);
        this.name = 'PermissionError';
        this.customType = ErrorTypes.PERMISSION;
        this.requiredPermission = requiredPermission;
    }
}

module.exports = {
    errorHandler,
    ErrorTypes,
    ErrorSeverity,
    GameError,
    ValidationError,
    PermissionError,
    setupErrorHandlers: (client) => errorHandler.setupGlobalHandlers(client)
};