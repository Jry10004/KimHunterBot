// 보안 미들웨어
const inputValidator = require('./InputValidator');
const rateLimiter = require('./RateLimiter');
const permissionManager = require('./PermissionManager');
const encryptionService = require('./EncryptionService');
const logger = require('../services/Logger');
const { logCommand, logCommandComplete } = require('../middleware/logging');

// 명령어 보안 미들웨어
function secureCommand(options = {}) {
    const {
        rateLimit = true,
        validateInput = true,
        checkPermission = true,
        logActivity = true,
        validationRules = {}
    } = options;
    
    return async function(interaction) {
        const commandName = interaction.commandName;
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;
        
        let context = null;
        
        try {
            // 1. Rate Limiting
            if (rateLimit) {
                const rateLimitResult = await rateLimiter.checkRequest(
                    userId, 
                    commandName,
                    { guildId }
                );
                
                if (!rateLimitResult.allowed) {
                    await interaction.reply({
                        content: `⏱️ ${rateLimitResult.message}`,
                        ephemeral: true
                    });
                    return false;
                }
            }
            
            // 2. 권한 확인
            if (checkPermission) {
                const hasPermission = await permissionManager.canExecuteCommand(
                    userId,
                    commandName,
                    guildId
                );
                
                if (!hasPermission) {
                    await interaction.reply({
                        content: '❌ 이 명령어를 사용할 권한이 없습니다.',
                        ephemeral: true
                    });
                    
                    logger.warn('Unauthorized command attempt', {
                        userId,
                        commandName,
                        guildId
                    });
                    
                    return false;
                }
            }
            
            // 3. 입력 검증
            if (validateInput && validationRules) {
                for (const [optionName, rule] of Object.entries(validationRules)) {
                    const value = interaction.options.getString(optionName) ||
                                 interaction.options.getInteger(optionName) ||
                                 interaction.options.getUser(optionName)?.id;
                    
                    if (value !== null) {
                        const validation = inputValidator.validate(value, rule);
                        
                        if (!validation.valid) {
                            await interaction.reply({
                                content: `❌ 입력 오류: ${validation.error}`,
                                ephemeral: true
                            });
                            
                            logger.warn('Invalid input detected', {
                                userId,
                                commandName,
                                option: optionName,
                                error: validation.error
                            });
                            
                            return false;
                        }
                    }
                }
            }
            
            // 4. 활동 로깅
            if (logActivity) {
                context = await logCommand(commandName)(interaction);
            }
            
            return true;
            
        } catch (error) {
            logger.error('Security middleware error', {
                commandName,
                userId,
                error: error.message
            });
            
            if (context) {
                logCommandComplete(commandName, context, false, error);
            }
            
            return false;
        }
    };
}

// 상호작용 보안 미들웨어
function secureInteraction(options = {}) {
    const {
        rateLimit = true,
        checkPermission = false,
        validateCustomId = true
    } = options;
    
    return async function(interaction) {
        const userId = interaction.user.id;
        const customId = interaction.customId;
        
        try {
            // 1. Rate Limiting
            if (rateLimit) {
                const rateLimitResult = await rateLimiter.checkRequest(
                    userId,
                    'interaction',
                    { type: interaction.type }
                );
                
                if (!rateLimitResult.allowed) {
                    await interaction.reply({
                        content: '⏱️ 너무 빠른 상호작용입니다. 잠시 후 다시 시도하세요.',
                        ephemeral: true
                    });
                    return false;
                }
            }
            
            // 2. Custom ID 검증
            if (validateCustomId && customId) {
                // XSS 및 인젝션 체크
                if (inputValidator.containsXss(customId) || 
                    inputValidator.containsSqlInjection(customId)) {
                    
                    logger.warn('Malicious custom ID detected', {
                        userId,
                        customId
                    });
                    
                    return false;
                }
            }
            
            // 3. 권한 확인 (필요한 경우)
            if (checkPermission && customId) {
                // customId에서 필요 권한 추출 (예: admin_panel_delete)
                const parts = customId.split('_');
                if (parts[0] === 'admin' || parts[0] === 'mod') {
                    const hasPermission = await permissionManager.hasPermission(
                        userId,
                        `command.${parts[0]}`,
                        interaction.guild?.id
                    );
                    
                    if (!hasPermission) {
                        await interaction.reply({
                            content: '❌ 권한이 없습니다.',
                            ephemeral: true
                        });
                        return false;
                    }
                }
            }
            
            return true;
            
        } catch (error) {
            logger.error('Interaction security error', {
                userId,
                customId,
                error: error.message
            });
            
            return false;
        }
    };
}

// 데이터 보안 래퍼
function secureData(fields = []) {
    return {
        // 저장 전 암호화
        async beforeSave(doc) {
            if (fields.length > 0) {
                const encrypted = await encryptionService.encryptFields(
                    doc.toObject(),
                    fields
                );
                
                for (const field of fields) {
                    if (encrypted[field]) {
                        doc[field] = encrypted[field];
                        doc[`${field}_encrypted`] = true;
                        doc[`${field}_key_version`] = encrypted[`${field}_key_version`];
                    }
                }
            }
        },
        
        // 조회 후 복호화
        async afterFind(docs) {
            if (!Array.isArray(docs)) {
                docs = [docs];
            }
            
            for (const doc of docs) {
                if (doc && fields.length > 0) {
                    const decrypted = await encryptionService.decryptFields(
                        doc.toObject ? doc.toObject() : doc,
                        fields
                    );
                    
                    for (const field of fields) {
                        if (decrypted[field] !== undefined) {
                            doc[field] = decrypted[field];
                        }
                    }
                }
            }
        }
    };
}

// API 보안 미들웨어 (Express용)
function secureAPI(options = {}) {
    const {
        rateLimit = true,
        requireAuth = true,
        validateBody = true,
        cors = true
    } = options;
    
    return async function(req, res, next) {
        try {
            // 1. CORS 헤더
            if (cors) {
                res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                
                if (req.method === 'OPTIONS') {
                    return res.sendStatus(200);
                }
            }
            
            // 2. Rate Limiting
            if (rateLimit) {
                const ip = req.ip || req.connection.remoteAddress;
                const endpoint = req.path;
                
                const rateLimitResult = await rateLimiter.checkIpRequest(ip, endpoint);
                
                if (!rateLimitResult.allowed) {
                    res.setHeader('Retry-After', rateLimitResult.retryAfter);
                    return res.status(429).json({
                        error: 'Too Many Requests',
                        retryAfter: rateLimitResult.retryAfter
                    });
                }
            }
            
            // 3. 인증 확인
            if (requireAuth) {
                const token = req.headers.authorization?.replace('Bearer ', '');
                
                if (!token) {
                    return res.status(401).json({ error: 'Authentication required' });
                }
                
                // 토큰 검증
                try {
                    const payload = await verifyToken(token);
                    req.user = payload;
                } catch {
                    return res.status(401).json({ error: 'Invalid token' });
                }
            }
            
            // 4. Body 검증
            if (validateBody && req.body) {
                const sanitized = sanitizeRequestBody(req.body);
                req.body = sanitized;
            }
            
            next();
            
        } catch (error) {
            logger.error('API security middleware error', {
                path: req.path,
                method: req.method,
                error: error.message
            });
            
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}

// 토큰 검증 (예시)
async function verifyToken(token) {
    // JWT 또는 세션 토큰 검증 로직
    // 여기서는 간단한 예시
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid token format');
    }
    
    // 실제로는 JWT 라이브러리 사용
    return {
        userId: 'decoded-user-id',
        permissions: []
    };
}

// 요청 본문 살균
function sanitizeRequestBody(body, depth = 0) {
    if (depth > 10) {
        throw new Error('Object depth limit exceeded');
    }
    
    if (Array.isArray(body)) {
        return body.map(item => sanitizeRequestBody(item, depth + 1));
    }
    
    if (body && typeof body === 'object') {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(body)) {
            // 위험한 키 차단
            if (key.startsWith('$') || key.startsWith('__')) {
                logger.warn('Dangerous key blocked', { key });
                continue;
            }
            
            // 재귀적으로 살균
            sanitized[key] = sanitizeRequestBody(value, depth + 1);
        }
        
        return sanitized;
    }
    
    // 문자열 살균
    if (typeof body === 'string') {
        return inputValidator.sanitizeText(body);
    }
    
    return body;
}

// IP 차단 미들웨어
const blockedIPs = new Set();

function blockIP(ip, duration = 3600000) {
    blockedIPs.add(ip);
    
    setTimeout(() => {
        blockedIPs.delete(ip);
    }, duration);
    
    logger.warn('IP blocked', { ip, duration });
}

function ipBlocking() {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        
        if (blockedIPs.has(ip)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        next();
    };
}

module.exports = {
    secureCommand,
    secureInteraction,
    secureData,
    secureAPI,
    blockIP,
    ipBlocking,
    sanitizeRequestBody
};