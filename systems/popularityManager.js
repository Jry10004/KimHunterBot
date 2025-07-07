const Popularity = require('../models/Popularity');
const User = require('../models/User');
const cron = require('node-cron');

class PopularityManager {
    constructor(client) {
        this.client = client;
        this.setupWeeklyReset();
    }
    
    // 매주 월요일 00:00에 주간 랭킹 초기화
    setupWeeklyReset() {
        // 매주 월요일 00:00 (0 0 * * 1)
        cron.schedule('0 0 * * 1', async () => {
            console.log('🔄 주간 인기도 랭킹 초기화 시작...');
            
            try {
                // 현재 1위 찾기
                const currentChampion = await Popularity.findOne({ hasTitle: true });
                const newChampion = await Popularity.findOne({})
                    .sort({ weeklyLikes: -1, totalLikes: -1 })
                    .limit(1);
                
                // 칭호 변경 처리
                if (currentChampion && newChampion) {
                    // 기존 챔피언과 새 챔피언이 다른 경우
                    if (currentChampion.userId !== newChampion.userId) {
                        // 기존 챔피언 칭호 제거
                        currentChampion.hasTitle = false;
                        currentChampion.titleHistory.push({
                            startDate: currentChampion.titleHistory[currentChampion.titleHistory.length - 1]?.startDate || new Date(),
                            endDate: new Date(),
                            rank: 1
                        });
                        await currentChampion.save();
                        
                        // 새 챔피언 칭호 부여
                        newChampion.hasTitle = true;
                        newChampion.statistics.totalWeeksAsChampion += 1;
                        await newChampion.save();
                        
                        // 알림 전송
                        await this.sendChampionChangeNotification(currentChampion, newChampion);
                    } else {
                        // 동일 유저가 연속 1위
                        currentChampion.statistics.totalWeeksAsChampion += 1;
                        await currentChampion.save();
                    }
                } else if (newChampion && newChampion.weeklyLikes > 0) {
                    // 첫 번째 챔피언
                    newChampion.hasTitle = true;
                    newChampion.statistics.totalWeeksAsChampion = 1;
                    await newChampion.save();
                    
                    await this.sendFirstChampionNotification(newChampion);
                }
                
                // 모든 유저의 순위 기록
                const allUsers = await Popularity.find({})
                    .sort({ weeklyLikes: -1, totalLikes: -1 });
                
                for (let i = 0; i < allUsers.length; i++) {
                    allUsers[i].statistics.lastWeekRank = i + 1;
                    await allUsers[i].save();
                }
                
                // 주간 좋아요 초기화
                await Popularity.updateMany({}, { $set: { weeklyLikes: 0 } });
                
                console.log('✅ 주간 인기도 랭킹 초기화 완료!');
                
                // 주간 랭킹 결과 공지
                await this.sendWeeklyRankingReport(allUsers.slice(0, 10));
                
            } catch (error) {
                console.error('❌ 주간 랭킹 초기화 오류:', error);
            }
        });
        
        console.log('✅ 인기도 관리 시스템 초기화 완료');
    }
    
    // 챔피언 변경 알림
    async sendChampionChangeNotification(oldChampion, newChampion) {
        try {
            const channel = await this.findAnnouncementChannel();
            if (!channel) return;
            
            const embed = {
                color: 0xFFD700,
                title: '👑 새로운 인기왕 탄생!',
                description: `**${oldChampion.nickname}**님이 인기왕 자리에서 물러나고,\n` +
                           `**${newChampion.nickname}**님이 새로운 인기왕이 되었습니다!`,
                fields: [
                    {
                        name: '🏆 신임 인기왕',
                        value: `${newChampion.nickname}\n💖 주간 좋아요: ${newChampion.weeklyLikes}개`,
                        inline: true
                    },
                    {
                        name: '📉 전임 인기왕',
                        value: `${oldChampion.nickname}\n👑 재위 기간: ${oldChampion.statistics.totalWeeksAsChampion}주`,
                        inline: true
                    }
                ],
                timestamp: new Date()
            };
            
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('챔피언 변경 알림 실패:', error);
        }
    }
    
    // 첫 챔피언 알림
    async sendFirstChampionNotification(champion) {
        try {
            const channel = await this.findAnnouncementChannel();
            if (!channel) return;
            
            const embed = {
                color: 0xFFD700,
                title: '👑 첫 인기왕 탄생!',
                description: `**${champion.nickname}**님이 첫 번째 인기왕이 되었습니다!`,
                fields: [
                    {
                        name: '💖 주간 좋아요',
                        value: `${champion.weeklyLikes}개`,
                        inline: true
                    }
                ],
                timestamp: new Date()
            };
            
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('첫 챔피언 알림 실패:', error);
        }
    }
    
    // 주간 랭킹 리포트
    async sendWeeklyRankingReport(top10) {
        try {
            const channel = await this.findAnnouncementChannel();
            if (!channel) return;
            
            let rankingText = '';
            const medals = ['🥇', '🥈', '🥉'];
            
            for (let i = 0; i < Math.min(10, top10.length); i++) {
                const user = top10[i];
                if (user.weeklyLikes === 0) break;
                
                const medal = medals[i] || `**${i + 1}.**`;
                rankingText += `${medal} ${user.nickname} - 💖 ${user.weeklyLikes}개\n`;
            }
            
            if (rankingText) {
                const embed = {
                    color: 0xFF69B4,
                    title: '📊 주간 인기도 랭킹 결과',
                    description: rankingText,
                    footer: {
                        text: '새로운 주가 시작되었습니다! 다시 도전하세요!'
                    },
                    timestamp: new Date()
                };
                
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('주간 랭킹 리포트 실패:', error);
        }
    }
    
    // 공지 채널 찾기
    async findAnnouncementChannel() {
        const guild = this.client.guilds.cache.first();
        if (!guild) return null;
        
        return guild.channels.cache.find(ch => 
            ch.name === 'announcements' || 
            ch.name === '공지' || 
            ch.name === '📢공지사항' ||
            ch.name === 'general' ||
            ch.name === '일반'
        );
    }
    
    // 유저의 인기도 통계 조회
    async getUserStats(userId) {
        const popularity = await Popularity.findOne({ userId });
        if (!popularity) return null;
        
        return {
            totalLikes: popularity.totalLikes,
            weeklyLikes: popularity.weeklyLikes,
            hasTitle: popularity.hasTitle,
            totalWeeksAsChampion: popularity.statistics.totalWeeksAsChampion,
            peakWeeklyLikes: popularity.statistics.peakWeeklyLikes,
            lastWeekRank: popularity.statistics.lastWeekRank,
            givenToday: popularity.dailyGiven.users.length,
            receivedToday: popularity.receivedLikes.filter(like => 
                new Date(like.date).toDateString() === new Date().toDateString()
            ).length
        };
    }
}

module.exports = PopularityManager;