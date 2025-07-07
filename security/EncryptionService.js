// 암호화 서비스
const crypto = require('crypto');
const logger = require('../services/Logger');

class EncryptionService {
    constructor() {
        // 암호화 키 생성 또는 로드
        this.algorithm = 'aes-256-gcm';
        this.saltLength = 32;
        this.tagLength = 16;
        this.ivLength = 16;
        this.keyDerivationIterations = 100000;
        
        // 마스터 키 (환경 변수에서 로드하거나 생성)
        this.masterKey = this.loadOrGenerateMasterKey();
        
        // 키 로테이션 정보
        this.keyVersion = 1;
        this.keyRotationSchedule = 90 * 24 * 60 * 60 * 1000; // 90일
    }
    
    // 마스터 키 로드 또는 생성
    loadOrGenerateMasterKey() {
        if (process.env.ENCRYPTION_KEY) {
            return Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
        }
        
        // 프로덕션에서는 반드시 환경 변수 사용
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Encryption key must be set in production');
        }
        
        // 개발 환경용 임시 키
        logger.warn('Using temporary encryption key for development');
        return crypto.randomBytes(32);
    }
    
    // 데이터 암호화
    async encrypt(data, additionalData = null) {
        try {
            // 입력 검증
            if (!data) {
                throw new Error('No data to encrypt');
            }
            
            // 문자열로 변환
            const plaintext = typeof data === 'string' 
                ? data 
                : JSON.stringify(data);
            
            // 암호화 컴포넌트 생성
            const salt = crypto.randomBytes(this.saltLength);
            const iv = crypto.randomBytes(this.ivLength);
            
            // 키 유도
            const key = await this.deriveKey(this.masterKey, salt);
            
            // 암호화
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);
            
            if (additionalData) {
                cipher.setAAD(Buffer.from(additionalData));
            }
            
            const encrypted = Buffer.concat([
                cipher.update(plaintext, 'utf8'),
                cipher.final()
            ]);
            
            const tag = cipher.getAuthTag();
            
            // 결과 조합
            const combined = Buffer.concat([
                Buffer.from([this.keyVersion]), // 1 바이트
                salt, // 32 바이트
                iv, // 16 바이트
                tag, // 16 바이트
                encrypted
            ]);
            
            return {
                encrypted: combined.toString('base64'),
                keyVersion: this.keyVersion
            };
            
        } catch (error) {
            logger.error('Encryption failed', { error: error.message });
            throw new Error('암호화 실패');
        }
    }
    
    // 데이터 복호화
    async decrypt(encryptedData, additionalData = null) {
        try {
            // 입력 검증
            if (!encryptedData || !encryptedData.encrypted) {
                throw new Error('Invalid encrypted data');
            }
            
            const combined = Buffer.from(encryptedData.encrypted, 'base64');
            
            // 컴포넌트 추출
            let offset = 0;
            const keyVersion = combined[offset++];
            const salt = combined.slice(offset, offset + this.saltLength);
            offset += this.saltLength;
            const iv = combined.slice(offset, offset + this.ivLength);
            offset += this.ivLength;
            const tag = combined.slice(offset, offset + this.tagLength);
            offset += this.tagLength;
            const encrypted = combined.slice(offset);
            
            // 키 버전 확인
            if (keyVersion !== this.keyVersion) {
                logger.warn('Key version mismatch', { 
                    expected: this.keyVersion, 
                    actual: keyVersion 
                });
            }
            
            // 키 유도
            const key = await this.deriveKey(this.masterKey, salt);
            
            // 복호화
            const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
            decipher.setAuthTag(tag);
            
            if (additionalData) {
                decipher.setAAD(Buffer.from(additionalData));
            }
            
            const decrypted = Buffer.concat([
                decipher.update(encrypted),
                decipher.final()
            ]);
            
            const plaintext = decrypted.toString('utf8');
            
            // JSON 파싱 시도
            try {
                return JSON.parse(plaintext);
            } catch {
                return plaintext;
            }
            
        } catch (error) {
            logger.error('Decryption failed', { error: error.message });
            throw new Error('복호화 실패');
        }
    }
    
    // 단방향 해시
    hash(data, salt = null) {
        const actualSalt = salt || crypto.randomBytes(16);
        const hash = crypto
            .createHash('sha256')
            .update(actualSalt)
            .update(data)
            .digest();
        
        return {
            hash: hash.toString('base64'),
            salt: actualSalt.toString('base64')
        };
    }
    
    // 해시 검증
    verifyHash(data, hash, salt) {
        const computed = this.hash(data, Buffer.from(salt, 'base64'));
        return computed.hash === hash;
    }
    
    // 비밀번호 해싱 (bcrypt 대체)
    async hashPassword(password) {
        const salt = crypto.randomBytes(16);
        const hash = await this.pbkdf2(password, salt, this.keyDerivationIterations);
        
        return {
            hash: hash.toString('base64'),
            salt: salt.toString('base64'),
            iterations: this.keyDerivationIterations
        };
    }
    
    // 비밀번호 검증
    async verifyPassword(password, storedHash, salt, iterations = this.keyDerivationIterations) {
        const hash = await this.pbkdf2(
            password, 
            Buffer.from(salt, 'base64'), 
            iterations
        );
        
        return hash.toString('base64') === storedHash;
    }
    
    // 토큰 생성
    generateToken(length = 32) {
        return crypto.randomBytes(length).toString('base64url');
    }
    
    // 안전한 랜덤 문자열
    generateSecureString(length = 16, charset = 'alphanumeric') {
        const charsets = {
            alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
            numeric: '0123456789',
            hex: '0123456789abcdef'
        };
        
        const chars = charsets[charset] || charsets.alphanumeric;
        const bytes = crypto.randomBytes(length);
        const result = new Array(length);
        
        for (let i = 0; i < length; i++) {
            result[i] = chars[bytes[i] % chars.length];
        }
        
        return result.join('');
    }
    
    // 데이터 서명
    sign(data, key = null) {
        const signingKey = key || this.masterKey;
        const sign = crypto.createHmac('sha256', signingKey);
        sign.update(typeof data === 'string' ? data : JSON.stringify(data));
        
        return sign.digest('base64');
    }
    
    // 서명 검증
    verifySignature(data, signature, key = null) {
        const signingKey = key || this.masterKey;
        const computed = this.sign(data, signingKey);
        
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'base64'),
            Buffer.from(computed, 'base64')
        );
    }
    
    // 민감한 데이터 마스킹
    mask(data, options = {}) {
        const {
            showFirst = 3,
            showLast = 3,
            maskChar = '*',
            minLength = 10
        } = options;
        
        if (!data || typeof data !== 'string') {
            return data;
        }
        
        if (data.length < minLength) {
            return maskChar.repeat(data.length);
        }
        
        const first = data.slice(0, showFirst);
        const last = data.slice(-showLast);
        const middle = maskChar.repeat(Math.max(0, data.length - showFirst - showLast));
        
        return first + middle + last;
    }
    
    // 이메일 마스킹
    maskEmail(email) {
        if (!email || !email.includes('@')) {
            return email;
        }
        
        const [local, domain] = email.split('@');
        const maskedLocal = this.mask(local, { 
            showFirst: 2, 
            showLast: 1, 
            minLength: 5 
        });
        
        return `${maskedLocal}@${domain}`;
    }
    
    // 민감한 필드 암호화
    async encryptFields(object, fields) {
        const encrypted = { ...object };
        
        for (const field of fields) {
            if (field in encrypted && encrypted[field]) {
                const result = await this.encrypt(encrypted[field]);
                encrypted[field] = result.encrypted;
                encrypted[`${field}_encrypted`] = true;
                encrypted[`${field}_key_version`] = result.keyVersion;
            }
        }
        
        return encrypted;
    }
    
    // 민감한 필드 복호화
    async decryptFields(object, fields) {
        const decrypted = { ...object };
        
        for (const field of fields) {
            if (decrypted[`${field}_encrypted`] && decrypted[field]) {
                try {
                    decrypted[field] = await this.decrypt({
                        encrypted: decrypted[field],
                        keyVersion: decrypted[`${field}_key_version`]
                    });
                    
                    delete decrypted[`${field}_encrypted`];
                    delete decrypted[`${field}_key_version`];
                } catch (error) {
                    logger.error('Field decryption failed', { field, error: error.message });
                }
            }
        }
        
        return decrypted;
    }
    
    // 헬퍼 함수들
    async deriveKey(masterKey, salt) {
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(masterKey, salt, 10000, 32, 'sha256', (err, derivedKey) => {
                if (err) reject(err);
                else resolve(derivedKey);
            });
        });
    }
    
    async pbkdf2(password, salt, iterations) {
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(password, salt, iterations, 32, 'sha256', (err, derivedKey) => {
                if (err) reject(err);
                else resolve(derivedKey);
            });
        });
    }
    
    // 키 로테이션
    async rotateKeys() {
        logger.info('Starting key rotation');
        
        // 새 마스터 키 생성
        const newMasterKey = crypto.randomBytes(32);
        const oldMasterKey = this.masterKey;
        
        // 버전 증가
        this.keyVersion++;
        
        // 데이터 재암호화 로직 (실제 구현 시 필요)
        // 모든 암호화된 데이터를 찾아서 재암호화해야 함
        
        this.masterKey = newMasterKey;
        
        logger.info('Key rotation completed', { newKeyVersion: this.keyVersion });
        
        return {
            oldKey: oldMasterKey.toString('base64'),
            newKey: newMasterKey.toString('base64'),
            version: this.keyVersion
        };
    }
}

// 싱글톤 인스턴스
const encryptionService = new EncryptionService();

module.exports = encryptionService;