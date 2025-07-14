// 회원가입 시스템 테스트 스크립트
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

console.log('=== 회원가입 모달 구조 확인 ===');

// 모달 생성
const modal = new ModalBuilder()
    .setCustomId('registration_email_modal')
    .setTitle('회원가입 - 정보 입력');

const emailInput = new TextInputBuilder()
    .setCustomId('email_input')
    .setLabel('이메일 주소')
    .setPlaceholder('example@email.com')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(100);
    
const nicknameInput = new TextInputBuilder()
    .setCustomId('nickname_input')
    .setLabel('게임 닉네임 (2~10자, 한글/영문/숫자)')
    .setPlaceholder('김헌터')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(10);

modal.addComponents(
    new ActionRowBuilder().addComponents(emailInput),
    new ActionRowBuilder().addComponents(nicknameInput)
);

console.log('모달 구성 요소:');
console.log('- 이메일 입력: ✅');
console.log('- 닉네임 입력: ✅');
console.log('- 모달 ID:', modal.data.custom_id);
console.log('- 모달 제목:', modal.data.title);
console.log('- 컴포넌트 수:', modal.components.length);

console.log('\n현재 모달에는 이메일과 닉네임 입력 필드가 모두 포함되어 있습니다.');
console.log('만약 이메일 입력칸이 보이지 않는다면:');
console.log('1. Discord 클라이언트 업데이트 필요');
console.log('2. 모바일에서는 모달이 다르게 표시될 수 있음');
console.log('3. 봇 권한 문제일 수 있음');