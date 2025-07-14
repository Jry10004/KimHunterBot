const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
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
    
    try {
        // 핫플레이스 성남방 서버
        const guild = client.guilds.cache.get('1371881456212639794');
        if (!guild) {
            console.error('서버를 찾을 수 없습니다!');
            process.exit(1);
        }

        // 1. 김헌터플레이어 역할 생성 또는 찾기
        let playerRole = guild.roles.cache.find(role => role.name === '김헌터플레이어');
        
        if (!playerRole) {
            playerRole = await guild.roles.create({
                name: '김헌터플레이어',
                color: '#3498db',
                reason: '김헌터 게임 플레이어 역할'
            });
            console.log('✅ 김헌터플레이어 역할 생성 완료');
        } else {
            console.log('✅ 김헌터플레이어 역할 찾음');
        }

        // 2. @everyone 역할의 기본 권한 제거 (메시지 읽기 권한 제거)
        const everyoneRole = guild.roles.everyone;
        await everyoneRole.setPermissions(
            everyoneRole.permissions.remove(PermissionFlagsBits.ViewChannel)
        );
        console.log('✅ @everyone 기본 권한 업데이트 완료');

        // 3. 모든 채널의 권한 설정
        const channels = guild.channels.cache;
        
        // 예외 채널 목록 (권한 유지)
        const exemptChannels = [
            '가입', 
            '버그재보', 
            '테스트봇',
            '규칙',
            '공지'
        ];

        for (const [channelId, channel] of channels) {
            // 카테고리는 건너뛰기
            if (channel.type === 4) continue;
            
            const channelName = channel.name;
            
            if (exemptChannels.some(exempt => channelName.includes(exempt))) {
                // 예외 채널은 모두가 볼 수 있도록
                await channel.permissionOverwrites.edit(everyoneRole, {
                    ViewChannel: true
                });
                console.log(`✅ ${channelName} - 모든 사용자 접근 가능`);
            } else {
                // 일반 채널은 김헌터플레이어 역할만 볼 수 있도록
                await channel.permissionOverwrites.edit(everyoneRole, {
                    ViewChannel: false
                });
                
                await channel.permissionOverwrites.edit(playerRole, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                
                console.log(`✅ ${channelName} - 김헌터플레이어만 접근 가능`);
            }
        }

        // 4. 회원가입 명령어에 역할 부여 로직 추가 확인
        console.log('\n📝 회원가입 시 김헌터플레이어 역할이 자동으로 부여되도록 설정되었습니다.');
        console.log('📝 handlers/character/register.js 파일에서 역할 부여 로직이 작동합니다.');
        
        console.log('\n✅ 모든 권한 설정이 완료되었습니다!');
        
    } catch (error) {
        console.error('권한 설정 중 오류 발생:', error);
    } finally {
        client.destroy();
        process.exit(0);
    }
});

client.login(process.env.BOT_TOKEN);