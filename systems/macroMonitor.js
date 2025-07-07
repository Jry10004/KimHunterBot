const antiMacro = require('./antiMacro');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

// 매크로 모니터링 시스템
class MacroMonitor {
    constructor() {
        // 최근 CAPTCHA 전송 기록 (중복 방지)
        this.recentCaptchas = new Map();
        // CAPTCHA 쿨다운 (5분)
        this.captchaCooldown = 5 * 60 * 1000;
        // 자동 감지 활성화 여부
        this.autoDetectionEnabled = true;
    }

    // 인터랙션 모니터링
    async monitorInteraction(interaction) {
        const userId = interaction.user.id;
        
        // 봇이나 시스템 메시지는 무시
        if (interaction.user.bot) return null;
        
        // 제재 상태 확인
        const penaltyStatus = antiMacro.checkPenaltyStatus(userId);
        if (penaltyStatus.restricted) {
            return penaltyStatus;
        }
        
        // 화이트리스트 확인
        if (antiMacro.isExempted(userId)) {
            return null;
        }
        
        // 행동 타입 분류
        const actionType = this.classifyAction(interaction);
        
        // 행동 기록
        antiMacro.recordUserAction(userId, actionType);
        
        // 패턴 분석 결과 확인
        const pattern = antiMacro.ANTI_MACRO.userPatterns.get(userId);
        if (!pattern) return null;
        
        // 자동 감지가 꺼져있으면 기록만 하고 종료
        if (!this.autoDetectionEnabled) return null;
        
        // 의심 점수가 높고 최근에 CAPTCHA를 보내지 않았다면
        if (pattern.suspicionScore >= 70 && !this.hasRecentCaptcha(userId)) {
            const captchaResult = await antiMacro.triggerCaptchaVerification(userId, interaction.channel);
            if (captchaResult && captchaResult.type === 'captcha_required') {
                this.recordCaptchaSent(userId);
                return {
                    type: 'captcha_required',
                    captcha: captchaResult
                };
            }
        }
        
        return null;
    }
    
    // 행동 타입 분류 (더 세밀하게)
    classifyAction(interaction) {
        if (interaction.isCommand()) {
            return `cmd:${interaction.commandName}`;
        } else if (interaction.isButton()) {
            const customId = interaction.customId;
            // 게임 관련 버튼 분류
            if (customId.includes('hunt') || customId.includes('dungeon')) {
                return 'game:combat';
            } else if (customId.includes('shop') || customId.includes('buy')) {
                return 'game:shop';
            } else if (customId.includes('enhance')) {
                return 'game:enhance';
            }
            return `btn:${customId.split('_')[0]}`;
        } else if (interaction.isStringSelectMenu()) {
            return `select:${interaction.customId.split('_')[0]}`;
        } else if (interaction.isModalSubmit()) {
            return 'modal:submit';
        }
        return 'other';
    }
    
    // 최근 CAPTCHA 전송 여부 확인
    hasRecentCaptcha(userId) {
        const lastSent = this.recentCaptchas.get(userId);
        if (!lastSent) return false;
        return Date.now() - lastSent < this.captchaCooldown;
    }
    
    // CAPTCHA 전송 기록
    recordCaptchaSent(userId) {
        this.recentCaptchas.set(userId, Date.now());
        
        // 오래된 기록 정리
        for (const [uid, timestamp] of this.recentCaptchas.entries()) {
            if (Date.now() - timestamp > this.captchaCooldown * 2) {
                this.recentCaptchas.delete(uid);
            }
        }
    }
    
    // 자동 감지 토글
    toggleAutoDetection(enabled) {
        this.autoDetectionEnabled = enabled;
        return this.autoDetectionEnabled;
    }
    
    // 의심 유저 목록 가져오기
    getSuspiciousUsers(threshold = 50) {
        const suspicious = [];
        for (const [userId, pattern] of antiMacro.ANTI_MACRO.userPatterns.entries()) {
            if (pattern.suspicionScore >= threshold) {
                suspicious.push({
                    userId,
                    score: pattern.suspicionScore,
                    actions: pattern.actions.length,
                    lastAction: pattern.actions[pattern.actions.length - 1]?.timestamp || 0
                });
            }
        }
        return suspicious.sort((a, b) => b.score - a.score);
    }
    
    // 시스템 상태 리포트
    getSystemReport() {
        const stats = antiMacro.getStatistics();
        const suspicious = this.getSuspiciousUsers();
        const highRisk = suspicious.filter(u => u.score >= 70).length;
        const mediumRisk = suspicious.filter(u => u.score >= 50 && u.score < 70).length;
        
        return {
            stats,
            riskLevels: {
                high: highRisk,
                medium: mediumRisk,
                low: stats.totalTrackedUsers - highRisk - mediumRisk
            },
            autoDetection: this.autoDetectionEnabled,
            recentCaptchas: this.recentCaptchas.size,
            suspicious: suspicious.slice(0, 10) // 상위 10명
        };
    }
}

// 싱글톤 인스턴스
const macroMonitor = new MacroMonitor();

module.exports = macroMonitor;