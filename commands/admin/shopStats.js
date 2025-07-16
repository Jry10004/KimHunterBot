const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ShopGachaLogger = require('../../utils/shopGachaLogger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('상점통계')
        .setDescription('[관리자] 상점 가챠 통계를 확인합니다.')
        .addStringOption(option =>
            option.setName('날짜')
                .setDescription('조회할 날짜 (YYYY-MM-DD 형식)')
                .setRequired(false)),
    
    async execute(interaction) {
        // 관리자 확인
        const adminIds = ['1068170803849637999', '1232695833609199636'];
        if (!adminIds.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
                flags: 64
            });
        }
        
        await interaction.deferReply({ flags: 64 });
        
        try {
            const date = interaction.options.getString('날짜');
            const stats = await ShopGachaLogger.getStats(date);
            
            if (!stats) {
                return await interaction.editReply({
                    content: '❌ 통계를 불러올 수 없습니다. 로그 파일이 없거나 읽기 오류가 발생했습니다.'
                });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`📊 상점 가챠 통계 ${date ? `(${date})` : '(오늘)'}`)
                .setTimestamp();
            
            // 기본 통계
            embed.addFields({
                name: '📈 기본 통계',
                value: `총 시도: **${stats.total}**회\n` +
                       `성공: **${stats.success}**회 (${stats.total > 0 ? ((stats.success/stats.total)*100).toFixed(1) : 0}%)\n` +
                       `실패: **${stats.failed}**회 (${stats.total > 0 ? ((stats.failed/stats.total)*100).toFixed(1) : 0}%)\n` +
                       `중복 클릭: **${stats.duplicateClicks}**회`,
                inline: false
            });
            
            // 슬롯별 통계
            if (Object.keys(stats.bySlot).length > 0) {
                const slotStats = Object.entries(stats.bySlot)
                    .sort(([,a], [,b]) => b - a)
                    .map(([slot, count]) => `${slot}: **${count}**회`)
                    .join('\n');
                    
                embed.addFields({
                    name: '🎰 슬롯별 통계',
                    value: slotStats || '없음',
                    inline: true
                });
            }
            
            // 상위 사용자
            if (Object.keys(stats.byUser).length > 0) {
                const topUsers = Object.entries(stats.byUser)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .map(([userId, count], index) => `${index + 1}. <@${userId}>: **${count}**회`)
                    .join('\n');
                    
                embed.addFields({
                    name: '👥 상위 사용자 (Top 10)',
                    value: topUsers || '없음',
                    inline: true
                });
            }
            
            // 최근 오류
            if (stats.errors.length > 0) {
                const recentErrors = stats.errors
                    .slice(-5)
                    .reverse()
                    .map(err => {
                        const time = new Date(err.timestamp).toLocaleTimeString('ko-KR');
                        return `[${time}] <@${err.userId}> - ${err.slot}\n└ ${err.error} (${err.phase})`;
                    })
                    .join('\n\n');
                    
                embed.addFields({
                    name: '❌ 최근 오류 (최대 5개)',
                    value: recentErrors.substring(0, 1024),
                    inline: false
                });
            }
            
            // 성공률 계산
            const successRate = stats.total > 0 ? (stats.success / stats.total * 100).toFixed(1) : 0;
            const failRate = stats.total > 0 ? (stats.failed / stats.total * 100).toFixed(1) : 0;
            
            embed.setFooter({ 
                text: `전체 성공률: ${successRate}% | 실패율: ${failRate}% | 중복 클릭률: ${stats.total > 0 ? (stats.duplicateClicks / stats.total * 100).toFixed(1) : 0}%` 
            });
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('[상점통계] 오류:', error);
            await interaction.editReply({
                content: '❌ 통계 조회 중 오류가 발생했습니다.',
            });
        }
    }
};