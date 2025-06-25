require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const PRODUCTION_GUILD_ID = '1386384507032039558';

// 봇 초대 링크 생성 (관리자 권한 + 애플리케이션 명령어 권한)
const inviteURL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${PRODUCTION_GUILD_ID}`;

console.log('🔗 봇 초대 링크 (프로덕션 서버용):');
console.log(inviteURL);
console.log('\n이 링크를 사용하여 봇을 프로덕션 서버에 추가하세요.');
console.log('권한: 관리자 + 슬래시 명령어');