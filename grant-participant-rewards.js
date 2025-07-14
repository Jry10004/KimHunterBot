const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const participants = [
    { nickname: '인프', discordId: '592659577384730645', rank: 6, earned: 123276 }  // Try with old ID
];

const REWARD_AMOUNT = 100000; // 10만 골드

async function grantRewards() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공\n');

        console.log('🎁 참가 보상 지급 시작');
        console.log(`💰 보상 금액: ${REWARD_AMOUNT.toLocaleString()} 골드\n`);

        for (const participant of participants) {
            try {
                const user = await User.findOne({ discordId: participant.discordId });
                
                if (!user) {
                    console.log(`❌ ${participant.nickname} - 유저를 찾을 수 없습니다 (ID: ${participant.discordId})`);
                    continue;
                }

                const beforeGold = user.gold || 0;
                user.gold = beforeGold + REWARD_AMOUNT;
                await user.save();

                console.log(`✅ ${participant.nickname} (${participant.rank}위)`);
                console.log(`   이벤트 획득: ${participant.earned.toLocaleString()} 골드`);
                console.log(`   참가 보상: +${REWARD_AMOUNT.toLocaleString()} 골드`);
                console.log(`   보유 골드: ${beforeGold.toLocaleString()} → ${user.gold.toLocaleString()}\n`);

            } catch (error) {
                console.error(`❌ ${participant.nickname} 보상 지급 실패:`, error.message);
            }
        }

        console.log('✅ 참가 보상 지급 완료!');

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

grantRewards();