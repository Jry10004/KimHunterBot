const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ]
});

client.once('ready', async () => {
    console.log('🔧 사용자 권한 부여 도구\n');
    
    const guildId = process.env.PRODUCTION_GUILD_ID;
    const userId = '424480594542592009';
    
    try {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        
        console.log(`👤 대상 사용자: ${member.user.tag}`);
        console.log(`📍 서버: ${guild.name}\n`);
        
        // 현재 역할 확인
        console.log('현재 역할:');
        member.roles.cache.forEach(role => {
            if (role.name !== '@everyone') {
                console.log(`  - ${role.name} (관리자: ${role.permissions.has('Administrator') ? '✅' : '❌'})`);
            }
        });
        
        // 관리자 권한이 있는 역할 찾기
        const adminRoles = guild.roles.cache.filter(role => 
            role.permissions.has(PermissionFlagsBits.Administrator) && 
            role.name !== '@everyone'
        );
        
        if (adminRoles.size > 0) {
            console.log('\n📋 서버의 관리자 역할:');
            adminRoles.forEach(role => {
                console.log(`  - ${role.name} (ID: ${role.id})`);
            });
            
            console.log('\n💡 해결 방법:');
            console.log('1. Discord에서 서버 설정 > 역할 메뉴로 이동');
            console.log('2. 사용자 _10004에게 위 관리자 역할 중 하나를 부여');
            console.log('3. 또는 새로운 관리자 역할을 만들어 부여');
        } else {
            console.log('\n⚠️ 서버에 관리자 역할이 없습니다!');
            console.log('\n💡 해결 방법:');
            console.log('1. Discord에서 서버 설정 > 역할 메뉴로 이동');
            console.log('2. "역할 만들기" 클릭');
            console.log('3. 역할 이름 설정 (예: 관리자, Admin)');
            console.log('4. 권한 탭에서 "관리자" 권한 활성화');
            console.log('5. 사용자 _10004에게 이 역할 부여');
        }
        
        // 서버 소유자 정보
        if (guild.ownerId !== userId) {
            const owner = await guild.fetchOwner();
            console.log(`\n👑 서버 소유자: ${owner.user.tag}`);
            console.log('서버 소유자에게 관리자 역할 부여를 요청하세요.');
        }
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
    
    client.destroy();
});

client.login(process.env.BOT_TOKEN);