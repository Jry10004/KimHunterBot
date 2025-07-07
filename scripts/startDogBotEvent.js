require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const stateManager = require('../systems/dogBotStateManager');
const announcer = require('../systems/dogBotEventAnnouncer');
const hostageSystem = require('../systems/dogBotHostageSystem');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} 로그인 완료!`);
    
    // 이벤트 시작
    stateManager.startEvent();
    console.log('🐕 댕댕봇 구출 이벤트를 시작했습니다.');
    
    // 자동 공지 시작
    announcer.startAnnouncements(client);
    console.log('📢 자동 공지를 시작했습니다.');
    
    // 인질 시스템 시작
    hostageSystem.startHostageSystem(client);
    console.log('🚨 인질 시스템을 시작했습니다.');
    
    // 5초 후 종료
    setTimeout(() => {
        console.log('✅ 이벤트 시작 완료!');
        client.destroy();
        process.exit(0);
    }, 5000);
});

client.login(process.env.DISCORD_TOKEN);