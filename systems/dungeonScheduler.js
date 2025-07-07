const schedule = require('node-schedule');
const { EmbedBuilder } = require('discord.js');

class DungeonScheduler {
    constructor() {
        this.scheduledJobs = [];
        this.newsChannels = new Set();
    }

    // 던전 스케줄러 시작
    start(client) {
        this.client = client;
        
        // 매일 특정 시간에 던전 개방 (오전 9시, 오후 3시, 오후 9시)
        const dungeonTimes = ['0 9 * * *', '0 15 * * *', '0 21 * * *'];
        
        dungeonTimes.forEach((time, index) => {
            const job = schedule.scheduleJob(time, async () => {
                await this.openDungeonEvent(index + 1);
            });
            this.scheduledJobs.push(job);
        });
        
        console.log('🏰 던전 스케줄러가 시작되었습니다.');
    }

    // 뉴스 채널 설정
    setNewsChannel(channelId) {
        this.newsChannels.add(channelId);
    }

    // 던전 개방 이벤트
    async openDungeonEvent(sessionNumber) {
        const timeNames = {
            1: '오전',
            2: '오후', 
            3: '저녁'
        };
        
        const embed = new EmbedBuilder()
            .setTitle(`🏰 ${timeNames[sessionNumber]} 던전 탐험 개방!`)
            .setDescription(`던전이 개방되었습니다! 오늘의 ${sessionNumber}번째 탐험 기회입니다.`)
            .addFields(
                { name: '⚔️ 던전 정보', value: '• 총 50층\n• 층마다 다른 몬스터\n• 유물 보상 획득 가능', inline: true },
                { name: '🎁 보상', value: '• 골드 & 경험치\n• 희귀 유물\n• 특별 아이템', inline: true },
                { name: '📊 도전 횟수', value: `오늘 ${sessionNumber}/3회`, inline: true }
            )
            .setColor('#8B4513')
            .setFooter({ text: '💡 /던전 명령어로 탐험을 시작하세요!' })
            .setTimestamp();

        // 모든 뉴스 채널에 전송
        for (const channelId of this.newsChannels) {
            try {
                const channel = await this.client.channels.fetch(channelId);
                if (channel && channel.isTextBased()) {
                    await channel.send({ embeds: [embed] });
                    
                    // 관련 주식 변동 알림
                    await this.notifyStockChange(channel);
                }
            } catch (error) {
                console.error(`던전 개방 알림 전송 실패 (${channelId}):`, error);
            }
        }
        
        // 모든 유저의 던전 시도 횟수 초기화 (하루 시작 시)
        if (sessionNumber === 1) {
            await this.resetDailyAttempts();
        }
    }

    // 관련 주식 변동 알림
    async notifyStockChange(channel) {
        const stockEmbed = new EmbedBuilder()
            .setTitle('📈 던전 개방 관련 주식 변동')
            .setDescription('던전 탐험 관련 회사들의 주가가 변동했습니다!')
            .addFields(
                { name: '🏜️ 사막 탐험대', value: '주가 +3~5% 상승', inline: true },
                { name: '⛰️ 설산 유적단', value: '주가 +2~4% 상승', inline: true },
                { name: '🌴 정글 탐사대', value: '주가 +3~6% 상승', inline: true }
            )
            .setColor('#4CAF50')
            .setTimestamp();
            
        await channel.send({ embeds: [stockEmbed] });
    }

    // 일일 시도 횟수 초기화
    async resetDailyAttempts() {
        const User = require('../models/User');
        const today = new Date().toDateString();
        
        await User.updateMany(
            {},
            { 
                $set: { 
                    'dungeonDaily': {
                        date: today,
                        attempts: 0
                    }
                }
            }
        );
        
        console.log('🔄 던전 일일 시도 횟수가 초기화되었습니다.');
    }

    // 스케줄러 중지
    stop() {
        this.scheduledJobs.forEach(job => job.cancel());
        this.scheduledJobs = [];
        console.log('🛑 던전 스케줄러가 중지되었습니다.');
    }
}

module.exports = new DungeonScheduler();