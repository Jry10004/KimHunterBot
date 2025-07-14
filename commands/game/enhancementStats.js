const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('강화통계')
        .setDescription('나의 강화 통계를 확인합니다'),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user) {
                return await interaction.editReply({
                    content: '❌ 먼저 `/회원가입` 명령어로 가입해주세요!'
                });
            }
            
            // 강화 통계 가져오기
            const stats = user.enhancementStats || {
                totalAttempts: 0,
                totalSuccess: 0,
                totalFail: 0,
                totalDestroyed: 0,
                highestEnhancement: 0,
                goldSpent: 0
            };
            
            // 현재 보유 아이템 중 최고 강화
            let currentHighest = 0;
            let currentHighestItem = null;
            
            if (user.inventory && user.inventory.length > 0) {
                for (const item of user.inventory) {
                    if (item && item.enhancement > currentHighest) {
                        currentHighest = item.enhancement;
                        currentHighestItem = item;
                    }
                }
            }
            
            // 성공률 계산
            const successRate = stats.totalAttempts > 0 
                ? ((stats.totalSuccess / stats.totalAttempts) * 100).toFixed(2)
                : 0;
            
            // 파괴율 계산
            const destroyRate = stats.totalAttempts > 0
                ? ((stats.totalDestroyed / stats.totalAttempts) * 100).toFixed(2)
                : 0;
            
            // 임베드 생성
            const embed = new EmbedBuilder()
                .setTitle(`🔨 ${user.nickname || user.username}님의 강화 통계`)
                .setColor('#2196F3')
                .setTimestamp()
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    {
                        name: '📊 전체 통계',
                        value: `총 시도: **${stats.totalAttempts.toLocaleString()}회**\n` +
                               `성공: **${stats.totalSuccess.toLocaleString()}회**\n` +
                               `실패: **${stats.totalFail.toLocaleString()}회**\n` +
                               `파괴: **${stats.totalDestroyed.toLocaleString()}개**`,
                        inline: true
                    },
                    {
                        name: '📈 성공률',
                        value: `전체: **${successRate}%**\n` +
                               `파괴율: **${destroyRate}%**`,
                        inline: true
                    },
                    {
                        name: '💰 소비 골드',
                        value: `**${stats.goldSpent.toLocaleString()}G**`,
                        inline: true
                    }
                );
            
            // 최고 기록
            if (stats.highestEnhancement > 0) {
                embed.addFields({
                    name: '🏆 최고 기록',
                    value: `역대 최고: **+${stats.highestEnhancement}강**`,
                    inline: false
                });
            }
            
            // 현재 최고 강화 아이템
            if (currentHighestItem) {
                embed.addFields({
                    name: '✨ 현재 최고 강화 아이템',
                    value: `${currentHighestItem.name} **+${currentHighest}강**`,
                    inline: false
                });
            }
            
            // 강화 팁
            if (stats.totalAttempts < 10) {
                embed.setFooter({ 
                    text: '💡 팁: /강화 명령어로 장비를 강화해보세요!' 
                });
            } else if (successRate < 50) {
                embed.setFooter({ 
                    text: '💡 팁: 높은 강화 단계에서는 보호권 사용을 고려해보세요!' 
                });
            } else {
                embed.setFooter({ 
                    text: '김헌터 | 행운이 함께하길!' 
                });
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('강화 통계 조회 오류:', error);
            await interaction.editReply({
                content: '❌ 강화 통계를 불러오는 중 오류가 발생했습니다.'
            });
        }
    }
};