// 보안 감사 로거
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../services/Logger');

class AuditLogger {
    constructor() {
        this.auditDir = path.join(__dirname, '..', 'logs', 'audit');
        this.currentFile = null;
        this.writeQueue = [];
        this.isWriting = false;
        
        // 감사 이벤트 타입
        this.eventTypes = {
            // 인증 관련
            LOGIN_SUCCESS: 'auth.login.success',
            LOGIN_FAILED: 'auth.login.failed',
            LOGOUT: 'auth.logout',
            REGISTER: 'auth.register',
            
            // 권한 관련
            PERMISSION_GRANTED: 'permission.granted',
            PERMISSION_DENIED: 'permission.denied',
            ROLE_CHANGED: 'permission.role.changed',
            
            // 데이터 접근
            DATA_READ: 'data.read',
            DATA_WRITE: 'data.write',
            DATA_DELETE: 'data.delete',
            DATA_EXPORT: 'data.export',
            
            // 관리자 작업
            ADMIN_ACTION: 'admin.action',
            CONFIG_CHANGED: 'admin.config.changed',
            USER_BANNED: 'admin.user.banned',
            USER_UNBANNED: 'admin.user.unbanned',
            
            // 보안 이벤트
            SECURITY_VIOLATION: 'security.violation',
            RATE_LIMIT_EXCEEDED: 'security.ratelimit',
            SUSPICIOUS_ACTIVITY: 'security.suspicious',
            IP_BLOCKED: 'security.ip.blocked',
            
            // 시스템 이벤트
            SYSTEM_START: 'system.start',
            SYSTEM_STOP: 'system.stop',
            BACKUP_CREATED: 'system.backup.created',
            BACKUP_RESTORED: 'system.backup.restored',
            
            // 경제 관련
            CURRENCY_TRANSFER: 'economy.transfer',
            ITEM_TRADE: 'economy.trade',
            PURCHASE: 'economy.purchase',
            
            // 커스텀
            CUSTOM: 'custom'
        };
        
        this.initialize();
    }
    
    // 초기화
    async initialize() {
        try {
            await fs.mkdir(this.auditDir, { recursive: true });
            this.rotateFile();
            
            // 주기적 파일 로테이션
            setInterval(() => this.rotateFile(), 24 * 60 * 60 * 1000); // 24시간
            
            logger.info('Audit logger initialized');
        } catch (error) {
            logger.error('Failed to initialize audit logger', { error: error.message });
        }
    }
    
    // 감사 로그 기록
    async log(eventType, data = {}) {
        const entry = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            eventType,
            ...this.extractContext(data),
            data: this.sanitizeData(data),
            hash: null
        };
        
        // 무결성을 위한 해시 생성
        entry.hash = this.generateHash(entry);
        
        // 큐에 추가
        this.writeQueue.push(entry);
        
        // 비동기 쓰기
        this.processQueue();
        
        // 중요 이벤트는 즉시 메인 로거에도 기록
        if (this.isCriticalEvent(eventType)) {
            logger.warn('Critical audit event', entry);
        }
        
        return entry.id;
    }
    
    // 컨텍스트 추출
    extractContext(data) {
        const context = {
            userId: data.userId || null,
            guildId: data.guildId || null,
            ip: data.ip || null,
            userAgent: data.userAgent || null,
            sessionId: data.sessionId || null,
            requestId: data.requestId || null
        };
        
        // 실행자 정보
        if (data.executor) {
            context.executor = {
                id: data.executor.id,
                type: data.executor.type || 'user'
            };
        }
        
        // 대상 정보
        if (data.target) {
            context.target = {
                id: data.target.id,
                type: data.target.type || 'unknown'
            };
        }
        
        return context;
    }
    
    // 데이터 살균 (민감한 정보 제거)
    sanitizeData(data) {
        const sanitized = { ...data };
        
        // 민감한 필드 제거 또는 마스킹
        const sensitiveFields = [
            'password', 'token', 'secret', 'key', 'authorization',
            'creditCard', 'ssn', 'apiKey', 'privateKey'
        ];
        
        for (const field of sensitiveFields) {
            if (field in sanitized) {
                sanitized[field] = '[REDACTED]';
            }
        }
        
        // 이메일 마스킹
        if (sanitized.email) {
            sanitized.email = this.maskEmail(sanitized.email);
        }
        
        // IP 부분 마스킹 (GDPR 준수)
        if (sanitized.ip && process.env.MASK_IP === 'true') {
            sanitized.ip = this.maskIP(sanitized.ip);
        }
        
        return sanitized;
    }
    
    // 큐 처리
    async processQueue() {
        if (this.isWriting || this.writeQueue.length === 0) {
            return;
        }
        
        this.isWriting = true;
        
        try {
            const entries = this.writeQueue.splice(0, 100); // 배치 처리
            const lines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
            
            await fs.appendFile(this.currentFile, lines, 'utf8');
            
        } catch (error) {
            logger.error('Failed to write audit log', { error: error.message });
            
            // 실패한 항목 다시 큐에 추가
            this.writeQueue.unshift(...entries);
        } finally {
            this.isWriting = false;
            
            // 남은 항목이 있으면 다시 처리
            if (this.writeQueue.length > 0) {
                setTimeout(() => this.processQueue(), 100);
            }
        }
    }
    
    // 파일 로테이션
    async rotateFile() {
        const date = new Date().toISOString().split('T')[0];
        this.currentFile = path.join(this.auditDir, `audit-${date}.jsonl`);
        
        // 오래된 파일 압축
        this.compressOldFiles();
    }
    
    // 오래된 파일 압축
    async compressOldFiles() {
        try {
            const files = await fs.readdir(this.auditDir);
            const today = new Date().toISOString().split('T')[0];
            
            for (const file of files) {
                if (file.endsWith('.jsonl') && !file.includes(today)) {
                    // gzip으로 압축
                    const filePath = path.join(this.auditDir, file);
                    const { createGzip } = require('zlib');
                    const { pipeline } = require('stream/promises');
                    const source = require('fs').createReadStream(filePath);
                    const destination = require('fs').createWriteStream(`${filePath}.gz`);
                    const gzip = createGzip();
                    
                    await pipeline(source, gzip, destination);
                    await fs.unlink(filePath);
                    
                    logger.info('Compressed audit log', { file });
                }
            }
        } catch (error) {
            logger.error('Failed to compress audit logs', { error: error.message });
        }
    }
    
    // 감사 로그 검색
    async search(criteria) {
        const {
            startDate,
            endDate,
            eventType,
            userId,
            ip,
            limit = 100
        } = criteria;
        
        const results = [];
        
        try {
            const files = await this.getFilesInRange(startDate, endDate);
            
            for (const file of files) {
                const filePath = path.join(this.auditDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const entry = JSON.parse(line);
                        
                        // 필터링
                        if (eventType && entry.eventType !== eventType) continue;
                        if (userId && entry.userId !== userId) continue;
                        if (ip && entry.ip !== ip) continue;
                        
                        results.push(entry);
                        
                        if (results.length >= limit) {
                            return results;
                        }
                    } catch {
                        // 파싱 실패한 라인 무시
                    }
                }
            }
            
        } catch (error) {
            logger.error('Audit log search failed', { error: error.message });
        }
        
        return results;
    }
    
    // 날짜 범위의 파일 찾기
    async getFilesInRange(startDate, endDate) {
        const files = await fs.readdir(this.auditDir);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return files.filter(file => {
            const match = file.match(/audit-(\d{4}-\d{2}-\d{2})/);
            if (!match) return false;
            
            const fileDate = new Date(match[1]);
            return fileDate >= start && fileDate <= end;
        }).sort();
    }
    
    // 통계 생성
    async generateReport(startDate, endDate) {
        const entries = await this.search({ startDate, endDate, limit: Infinity });
        
        const report = {
            period: { startDate, endDate },
            totalEvents: entries.length,
            byEventType: {},
            byUser: {},
            byHour: Array(24).fill(0),
            topUsers: [],
            securityEvents: []
        };
        
        // 집계
        for (const entry of entries) {
            // 이벤트 타입별
            report.byEventType[entry.eventType] = 
                (report.byEventType[entry.eventType] || 0) + 1;
            
            // 사용자별
            if (entry.userId) {
                report.byUser[entry.userId] = 
                    (report.byUser[entry.userId] || 0) + 1;
            }
            
            // 시간대별
            const hour = new Date(entry.timestamp).getHours();
            report.byHour[hour]++;
            
            // 보안 이벤트
            if (entry.eventType.startsWith('security.')) {
                report.securityEvents.push({
                    timestamp: entry.timestamp,
                    type: entry.eventType,
                    userId: entry.userId,
                    data: entry.data
                });
            }
        }
        
        // 상위 사용자
        report.topUsers = Object.entries(report.byUser)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([userId, count]) => ({ userId, count }));
        
        return report;
    }
    
    // 무결성 검증
    async verifyIntegrity(date) {
        const file = path.join(this.auditDir, `audit-${date}.jsonl`);
        
        try {
            const content = await fs.readFile(file, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            let valid = 0;
            let invalid = 0;
            
            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    const originalHash = entry.hash;
                    
                    // 해시 재계산
                    delete entry.hash;
                    const calculatedHash = this.generateHash(entry);
                    
                    if (originalHash === calculatedHash) {
                        valid++;
                    } else {
                        invalid++;
                        logger.warn('Audit log integrity violation detected', {
                            entryId: entry.id,
                            timestamp: entry.timestamp
                        });
                    }
                } catch {
                    invalid++;
                }
            }
            
            return {
                date,
                total: lines.length,
                valid,
                invalid,
                integrity: invalid === 0
            };
            
        } catch (error) {
            logger.error('Integrity verification failed', { error: error.message });
            return { date, error: error.message };
        }
    }
    
    // 헬퍼 함수들
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    generateHash(entry) {
        const content = JSON.stringify({
            id: entry.id,
            timestamp: entry.timestamp,
            eventType: entry.eventType,
            userId: entry.userId,
            data: entry.data
        });
        
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    maskEmail(email) {
        const [local, domain] = email.split('@');
        const masked = local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1);
        return `${masked}@${domain}`;
    }
    
    maskIP(ip) {
        const parts = ip.split('.');
        if (parts.length === 4) {
            parts[3] = '0';
            return parts.join('.');
        }
        return ip;
    }
    
    isCriticalEvent(eventType) {
        const criticalEvents = [
            this.eventTypes.SECURITY_VIOLATION,
            this.eventTypes.USER_BANNED,
            this.eventTypes.ADMIN_ACTION,
            this.eventTypes.BACKUP_RESTORED,
            this.eventTypes.CONFIG_CHANGED
        ];
        
        return criticalEvents.includes(eventType);
    }
    
    // 특정 이벤트 로깅 헬퍼
    async logLogin(userId, success, metadata = {}) {
        return this.log(
            success ? this.eventTypes.LOGIN_SUCCESS : this.eventTypes.LOGIN_FAILED,
            { userId, ...metadata }
        );
    }
    
    async logPermission(userId, permission, granted, metadata = {}) {
        return this.log(
            granted ? this.eventTypes.PERMISSION_GRANTED : this.eventTypes.PERMISSION_DENIED,
            { userId, permission, ...metadata }
        );
    }
    
    async logDataAccess(userId, operation, resource, metadata = {}) {
        const eventMap = {
            read: this.eventTypes.DATA_READ,
            write: this.eventTypes.DATA_WRITE,
            delete: this.eventTypes.DATA_DELETE,
            export: this.eventTypes.DATA_EXPORT
        };
        
        return this.log(
            eventMap[operation] || this.eventTypes.DATA_READ,
            { userId, resource, ...metadata }
        );
    }
    
    async logAdminAction(adminId, action, target, metadata = {}) {
        return this.log(this.eventTypes.ADMIN_ACTION, {
            executor: { id: adminId, type: 'admin' },
            action,
            target,
            ...metadata
        });
    }
    
    async logSecurityEvent(type, details) {
        const eventMap = {
            violation: this.eventTypes.SECURITY_VIOLATION,
            ratelimit: this.eventTypes.RATE_LIMIT_EXCEEDED,
            suspicious: this.eventTypes.SUSPICIOUS_ACTIVITY,
            ipblock: this.eventTypes.IP_BLOCKED
        };
        
        return this.log(eventMap[type] || this.eventTypes.SECURITY_VIOLATION, details);
    }
}

// 싱글톤 인스턴스
const auditLogger = new AuditLogger();

module.exports = auditLogger;