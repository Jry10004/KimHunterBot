const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;

console.log('🔍 환경 변수 확인:');
console.log(`CLIENT_ID: ${clientId}`);
console.log(`GUILD_ID: ${guildId}`);
console.log(`TOKEN: ${token ? '✅ 설정됨' : '❌ 없음'}`);

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        // 1. 길드 명령어 확인
        console.log('\n📋 길드 명령어 확인 중...');
        const guildCommands = await rest.get(
            Routes.applicationGuildCommands(clientId, guildId)
        );
        
        console.log(`\n길드 명령어 (${guildCommands.length}개):`);
        const adminCommands = guildCommands.filter(cmd => 
            cmd.default_member_permissions === '8' || 
            cmd.name === '말' || 
            cmd.name === '공지작성'
        );
        
        console.log('\n🔐 관리자 명령어:');
        adminCommands.forEach(cmd => {
            console.log(`- /${cmd.name}`);
            console.log(`  ID: ${cmd.id}`);
            console.log(`  권한: ${cmd.default_member_permissions || '없음'}`);
            console.log(`  설명: ${cmd.description}`);
            console.log('');
        });

        // 2. 명령어 권한 정보 상세 확인
        console.log('\n🔍 명령어 권한 상세 정보:');
        const targetCommands = ['말', '공지작성'];
        
        for (const cmdName of targetCommands) {
            const cmd = guildCommands.find(c => c.name === cmdName);
            if (cmd) {
                console.log(`\n/${cmdName}:`);
                console.log(JSON.stringify({
                    id: cmd.id,
                    name: cmd.name,
                    description: cmd.description,
                    default_member_permissions: cmd.default_member_permissions,
                    dm_permission: cmd.dm_permission,
                    type: cmd.type,
                    options: cmd.options?.length || 0
                }, null, 2));
            }
        }

        // 3. 봇의 길드 정보 확인
        console.log('\n🤖 봇 정보 확인...');
        const botInfo = await rest.get(Routes.user('@me'));
        console.log(`봇 이름: ${botInfo.username}`);
        console.log(`봇 ID: ${botInfo.id}`);
        
        // 4. 해결 방법 제안
        console.log('\n💡 해결 방법:');
        console.log('1. Discord 데스크톱 앱에서 Ctrl+R을 여러 번 눌러보세요');
        console.log('2. Discord 웹 버전에서 확인해보세요: https://discord.com');
        console.log('3. 다른 관리자 계정으로 확인해보세요');
        console.log('4. 봇을 다른 서버에 초대해서 테스트해보세요');
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
})();