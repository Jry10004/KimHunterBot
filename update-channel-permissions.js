const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } = require('discord.js');
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

        // #핫플채팅 채널 찾기
        const hotplChatChannel = guild.channels.cache.find(ch => ch.name === '핫플채팅');
        // #하이라이트 음성채널 찾기
        const highlightVoiceChannel = guild.channels.cache.find(ch => 
            ch.name === '하이라이트' && ch.type === ChannelType.GuildVoice
        );

        let updatedCount = 0;

        // #핫플채팅 권한 설정
        if (hotplChatChannel) {
            console.log(`📝 #핫플채팅 채널 권한 수정 중...`);
            await hotplChatChannel.permissionOverwrites.edit(guild.roles.everyone, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            console.log(`✅ #핫플채팅 - 모든 사용자에게 표시되도록 설정 완료`);
            updatedCount++;
        } else {
            console.log('⚠️ #핫플채팅 채널을 찾을 수 없습니다.');
        }

        // #하이라이트 음성채널 권한 설정
        if (highlightVoiceChannel) {
            console.log(`🎤 #하이라이트 음성채널 권한 수정 중...`);
            await highlightVoiceChannel.permissionOverwrites.edit(guild.roles.everyone, {
                ViewChannel: true,
                Connect: true,
                Speak: true
            });
            console.log(`✅ #하이라이트 - 모든 사용자에게 표시되도록 설정 완료`);
            updatedCount++;
        } else {
            console.log('⚠️ #하이라이트 음성채널을 찾을 수 없습니다.');
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