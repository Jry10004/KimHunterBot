const { Client, GatewayIntentBits } = require('discord.js');
const { token } = require('../config/config');
const { initializeEmblemShop } = require('../systems/emblemShop');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', async () => {
    console.log('✅ 봇이 준비되었습니다.');
    
    try {
        // 엠블럼 상점 채널 업데이트
        const channelId = '1388182808895291422';
        const channel = await client.channels.fetch(channelId);
        
        if (!channel) {
            console.error('❌ 채널을 찾을 수 없습니다.');
            return;
        }
        
        console.log(`📍 채널 발견: ${channel.name}`);
        
        // 엠블럼 상점 메시지 업데이트 (forceNew = false로 기존 메시지 업데이트)
        await initializeEmblemShop(client, channelId, false);
        
        console.log('✅ 엠블럼 상점 버튼 업데이트 완료!');
        console.log('🔨 이제 엠블럼 강화 버튼이 추가되었습니다.');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        // 봇 종료
        setTimeout(() => {
            client.destroy();
            console.log('👋 봇을 종료합니다.');
        }, 2000);
    }
});

client.login(token);