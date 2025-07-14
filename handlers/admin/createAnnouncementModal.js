const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function createAnnouncementModal(template) {
    const modal = new ModalBuilder()
        .setCustomId(`announcement_${template}`)
        .setTitle('📢 공지사항 작성');

    // 제목 입력
    const titleInput = new TextInputBuilder()
        .setCustomId('announcement_title')
        .setLabel('공지 제목')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    // 템플릿별 기본 제목 설정
    switch (template) {
        case 'maintenance':
            titleInput.setPlaceholder('🔧 시스템 점검 안내');
            break;
        case 'event':
            titleInput.setPlaceholder('🎉 이벤트 안내');
            break;
        case 'update':
            titleInput.setPlaceholder('📋 업데이트 안내');
            break;
        default:
            titleInput.setPlaceholder('📢 공지사항');
    }

    // 내용 입력
    const contentInput = new TextInputBuilder()
        .setCustomId('announcement_content')
        .setLabel('공지 내용')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);

    // 템플릿별 기본 내용 설정
    switch (template) {
        case 'maintenance':
            contentInput.setPlaceholder('점검 일시, 내용을 입력하세요...');
            break;
        case 'event':
            contentInput.setPlaceholder('이벤트 기간, 내용을 입력하세요...');
            break;
        case 'update':
            contentInput.setPlaceholder('업데이트 내용을 입력하세요...');
            break;
        default:
            contentInput.setPlaceholder('공지사항 내용을 입력하세요...');
    }

    // 추가 옵션 (선택사항)
    const footerInput = new TextInputBuilder()
        .setCustomId('announcement_footer')
        .setLabel('하단 문구 (선택사항)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('김헌터 운영팀')
        .setValue('김헌터 운영팀')
        .setMaxLength(50);

    // 이미지 URL (선택사항)
    const imageInput = new TextInputBuilder()
        .setCustomId('announcement_image')
        .setLabel('이미지 URL (선택사항)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://example.com/image.png');

    // 색상 코드 (선택사항)
    const colorInput = new TextInputBuilder()
        .setCustomId('announcement_color')
        .setLabel('임베드 색상 (HEX 코드, 선택사항)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('#0099ff')
        .setValue(template === 'maintenance' ? '#ff6b6b' : template === 'event' ? '#ffd43b' : '#0099ff')
        .setMaxLength(7);

    // ActionRow에 컴포넌트 추가
    const firstRow = new ActionRowBuilder().addComponents(titleInput);
    const secondRow = new ActionRowBuilder().addComponents(contentInput);
    const thirdRow = new ActionRowBuilder().addComponents(footerInput);
    const fourthRow = new ActionRowBuilder().addComponents(imageInput);
    const fifthRow = new ActionRowBuilder().addComponents(colorInput);

    // 모달에 추가
    modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);

    return modal;
}

module.exports = { createAnnouncementModal };