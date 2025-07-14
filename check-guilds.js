const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

client.once('ready', async () => {
    console.log(`${client.user.tag}으로 로그인했습니다!`);
    
    console.log('\n봇이 참여한 서버 목록:');
    client.guilds.cache.forEach(guild => {
        console.log(`- ${guild.name} (ID: ${guild.id})`);
    });
    
    client.destroy();
    process.exit(0);
});

client.login(process.env.BOT_TOKEN);