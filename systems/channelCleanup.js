const { PermissionFlagsBits } = require('discord.js');

// 미니게임 채널 정리 시스템
class ChannelCleanupSystem {
    constructor() {
        this.activeChannels = new Map(); // channelId -> { gameType, hostName, createdAt }
        this.cleanupInterval = null;
    }

    // 채널 등록
    registerChannel(channel, gameType, hostName) {
        if (!channel || !channel.id) return;
        
        this.activeChannels.set(channel.id, {
            gameType,
            hostName,
            createdAt: Date.now(),
            channelName: channel.name
        });
        
        console.log(`[채널 정리] 등록: ${channel.name} (${gameType})`);
    }

    // 채널 제거
    unregisterChannel(channelId) {
        if (this.activeChannels.has(channelId)) {
            const info = this.activeChannels.get(channelId);
            console.log(`[채널 정리] 제거: ${info.channelName}`);
            this.activeChannels.delete(channelId);
        }
    }

    // 안전한 채널 삭제
    async safeDeleteChannel(channel, reason = '게임 종료') {
        if (!channel || channel.deleted) return;
        
        try {
            // 봇이 채널 관리 권한이 있는지 확인
            const botMember = channel.guild.members.me;
            if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                console.error('[채널 정리] 채널 관리 권한이 없습니다.');
                return;
            }
            
            // 채널 삭제 가능 여부 확인
            if (channel.deletable) {
                await channel.delete(reason);
                this.unregisterChannel(channel.id);
            } else {
                console.error(`[채널 정리] 채널을 삭제할 수 없습니다: ${channel.name}`);
            }
        } catch (error) {
            console.error(`[채널 정리] 삭제 오류:`, error);
            // 오류가 발생해도 목록에서는 제거
            this.unregisterChannel(channel.id);
        }
    }

    // 오래된 채널 정리 (30분 이상)
    async cleanupOldChannels(guild) {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30분
        
        for (const [channelId, info] of this.activeChannels) {
            if (now - info.createdAt > maxAge) {
                const channel = guild.channels.cache.get(channelId);
                if (channel) {
                    console.log(`[채널 정리] 오래된 채널 삭제: ${info.channelName}`);
                    await this.safeDeleteChannel(channel, '30분 초과 - 자동 정리');
                } else {
                    // 채널이 이미 없으면 목록에서만 제거
                    this.unregisterChannel(channelId);
                }
            }
        }
    }

    // 정리 작업 시작 (5분마다)
    startCleanupInterval(client) {
        if (this.cleanupInterval) return;
        
        this.cleanupInterval = setInterval(async () => {
            for (const guild of client.guilds.cache.values()) {
                await this.cleanupOldChannels(guild);
            }
        }, 5 * 60 * 1000); // 5분
        
        console.log('[채널 정리] 자동 정리 시작됨');
    }

    // 정리 작업 중지
    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('[채널 정리] 자동 정리 중지됨');
        }
    }

    // 모든 미니게임 채널 정리 (봇 종료 시)
    async cleanupAllChannels(client) {
        console.log('[채널 정리] 모든 미니게임 채널 정리 시작...');
        
        for (const guild of client.guilds.cache.values()) {
            const gameCategory = guild.channels.cache.find(
                c => c.name === '🎮 미니게임' && c.type === 4
            );
            
            if (gameCategory) {
                const channels = guild.channels.cache.filter(
                    c => c.parentId === gameCategory.id && c.type === 0
                );
                
                for (const channel of channels.values()) {
                    // 대기실은 제외
                    if (!channel.name.includes('대기실')) {
                        await this.safeDeleteChannel(channel, '봇 종료 - 정리');
                    }
                }
            }
        }
        
        this.activeChannels.clear();
        console.log('[채널 정리] 완료');
    }
}

// 싱글톤 인스턴스
const channelCleanup = new ChannelCleanupSystem();

module.exports = channelCleanup;