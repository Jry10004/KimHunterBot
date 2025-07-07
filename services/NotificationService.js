// 실시간 알림 서비스
const { EmbedBuilder } = require('discord.js');
const cacheService = require('./CacheService');

class NotificationService {
    constructor() {
        this.client = null;
        this.subscriptions = new Map(); // userId -> Set of notification types
        this.notificationQueue = [];
        this.processing = false;
        
        // 알림 타입
        this.types = {
            BOSS_SPAWN: 'boss_spawn',
            PVP_CHALLENGE: 'pvp_challenge',
            AUCTION_OUTBID: 'auction_outbid',
            AUCTION_WON: 'auction_won',
            STOCK_ALERT: 'stock_alert',
            FRIEND_ONLINE: 'friend_online',
            ENERGY_FULL: 'energy_full',
            QUEST_COMPLETE: 'quest_complete',
            LEVEL_UP: 'level_up',
            RARE_DROP: 'rare_drop',
            SYSTEM: 'system'
        };
        
        // 알림 설정
        this.defaultSettings = {
            dm: true,
            mention: false,
            embed: true,
            sound: false
        };
        
        // 통계
        this.stats = {
            sent: 0,
            failed: 0,
            queued: 0
        };
    }
    
    // 클라이언트 설정
    setClient(client) {
        this.client = client;
        console.log('🔔 알림 서비스 초기화됨');
        
        // 큐 처리 시작
        this.startQueueProcessor();
    }
    
    // 알림 구독
    async subscribe(userId, notificationType, settings = {}) {
        if (!this.subscriptions.has(userId)) {
            this.subscriptions.set(userId, new Map());
        }
        
        const userSubs = this.subscriptions.get(userId);
        userSubs.set(notificationType, {
            ...this.defaultSettings,
            ...settings,
            subscribedAt: new Date()
        });
        
        // 캐시에 저장
        cacheService.set('user', `notifications:${userId}`, Array.from(userSubs.entries()), 86400); // 24시간
        
        console.log(`🔔 알림 구독: ${userId} -> ${notificationType}`);
        return true;
    }
    
    // 알림 구독 해제
    async unsubscribe(userId, notificationType) {
        const userSubs = this.subscriptions.get(userId);
        if (!userSubs) return false;
        
        userSubs.delete(notificationType);
        
        if (userSubs.size === 0) {
            this.subscriptions.delete(userId);
        }
        
        // 캐시 업데이트
        cacheService.set('user', `notifications:${userId}`, Array.from(userSubs.entries()), 86400);
        
        console.log(`🔕 알림 구독 해제: ${userId} -> ${notificationType}`);
        return true;
    }
    
    // 알림 전송
    async send(userId, notificationType, data) {
        // 구독 확인
        const userSubs = this.subscriptions.get(userId);
        if (!userSubs || !userSubs.has(notificationType)) {
            return { sent: false, reason: 'not_subscribed' };
        }
        
        const settings = userSubs.get(notificationType);
        
        // 알림 객체 생성
        const notification = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            type: notificationType,
            data,
            settings,
            createdAt: new Date(),
            attempts: 0
        };
        
        // 큐에 추가
        this.notificationQueue.push(notification);
        this.stats.queued++;
        
        // 즉시 처리 시도
        this.processQueue();
        
        return { sent: true, notificationId: notification.id };
    }
    
    // 대량 알림 전송
    async broadcast(notificationType, data, filter = () => true) {
        const notifications = [];
        
        for (const [userId, subs] of this.subscriptions) {
            if (subs.has(notificationType) && filter(userId)) {
                const result = await this.send(userId, notificationType, data);
                notifications.push({ userId, ...result });
            }
        }
        
        console.log(`📢 브로드캐스트 완료: ${notificationType} (${notifications.length}명)`);
        return notifications;
    }
    
    // 큐 처리
    async processQueue() {
        if (this.processing || this.notificationQueue.length === 0) return;
        
        this.processing = true;
        
        while (this.notificationQueue.length > 0) {
            const notification = this.notificationQueue.shift();
            
            try {
                await this.sendNotification(notification);
                this.stats.sent++;
            } catch (error) {
                notification.attempts++;
                
                if (notification.attempts < 3) {
                    // 재시도
                    this.notificationQueue.push(notification);
                } else {
                    console.error(`❌ 알림 전송 실패 (${notification.userId}):`, error.message);
                    this.stats.failed++;
                }
            }
            
            // 속도 제한
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.processing = false;
    }
    
    // 실제 알림 전송
    async sendNotification(notification) {
        const { userId, type, data, settings } = notification;
        
        try {
            const user = await this.client.users.fetch(userId);
            if (!user) throw new Error('사용자를 찾을 수 없음');
            
            // 알림 내용 생성
            const content = this.createNotificationContent(type, data, settings);
            
            if (settings.dm) {
                // DM 전송
                await user.send(content);
            } else {
                // 채널 전송 (설정된 경우)
                if (data.channelId) {
                    const channel = await this.client.channels.fetch(data.channelId);
                    if (channel) {
                        await channel.send({
                            ...content,
                            content: settings.mention ? `<@${userId}> ${content.content || ''}` : content.content
                        });
                    }
                }
            }
            
            // 알림 기록
            await this.logNotification(notification);
            
        } catch (error) {
            throw error;
        }
    }
    
    // 알림 내용 생성
    createNotificationContent(type, data, settings) {
        const templates = {
            [this.types.BOSS_SPAWN]: {
                title: '👹 보스 출현!',
                description: `**${data.bossName}**이(가) 출현했습니다!`,
                color: '#FF0000',
                fields: [
                    { name: '위치', value: data.location || '알 수 없음', inline: true },
                    { name: '난이도', value: data.difficulty || '보통', inline: true }
                ]
            },
            [this.types.PVP_CHALLENGE]: {
                title: '⚔️ PVP 도전!',
                description: `**${data.challengerName}**님이 당신에게 도전했습니다!`,
                color: '#FF6B6B',
                fields: [
                    { name: '전투력', value: data.combatPower?.toLocaleString() || '???', inline: true },
                    { name: '베팅금', value: `${data.betAmount?.toLocaleString() || 0}G`, inline: true }
                ]
            },
            [this.types.AUCTION_OUTBID]: {
                title: '💸 입찰 경쟁!',
                description: `누군가 당신보다 높은 가격을 제시했습니다!`,
                color: '#FFA500',
                fields: [
                    { name: '아이템', value: data.itemName || '???', inline: true },
                    { name: '현재 최고가', value: `${data.currentBid?.toLocaleString() || 0}G`, inline: true }
                ]
            },
            [this.types.AUCTION_WON]: {
                title: '🎉 낙찰 성공!',
                description: `축하합니다! 경매에서 낙찰받았습니다!`,
                color: '#00FF00',
                fields: [
                    { name: '아이템', value: data.itemName || '???', inline: true },
                    { name: '낙찰가', value: `${data.finalPrice?.toLocaleString() || 0}G`, inline: true }
                ]
            },
            [this.types.STOCK_ALERT]: {
                title: '📈 주식 알림',
                description: data.message || '주식 시장에 변동이 있습니다.',
                color: '#0099FF',
                fields: data.stocks ? data.stocks.map(stock => ({
                    name: stock.name,
                    value: `${stock.change > 0 ? '📈' : '📉'} ${stock.change}%`,
                    inline: true
                })) : []
            },
            [this.types.ENERGY_FULL]: {
                title: '⚡ 에너지 충전 완료!',
                description: '에너지가 가득 찼습니다. 게임을 즐겨보세요!',
                color: '#FFFF00'
            },
            [this.types.LEVEL_UP]: {
                title: '🎊 레벨 업!',
                description: `축하합니다! **레벨 ${data.newLevel}**이 되었습니다!`,
                color: '#FFD700',
                fields: [
                    { name: '보상', value: data.rewards || '없음', inline: true }
                ]
            },
            [this.types.RARE_DROP]: {
                title: '✨ 희귀 아이템 획득!',
                description: `**${data.itemName}**을(를) 획득했습니다!`,
                color: '#FF00FF',
                fields: [
                    { name: '등급', value: data.rarity || '희귀', inline: true },
                    { name: '획득처', value: data.source || '알 수 없음', inline: true }
                ]
            },
            [this.types.SYSTEM]: {
                title: '📢 시스템 알림',
                description: data.message || '시스템 메시지',
                color: '#808080'
            }
        };
        
        const template = templates[type] || templates[this.types.SYSTEM];
        
        if (settings.embed) {
            const embed = new EmbedBuilder()
                .setTitle(template.title)
                .setDescription(template.description)
                .setColor(template.color)
                .setTimestamp();
            
            if (template.fields) {
                embed.addFields(template.fields);
            }
            
            return { embeds: [embed] };
        } else {
            return { content: `${template.title}\n${template.description}` };
        }
    }
    
    // 알림 기록
    async logNotification(notification) {
        // 최근 알림 기록 (Redis나 DB에 저장)
        const recentKey = `recent_notifications:${notification.userId}`;
        let recent = cacheService.get('temp', recentKey) || [];
        
        recent.unshift({
            id: notification.id,
            type: notification.type,
            timestamp: notification.createdAt,
            read: false
        });
        
        // 최근 50개만 유지
        recent = recent.slice(0, 50);
        
        cacheService.set('temp', recentKey, recent, 86400); // 24시간
    }
    
    // 사용자 알림 설정 조회
    getUserSettings(userId) {
        const userSubs = this.subscriptions.get(userId);
        if (!userSubs) return {};
        
        const settings = {};
        for (const [type, config] of userSubs) {
            settings[type] = config;
        }
        
        return settings;
    }
    
    // 최근 알림 조회
    getRecentNotifications(userId, limit = 10) {
        const recentKey = `recent_notifications:${userId}`;
        const recent = cacheService.get('temp', recentKey) || [];
        return recent.slice(0, limit);
    }
    
    // 알림 읽음 처리
    markAsRead(userId, notificationId) {
        const recentKey = `recent_notifications:${userId}`;
        const recent = cacheService.get('temp', recentKey) || [];
        
        const notification = recent.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            cacheService.set('temp', recentKey, recent, 86400);
        }
    }
    
    // 큐 프로세서 시작
    startQueueProcessor() {
        setInterval(() => {
            if (!this.processing && this.notificationQueue.length > 0) {
                this.processQueue();
            }
        }, 1000);
    }
    
    // 통계
    getStats() {
        return {
            ...this.stats,
            queueLength: this.notificationQueue.length,
            totalSubscriptions: this.subscriptions.size,
            processing: this.processing
        };
    }
}

// 싱글톤 인스턴스
const notificationService = new NotificationService();

module.exports = notificationService;