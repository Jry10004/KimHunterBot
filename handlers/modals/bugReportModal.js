const { EmbedBuilder } = require('discord.js');

async function handleBugReportModal(interaction) {
    const bugType = interaction.fields.getTextInputValue('bug_type');
    const bugDescription = interaction.fields.getTextInputValue('bug_description');
    const reproduceSteps = interaction.fields.getTextInputValue('reproduce_steps');
    const expectedResult = interaction.fields.getTextInputValue('expected_result');
    const additionalInfo = interaction.fields.getTextInputValue('additional_info');

    // 버그 제보 채널 찾기
    const bugReportChannel = interaction.guild.channels.cache.find(ch => ch.name === '버그재보');
    
    if (!bugReportChannel) {
        return await interaction.reply({
            content: '❌ 버그재보 채널을 찾을 수 없습니다. 관리자에게 문의해주세요.',
            ephemeral: true
        });
    }

    // 버그 리포트 임베드 생성
    const bugEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle(`🐛 새로운 버그 제보`)
        .setAuthor({ 
            name: interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL()
        })
        .addFields(
            { name: '📋 버그 종류', value: bugType, inline: false },
            { name: '📝 버그 설명', value: bugDescription, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `제보자 ID: ${interaction.user.id}` });

    // 선택적 필드 추가
    if (reproduceSteps) {
        bugEmbed.addFields({ name: '🔄 재현 방법', value: reproduceSteps, inline: false });
    }
    if (expectedResult) {
        bugEmbed.addFields({ name: '✅ 예상 결과', value: expectedResult, inline: false });
    }
    if (additionalInfo) {
        bugEmbed.addFields({ name: '📎 추가 정보', value: additionalInfo, inline: false });
    }

    // 버그 리포트 전송
    try {
        await bugReportChannel.send({ embeds: [bugEmbed] });
        
        // 제보자에게 확인 메시지
        await interaction.reply({
            content: '✅ 버그 제보가 성공적으로 접수되었습니다!\n개발자가 확인 후 조치할 예정입니다. 감사합니다!',
            ephemeral: true
        });

        // 로그 기록
        console.log(`[버그제보] ${interaction.user.tag} - ${bugType}`);
        
    } catch (error) {
        console.error('버그 제보 전송 실패:', error);
        await interaction.reply({
            content: '❌ 버그 제보 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            ephemeral: true
        });
    }
}

module.exports = { handleBugReportModal };