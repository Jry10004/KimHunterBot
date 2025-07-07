const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function removePrelaunchItems() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('=== 사전강화 이벤트 아이템 제거 시작 ===');
        
        const users = await User.find({}).select('username discordId inventory equipment');
        
        let totalRemoved = 0;
        let totalUsers = 0;
        
        for (const user of users) {
            if (user.inventory && user.inventory.length > 0) {
                // 기존 인벤토리 길이
                const originalLength = user.inventory.length;
                
                // 사전강화 아이템 제외한 새 인벤토리
                const newInventory = user.inventory.filter(item => {
                    // 사전강화 아이템 제거 (setName이 'prelaunch'인 경우)
                    if (item.setName === 'prelaunch') {
                        return false;
                    }
                    return true;
                });
                
                const removedCount = originalLength - newInventory.length;
                
                if (removedCount > 0) {
                    // 장비 슬롯 업데이트 (삭제된 아이템 인덱스 조정)
                    const oldToNewIndex = {};
                    let newIndex = 0;
                    
                    for (let oldIndex = 0; oldIndex < originalLength; oldIndex++) {
                        const item = user.inventory[oldIndex];
                        if (item.setName !== 'prelaunch') {
                            oldToNewIndex[oldIndex] = newIndex;
                            newIndex++;
                        }
                    }
                    
                    // 장비 슬롯 인덱스 업데이트
                    if (user.equipment) {
                        for (const slot in user.equipment) {
                            const oldSlotIndex = user.equipment[slot];
                            if (oldSlotIndex >= 0) {
                                if (oldToNewIndex.hasOwnProperty(oldSlotIndex)) {
                                    user.equipment[slot] = oldToNewIndex[oldSlotIndex];
                                } else {
                                    // 삭제된 아이템이 장착 중이었다면 슬롯 비우기
                                    user.equipment[slot] = -1;
                                }
                            }
                        }
                    }
                    
                    user.inventory = newInventory;
                    await user.save();
                    
                    console.log(`✅ ${user.username || user.discordId}: ${removedCount}개 사전강화 아이템 제거됨`);
                    totalRemoved += removedCount;
                    totalUsers++;
                }
            }
        }
        
        console.log('\n=== 제거 완료 ===');
        console.log(`총 ${totalUsers}명의 유저에서 ${totalRemoved}개의 사전강화 아이템이 제거되었습니다.`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// 실행
removePrelaunchItems();