require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function grantStatPoints() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 모든 유저에게 레벨에 따른 스탯 포인트 지급
        const users = await User.find({ registered: true });
        let updatedCount = 0;

        for (const user of users) {
            // 레벨에 따른 스탯 포인트 계산 (레벨당 5포인트)
            const expectedStatPoints = (user.level - 1) * 5;
            
            // 현재 사용한 스탯 포인트 계산
            const usedStatPoints = ((user.stats?.strength || 10) - 10) +
                                 ((user.stats?.agility || 10) - 10) +
                                 ((user.stats?.intelligence || 10) - 10) +
                                 ((user.stats?.vitality || 10) - 10) +
                                 ((user.stats?.luck || 10) - 10);
            
            // 남은 스탯 포인트 계산
            const remainingStatPoints = Math.max(0, expectedStatPoints - usedStatPoints);
            
            if (remainingStatPoints > 0 || user.statPoints !== remainingStatPoints) {
                user.statPoints = remainingStatPoints;
                await user.save();
                updatedCount++;
                console.log(`✅ ${user.nickname || user.username}: ${remainingStatPoints} 스탯 포인트 지급 (레벨 ${user.level})`);
            }
        }

        console.log(`\n✅ 총 ${updatedCount}명의 유저에게 스탯 포인트를 지급했습니다.`);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 작업 완료');
    }
}

// 스크립트 실행
grantStatPoints();