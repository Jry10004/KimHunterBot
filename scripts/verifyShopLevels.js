require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function verifyShopLevels() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 특정 유저들의 상점 레벨 확인
        const targetUsers = ['424480594542592009', '592659577384730645', '795131062795501598'];
        
        console.log('\n📊 주요 유저 상점 레벨 확인:');
        for (const discordId of targetUsers) {
            const user = await User.findOne({ discordId });
            if (user) {
                console.log(`\n${user.username || user.discordId}:`);
                console.log(`  - 무기 상점: Lv.${user.shopLevels?.weapon || 1}`);
                console.log(`  - 방어구 상점: Lv.${user.shopLevels?.armor || 1}`);
                console.log(`  - 장신구 상점: Lv.${user.shopLevels?.accessory || 1}`);
            }
        }

        // 전체 통계
        const stats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    avgWeapon: { $avg: '$shopLevels.weapon' },
                    avgArmor: { $avg: '$shopLevels.armor' },
                    avgAccessory: { $avg: '$shopLevels.accessory' },
                    maxWeapon: { $max: '$shopLevels.weapon' },
                    maxArmor: { $max: '$shopLevels.armor' },
                    maxAccessory: { $max: '$shopLevels.accessory' }
                }
            }
        ]);

        if (stats.length > 0) {
            console.log('\n📈 전체 상점 레벨 통계:');
            console.log(`  - 평균 무기 상점: ${stats[0].avgWeapon.toFixed(2)}`);
            console.log(`  - 평균 방어구 상점: ${stats[0].avgArmor.toFixed(2)}`);
            console.log(`  - 평균 장신구 상점: ${stats[0].avgAccessory.toFixed(2)}`);
            console.log(`  - 최고 무기 상점: ${stats[0].maxWeapon}`);
            console.log(`  - 최고 방어구 상점: ${stats[0].maxArmor}`);
            console.log(`  - 최고 장신구 상점: ${stats[0].maxAccessory}`);
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 확인 완료');
    }
}

// 스크립트 실행
verifyShopLevels();