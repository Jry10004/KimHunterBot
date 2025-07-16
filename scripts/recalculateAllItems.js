// 모든 유저의 아이템 점수 재계산 및 재장착
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const randomItemGenerator = require('../systems/randomItemGenerator');
const { getJobFromEmblem } = require('../handlers/common/combatPower');

async function recalculateAllItems() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');

        // 모든 유저 조회
        const users = await User.find({ registered: true });
        console.log(`총 ${users.length}명의 유저 처리 시작`);

        let processedCount = 0;
        let itemsUpdated = 0;

        for (const user of users) {
            // 유저의 직업 확인
            const userJob = getJobFromEmblem(user.emblem);
            
            if (!userJob) {
                console.log(`${user.nickname || user.discordId}: 직업을 확인할 수 없음 (엠블럼: ${user.emblem})`);
                continue;
            }

            // 인벤토리의 모든 아이템 점수 재계산
            if (user.inventory && user.inventory.length > 0) {
                let updated = false;
                
                for (const item of user.inventory) {
                    if (item && item.stats) {
                        const oldScore = item.score || 0;
                        const newScore = randomItemGenerator.calculateItemScore(item, userJob);
                        
                        if (oldScore !== newScore) {
                            item.score = newScore;
                            updated = true;
                            itemsUpdated++;
                        }
                    }
                }

                if (updated) {
                    // 장비 재장착 (최적화)
                    const equipment = {
                        weapon: -1,
                        armor: -1,
                        helmet: -1,
                        gloves: -1,
                        boots: -1,
                        shield: -1,
                        accessory: -1
                    };

                    // 각 부위별 최고 점수 아이템 찾기
                    for (let i = 0; i < user.inventory.length; i++) {
                        const item = user.inventory[i];
                        if (!item || !item.type) continue;

                        // inventorySlot 설정
                        item.inventorySlot = i;

                        const currentEquipped = equipment[item.type];
                        
                        if (currentEquipped === -1) {
                            equipment[item.type] = i;
                        } else {
                            const currentItem = user.inventory[currentEquipped];
                            if (currentItem && item.score > (currentItem.score || 0)) {
                                equipment[item.type] = i;
                            }
                        }
                    }

                    // 장비 업데이트
                    user.equipment = equipment;
                    await user.save();
                    
                    console.log(`✅ ${user.nickname || user.discordId} (${userJob}): ${user.inventory.length}개 아이템 재계산 완료`);
                    processedCount++;
                }
            }
        }

        console.log(`\n처리 완료:`);
        console.log(`- 총 유저: ${users.length}명`);
        console.log(`- 처리된 유저: ${processedCount}명`);
        console.log(`- 재계산된 아이템: ${itemsUpdated}개`);

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

// 스크립트 실행
recalculateAllItems();