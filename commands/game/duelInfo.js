const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('결투정보')
        .setDescription('PVP 통계 및 정보를 확인합니다'),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user) {
                return await interaction.editReply({
                    content: '❌ 먼저 `/회원가입` 명령어로 가입해주세요!'
                });
            }
            
            // PVP 통계 가져오기
            const pvpStats = user.pvp || {
                wins: 0,
                losses: 0,
                draws: 0,
                totalDuels: 0,
                winStreak: 0,
                maxWinStreak: 0,
                rating: 1000
            };
            
            // 총 경기 수 (totalDuels가 정확하지 않을 수 있으므로 재계산)
            const totalGames = pvpStats.wins + pvpStats.losses + (pvpStats.draws || 0);
            
            // 승률 계산 (무승부 제외)
            const winRate = totalGames > 0 
                ? ((pvpStats.wins / totalGames) * 100).toFixed(1)
                : '0.0';
            
            // 티어 계산
            let tier = '브론즈';
            let tierEmoji = '🥉';
            if (pvpStats.rating >= 2000) {
                tier = '다이아몬드';
                tierEmoji = '💎';
            } else if (pvpStats.rating >= 1700) {
                tier = '플래티넘';
                tierEmoji = '🏆';
            } else if (pvpStats.rating >= 1400) {
                tier = '골드';
                tierEmoji = '🥇';
            } else if (pvpStats.rating >= 1200) {
                tier = '실버';
                tierEmoji = '🥈';
            }
            
            // 임베드 생성
            const embed = new EmbedBuilder()
                .setTitle(`⚔️ ${user.nickname || user.username}님의 PVP 정보`)
                .setColor('#FF4500')
                .setTimestamp()
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    {
                        name: '🏅 티어',
                        value: `${tierEmoji} **${tier}**\nRating: **${pvpStats.rating}**`,
                        inline: true
                    },
                    {
                        name: '📊 전적',
                        value: `총 ${totalGames}전\n${pvpStats.wins}승 ${pvpStats.losses}패 ${pvpStats.draws || 0}무`,
                        inline: true
                    },
                    {
                        name: '📈 승률',
                        value: `**${winRate}%**`,
                        inline: true
                    },
                    {
                        name: '🔥 연승',
                        value: `현재: **${pvpStats.winStreak || 0}연승**\n최고: **${pvpStats.maxWinStreak || pvpStats.bestWinStreak || 0}연승**`,
                        inline: true
                    },
                    {
                        name: '🎯 최근 10경기',
                        value: user.recentPvpResults && user.recentPvpResults.length > 0
                            ? user.recentPvpResults.slice(0, 10).map(r => r === 'W' ? '✅' : r === 'L' ? '❌' : '🤝').join(' ')
                            : '전적 없음',
                        inline: true
                    }
                );
            
            // 업적
            const achievements = [];
            if (pvpStats.wins >= 100) achievements.push('🏆 백전백승');
            if (pvpStats.bestWinStreak >= 10) achievements.push('🔥 10연승');
            if (pvpStats.rating >= 1500) achievements.push('⭐ 상위권');
            
            if (achievements.length > 0) {
                embed.addFields({
                    name: '🎖️ 업적',
                    value: achievements.join('\n'),
                    inline: false
                });
            }
            
            embed.setFooter({ 
                text: '💡 /결투 명령어로 다른 플레이어와 대결하세요!' 
            });
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('결투 정보 조회 오류:', error);
            await interaction.editReply({
                content: '❌ 결투 정보를 불러오는 중 오류가 발생했습니다.'
            });
        }
    }
};