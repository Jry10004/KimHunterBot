const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const stateManager = require('../systems/dogBotStateManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('댕댕봇데이터리로드')
        .setDescription('댕댕봇 구출 이벤트 데이터를 강제로 리로드합니다 (관리자 전용)'),
    
    async execute(interaction) {
        // 관리자 권한 체크
        const ADMIN_IDS = ['295980447849250817', '424480594542592009']; // 하연, 요리
        
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
                ephemeral: true
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            console.log(`[Admin] ${interaction.user.username}님이 댕댕봇 데이터 리로드 요청`);
            
            // 데이터 리로드 전 상태
            const beforeStats = {
                totalAttacks: stateManager.state.statistics.totalAttacks,
                totalDamage: stateManager.state.statistics.totalDamage,
                participants: stateManager.state.statistics.participants.length,
                userCount: Object.keys(stateManager.state.statistics.userDamage).length
            };
            
            // 데이터 강제 리로드
            const success = await stateManager.forceReloadData();
            
            if (!success) {
                return await interaction.editReply({
                    content: '❌ 데이터 리로드에 실패했습니다. 콘솔 로그를 확인해주세요.'
                });
            }
            
            // 데이터 리로드 후 상태
            const afterStats = {
                totalAttacks: stateManager.state.statistics.totalAttacks,
                totalDamage: stateManager.state.statistics.totalDamage,
                participants: stateManager.state.statistics.participants.length,
                userCount: Object.keys(stateManager.state.statistics.userDamage).length
            };
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ 댕댕봇 데이터 리로드 완료')
                .setDescription('파일에서 데이터를 성공적으로 다시 로드했습니다.')
                .addFields(
                    {
                        name: '📊 이전 상태',
                        value: `총 공격: ${beforeStats.totalAttacks}회\n` +
                               `총 데미지: ${beforeStats.totalDamage.toLocaleString()}\n` +
                               `참여자: ${beforeStats.participants}명\n` +
                               `유저 데이터: ${beforeStats.userCount}개`,
                        inline: true
                    },
                    {
                        name: '📊 현재 상태',
                        value: `총 공격: ${afterStats.totalAttacks}회\n` +
                               `총 데미지: ${afterStats.totalDamage.toLocaleString()}\n` +
                               `참여자: ${afterStats.participants}명\n` +
                               `유저 데이터: ${afterStats.userCount}개`,
                        inline: true
                    }
                )
                .setFooter({ text: '데이터가 업데이트되었습니다.' })
                .setTimestamp();
            
            // 주요 유저 데이터 표시
            let userDataText = '';
            const importantUsers = ['424480594542592009', '1374702838541168650', '295980447849250817'];
            
            for (const userId of importantUsers) {
                if (stateManager.state.statistics.userDamage[userId]) {
                    const damage = stateManager.state.statistics.userDamage[userId];
                    const attacks = stateManager.state.statistics.userAttackCount[userId] || 0;
                    userDataText += `<@${userId}>: ${damage.toLocaleString()} (${attacks}회)\n`;
                }
            }
            
            if (userDataText) {
                embed.addFields({
                    name: '👥 주요 유저 데이터',
                    value: userDataText,
                    inline: false
                });
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('[Admin] 데이터 리로드 오류:', error);
            await interaction.editReply({
                content: '❌ 데이터 리로드 중 오류가 발생했습니다: ' + error.message
            });
        }
    }
};