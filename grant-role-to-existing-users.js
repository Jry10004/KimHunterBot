const { Client, GatewayIntentBits } = require('discord.js');
const User = require('./models/User');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

async function grantRoleToExistingUsers() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 회원가입이 완료된 모든 유저 찾기
        const registeredUsers = await User.find({ registered: true });
        console.log(`📊 회원가입 완료 유저 수: ${registeredUsers.length}명`);

        // 핫플레이스 성남방 서버
        const guild = client.guilds.cache.get('1371881456212639794');
        if (!guild) {
            console.error('❌ 서버를 찾을 수 없습니다!');
            return;
        }

        // 김헌터플레이어 역할 찾기
        const playerRole = guild.roles.cache.find(role => role.name === '김헌터플레이어');
        if (!playerRole) {
            console.error('❌ 김헌터플레이어 역할을 찾을 수 없습니다!');
            return;
        }

        console.log(`🎮 김헌터플레이어 역할 ID: ${playerRole.id}`);
        console.log('\n역할 부여 시작...\n');

        let successCount = 0;
        let failCount = 0;
        let alreadyHasRole = 0;

        // 각 유저에게 역할 부여
        for (const user of registeredUsers) {
            try {
                // Discord 멤버 찾기
                const member = await guild.members.fetch(user.discordId).catch(() => null);
                
                if (!member) {
                    console.log(`⚠️ ${user.nickname || user.discordId} - 서버에 없음`);
                    failCount++;
                    continue;
                }

                // 이미 역할이 있는지 확인
                if (member.roles.cache.has(playerRole.id)) {
                    console.log(`✅ ${user.nickname || member.user.tag} - 이미 역할 보유`);
                    alreadyHasRole++;
                    continue;
                }

                // 역할 부여
                await member.roles.add(playerRole);
                console.log(`✅ ${user.nickname || member.user.tag} - 역할 부여 완료`);
                successCount++;

                // API 제한 방지를 위한 딜레이
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`❌ ${user.nickname || user.discordId} - 역할 부여 실패:`, error.message);
                failCount++;
            }
        }

        console.log('\n📊 역할 부여 완료!');
        console.log(`✅ 성공: ${successCount}명`);
        console.log(`✅ 이미 보유: ${alreadyHasRole}명`);
        console.log(`❌ 실패: ${failCount}명`);
        console.log(`📊 총계: ${registeredUsers.length}명`);

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        client.destroy();
        process.exit(0);
    }
}

client.once('ready', async () => {
    console.log(`${client.user.tag}으로 로그인했습니다!`);
    await grantRoleToExistingUsers();
});

client.login(process.env.BOT_TOKEN);