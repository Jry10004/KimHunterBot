const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// 삭제할 기존 상점 아이템 ID 목록
const OLD_SHOP_ITEM_IDS = [
    'wooden_sword', 'iron_sword', 'steel_sword', 'mithril_sword', 'dragon_sword',
    'leather_armor', 'chain_armor', 'plate_armor', 'dragon_armor',
    'leather_helmet', 'iron_helmet', 'dragon_helmet',
    'leather_gloves', 'iron_gauntlets', 'dragon_gloves',
    'leather_boots', 'speed_boots', 'dragon_boots',
    'power_ring', 'wisdom_amulet', 'luck_charm', 'dragon_pendant'
];

async function cleanupOldShopItems() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 모든 유저 조회
        const users = await User.find({});
        console.log(`총 ${users.length}명의 유저 확인`);

        let totalItemsRemoved = 0;
        let affectedUsers = 0;

        for (const user of users) {
            if (!user.inventory || user.inventory.length === 0) continue;

            const originalCount = user.inventory.length;
            
            // 기존 상점 아이템 필터링 (사전강화 아이템은 유지)
            user.inventory = user.inventory.filter(item => {
                // ID가 기존 상점 아이템 목록에 있으면 제거
                if (OLD_SHOP_ITEM_IDS.includes(item.id)) {
                    return false;
                }
                
                // 사전강화 아이템은 유지 (특별한 패턴이 있다면 확인)
                if (item.id && item.id.includes('prelaunch_')) {
                    return true;
                }
                
                // 랜덤 아이템은 유지 (random_으로 시작하는 ID)
                if (item.id && item.id.startsWith('random_')) {
                    return true;
                }
                
                // 그 외 아이템도 일단 유지
                return true;
            });

            const removedCount = originalCount - user.inventory.length;
            
            if (removedCount > 0) {
                await user.save();
                totalItemsRemoved += removedCount;
                affectedUsers++;
                console.log(`✅ ${user.username}: ${removedCount}개 아이템 제거됨`);
            }
        }

        console.log('\n=== 정리 완료 ===');
        console.log(`영향받은 유저: ${affectedUsers}명`);
        console.log(`총 제거된 아이템: ${totalItemsRemoved}개`);

        // 연결 종료
        await mongoose.connection.close();
        console.log('✅ MongoDB 연결 종료');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        process.exit(1);
    }
}

// 확인 프롬프트
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('⚠️  경고: 이 스크립트는 모든 유저의 기존 상점 아이템을 삭제합니다!');
console.log('삭제될 아이템:', OLD_SHOP_ITEM_IDS.join(', '));
console.log('\n사전강화 아이템과 랜덤 생성 아이템은 유지됩니다.');

rl.question('\n정말로 진행하시겠습니까? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes') {
        cleanupOldShopItems();
    } else {
        console.log('작업이 취소되었습니다.');
        process.exit(0);
    }
    rl.close();
});