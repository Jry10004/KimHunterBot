// 이모지 서버 확인 스크립트
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildEmojisAndStickers
    ] 
});

client.once('ready', () => {
    console.log(`${client.user.tag} 로그인 완료!`);
    console.log('\n=== 봇이 속한 서버 목록 ===');
    
    client.guilds.cache.forEach(guild => {
        console.log(`\n서버명: ${guild.name}`);
        console.log(`서버 ID: ${guild.id}`);
        console.log(`멤버 수: ${guild.memberCount}`);
        console.log(`이모지 수: ${guild.emojis.cache.size}`);
        
        if (guild.emojis.cache.size > 0) {
            console.log('이모지 목록:');
            guild.emojis.cache.forEach(emoji => {
                console.log(`  - ${emoji.name}: <:${emoji.name}:${emoji.id}>`);
            });
        }
    });
    
    console.log('\n=== 이모지 사용 가능 여부 확인 ===');
    console.log('봇이 양쪽 서버에 모두 있어야 다른 서버의 이모지를 사용할 수 있습니다.');
    
    process.exit(0);
});

client.login(process.env.BOT_TOKEN);