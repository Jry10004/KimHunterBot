const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

async function updateChannelPermissions() {
    try {
        // 핫플레이스 성남방 서버
        const guild = client.guilds.cache.get('1371881456212639794');
        if (!guild) {
            console.error('❌ 서버를 찾을 수 없습니다!');
            return;
        }

        console.log('🔧 채널 권한 업데이트 시작...\n');

        // 채널 ID로 직접 가져오기
        const hotplChatChannel = guild.channels.cache.get('1371881456212639796'); // 🔥│핫플채팅
        const highlightChannel = guild.channels.cache.get('1371881456212639797'); // 🎬│하이라이트

        let updatedCount = 0;

        // #핫플채팅 권한 설정
        if (hotplChatChannel) {
            console.log(`📝 ${hotplChatChannel.name} 채널 권한 수정 중...`);
            await hotplChatChannel.permissionOverwrites.edit(guild.roles.everyone, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            console.log(`✅ ${hotplChatChannel.name} - 모든 사용자에게 표시되도록 설정 완료`);
            updatedCount++;
        } else {
            console.log('⚠️ 핫플채팅 채널을 찾을 수 없습니다.');
        }

        // #하이라이트 채널 권한 설정
        if (highlightChannel) {
            console.log(`🎬 ${highlightChannel.name} 채널 권한 수정 중...`);
            await highlightChannel.permissionOverwrites.edit(guild.roles.everyone, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            console.log(`✅ ${highlightChannel.name} - 모든 사용자에게 표시되도록 설정 완료`);
            updatedCount++;
        } else {
            console.log('⚠️ 하이라이트 채널을 찾을 수 없습니다.');
        }

        // 음성 채널도 확인 (하이라이트 음성채널이 있다면)
        const voiceChannels = guild.channels.cache.filter(ch => 
            ch.type === 2 && ch.name.includes('하이라이트')
        );
        
        for (const [id, channel] of voiceChannels) {
            console.log(`🎤 ${channel.name} 음성채널 권한 수정 중...`);
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
                ViewChannel: true,
                Connect: true,
                Speak: true
            });
            console.log(`✅ ${channel.name} - 모든 사용자에게 표시되도록 설정 완료`);
            updatedCount++;
        }

        console.log(`\n✅ 권한 업데이트 완료! 총 ${updatedCount}개 채널 수정됨`);

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        client.destroy();
        process.exit(0);
    }
}

client.once('ready', async () => {
    console.log(`${client.user.tag}으로 로그인했습니다!`);
    await updateChannelPermissions();
});

client.login(process.env.BOT_TOKEN);