const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const antiMacro = require('../../systems/antiMacro');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('매크로테스트')
        .setDescription('매크로 방지 시스템 테스트 (관리자 전용)')
        .addStringOption(option =>
            option.setName('타입')
                .setDescription('테스트 유형을 선택하세요')
                .setRequired(true)
                .addChoices(
                    { name: '기본 검증', value: 'basic' },
                    { name: '빠른 클릭 패턴', value: 'rapid' },
                    { name: '반복 패턴', value: 'pattern' },
                    { name: '상태 확인', value: 'status' },
                    { name: '초기화', value: 'reset' }
                ))
        .addUserOption(option =>
            option.setName('대상')
                .setDescription('대상 사용자 (선택사항)')
                .setRequired(false)),

    async execute(interaction) {
        console.log('매크로테스트 명령어 실행 시작');
        try {
            // 관리자 확인
            const ADMIN_IDS = ['424480594542592009', '295980447849250817', '532128778175619084', '592659577384730645'];
            if (!ADMIN_IDS.includes(interaction.user.id)) {
                console.log('관리자가 아닌 사용자:', interaction.user.id);
                return interaction.reply({ 
                    content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!', 
                    flags: 64  // ephemeral flag
                });
            }

            const mode = interaction.options.getString('타입');
            const targetUser = interaction.options.getUser('대상');
            const targetId = targetUser?.id || interaction.user.id;
            
            console.log('매크로테스트 모드:', mode, '대상:', targetId);

            switch (mode) {
            case 'basic':
                console.log('basic 케이스 시작');
                // 테스트 모드에서는 기존 검증 제거
                if (antiMacro.ANTI_MACRO.activeVerifications.has(targetId)) {
                    console.log('기존 검증 제거');
                    antiMacro.ANTI_MACRO.activeVerifications.delete(targetId);
                }
                
                // macroMonitor의 쿨다운도 제거
                const macroMonitor = require('../systems/macroMonitor');
                if (macroMonitor.recentCaptchas.has(targetId)) {
                    console.log('쿨다운 제거');
                    macroMonitor.recentCaptchas.delete(targetId);
                }
                
                console.log('CAPTCHA 검증 트리거 시작');
                // 기본 CAPTCHA 검증 트리거
                let captchaResult;
                try {
                    captchaResult = await antiMacro.triggerCaptchaVerification(targetId, interaction.channel);
                    console.log('CAPTCHA 결과:', captchaResult);
                } catch (captchaError) {
                    console.error('CAPTCHA 생성 오류:', captchaError);
                    return interaction.reply('❌ CAPTCHA 생성 중 오류가 발생했습니다: ' + captchaError.message);
                }
                
                if (captchaResult && captchaResult.type === 'captcha_required') {
                    console.log('CAPTCHA 생성 성공, 응답 전송');
                    
                    // 대상 유저에게 DM으로 CAPTCHA 전송
                    try {
                        const target = await interaction.client.users.fetch(targetId);
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('🔒 매크로 검증 요청')
                            .setDescription(captchaResult.message + '\n\n**💬 이 DM 또는 아무 채널에 답을 입력하세요!**')
                            .setColor('#FF0000')
                            .setFooter({ text: '⏰ 60초 내에 답변을 입력해주세요.' })
                            .setTimestamp();
                        
                        if (captchaResult.question) {
                            dmEmbed.addFields({ name: '문제', value: captchaResult.question, inline: false });
                        }
                        
                        await target.send({
                            embeds: [dmEmbed],
                            files: [{ attachment: captchaResult.image, name: 'captcha.png' }]
                        });
                        
                        // 채널에도 알림 전송 (이미지는 제외)
                        const channelEmbed = new EmbedBuilder()
                            .setTitle('🔒 매크로 검증 진행 중')
                            .setDescription(`<@${targetId}>님에게 매크로 검증을 요청했습니다.\n검증이 진행 중입니다...`)
                            .setColor('#FFA500')
                            .setFooter({ text: 'DM을 확인해주세요!' });
                        
                        await interaction.channel.send({
                            embeds: [channelEmbed]
                        });
                        
                        const successEmbed = new EmbedBuilder()
                            .setTitle('✅ 매크로 검증 전송 완료')
                            .setDescription(`<@${targetId}>님에게 CAPTCHA 검증을 요청했습니다.`)
                            .setColor('#00FF00')
                            .setTimestamp();
                        
                        return interaction.reply({
                            embeds: [successEmbed]
                        });
                    } catch (dmError) {
                        console.error('DM 전송 실패:', dmError);
                        return interaction.reply('❌ DM 전송에 실패했습니다. 대상의 DM이 차단되어 있을 수 있습니다.');
                    }
                } else {
                    console.log('CAPTCHA 생성 실패');
                    return interaction.reply('❌ CAPTCHA 검증 시작에 실패했습니다. 대상이 화이트리스트에 있을 수 있습니다.');
                }
                break;

            case 'rapid':
                // 빠른 클릭 패턴 시뮬레이션
                for (let i = 0; i < 10; i++) {
                    antiMacro.recordUserAction(targetId, 'test:rapid_click', Date.now() + i * 100);
                }
                return interaction.reply('✅ 빠른 클릭 패턴이 기록되었습니다.');

            case 'pattern':
                // 반복 패턴 시뮬레이션
                const baseTime = Date.now();
                for (let i = 0; i < 20; i++) {
                    antiMacro.recordUserAction(targetId, 'test:repeat', baseTime + i * 1000);
                }
                return interaction.reply('✅ 반복 패턴이 기록되었습니다.');

            case 'status':
                // 시스템 상태 확인
                const stats = antiMacro.getStatistics();
                const userPattern = antiMacro.ANTI_MACRO.userPatterns.get(targetId);
                const penaltyStatus = antiMacro.checkPenaltyStatus(targetId);
                
                const statusEmbed = new EmbedBuilder()
                    .setTitle('📊 매크로 방지 시스템 상태')
                    .setColor('#0099ff')
                    .addFields(
                        { name: '전체 추적 사용자', value: `${stats.totalTrackedUsers}명`, inline: true },
                        { name: '진행 중인 검증', value: `${stats.activeVerifications}건`, inline: true },
                        { name: '제재 받은 사용자', value: `${stats.penalizedUsers}명`, inline: true },
                        { name: '화이트리스트', value: `${stats.whitelistedUsers}명`, inline: true },
                        { name: '임시 면제', value: `${stats.temporaryExemptions}명`, inline: true }
                    );
                
                if (userPattern) {
                    statusEmbed.addFields(
                        { name: '\n대상 사용자 정보', value: `<@${targetId}>`, inline: false },
                        { name: '의심 점수', value: `${userPattern.suspicionScore}점`, inline: true },
                        { name: '기록된 행동', value: `${userPattern.actions.length}개`, inline: true },
                        { name: '제재 상태', value: penaltyStatus.restricted ? '제재 중' : '정상', inline: true }
                    );
                }
                
                return interaction.reply({ embeds: [statusEmbed] });

            case 'reset':
                // 특정 사용자 초기화
                antiMacro.resetUserPattern(targetId);
                antiMacro.resetPenaltyHistory(targetId);
                return interaction.reply(`✅ <@${targetId}>의 매크로 감지 기록이 초기화되었습니다.`);
                
            default:
                return interaction.reply('❌ 알 수 없는 테스트 모드입니다.');
            }
        } catch (error) {
            console.error('매크로테스트 오류:', error);
            
            // 이미 응답했는지 확인
            if (interaction.replied || interaction.deferred) {
                return interaction.editReply('❌ 매크로 테스트 중 오류가 발생했습니다.');
            } else {
                return interaction.reply({
                    content: '❌ 매크로 테스트 중 오류가 발생했습니다.',
                    flags: 64
                });
            }
        }
    }
};