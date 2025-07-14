const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const { calculateCombatPower } = require('../../handlers/common/utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('내전투력')
        .setDescription('⚔️ 현재 전투력과 에너지 조각 정보를 확인합니다'),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user) {
                return await interaction.editReply({
                    content: '❌ 먼저 `/회원가입` 명령어로 가입해주세요!'
                });
            }
            
            // 전투력 계산
            const combatPower = calculateCombatPower(user);
            
            // 장비별 전투력 계산
            let equipmentCP = {
                weapon: 0,
                armor: 0,
                accessory: 0,
                helmet: 0,
                gloves: 0,
                boots: 0
            };
            
            if (user.equipment && user.inventory) {
                for (const [slot, index] of Object.entries(user.equipment)) {
                    if (index !== null && index !== undefined && user.inventory[index]) {
                        const item = user.inventory[index];
                        const itemCP = (item.stats?.attack || 0) + (item.stats?.defense || 0) + 
                                      ((item.enhancement || 0) * 20);
                        equipmentCP[slot] = itemCP;
                    }
                }
            }
            
            // 에너지 조각 정보
            const fragments = user.fragments || {};
            let totalFragments = 0;
            let fragmentValue = 0;
            
            for (let tier = 1; tier <= 10; tier++) {
                const count = fragments[`tier${tier}`] || 0;
                totalFragments += count;
                fragmentValue += count * Math.pow(10, tier);
            }
            
            // 임베드 생성
            const embed = new EmbedBuilder()
                .setTitle(`⚔️ ${user.nickname || user.username}님의 전투력`)
                .setColor('#FF6B6B')
                .setTimestamp()
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    {
                        name: '💪 총 전투력',
                        value: `**${combatPower.toLocaleString()}**`,
                        inline: false
                    },
                    {
                        name: '📊 기본 스탯',
                        value: `레벨: **${user.level}**\n` +
                               `공격력: **${user.attack}**\n` +
                               `방어력: **${user.defense}**`,
                        inline: true
                    },
                    {
                        name: '🎯 장비 전투력',
                        value: `무기: **${equipmentCP.weapon}**\n` +
                               `갑옷: **${equipmentCP.armor}**\n` +
                               `액세서리: **${equipmentCP.accessory}**`,
                        inline: true
                    },
                    {
                        name: '🛡️ 추가 장비',
                        value: `투구: **${equipmentCP.helmet}**\n` +
                               `장갑: **${equipmentCP.gloves}**\n` +
                               `신발: **${equipmentCP.boots}**`,
                        inline: true
                    }
                );
            
            // 에너지 조각 정보
            if (totalFragments > 0) {
                let fragmentInfo = '';
                for (let tier = 1; tier <= 10; tier++) {
                    const count = fragments[`tier${tier}`] || 0;
                    if (count > 0) {
                        fragmentInfo += `${tier}단계: **${count}개**\n`;
                    }
                }
                
                embed.addFields({
                    name: '💎 에너지 조각',
                    value: fragmentInfo || '보유 조각 없음',
                    inline: true
                });
                
                embed.addFields({
                    name: '💰 조각 가치',
                    value: `총 ${totalFragments}개\n약 **${fragmentValue.toLocaleString()}G**`,
                    inline: true
                });
            }
            
            // 전투력 순위
            const allUsers = await User.find({}).select('discordId attack defense level').lean();
            const rankings = allUsers.map(u => ({
                id: u.discordId,
                power: calculateCombatPower(u)
            })).sort((a, b) => b.power - a.power);
            
            const userRank = rankings.findIndex(r => r.id === interaction.user.id) + 1;
            
            embed.addFields({
                name: '🏆 전투력 순위',
                value: `전체 **${userRank}위** / ${rankings.length}명`,
                inline: false
            });
            
            // 전투력 증가 팁
            if (combatPower < 1000) {
                embed.setFooter({ 
                    text: '💡 장비를 강화하고 레벨을 올려 전투력을 높이세요!' 
                });
            } else if (combatPower < 5000) {
                embed.setFooter({ 
                    text: '💡 고급 장비와 에너지 조각으로 더 강해질 수 있습니다!' 
                });
            } else {
                embed.setFooter({ 
                    text: '김헌터 | 당신은 진정한 강자입니다!' 
                });
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('전투력 조회 오류:', error);
            await interaction.editReply({
                content: '❌ 전투력 정보를 불러오는 중 오류가 발생했습니다.'
            });
        }
    }
};