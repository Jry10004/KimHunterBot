require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log('봇 준비 완료');
    
    const userIds = [
        '1374702838541168650',  // 익명유저로 표시되는 ID
        '295980447849250817',   // 하연
        '364197967114272769',   // 선규
        '424480594542592009'    // 요리
    ];
    
    for (const userId of userIds) {
        try {
            const user = await client.users.fetch(userId);
            console.log(`✅ ${userId}: ${user.username} (${user.tag})`);
        } catch (error) {
            console.log(`❌ ${userId}: 찾을 수 없음 (${error.message})`);
        }
    }
    
    process.exit(0);
});

client.login(process.env.BOT_TOKEN || process.env.DISCORD_TOKEN);