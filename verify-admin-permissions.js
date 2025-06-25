const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ]
});

client.once('ready', async () => {
    console.log(`✅ 봇 로그인: ${client.user.tag}\n`);
    
    const productionGuildId = process.env.PRODUCTION_GUILD_ID;
    const adminUserId = '424480594542592009'; // 관리자 ID
    
    try {
        // 1. 길드 가져오기
        const guild = await client.guilds.fetch(productionGuildId);
        console.log(`📍 서버: ${guild.name} (${guild.id})\n`);
        
        // 2. 관리자 멤버 정보 가져오기
        const adminMember = await guild.members.fetch(adminUserId);
        console.log(`👤 관리자: ${adminMember.user.tag}`);
        console.log(`관리자 권한: ${adminMember.permissions.has('Administrator') ? '✅ 있음' : '❌ 없음'}\n`);
        
        // 3. 봇의 권한 확인
        const botMember = guild.members.cache.get(client.user.id);
        console.log(`🤖 봇: ${botMember.user.tag}`);
        console.log(`봇 권한:`);
        console.log(`  - 슬래시 명령어: ${botMember.permissions.has('UseApplicationCommands') ? '✅' : '❌'}`);
        console.log(`  - 관리자: ${botMember.permissions.has('Administrator') ? '✅' : '❌'}`);
        console.log(`  - 메시지 보내기: ${botMember.permissions.has('SendMessages') ? '✅' : '❌'}`);
        
        // 4. 봇의 역할 확인
        console.log(`\n📋 봇의 역할:`);
        botMember.roles.cache.forEach(role => {
            if (role.name !== '@everyone') {
                console.log(`  - ${role.name} (권한: ${role.permissions.bitfield})`);
            }
        });
        
        // 5. 명령어 권한 상세 확인
        console.log('\n🔍 명령어 권한 확인:');
        const commands = await guild.commands.fetch();
        
        const adminCommands = commands.filter(cmd => 
            cmd.defaultMemberPermissions?.bitfield === 8n ||
            ['말', '공지작성'].includes(cmd.name)
        );
        
        console.log(`\n관리자 명령어 (${adminCommands.size}개):`);
        adminCommands.forEach(cmd => {
            console.log(`\n/${cmd.name}:`);
            console.log(`  ID: ${cmd.id}`);
            console.log(`  기본 권한: ${cmd.defaultMemberPermissions?.bitfield || '없음'}`);
            console.log(`  DM 가능: ${cmd.dmPermission ? '예' : '아니오'}`);
            
            // 관리자가 이 명령어를 사용할 수 있는지 확인
            const canUse = adminMember.permissions.has(cmd.defaultMemberPermissions || 0n);
            console.log(`  관리자 사용 가능: ${canUse ? '✅' : '❌'}`);
        });
        
        console.log('\n💡 해결 방법:');
        console.log('1. Discord 데스크톱 앱에서 Ctrl+Shift+R (강제 새로고침)');
        console.log('2. Discord 설정 > 고급 > 개발자 모드 켜기/끄기');
        console.log('3. 서버 설정 > 통합 > 봇 > 명령어 권한 확인');
        console.log('4. 웹 브라우저에서 Discord 접속: https://discord.com/channels/' + productionGuildId);
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
    
    client.destroy();
});

client.login(process.env.BOT_TOKEN);