const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('강화랭킹')
        .setDescription('강화 랭킹을 확인합니다'),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            // 모든 유저 조회
            const users = await User.find({}).lean();
            
            // 각 유저의 최고 강화 아이템 찾기
            const rankings = [];
            
            for (const user of users) {
                if (!user.inventory || user.inventory.length === 0) continue;
                
                let highestEnhancement = 0;
                let highestItem = null;
                
                // 장착된 장비 확인
                if (user.equipment) {
                    for (const [slot, index] of Object.entries(user.equipment)) {
                        if (index !== null && index !== undefined && user.inventory[index]) {
                            const item = user.inventory[index];
                            if (item.enhancement > highestEnhancement) {
                                highestEnhancement = item.enhancement;
                                highestItem = {
                                    name: item.name,
                                    enhancement: item.enhancement,
                                    slot: slot
                                };
                            }
                        }
                    }
                }
                
                // 인벤토리의 모든 아이템도 확인
                for (const item of user.inventory) {
                    if (item && item.enhancement > highestEnhancement) {
                        highestEnhancement = item.enhancement;
                        highestItem = {
                            name: item.name,
                            enhancement: item.enhancement,
                            slot: item.type || 'inventory'
                        };
                    }
                }
                
                if (highestItem && highestEnhancement > 0) {
                    rankings.push({
                        username: user.nickname || user.username || 'Unknown',
                        item: highestItem,
                        enhancement: highestEnhancement
                    });
                }
            }
            
            // 강화 레벨로 정렬
            rankings.sort((a, b) => b.enhancement - a.enhancement);
            
            // 상위 10명만 선택
            const topRankings = rankings.slice(0, 10);
            
            // 임베드 생성
            const embed = new EmbedBuilder()
                .setTitle('🏆 강화 랭킹 TOP 10')
                .setColor('#FFD700')
                .setTimestamp()
                .setFooter({ text: '김헌터 | 최고 강화 아이템 기준' });
            
            if (topRankings.length === 0) {
                embed.setDescription('아직 강화된 아이템이 없습니다.');
            } else {
                let description = '';
                
                topRankings.forEach((user, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    const itemName = user.item.name || '알 수 없는 아이템';
                    
                    description += `${medal} **${user.username}**\n`;
                    description += `   └ ${itemName} **+${user.enhancement}강**\n`;
                    
                    // 25강 이상은 특별 표시
                    if (user.enhancement >= 25) {
                        description += `   └ ✨ **전설의 강화!** ✨\n`;
                    }
                    
                    description += '\n';
                });
                
                embed.setDescription(description);
            }
            
            // 현재 유저의 순위 찾기
            const userRank = rankings.findIndex(r => 
                r.username === (interaction.user.nickname || interaction.user.username)
            ) + 1;
            
            if (userRank > 0) {
                embed.addFields({
                    name: '📊 내 순위',
                    value: userRank <= 10 
                        ? `현재 **${userRank}위**입니다! 🎉` 
                        : `현재 **${userRank}위**입니다. (TOP 10 진입까지 ${10 - userRank}순위)`,
                    inline: false
                });
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('강화 랭킹 조회 오류:', error);
            await interaction.editReply({
                content: '❌ 강화 랭킹을 불러오는 중 오류가 발생했습니다.',
                embeds: []
            });
        }
    }
};