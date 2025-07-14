// 권한 관리 시스템
const logger = require('../services/Logger');
const { config, isAdmin } = require('../config');

class PermissionManager {
    constructor() {
        // 역할 정의
        this.roles = {
            owner: {
                level: 100,
                permissions: ['*'] // 모든 권한
            },
            admin: {
                level: 90,
                permissions: [
                    'command.*',
                    'manage.users',
                    'manage.guilds',
                    'manage.items',
                    'manage.economy',
                    'view.logs',
                    'debug.*'
                ]
            },
            moderator: {
                level: 50,
                permissions: [
                    'command.ban',
                    'command.kick',
                    'command.mute',
                    'command.warn',
                    'manage.messages',
                    'view.reports'
                ]
            },
            vip: {
                level: 20,
                permissions: [
                    'command.vip',
                    'bypass.cooldown',
                    'extra.rewards'
                ]
            },
            verified: {
                level: 10,
                permissions: [
                    'command.trade',
                    'command.auction',
                    'command.pvp'
                ]
            },
            user: {
                level: 1,
                permissions: [
                    'command.basic',
                    'command.hunt',
                    'command.work',
                    'command.shop',
                    'command.inventory'
                ]
            },
            guest: {
                level: 0,
                permissions: [
                    'command.help',
                    'command.info',
                    'command.register'
                ]
            }
        };
        
        // 명령어별 필요 권한
        this.commandPermissions = {
            // 관리자 명령어
            ban: 'command.ban',
            kick: 'command.kick',
            mute: 'command.mute',
            warn: 'command.warn',
            give: 'manage.economy',
            spawn: 'manage.items',
            reset: 'manage.users',
            backup: 'command.backup',
            restore: 'command.restore',
            
            // 일반 명령어
            hunt: 'command.hunt',
            work: 'command.work',
            shop: 'command.shop',
            inventory: 'command.basic',
            profile: 'command.basic',
            
            // 인증 필요 명령어
            trade: 'command.trade',
            auction: 'command.auction',
            pvp: 'command.pvp',
            
            // 게스트 명령어
            help: 'command.help',
            info: 'command.info',
            register: 'command.register'
        };
        
        // 사용자 역할 캐시
        this.userRoles = new Map();
        
        // 권한 오버라이드
        this.overrides = new Map();
    }
    
    // 사용자 역할 가져오기
    async getUserRole(userId, guildId = null) {
        // 캐시 확인
        const cacheKey = `${userId}:${guildId || 'global'}`;
        if (this.userRoles.has(cacheKey)) {
            return this.userRoles.get(cacheKey);
        }
        
        // 소유자 확인
        if (config.OWNER_ID === userId) {
            this.userRoles.set(cacheKey, 'owner');
            return 'owner';
        }
        
        // 관리자 확인
        if (isAdmin(userId)) {
            this.userRoles.set(cacheKey, 'admin');
            return 'admin';
        }
        
        // 데이터베이스에서 역할 조회
        try {
            const User = require('../models/User');
            const user = await User.findOne({ discordId: userId });
            
            if (!user) {
                this.userRoles.set(cacheKey, 'guest');
                return 'guest';
            }
            
            // 역할 우선순위에 따라 결정
            let role = 'user';
            
            if (!user.registered) {
                role = 'guest';
            } else if (user.verified) {
                role = 'verified';
            }
            
            if (user.vip && user.vipExpiry > new Date()) {
                role = 'vip';
            }
            
            if (user.isModerator) {
                role = 'moderator';
            }
            
            this.userRoles.set(cacheKey, role);
            return role;
            
        } catch (error) {
            logger.error('Error fetching user role', { userId, error: error.message });
            return 'guest';
        }
    }
    
    // 권한 확인
    async hasPermission(userId, permission, guildId = null) {
        // 권한 오버라이드 확인
        const overrideKey = `${userId}:${permission}`;
        if (this.overrides.has(overrideKey)) {
            const override = this.overrides.get(overrideKey);
            if (override.expires && override.expires < Date.now()) {
                this.overrides.delete(overrideKey);
            } else {
                return override.allowed;
            }
        }
        
        // 사용자 역할 가져오기
        const role = await this.getUserRole(userId, guildId);
        const roleData = this.roles[role];
        
        if (!roleData) {
            logger.warn('Unknown role', { userId, role });
            return false;
        }
        
        // 와일드카드 권한 확인
        if (roleData.permissions.includes('*')) {
            return true;
        }
        
        // 특정 권한 확인
        if (roleData.permissions.includes(permission)) {
            return true;
        }
        
        // 와일드카드 매칭
        const permissionParts = permission.split('.');
        
        for (const perm of roleData.permissions) {
            if (perm.includes('*')) {
                const permParts = perm.split('.');
                let matches = true;
                
                for (let i = 0; i < permParts.length; i++) {
                    if (permParts[i] === '*') {
                        break;
                    }
                    
                    if (permParts[i] !== permissionParts[i]) {
                        matches = false;
                        break;
                    }
                }
                
                if (matches) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // 명령어 권한 확인
    async canExecuteCommand(userId, commandName, guildId = null) {
        const permission = this.commandPermissions[commandName];
        
        if (!permission) {
            // 정의되지 않은 명령어는 기본적으로 허용
            logger.debug('Command has no permission requirement', { commandName });
            return true;
        }
        
        const hasPermission = await this.hasPermission(userId, permission, guildId);
        
        if (!hasPermission) {
            logger.info('Permission denied', {
                userId,
                commandName,
                permission,
                guildId
            });
        }
        
        return hasPermission;
    }
    
    // 역할 레벨 확인
    async hasRoleLevel(userId, requiredLevel, guildId = null) {
        const role = await this.getUserRole(userId, guildId);
        const roleData = this.roles[role];
        
        return roleData && roleData.level >= requiredLevel;
    }
    
    // 권한 부여
    grantPermission(userId, permission, duration = null) {
        const overrideKey = `${userId}:${permission}`;
        
        this.overrides.set(overrideKey, {
            allowed: true,
            grantedAt: Date.now(),
            expires: duration ? Date.now() + duration : null
        });
        
        logger.info('Permission granted', {
            userId,
            permission,
            duration
        });
        
        return true;
    }
    
    // 권한 제거
    revokePermission(userId, permission) {
        const overrideKey = `${userId}:${permission}`;
        const had = this.overrides.has(overrideKey);
        
        this.overrides.delete(overrideKey);
        
        if (had) {
            logger.info('Permission revoked', {
                userId,
                permission
            });
        }
        
        return had;
    }
    
    // 역할 설정
    async setUserRole(userId, role, guildId = null) {
        if (!this.roles[role]) {
            throw new Error(`Invalid role: ${role}`);
        }
        
        try {
            const User = require('../models/User');
            const updateData = {};
            
            // 역할에 따른 플래그 업데이트
            switch (role) {
                case 'moderator':
                    updateData.isModerator = true;
                    break;
                case 'vip':
                    updateData.vip = true;
                    updateData.vipExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30일
                    break;
                case 'verified':
                    updateData.verified = true;
                    break;
            }
            
            await User.updateOne({ discordId: userId }, updateData);
            
            // 캐시 초기화
            const cacheKey = `${userId}:${guildId || 'global'}`;
            this.userRoles.set(cacheKey, role);
            
            logger.info('User role updated', {
                userId,
                role,
                guildId
            });
            
            return true;
            
        } catch (error) {
            logger.error('Failed to set user role', {
                userId,
                role,
                error: error.message
            });
            
            throw error;
        }
    }
    
    // 권한 목록 조회
    async getUserPermissions(userId, guildId = null) {
        const role = await this.getUserRole(userId, guildId);
        const roleData = this.roles[role];
        
        if (!roleData) {
            return [];
        }
        
        const permissions = new Set(roleData.permissions);
        
        // 오버라이드 추가
        for (const [key, override] of this.overrides) {
            if (key.startsWith(`${userId}:`)) {
                const permission = key.split(':')[1];
                
                if (override.expires && override.expires < Date.now()) {
                    this.overrides.delete(key);
                    continue;
                }
                
                if (override.allowed) {
                    permissions.add(permission);
                } else {
                    permissions.delete(permission);
                }
            }
        }
        
        return Array.from(permissions);
    }
    
    // 권한 검증 미들웨어
    requirePermission(permission) {
        return async (interaction) => {
            const hasPermission = await this.hasPermission(
                interaction.user.id,
                permission,
                interaction.guild?.id
            );
            
            if (!hasPermission) {
                await interaction.reply({
                    content: '❌ 이 명령어를 사용할 권한이 없습니다.',
                    flags: 64
                });
                
                return false;
            }
            
            return true;
        };
    }
    
    // 역할 레벨 검증 미들웨어
    requireRoleLevel(level) {
        return async (interaction) => {
            const hasLevel = await this.hasRoleLevel(
                interaction.user.id,
                level,
                interaction.guild?.id
            );
            
            if (!hasLevel) {
                await interaction.reply({
                    content: '❌ 이 명령어를 사용하기 위한 역할 레벨이 부족합니다.',
                    flags: 64
                });
                
                return false;
            }
            
            return true;
        };
    }
    
    // 캐시 초기화
    clearCache(userId = null) {
        if (userId) {
            // 특정 사용자 캐시만 삭제
            const keysToDelete = [];
            
            for (const key of this.userRoles.keys()) {
                if (key.startsWith(`${userId}:`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => this.userRoles.delete(key));
        } else {
            // 전체 캐시 삭제
            this.userRoles.clear();
        }
        
        logger.debug('Permission cache cleared', { userId });
    }
    
    // 권한 감사 로그
    async auditPermissionCheck(userId, permission, result, context = {}) {
        logger.info('Permission check audit', {
            userId,
            permission,
            granted: result,
            ...context,
            timestamp: new Date()
        });
    }
    
    // 권한 리포트
    async generatePermissionReport(userId) {
        const role = await this.getUserRole(userId);
        const permissions = await this.getUserPermissions(userId);
        
        const report = {
            userId,
            role,
            roleLevel: this.roles[role]?.level || 0,
            permissions: permissions.sort(),
            overrides: [],
            commands: {}
        };
        
        // 오버라이드 정보
        for (const [key, override] of this.overrides) {
            if (key.startsWith(`${userId}:`)) {
                const permission = key.split(':')[1];
                report.overrides.push({
                    permission,
                    allowed: override.allowed,
                    expires: override.expires
                });
            }
        }
        
        // 명령어 권한 체크
        for (const [command, permission] of Object.entries(this.commandPermissions)) {
            report.commands[command] = permissions.includes(permission) || 
                                      permissions.includes('*') ||
                                      permissions.some(p => 
                                          p.includes('*') && 
                                          permission.startsWith(p.replace('*', ''))
                                      );
        }
        
        return report;
    }
}

// 싱글톤 인스턴스
const permissionManager = new PermissionManager();

module.exports = permissionManager;