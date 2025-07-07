// Rate Limiting 시스템
const logger = require('../services/Logger');
const metricsCollector = require('../services/MetricsCollector');

class RateLimiter {
    constructor() {
        // 사용자별 요청 기록
        this.userRequests = new Map();
        
        // 길드별 요청 기록
        this.guildRequests = new Map();
        
        // IP별 요청 기록 (웹 서버용)
        this.ipRequests = new Map();
        
        // 기본 설정
        this.config = {
            // 명령어별 제한
            commands: {
                default: { limit: 10, window: 60000 }, // 1분에 10회
                hunt: { limit: 5, window: 60000 }, // 1분에 5회
                work: { limit: 3, window: 300000 }, // 5분에 3회
                daily: { limit: 1, window: 86400000 }, // 24시간에 1회
                pvp: { limit: 20, window: 300000 }, // 5분에 20회
                shop: { limit: 30, window: 60000 }, // 1분에 30회
                trade: { limit: 10, window: 300000 }, // 5분에 10회
                register: { limit: 3, window: 3600000 }, // 1시간에 3회
                wordgame: { limit: 50, window: 60000 } // 1분에 50회
            },
            
            // 전역 제한
            global: {
                user: { limit: 100, window: 60000 }, // 사용자당 1분에 100회
                guild: { limit: 1000, window: 60000 }, // 길드당 1분에 1000회
                ip: { limit: 60, window: 60000 } // IP당 1분에 60회
            },
            
            // 버스트 허용량
            burstAllowance: 0.2, // 20% 추가 허용
            
            // 차단 시간
            blockDuration: {
                first: 60000, // 첫 차단: 1분
                second: 300000, // 두 번째: 5분
                third: 3600000, // 세 번째: 1시간
                persistent: 86400000 // 지속적 위반: 24시간
            }
        };
        
        // 차단 기록
        this.blocks = new Map();
        
        // 위반 횟수 기록
        this.violations = new Map();
        
        // 정리 인터벌
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
    
    // 요청 확인
    async checkRequest(userId, type = 'default', metadata = {}) {
        const now = Date.now();
        const key = `user:${userId}`;
        
        // 차단 확인
        if (this.isBlocked(key)) {
            const blockInfo = this.blocks.get(key);
            const remainingTime = blockInfo.until - now;
            
            logger.warn('Rate limit blocked request', {
                userId,
                type,
                remainingTime,
                reason: blockInfo.reason
            });
            
            return {
                allowed: false,
                reason: 'blocked',
                retryAfter: Math.ceil(remainingTime / 1000),
                message: `일시적으로 차단되었습니다. ${Math.ceil(remainingTime / 60000)}분 후에 다시 시도하세요.`
            };
        }
        
        // 명령어별 제한 확인
        const commandLimit = this.config.commands[type] || this.config.commands.default;
        const commandKey = `${key}:${type}`;
        const commandResult = this.checkLimit(commandKey, commandLimit);
        
        if (!commandResult.allowed) {
            this.handleViolation(key, `command_${type}`);
            
            return {
                ...commandResult,
                message: `명령어 사용 제한에 도달했습니다. ${Math.ceil(commandResult.retryAfter / 1000)}초 후에 다시 시도하세요.`
            };
        }
        
        // 전역 사용자 제한 확인
        const globalResult = this.checkLimit(key, this.config.global.user);
        
        if (!globalResult.allowed) {
            this.handleViolation(key, 'global_user');
            
            return {
                ...globalResult,
                message: `너무 많은 요청을 보냈습니다. 잠시 후 다시 시도하세요.`
            };
        }
        
        // 길드 제한 확인 (길드 명령어인 경우)
        if (metadata.guildId) {
            const guildKey = `guild:${metadata.guildId}`;
            const guildResult = this.checkLimit(guildKey, this.config.global.guild);
            
            if (!guildResult.allowed) {
                return {
                    ...guildResult,
                    message: `서버 전체 요청 제한에 도달했습니다.`
                };
            }
        }
        
        // 요청 기록
        this.recordRequest(commandKey);
        this.recordRequest(key);
        
        if (metadata.guildId) {
            this.recordRequest(`guild:${metadata.guildId}`);
        }
        
        // 메트릭 기록
        metricsCollector.recordCustomMetric('rate_limit_requests', 1, 'counter');
        
        return { allowed: true };
    }
    
    // IP 기반 확인 (웹 서버용)
    async checkIpRequest(ip, endpoint) {
        const now = Date.now();
        const key = `ip:${ip}`;
        
        // 차단 확인
        if (this.isBlocked(key)) {
            const blockInfo = this.blocks.get(key);
            return {
                allowed: false,
                reason: 'blocked',
                retryAfter: Math.ceil((blockInfo.until - now) / 1000)
            };
        }
        
        // IP 제한 확인
        const result = this.checkLimit(key, this.config.global.ip);
        
        if (!result.allowed) {
            this.handleViolation(key, 'ip_limit');
            return result;
        }
        
        this.recordRequest(key);
        return { allowed: true };
    }
    
    // 제한 확인
    checkLimit(key, config) {
        const now = Date.now();
        const requests = this.getRequests(key);
        
        // 시간 창 내의 요청만 필터링
        const recentRequests = requests.filter(time => 
            now - time < config.window
        );
        
        // 버스트 허용량 계산
        const burstLimit = Math.ceil(config.limit * (1 + this.config.burstAllowance));
        
        if (recentRequests.length >= burstLimit) {
            const oldestRequest = Math.min(...recentRequests);
            const retryAfter = (oldestRequest + config.window) - now;
            
            return {
                allowed: false,
                reason: 'rate_limit',
                limit: config.limit,
                remaining: 0,
                retryAfter: Math.max(0, retryAfter)
            };
        }
        
        return {
            allowed: true,
            limit: config.limit,
            remaining: Math.max(0, config.limit - recentRequests.length),
            resetAt: now + config.window
        };
    }
    
    // 요청 기록
    recordRequest(key) {
        const requests = this.getRequests(key);
        requests.push(Date.now());
        
        // 메모리 절약을 위해 오래된 기록 제거
        const maxWindow = Math.max(
            ...Object.values(this.config.commands).map(c => c.window),
            ...Object.values(this.config.global).map(c => c.window)
        );
        
        const cutoff = Date.now() - maxWindow;
        const filtered = requests.filter(time => time > cutoff);
        
        if (key.includes(':')) {
            const [type, id, command] = key.split(':');
            
            if (type === 'user') {
                if (!this.userRequests.has(id)) {
                    this.userRequests.set(id, new Map());
                }
                this.userRequests.get(id).set(command || 'global', filtered);
            } else if (type === 'guild') {
                this.guildRequests.set(id, filtered);
            } else if (type === 'ip') {
                this.ipRequests.set(id, filtered);
            }
        }
    }
    
    // 요청 기록 가져오기
    getRequests(key) {
        const [type, id, command] = key.split(':');
        
        if (type === 'user') {
            const userMap = this.userRequests.get(id);
            if (!userMap) return [];
            return userMap.get(command || 'global') || [];
        } else if (type === 'guild') {
            return this.guildRequests.get(id) || [];
        } else if (type === 'ip') {
            return this.ipRequests.get(id) || [];
        }
        
        return [];
    }
    
    // 위반 처리
    handleViolation(key, reason) {
        const violations = this.violations.get(key) || 0;
        this.violations.set(key, violations + 1);
        
        logger.warn('Rate limit violation', {
            key,
            reason,
            violations: violations + 1
        });
        
        // 메트릭 기록
        metricsCollector.recordCustomMetric('rate_limit_violations', 1, 'counter');
        
        // 반복 위반 시 차단
        if (violations >= 2) {
            const blockLevel = Math.min(violations - 1, 4);
            const durations = Object.values(this.config.blockDuration);
            const duration = durations[Math.min(blockLevel, durations.length - 1)];
            
            this.block(key, duration, `Repeated violations (${violations + 1})`);
        }
    }
    
    // 차단
    block(key, duration, reason) {
        const now = Date.now();
        
        this.blocks.set(key, {
            until: now + duration,
            reason,
            createdAt: now
        });
        
        logger.warn('Rate limit block applied', {
            key,
            duration,
            reason,
            until: new Date(now + duration)
        });
        
        // 메트릭 기록
        metricsCollector.recordCustomMetric('rate_limit_blocks', 1, 'counter');
    }
    
    // 차단 해제
    unblock(key) {
        const wasBlocked = this.blocks.has(key);
        this.blocks.delete(key);
        this.violations.delete(key);
        
        if (wasBlocked) {
            logger.info('Rate limit block removed', { key });
        }
        
        return wasBlocked;
    }
    
    // 차단 확인
    isBlocked(key) {
        const blockInfo = this.blocks.get(key);
        if (!blockInfo) return false;
        
        if (Date.now() >= blockInfo.until) {
            this.blocks.delete(key);
            return false;
        }
        
        return true;
    }
    
    // 정리
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        // 만료된 차단 제거
        for (const [key, blockInfo] of this.blocks) {
            if (now >= blockInfo.until) {
                this.blocks.delete(key);
                cleaned++;
            }
        }
        
        // 오래된 요청 기록 정리
        const maxWindow = Math.max(
            ...Object.values(this.config.commands).map(c => c.window),
            ...Object.values(this.config.global).map(c => c.window)
        );
        
        const cutoff = now - maxWindow;
        
        // 사용자 요청 정리
        for (const [userId, userMap] of this.userRequests) {
            for (const [command, requests] of userMap) {
                const filtered = requests.filter(time => time > cutoff);
                if (filtered.length === 0) {
                    userMap.delete(command);
                } else {
                    userMap.set(command, filtered);
                }
            }
            
            if (userMap.size === 0) {
                this.userRequests.delete(userId);
            }
        }
        
        // 길드 요청 정리
        for (const [guildId, requests] of this.guildRequests) {
            const filtered = requests.filter(time => time > cutoff);
            if (filtered.length === 0) {
                this.guildRequests.delete(guildId);
            } else {
                this.guildRequests.set(guildId, filtered);
            }
        }
        
        // IP 요청 정리
        for (const [ip, requests] of this.ipRequests) {
            const filtered = requests.filter(time => time > cutoff);
            if (filtered.length === 0) {
                this.ipRequests.delete(ip);
            } else {
                this.ipRequests.set(ip, filtered);
            }
        }
        
        if (cleaned > 0) {
            logger.debug(`Rate limiter cleanup: ${cleaned} expired blocks removed`);
        }
    }
    
    // 상태 조회
    getStatus() {
        return {
            activeUsers: this.userRequests.size,
            activeGuilds: this.guildRequests.size,
            activeIps: this.ipRequests.size,
            blockedKeys: this.blocks.size,
            violations: this.violations.size
        };
    }
    
    // 사용자 상태 조회
    getUserStatus(userId) {
        const key = `user:${userId}`;
        const userMap = this.userRequests.get(userId);
        
        if (this.isBlocked(key)) {
            const blockInfo = this.blocks.get(key);
            return {
                blocked: true,
                until: blockInfo.until,
                reason: blockInfo.reason
            };
        }
        
        const status = {
            blocked: false,
            violations: this.violations.get(key) || 0,
            requests: {}
        };
        
        if (userMap) {
            for (const [command, requests] of userMap) {
                const config = command === 'global' 
                    ? this.config.global.user 
                    : this.config.commands[command] || this.config.commands.default;
                
                const recent = requests.filter(time => 
                    Date.now() - time < config.window
                );
                
                status.requests[command] = {
                    count: recent.length,
                    limit: config.limit,
                    remaining: Math.max(0, config.limit - recent.length)
                };
            }
        }
        
        return status;
    }
    
    // 설정 업데이트
    updateConfig(path, value) {
        const parts = path.split('.');
        let current = this.config;
        
        for (let i = 0; i < parts.length - 1; i++) {
            if (!(parts[i] in current)) {
                throw new Error(`Invalid config path: ${path}`);
            }
            current = current[parts[i]];
        }
        
        const lastPart = parts[parts.length - 1];
        const oldValue = current[lastPart];
        current[lastPart] = value;
        
        logger.info('Rate limiter config updated', {
            path,
            oldValue,
            newValue: value
        });
    }
    
    // 종료
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// 싱글톤 인스턴스
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;