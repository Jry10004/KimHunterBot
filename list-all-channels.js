const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

async function listAllChannels() {
    try {
        // 핫플레이스 성남방 서버
        const guild = client.guilds.cache.get('1371881456212639794');
        if (!guild) {
            console.error('❌ 서버를 찾을 수 없습니다!');
            return;
        }

        console.log('📋 서버의 모든 채널 목록:\n');

        // 텍스트 채널
        console.log('📝 텍스트 채널:');
        guild.channels.cache
            .filter(ch => ch.type === ChannelType.GuildText)
            .forEach(ch => {
                console.log(`  - ${ch.name} (ID: ${ch.id})`);
            });

        // 음성 채널
        console.log('\n🎤 음성 채널:');
        guild.channels.cache
            .filter(ch => ch.type === ChannelType.GuildVoice)
            .forEach(ch => {
                console.log(`  - ${ch.name} (ID: ${ch.id})`);
            });

        // 핫플 또는 하이라이트가 포함된 채널 찾기
        console.log('\n🔍 "핫플" 또는 "하이라이트" 포함 채널:');
        guild.channels.cache
            .filter(ch => ch.name.includes('핫플') || ch.name.includes('하이라이트'))
            .forEach(ch => {
                console.log(`  - ${ch.name} (ID: ${ch.id}, Type: ${ChannelType[ch.type]})`);
            });

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        client.destroy();
        process.exit(0);
    }
}

client.once('ready', async () => {
    console.log(`${client.user.tag}으로 로그인했습니다!`);
    await listAllChannels();
});

client.login(process.env.BOT_TOKEN);