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
    const userId = '424480594542592009';
    
    try {
        const guild = await client.guilds.fetch(productionGuildId);
        const member = await guild.members.fetch(userId);
        
        console.log(`👤 유저: ${member.user.tag} (${member.user.id})`);
        console.log(`🏷️ 닉네임: ${member.displayName}\n`);
        
        console.log('📋 역할 목록:');
        member.roles.cache.forEach(role => {
            if (role.name !== '@everyone') {
                console.log(`  - ${role.name}`);
                console.log(`    위치: ${role.position}`);
                console.log(`    권한: ${role.permissions.bitfield}`);
                console.log(`    관리자: ${role.permissions.has('Administrator') ? '✅' : '❌'}`);
                console.log(`    색상: ${role.hexColor}`);
                console.log('');
            }
        });
        
        console.log('🔑 권한 확인:');
        const permissions = [
            'Administrator',
            'ManageGuild',
            'ManageRoles',
            'ManageChannels',
            'ManageMessages',
            'UseApplicationCommands',
            'ManageWebhooks'
        ];
        
        permissions.forEach(perm => {
            console.log(`  ${perm}: ${member.permissions.has(perm) ? '✅' : '❌'}`);
        });
        
        // 서버 소유자 확인
        console.log(`\n👑 서버 소유자: ${guild.ownerId === userId ? '✅ 맞음' : '❌ 아님'}`);
        if (guild.ownerId !== userId) {
            const owner = await guild.fetchOwner();
            console.log(`   실제 소유자: ${owner.user.tag} (${owner.user.id})`);
        }
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
    
    client.destroy();
});

client.login(process.env.BOT_TOKEN).catch(console.error);