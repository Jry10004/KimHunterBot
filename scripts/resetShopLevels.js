require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function resetShopLevels() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 모든 유저의 상점 레벨 초기화
        const result = await User.updateMany(
            {},
            {
                $set: {
                    'shopLevels.weapon': 1,
                    'shopLevels.armor': 1,
                    'shopLevels.accessory': 1
                }
            }
        );

        console.log(`✅ ${result.modifiedCount}명의 유저 상점 레벨이 초기화되었습니다.`);

        // 초기화 확인
        const users = await User.find({}).select('username shopLevels');
        console.log('\n📊 상점 레벨 초기화 결과:');
        users.forEach(user => {
            console.log(`- ${user.username}: 무기 Lv.${user.shopLevels.weapon}, 방어구 Lv.${user.shopLevels.armor}, 장신구 Lv.${user.shopLevels.accessory}`);
        });

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 작업 완료');
    }
}

// 스크립트 실행
resetShopLevels();