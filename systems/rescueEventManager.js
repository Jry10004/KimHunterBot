const { DOGBOT_RESCUE_EVENT, getCurrentFloor } = require('../data/dogBotRescueEvent');
const { EmbedBuilder } = require('discord.js');

class RescueEventManager {
    constructor(client) {
        this.client = client;
        this.hostageCheckInterval = null;
        this.messageCleanupInterval = null;
    }
    
    // 이벤트 시작
    startEvent() {
        // 인질 시스템 시작
        this.startHostageSystem();
        
        // 메시지 정리 시작
        this.startMessageCleanup();
        
        console.log('🐕 댕댕봇 구출 이벤트가 시작되었습니다!');
    }
    
    // 이벤트 종료
    stopEvent() {
        if (this.hostageCheckInterval) {
            clearInterval(this.hostageCheckInterval);
            this.hostageCheckInterval = null;
        }
        
        if (this.messageCleanupInterval) {
            clearInterval(this.messageCleanupInterval);
            this.messageCleanupInterval = null;
        }
        
        DOGBOT_RESCUE_EVENT.status.isActive = false;
        console.log('🎉 댕댕봇 구출 이벤트가 종료되었습니다!');
    }
    
    // 인질 시스템
    startHostageSystem() {
        this.hostageCheckInterval = setInterval(async () => {
            if (!DOGBOT_RESCUE_EVENT.status.isActive || DOGBOT_RESCUE_EVENT.status.rescueComplete) {
                return;
            }
            
            // 참여자 중에서 랜덤 선택
            const participants = Array.from(DOGBOT_RESCUE_EVENT.statistics.participants);
            if (participants.length === 0) return;
            
            const randomUser = participants[Math.floor(Math.random() * participants.length)];
            
            // 이미 인질인지 체크
            if (DOGBOT_RESCUE_EVENT.hostage.activeHostages.has(randomUser)) {
                return;
            }
            
            // 인질로 지정
            DOGBOT_RESCUE_EVENT.hostage.activeHostages.set(randomUser, {
                startTime: Date.now(),
                responded: false,
                channelId: null,
                messageId: null
            });
            
            // 알림 전송
            try {
                // 메인 채널 찾기 (수정 필요)
                const guild = this.client.guilds.cache.first();
                const channel = guild.channels.cache.find(ch => 
                    ch.name === 'general' || ch.name === '일반' || ch.name === '잡담'
                );
                
                if (channel) {
                    const hostageEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🚨 긴급! 버그 감염!')
                        .setDescription(`<@${randomUser}>님이 **디버그 버그**에 감염되었습니다!\n\n` +
                                      `**10분 내**에 아무 메시지나 입력하여 디버깅하세요!\n` +
                                      `실패 시 성문 HP가 **${DOGBOT_RESCUE_EVENT.hostage.healAmount}** 회복됩니다!`)
                        .setFooter({ text: '빠른 응답 부탁드립니다!' })
                        .setTimestamp();
                    
                    const message = await channel.send({
                        content: `<@${randomUser}>`,
                        embeds: [hostageEmbed]
                    });
                    
                    // 메시지 정보 저장
                    const hostageData = DOGBOT_RESCUE_EVENT.hostage.activeHostages.get(randomUser);
                    hostageData.channelId = channel.id;
                    hostageData.messageId = message.id;
                    
                    // 타임아웃 설정
                    setTimeout(() => this.checkHostageTimeout(randomUser), DOGBOT_RESCUE_EVENT.hostage.responseTime);
                }
            } catch (error) {
                console.error('인질 알림 전송 실패:', error);
                DOGBOT_RESCUE_EVENT.hostage.activeHostages.delete(randomUser);
            }
            
        }, DOGBOT_RESCUE_EVENT.hostage.checkInterval);
    }
    
    // 인질 타임아웃 체크
    async checkHostageTimeout(userId) {
        const hostageData = DOGBOT_RESCUE_EVENT.hostage.activeHostages.get(userId);
        if (!hostageData || hostageData.responded) {
            return;
        }
        
        // 타임아웃 - HP 회복
        const currentFloor = getCurrentFloor();
        const healAmount = DOGBOT_RESCUE_EVENT.hostage.healAmount;
        currentFloor.currentHP = Math.min(
            currentFloor.currentHP + healAmount,
            currentFloor.maxHP
        );
        
        // 알림
        try {
            const channel = this.client.channels.cache.get(hostageData.channelId);
            if (channel) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('💀 디버깅 실패!')
                    .setDescription(`<@${userId}>님이 응답하지 않아 버그가 강화되었습니다!\n` +
                                  `성문 HP가 **${healAmount}** 회복되었습니다...`)
                    .addFields({
                        name: '현재 HP',
                        value: `${currentFloor.currentHP.toLocaleString()} / ${currentFloor.maxHP.toLocaleString()}`,
                        inline: true
                    });
                
                await channel.send({ embeds: [timeoutEmbed] });
            }
        } catch (error) {
            console.error('타임아웃 알림 실패:', error);
        }
        
        // 인질 해제
        DOGBOT_RESCUE_EVENT.hostage.activeHostages.delete(userId);
    }
    
    // 메시지 감지 (인질 응답)
    handleMessage(message) {
        if (message.author.bot) return;
        
        const userId = message.author.id;
        const hostageData = DOGBOT_RESCUE_EVENT.hostage.activeHostages.get(userId);
        
        if (hostageData && !hostageData.responded) {
            hostageData.responded = true;
            
            // 성공 메시지
            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ 디버깅 성공!')
                .setDescription(`<@${userId}>님이 버그를 제거했습니다!\n` +
                              `추가 공격 기회를 획득했습니다!`)
                .setFooter({ text: '훌륭합니다!' });
            
            message.channel.send({ embeds: [successEmbed] });
            
            // 쿨다운 제거 (보너스)
            const attackCooldowns = require('../commands/dogBotRescue').attackCooldowns;
            if (attackCooldowns) {
                attackCooldowns.delete(userId);
            }
            
            // 인질 해제
            DOGBOT_RESCUE_EVENT.hostage.activeHostages.delete(userId);
        }
    }
    
    // 오래된 메시지 정리
    startMessageCleanup() {
        this.messageCleanupInterval = setInterval(async () => {
            // 30분 이상 된 인질 메시지 삭제
            const now = Date.now();
            const thirtyMinutes = 30 * 60 * 1000;
            
            for (const [userId, data] of DOGBOT_RESCUE_EVENT.hostage.activeHostages) {
                if (now - data.startTime > thirtyMinutes) {
                    try {
                        const channel = this.client.channels.cache.get(data.channelId);
                        if (channel && data.messageId) {
                            const message = await channel.messages.fetch(data.messageId);
                            await message.delete();
                        }
                    } catch (error) {
                        // 메시지가 이미 삭제됨
                    }
                    
                    DOGBOT_RESCUE_EVENT.hostage.activeHostages.delete(userId);
                }
            }
        }, 5 * 60 * 1000); // 5분마다
    }
}

module.exports = RescueEventManager;