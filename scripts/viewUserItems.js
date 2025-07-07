const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// 기존 상점 아이템 ID 목록
const OLD_SHOP_ITEM_IDS = [
    'wooden_sword', 'iron_sword', 'steel_sword', 'mithril_sword', 'dragon_sword',
    'leather_armor', 'chain_armor', 'plate_armor', 'dragon_armor',
    'leather_helmet', 'iron_helmet', 'dragon_helmet',
    'leather_gloves', 'iron_gauntlets', 'dragon_gloves',
    'leather_boots', 'speed_boots', 'dragon_boots',
    'power_ring', 'wisdom_amulet', 'luck_charm', 'dragon_pendant'
];

async function viewUserItems() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공\n');

        // 모든 유저 조회
        const users = await User.find({});
        console.log(`총 ${users.length}명의 유저 확인\n`);

        let totalOldItems = 0;
        let totalRandomItems = 0;
        let totalPrelaunchItems = 0;
        let totalOtherItems = 0;

        for (const user of users) {
            if (!user.inventory || user.inventory.length === 0) continue;

            let oldItems = 0;
            let randomItems = 0;
            let prelaunchItems = 0;
            let otherItems = 0;

            user.inventory.forEach(item => {
                if (OLD_SHOP_ITEM_IDS.includes(item.id)) {
                    oldItems++;
                    totalOldItems++;
                } else if (item.id && item.id.startsWith('random_')) {
                    randomItems++;
                    totalRandomItems++;
                } else if (item.id && item.id.includes('prelaunch_')) {
                    prelaunchItems++;
                    totalPrelaunchItems++;
                } else {
                    otherItems++;
                    totalOtherItems++;
                }
            });

            if (user.inventory.length > 0) {
                console.log(`📦 ${user.username}:`);
                console.log(`   - 기존 상점 아이템: ${oldItems}개`);
                console.log(`   - 랜덤 아이템: ${randomItems}개`);
                console.log(`   - 사전강화 아이템: ${prelaunchItems}개`);
                console.log(`   - 기타 아이템: ${otherItems}개`);
                console.log(`   - 총 보유 아이템: ${user.inventory.length}개\n`);
            }
        }

        console.log('=== 전체 통계 ===');
        console.log(`기존 상점 아이템: ${totalOldItems}개 (삭제 예정)`);
        console.log(`랜덤 아이템: ${totalRandomItems}개`);
        console.log(`사전강화 아이템: ${totalPrelaunchItems}개`);
        console.log(`기타 아이템: ${totalOtherItems}개`);
        console.log(`총 아이템: ${totalOldItems + totalRandomItems + totalPrelaunchItems + totalOtherItems}개`);

        // 연결 종료
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        process.exit(1);
    }
}

viewUserItems();