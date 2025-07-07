// 입력 검증 및 살균 처리
const validator = require('validator');
const logger = require('../services/Logger');

class InputValidator {
    constructor() {
        // 검증 규칙
        this.rules = {
            // Discord ID 패턴
            discordId: /^\d{17,19}$/,
            
            // 사용자명 패턴 (한글, 영문, 숫자, 언더스코어)
            username: /^[\w\uAC00-\uD7AF]{2,32}$/,
            
            // 닉네임 패턴 (더 유연함)
            nickname: /^[\w\uAC00-\uD7AF\s]{1,32}$/,
            
            // 이메일 패턴
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            
            // 명령어 이름
            commandName: /^[a-z_-]{1,32}$/,
            
            // 채널/길드 ID
            snowflake: /^\d{17,19}$/,
            
            // 숫자 범위
            positiveInteger: /^\d+$/,
            
            // 아이템 이름
            itemName: /^[\w\uAC00-\uD7AF\s]{1,64}$/,
            
            // 검색 쿼리
            searchQuery: /^[\w\uAC00-\uD7AF\s\-\.]{1,100}$/
        };
        
        // SQL 인젝션 패턴
        this.sqlInjectionPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/i,
            /(--|#|\/\*|\*\/)/,
            /(\bOR\b\s*\d+\s*=\s*\d+)/i,
            /(\bAND\b\s*\d+\s*=\s*\d+)/i,
            /(\'|\"|;|\\)/
        ];
        
        // NoSQL 인젝션 패턴
        this.noSqlInjectionPatterns = [
            /(\$where|\$regex|\$ne|\$gt|\$lt|\$gte|\$lte)/,
            /({|}|\[|\])/,
            /(function\s*\(|=>)/
        ];
        
        // XSS 패턴
        this.xssPatterns = [
            /<script[^>]*>[\s\S]*?<\/script>/gi,
            /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
            /on\w+\s*=\s*["'][^"']*["']/gi,
            /javascript:/gi,
            /<img[^>]+src[\\s]*=[\\s]*["']javascript:/gi
        ];
        
        // 최대 길이
        this.maxLengths = {
            username: 32,
            nickname: 32,
            email: 254,
            message: 2000,
            description: 4096,
            searchQuery: 100,
            itemName: 64,
            url: 2048
        };
    }
    
    // 기본 검증
    validate(value, type) {
        if (value === null || value === undefined) {
            return { valid: false, error: '값이 없습니다.' };
        }
        
        const rule = this.rules[type];
        if (!rule) {
            return { valid: false, error: '알 수 없는 검증 타입입니다.' };
        }
        
        const stringValue = String(value);
        
        // 길이 체크
        const maxLength = this.maxLengths[type];
        if (maxLength && stringValue.length > maxLength) {
            return { 
                valid: false, 
                error: `최대 ${maxLength}자까지 입력 가능합니다.` 
            };
        }
        
        // 패턴 체크
        if (!rule.test(stringValue)) {
            return { 
                valid: false, 
                error: this.getErrorMessage(type) 
            };
        }
        
        // 추가 보안 체크
        if (this.containsSqlInjection(stringValue)) {
            logger.warn('SQL injection attempt detected', { value, type });
            return { 
                valid: false, 
                error: '허용되지 않는 문자가 포함되어 있습니다.' 
            };
        }
        
        if (this.containsNoSqlInjection(stringValue)) {
            logger.warn('NoSQL injection attempt detected', { value, type });
            return { 
                valid: false, 
                error: '허용되지 않는 패턴이 감지되었습니다.' 
            };
        }
        
        return { valid: true, value: stringValue };
    }
    
    // Discord ID 검증
    validateDiscordId(id) {
        const result = this.validate(id, 'discordId');
        
        if (result.valid) {
            // 추가 검증: 유효한 타임스탬프 범위
            const timestamp = this.getTimestampFromSnowflake(id);
            const minDate = new Date('2015-01-01'); // Discord 출시일
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 1); // 미래 날짜 방지
            
            if (timestamp < minDate || timestamp > maxDate) {
                return { 
                    valid: false, 
                    error: '유효하지 않은 Discord ID입니다.' 
                };
            }
        }
        
        return result;
    }
    
    // 이메일 검증
    validateEmail(email) {
        if (!email || typeof email !== 'string') {
            return { valid: false, error: '유효한 이메일을 입력하세요.' };
        }
        
        // validator 라이브러리 사용
        if (!validator.isEmail(email)) {
            return { valid: false, error: '올바른 이메일 형식이 아닙니다.' };
        }
        
        // 추가 체크
        if (email.length > this.maxLengths.email) {
            return { valid: false, error: '이메일이 너무 깁니다.' };
        }
        
        // 일회용 이메일 도메인 차단 (선택적)
        const blockedDomains = ['tempmail.com', 'throwaway.email'];
        const domain = email.split('@')[1];
        
        if (blockedDomains.includes(domain)) {
            return { 
                valid: false, 
                error: '일회용 이메일은 사용할 수 없습니다.' 
            };
        }
        
        return { valid: true, value: email.toLowerCase() };
    }
    
    // URL 검증
    validateUrl(url) {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: '유효한 URL을 입력하세요.' };
        }
        
        try {
            const urlObj = new URL(url);
            
            // 허용된 프로토콜만
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return { 
                    valid: false, 
                    error: '허용되지 않는 프로토콜입니다.' 
                };
            }
            
            // 로컬 주소 차단
            if (['localhost', '127.0.0.1', '0.0.0.0'].includes(urlObj.hostname)) {
                return { 
                    valid: false, 
                    error: '로컬 주소는 사용할 수 없습니다.' 
                };
            }
            
            return { valid: true, value: url };
        } catch {
            return { valid: false, error: '올바른 URL 형식이 아닙니다.' };
        }
    }
    
    // 숫자 검증
    validateNumber(value, options = {}) {
        const {
            min = -Infinity,
            max = Infinity,
            integer = false,
            positive = false
        } = options;
        
        const num = Number(value);
        
        if (isNaN(num)) {
            return { valid: false, error: '유효한 숫자가 아닙니다.' };
        }
        
        if (integer && !Number.isInteger(num)) {
            return { valid: false, error: '정수를 입력하세요.' };
        }
        
        if (positive && num < 0) {
            return { valid: false, error: '양수를 입력하세요.' };
        }
        
        if (num < min) {
            return { valid: false, error: `최소값은 ${min}입니다.` };
        }
        
        if (num > max) {
            return { valid: false, error: `최대값은 ${max}입니다.` };
        }
        
        return { valid: true, value: num };
    }
    
    // 배열 검증
    validateArray(value, options = {}) {
        const {
            minLength = 0,
            maxLength = Infinity,
            itemValidator = null
        } = options;
        
        if (!Array.isArray(value)) {
            return { valid: false, error: '배열이 아닙니다.' };
        }
        
        if (value.length < minLength) {
            return { 
                valid: false, 
                error: `최소 ${minLength}개 이상 필요합니다.` 
            };
        }
        
        if (value.length > maxLength) {
            return { 
                valid: false, 
                error: `최대 ${maxLength}개까지 가능합니다.` 
            };
        }
        
        // 각 항목 검증
        if (itemValidator) {
            for (let i = 0; i < value.length; i++) {
                const result = itemValidator(value[i]);
                if (!result.valid) {
                    return { 
                        valid: false, 
                        error: `${i + 1}번째 항목: ${result.error}` 
                    };
                }
            }
        }
        
        return { valid: true, value };
    }
    
    // 텍스트 살균
    sanitizeText(text, options = {}) {
        const {
            stripHtml = true,
            maxLength = null,
            allowedTags = []
        } = options;
        
        let sanitized = String(text);
        
        // HTML 제거
        if (stripHtml) {
            if (allowedTags.length > 0) {
                // 허용된 태그만 남기기
                const tagPattern = new RegExp(
                    `<(?!\/?(?:${allowedTags.join('|')})(?:\\s|>))[^>]+>`,
                    'gi'
                );
                sanitized = sanitized.replace(tagPattern, '');
            } else {
                // 모든 HTML 제거
                sanitized = sanitized.replace(/<[^>]*>/g, '');
            }
        }
        
        // 특수 문자 이스케이프
        sanitized = sanitized
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
        
        // 길이 제한
        if (maxLength && sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        // 공백 정리
        sanitized = sanitized.trim().replace(/\s+/g, ' ');
        
        return sanitized;
    }
    
    // MongoDB 쿼리 살균
    sanitizeMongoQuery(query) {
        if (typeof query !== 'object' || query === null) {
            return query;
        }
        
        const sanitized = {};
        
        for (const [key, value] of Object.entries(query)) {
            // $ 연산자 차단
            if (key.startsWith('$')) {
                logger.warn('MongoDB operator in user input blocked', { key });
                continue;
            }
            
            // 재귀적으로 살균
            if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeMongoQuery(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    // SQL 인젝션 검사
    containsSqlInjection(value) {
        const str = String(value).toLowerCase();
        return this.sqlInjectionPatterns.some(pattern => pattern.test(str));
    }
    
    // NoSQL 인젝션 검사
    containsNoSqlInjection(value) {
        const str = String(value);
        return this.noSqlInjectionPatterns.some(pattern => pattern.test(str));
    }
    
    // XSS 검사
    containsXss(value) {
        const str = String(value);
        return this.xssPatterns.some(pattern => pattern.test(str));
    }
    
    // 경로 순회 공격 검사
    containsPathTraversal(path) {
        const patterns = [
            /\.\./,
            /\.\.%2[fF]/,
            /%2[eE]\./,
            /\x00/
        ];
        
        return patterns.some(pattern => pattern.test(path));
    }
    
    // 파일명 살균
    sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/^\.+/, '')
            .substring(0, 255);
    }
    
    // Snowflake에서 타임스탬프 추출
    getTimestampFromSnowflake(snowflake) {
        const epoch = 1420070400000; // Discord epoch
        const timestamp = (BigInt(snowflake) >> 22n) + BigInt(epoch);
        return new Date(Number(timestamp));
    }
    
    // 에러 메시지
    getErrorMessage(type) {
        const messages = {
            discordId: '유효한 Discord ID를 입력하세요.',
            username: '사용자명은 2-32자의 영문, 한글, 숫자, 언더스코어만 가능합니다.',
            nickname: '닉네임은 1-32자의 영문, 한글, 숫자, 공백만 가능합니다.',
            email: '올바른 이메일 형식을 입력하세요.',
            commandName: '명령어 이름은 소문자, 언더스코어, 하이픈만 가능합니다.',
            snowflake: '유효한 ID를 입력하세요.',
            positiveInteger: '양의 정수를 입력하세요.',
            itemName: '아이템 이름은 1-64자까지 가능합니다.',
            searchQuery: '검색어는 1-100자까지 가능합니다.'
        };
        
        return messages[type] || '유효하지 않은 입력입니다.';
    }
}

// 싱글톤 인스턴스
const inputValidator = new InputValidator();

module.exports = inputValidator;