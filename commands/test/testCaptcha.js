const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const antiMacro = require('../../systems/antiMacro');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testcaptcha')
        .setDescription('CAPTCHA 시스템 테스트')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('테스트할 사용자')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // 테스트할 사용자 ID
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const userId = targetUser.id;

            // CAPTCHA 트리거
            const captchaResult = await antiMacro.triggerCaptchaVerification(userId, interaction.channel);

            if (!captchaResult) {
                await interaction.editReply({
                    content: '❌ CAPTCHA를 생성할 수 없습니다. 이미 진행 중이거나 면제된 사용자입니다.'
                });
                return;
            }

            // CAPTCHA 이미지
            const imageBuffer = captchaResult.image;

            // 검증 임베드 생성
            const verifyEmbed = new EmbedBuilder()
                .setTitle('🚨 CAPTCHA 테스트')
                .setDescription(`**${captchaResult.message}**\n\n⏱️ 제한 시간: 60초\n⚠️ 3회 실패 또는 시간 초과 시 제재가 적용됩니다.\n\n💡 답을 DM이나 이 채널에 입력하세요!`)
                .setColor('#FF6B6B')
                .setImage('attachment://captcha.png')
                .setFooter({ text: '김헌터 보안 시스템' })
                .setTimestamp();

            // 현재 제재 레벨 표시
            const penaltyHistory = antiMacro.ANTI_MACRO.penaltyHistory.get(userId);
            if (penaltyHistory && penaltyHistory.level > 0) {
                verifyEmbed.addFields({
                    name: '⚠️ 현재 경고 단계',
                    value: `${penaltyHistory.level}단계 / 8단계`,
                    inline: true
                });
            }

            // 디버그 정보 (관리자만)
            if (interaction.user.id === interaction.guild.ownerId) {
                verifyEmbed.addFields({
                    name: '🔍 디버그 정보',
                    value: `타입: ${captchaResult.type}`,
                    inline: true
                });
            }

            await interaction.editReply({
                content: `<@${userId}> CAPTCHA 테스트가 시작되었습니다!`,
                embeds: [verifyEmbed],
                files: [{ attachment: imageBuffer, name: 'captcha.png' }]
            });

            // 타임아웃 처리
            setTimeout(async () => {
                const verification = antiMacro.ANTI_MACRO.activeVerifications.get(userId);
                if (verification) {
                    const result = await antiMacro.verifyCaptcha(userId, 'TIMEOUT_CHECK');
                    if (result.reason === 'timeout') {
                        await interaction.followUp({
                            content: `⏰ <@${userId}> CAPTCHA 시간이 초과되었습니다!`,
                            ephemeral: true
                        });
                    }
                }
            }, 60000);

        } catch (error) {
            console.error('CAPTCHA 테스트 오류:', error);
            await interaction.editReply({
                content: `❌ CAPTCHA 테스트 중 오류가 발생했습니다: ${error.message}`
            });
        }
    },
};