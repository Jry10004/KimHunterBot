const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const antiMacro = require('../systems/antiMacro');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('captchastatus')
        .setDescription('CAPTCHA 시스템 상태 확인')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('확인할 사용자')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;

            // 전체 통계
            const stats = antiMacro.getStatistics();

            // 사용자별 상태
            const penaltyStatus = antiMacro.checkPenaltyStatus(userId);
            const isExempted = antiMacro.isExempted(userId);
            const hasActiveVerification = antiMacro.ANTI_MACRO.activeVerifications.has(userId);
            const userPattern = antiMacro.ANTI_MACRO.userPatterns.get(userId);

            // 상태 임베드 생성
            const statusEmbed = new EmbedBuilder()
                .setTitle('🔍 CAPTCHA 시스템 상태')
                .setColor(penaltyStatus.restricted ? '#FF0000' : '#00FF00')
                .setTimestamp();

            // 전체 통계
            statusEmbed.addFields({
                name: '📊 전체 통계',
                value: `추적 중인 사용자: ${stats.totalTrackedUsers}명\n진행 중인 검증: ${stats.activeVerifications}개\n제재받은 사용자: ${stats.penalizedUsers}명\n화이트리스트: ${stats.whitelistedUsers}명`,
                inline: false
            });

            // 사용자 상태
            let userStatus = '✅ 정상';
            if (penaltyStatus.restricted) {
                userStatus = `🚫 제재 중 (${penaltyStatus.reason})`;
                if (penaltyStatus.timeLeft) {
                    const minutes = Math.floor(penaltyStatus.timeLeft / 60000);
                    const hours = Math.floor(minutes / 60);
                    const days = Math.floor(hours / 24);
                    
                    let timeStr = '';
                    if (days > 0) timeStr = `${days}일 `;
                    if (hours % 24 > 0) timeStr += `${hours % 24}시간 `;
                    if (minutes % 60 > 0) timeStr += `${minutes % 60}분`;
                    
                    userStatus += `\n남은 시간: ${timeStr}`;
                }
            } else if (hasActiveVerification) {
                userStatus = '🔄 검증 진행 중';
            } else if (isExempted) {
                userStatus = '🛡️ 면제됨';
            }

            statusEmbed.addFields({
                name: `👤 ${targetUser.username} 상태`,
                value: userStatus,
                inline: true
            });

            // 의심 점수
            if (userPattern) {
                statusEmbed.addFields({
                    name: '🎯 의심 점수',
                    value: `${userPattern.suspicionScore}점`,
                    inline: true
                });
            }

            // 제재 기록
            const penaltyHistory = antiMacro.ANTI_MACRO.penaltyHistory.get(userId);
            if (penaltyHistory) {
                statusEmbed.addFields({
                    name: '⚠️ 제재 기록',
                    value: `레벨: ${penaltyHistory.level}/8\n총 위반: ${penaltyHistory.totalViolations}회`,
                    inline: true
                });
            }

            // 관리자 전용 정보
            if (interaction.user.id === interaction.guild.ownerId) {
                const activeVerification = antiMacro.ANTI_MACRO.activeVerifications.get(userId);
                if (activeVerification) {
                    statusEmbed.addFields({
                        name: '🔐 현재 검증 정보',
                        value: `코드: ||${activeVerification.code}||\n타입: ${activeVerification.type}\n시도: ${activeVerification.attempts}/3`,
                        inline: false
                    });
                }
            }

            await interaction.editReply({
                embeds: [statusEmbed]
            });

        } catch (error) {
            console.error('CAPTCHA 상태 확인 오류:', error);
            await interaction.editReply({
                content: `❌ 상태 확인 중 오류가 발생했습니다: ${error.message}`
            });
        }
    },
};