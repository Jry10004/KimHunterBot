// 레벨 100 초과 유저 수정 스크립트
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MAX_LEVEL = 100;

async function fixMaxLevel() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');

        // 레벨 100 이상인 모든 유저 찾기
        const users = await User.find({
            $or: [
                { level: { $gt: MAX_LEVEL } },
                { level: MAX_LEVEL, exp: { $gt: 0 } }
            ]
        });

        console.log(`\n총 ${users.length}명의 유저가 레벨 ${MAX_LEVEL} 이상이거나 만렙에서 경험치를 가지고 있습니다.`);

        if (users.length === 0) {
            console.log('수정할 유저가 없습니다.');
            return;
        }

        console.log('\n유저 목록:');
        for (const user of users) {
            console.log(`- ${user.nickname || user.discordId}: Lv.${user.level} (EXP: ${user.exp})`);
        }

        // 수정 진행
        console.log('\n수정 시작...');
        let fixedCount = 0;

        for (const user of users) {
            const beforeLevel = user.level;
            const beforeExp = user.exp;

            // 레벨이 100을 초과하면 100으로 설정
            if (user.level > MAX_LEVEL) {
                user.level = MAX_LEVEL;
            }

            // 레벨이 100인 경우 경험치를 0으로 설정
            if (user.level === MAX_LEVEL) {
                user.exp = 0;
            }

            await user.save();
            fixedCount++;

            console.log(`✅ ${user.nickname || user.discordId}: Lv.${beforeLevel} (EXP: ${beforeExp}) → Lv.${user.level} (EXP: ${user.exp})`);
        }

        console.log(`\n✅ 총 ${fixedCount}명의 유저를 수정했습니다.`);

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

// 스크립트 실행
fixMaxLevel();