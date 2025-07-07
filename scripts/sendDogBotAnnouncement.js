require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const announcer = require('../systems/dogBotEventAnnouncer');
const stateManager = require('../systems/dogBotStateManager');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} 로그인 완료!`);
    
    // 이벤트가 활성화되어 있는지 확인
    if (stateManager.state && stateManager.state.status && stateManager.state.status.isActive) {
        console.log('📢 댕댕봇 구출 이벤트 공지를 발송합니다...');
        await announcer.sendEventAnnouncement(client);
        console.log('✅ 공지 발송 완료!');
    } else {
        console.log('❌ 이벤트가 활성화되어 있지 않습니다.');
    }
    
    // 완료 후 종료
    setTimeout(() => {
        client.destroy();
        process.exit(0);
    }, 5000);
});

client.login(process.env.DISCORD_TOKEN);