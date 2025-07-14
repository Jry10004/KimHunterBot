const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('버그제보')
        .setDescription('게임 버그를 제보합니다'),
    
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('bug_report_modal')
            .setTitle('🐛 버그 제보');

        const bugTypeInput = new TextInputBuilder()
            .setCustomId('bug_type')
            .setLabel('버그 종류')
            .setPlaceholder('예: 강화 오류, 전투 버그, UI 문제 등')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        const bugDescriptionInput = new TextInputBuilder()
            .setCustomId('bug_description')
            .setLabel('버그 설명')
            .setPlaceholder('버그가 발생한 상황을 자세히 설명해주세요')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1000);

        const reproduceStepsInput = new TextInputBuilder()
            .setCustomId('reproduce_steps')
            .setLabel('재현 방법')
            .setPlaceholder('버그를 재현하는 방법을 단계별로 설명해주세요')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500);

        const expectedResultInput = new TextInputBuilder()
            .setCustomId('expected_result')
            .setLabel('예상 결과')
            .setPlaceholder('정상적으로 작동했다면 어떻게 되어야 했나요?')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(200);

        const additionalInfoInput = new TextInputBuilder()
            .setCustomId('additional_info')
            .setLabel('추가 정보')
            .setPlaceholder('스크린샷 링크나 기타 정보가 있다면 입력해주세요')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(300);

        const firstActionRow = new ActionRowBuilder().addComponents(bugTypeInput);
        const secondActionRow = new ActionRowBuilder().addComponents(bugDescriptionInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(reproduceStepsInput);
        const fourthActionRow = new ActionRowBuilder().addComponents(expectedResultInput);
        const fifthActionRow = new ActionRowBuilder().addComponents(additionalInfoInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

        await interaction.showModal(modal);
    }
};