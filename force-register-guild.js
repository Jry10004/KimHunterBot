require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// 봇 클라이언트 생성
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds
    ]
});

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} 로그인 완료`);
    
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    
    // 봇이 참여한 모든 서버 목록
    console.log('\n📋 봇이 참여 중인 서버 목록:');
    client.guilds.cache.forEach((guild, index) => {
        console.log(`${index + 1}. ${guild.name} (${guild.id})`);
    });
    
    // 각 서버에 명령어 강제 등록
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            console.log(`\n🔄 [${guild.name}] 서버에 명령어 등록 시도...`);
            
            // 기존 명령어 삭제
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, guildId),
                { body: [] }
            );
            
            console.log(`✅ [${guild.name}] 서버의 기존 명령어 삭제 완료`);
            console.log('봇을 재시작하면 명령어가 다시 등록됩니다.');
            
        } catch (error) {
            console.log(`❌ [${guild.name}] 실패:`, error.message);
        }
    }
    
    process.exit(0);
});

client.login(TOKEN);