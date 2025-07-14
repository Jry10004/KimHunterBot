const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const { EMBLEMS } = require('../../systems/emblemShop');
const { EMBLEM_ENHANCE_STATS } = require('../../systems/emblemEnhancement');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('엠블럼스탯수정')
        .setDescription('모든 유저의 엠블럼 강화 스탯을 재계산합니다 (관리자 전용)'),
    
    async execute(interaction) {
        // 관리자 권한 확인
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // 엠블럼을 가진 모든 유저 찾기
            const users = await User.find({ emblem: { $exists: true, $ne: null } });
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🔧 엠블럼 스탯 수정 시작')
                .setDescription(`엠블럼을 가진 유저 수: ${users.length}명`);

            await interaction.editReply({ embeds: [embed] });

            let fixedCount = 0;
            const results = [];

            for (const user of users) {
                if (!user.emblem) continue;

                // 엠블럼 타입 찾기
                const emblemType = Object.keys(EMBLEMS).find(type => 
                    EMBLEMS[type].emblems.some(e => e.name === user.emblem)
                );

                if (!emblemType) {
                    results.push(`⚠️ ${user.nickname || user.discordId}: 엠블럼 타입을 찾을 수 없음 (${user.emblem})`);
                    continue;
                }

                const emblemData = EMBLEM_ENHANCE_STATS[emblemType];
                if (!emblemData) {
                    results.push(`⚠️ ${user.nickname || user.discordId}: ${emblemType} 타입의 강화 스탯 데이터 없음`);
                    continue;
                }

                // 스탯 초기화
                if (!user.stats) {
                    user.stats = {
                        strength: 10,
                        agility: 10,
                        intelligence: 10,
                        vitality: 10,
                        luck: 10
                    };
                }

                // 기존 엠블럼 스탯 제거
                if (user.emblemEnhancement?.appliedStats) {
                    for (const [stat, value] of Object.entries(user.emblemEnhancement.appliedStats)) {
                        if (user.stats[stat] !== undefined && value > 0) {
                            user.stats[stat] = Math.max(10, user.stats[stat] - value);
                        }
                    }
                }

                // 새로운 스탯 적용
                const enhanceLevel = user.emblemEnhancement?.level || 0;
                const appliedStats = {};

                for (const [stat, multiplier] of Object.entries(emblemData.stats)) {
                    const statValue = Math.floor(multiplier * enhanceLevel);
                    if (statValue > 0 && user.stats[stat] !== undefined) {
                        user.stats[stat] += statValue;
                        appliedStats[stat] = statValue;
                    }
                }

                // 적용된 스탯 저장
                if (!user.emblemEnhancement) {
                    user.emblemEnhancement = {};
                }
                user.emblemEnhancement.appliedStats = appliedStats;

                await user.save();
                fixedCount++;

                const statsText = Object.entries(appliedStats)
                    .map(([stat, value]) => `${stat}: +${value}`)
                    .join(', ') || '없음';

                results.push(`✅ ${user.nickname || user.discordId}: ${user.emblem} (${emblemType}) +${enhanceLevel} [${statsText}]`);
            }

            // 결과 임베드
            const resultEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ 엠블럼 스탯 수정 완료')
                .setDescription(`총 ${fixedCount}명의 유저 엠블럼 스탯이 수정되었습니다.`)
                .setFooter({ text: '엠블럼 강화 스탯이 정상적으로 적용되었습니다.' });

            // 결과가 너무 길면 파일로 저장
            if (results.length > 10) {
                const resultText = results.join('\n');
                const buffer = Buffer.from(resultText, 'utf-8');
                
                await interaction.followUp({
                    embeds: [resultEmbed],
                    files: [{
                        attachment: buffer,
                        name: 'emblem_stats_fix_results.txt'
                    }],
                    ephemeral: true
                });
            } else {
                resultEmbed.addFields({
                    name: '수정 내역',
                    value: results.join('\n') || '수정된 유저 없음'
                });
                
                await interaction.followUp({
                    embeds: [resultEmbed],
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('[엠블럼 스탯 수정] 오류:', error);
            await interaction.followUp({
                content: '❌ 엠블럼 스탯 수정 중 오류가 발생했습니다.',
                ephemeral: true
            });
        }
    }
};