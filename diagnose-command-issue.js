const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;
const userId = '424480594542592009';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const rest = new REST({ version: '10' }).setToken(token);

client.once('ready', async () => {
    console.log('🔍 명령어 문제 진단 시작...\n');
    
    try {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        
        console.log('=== 1. 사용자 정보 ===');
        console.log(`사용자: ${member.user.tag}`);
        console.log(`서버 소유자: ${guild.ownerId === userId ? '✅' : '❌'}`);
        console.log(`관리자 권한: ${member.permissions.has('Administrator') ? '✅' : '❌'}`);
        
        console.log('\n=== 2. 봇 정보 ===');
        const botMember = guild.members.cache.get(client.user.id);
        console.log(`봇: ${client.user.tag}`);
        console.log(`봇 관리자 권한: ${botMember.permissions.has('Administrator') ? '✅' : '❌'}`);
        console.log(`봇 명령어 권한: ${botMember.permissions.has('UseApplicationCommands') ? '✅' : '❌'}`);
        
        console.log('\n=== 3. REST API로 명령어 확인 ===');
        const restCommands = await rest.get(
            Routes.applicationGuildCommands(clientId, guildId)
        );
        
        const problemCommands = restCommands.filter(cmd => 
            ['말', '공지작성'].includes(cmd.name)
        );
        
        problemCommands.forEach(cmd => {
            console.log(`\n/${cmd.name}:`);
            console.log(`  ID: ${cmd.id}`);
            console.log(`  설명: ${cmd.description}`);
            console.log(`  권한: ${cmd.default_member_permissions || '없음'}`);
            console.log(`  DM 허용: ${cmd.dm_permission}`);
        });
        
        console.log('\n=== 4. Discord.js로 명령어 확인 ===');
        const djsCommands = await guild.commands.fetch();
        const djsProblemCommands = djsCommands.filter(cmd => 
            ['말', '공지작성'].includes(cmd.name)
        );
        
        djsProblemCommands.forEach(cmd => {
            console.log(`\n/${cmd.name}:`);
            console.log(`  등록 상태: ✅`);
            console.log(`  권한 필요: ${cmd.defaultMemberPermissions ? cmd.defaultMemberPermissions.toArray().join(', ') : '없음'}`);
        });
        
        console.log('\n=== 5. 가능한 원인 ===');
        if (!member.permissions.has('Administrator')) {
            console.log('❗ 사용자가 관리자 권한이 없어 관리자 명령어가 보이지 않음');
        }
        if (restCommands.length !== djsCommands.size) {
            console.log('❗ REST API와 Discord.js 명령어 수가 다름 (캐시 문제)');
        }
        
        console.log('\n=== 6. 해결 방법 ===');
        console.log('옵션 1: 사용자에게 관리자 권한 부여');
        console.log('옵션 2: 명령어 권한 설정 변경 (관리자 전용 해제)');
        console.log('옵션 3: Discord 앱 캐시 초기화');
        console.log('  - Windows: %appdata%/discord/Cache 폴더 삭제');
        console.log('  - 또는 Discord 설정 > 고급 > "캐시 지우기"');
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
    
    client.destroy();
});

client.login(token);