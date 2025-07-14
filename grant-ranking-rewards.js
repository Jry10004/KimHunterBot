const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const rankingRewards = [
    { 
        nickname: 'hayeon1130', 
        discordId: '295980447849250817', 
        rank: 1, 
        reward: 855203,
        description: '1위 보상'
    },
    { 
        nickname: '선규', 
        discordId: '364197967114272769', 
        rank: 4, 
        reward: 168929,
        description: '4위 보상'
    },
    { 
        nickname: '인프', 
        discordId: '592659577384730645', // 구 ID 사용
        rank: 6, 
        reward: 123276,
        description: '6위 보상'
    }
];

async function checkAndGrantRewards() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공\n');

        console.log('🏆 등수 보상 확인 및 지급');
        console.log('================================\n');

        for (const participant of rankingRewards) {
            try {
                const user = await User.findOne({ discordId: participant.discordId });
                
                if (!user) {
                    console.log(`❌ ${participant.nickname} - 유저를 찾을 수 없습니다 (ID: ${participant.discordId})`);
                    continue;
                }

                const beforeGold = user.gold || 0;
                
                console.log(`\n🏅 ${participant.nickname} (${participant.rank}위)`);
                console.log(`   현재 보유 골드: ${beforeGold.toLocaleString()}`);
                console.log(`   등수 보상: ${participant.reward.toLocaleString()} 골드`);
                
                // 이미 받은 보상인지 확인하기 위해 로그를 출력
                // 실제로는 이벤트 로그나 별도 필드로 관리하는 것이 좋음
                console.log(`   보상 지급 중...`);
                
                user.gold = beforeGold + participant.reward;
                await user.save();
                
                console.log(`   ✅ 보상 지급 완료!`);
                console.log(`   최종 보유 골드: ${user.gold.toLocaleString()}`);

            } catch (error) {
                console.error(`❌ ${participant.nickname} 보상 지급 실패:`, error.message);
            }
        }

        console.log('\n================================');
        console.log('✅ 등수 보상 지급 프로세스 완료!');
        
        // 전체 지급 내역 요약
        console.log('\n📊 지급 내역 요약:');
        let totalRewards = 0;
        for (const participant of rankingRewards) {
            console.log(`   ${participant.rank}위 ${participant.nickname}: ${participant.reward.toLocaleString()} 골드`);
            totalRewards += participant.reward;
        }
        console.log(`   총 지급액: ${totalRewards.toLocaleString()} 골드`);

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

checkAndGrantRewards();