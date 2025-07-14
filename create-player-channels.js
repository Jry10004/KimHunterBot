const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

async function createPlayerChannels() {
    try {
        // 핫플레이스 성남방 서버
        const guild = client.guilds.cache.get('1371881456212639794');
        if (!guild) {
            console.error('❌ 서버를 찾을 수 없습니다!');
            return;
        }

        console.log('🔧 플레이어 전용 채널 생성 시작...\n');

        // 김헌터플레이어 역할 찾기
        const playerRole = guild.roles.cache.find(role => role.name === '김헌터플레이어');
        if (!playerRole) {
            console.error('❌ 김헌터플레이어 역할을 찾을 수 없습니다!');
            return;
        }

        // 강화왕 김헌터 카테고리 찾기
        const category = guild.channels.cache.find(ch => 
            ch.type === ChannelType.GuildCategory && ch.name === '━━━━━━━━━ 강화왕김헌터 ━━━━━━━━━'
        );
        
        if (!category) {
            console.error('❌ 강화왕 김헌터 카테고리를 찾을 수 없습니다!');
            return;
        }

        console.log(`📁 카테고리 찾음: ${category.name} (ID: ${category.id})`);

        // 채널 생성
        const channels = [
            {
                name: '💬│플레이어-라운지',
                topic: '김헌터 플레이어들의 자유로운 잡담 공간',
                type: ChannelType.GuildText
            },
            {
                name: '⚔️│사냥터',
                topic: '게임 명령어를 사용하는 공간 - 사냥, 강화, 결투 등',
                type: ChannelType.GuildText
            }
        ];

        for (const channelData of channels) {
            console.log(`\n📝 "${channelData.name}" 채널 생성 중...`);
            
            const channel = await guild.channels.create({
                name: channelData.name,
                type: channelData.type,
                parent: category.id,
                topic: channelData.topic,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: playerRole.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AddReactions,
                            PermissionFlagsBits.UseApplicationCommands
                        ]
                    }
                ]
            });

            console.log(`✅ "${channel.name}" 채널 생성 완료!`);
            console.log(`   - ID: ${channel.id}`);
            console.log(`   - 설명: ${channelData.topic}`);
        }

        console.log('\n✅ 모든 플레이어 전용 채널 생성 완료!');
        console.log('   - 김헌터플레이어 역할을 가진 사용자만 접근 가능');

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        client.destroy();
        process.exit(0);
    }
}

client.once('ready', async () => {
    console.log(`${client.user.tag}으로 로그인했습니다!`);
    await createPlayerChannels();
});

client.login(process.env.BOT_TOKEN);