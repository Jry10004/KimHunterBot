const User = require('../models/User');

/**
 * 인벤토리 관리를 위한 유틸리티 클래스
 * MongoDB 버전 충돌을 방지하면서 안전하게 아이템을 추가/제거
 */
class InventoryManager {
    /**
     * 아이템을 인벤토리에 안전하게 추가
     * @param {string} userId - Discord ID
     * @param {Array} items - 추가할 아이템 배열
     * @param {number} maxRetries - 최대 재시도 횟수
     * @returns {Object} 업데이트된 유저 객체
     */
    static async addItems(userId, items, maxRetries = 5) {
        let retries = maxRetries;
        let lastError = null;
        
        while (retries > 0) {
            try {
                // 트랜잭션 없이 단순하게 처리
                const user = await User.findOne({ discordId: userId });
                if (!user) {
                    throw new Error('사용자를 찾을 수 없습니다');
                }
                
                // 새 아이템 준비
                const newItems = items.map((item, index) => {
                    // 기존 슬롯 번호 수집
                    const existingSlots = new Set(
                        user.inventory
                            .map(i => i?.inventorySlot)
                            .filter(s => s !== undefined && s !== null)
                    );
                    
                    // 사용 가능한 슬롯 찾기
                    let slot = 0;
                    while (existingSlots.has(slot)) {
                        slot++;
                    }
                    existingSlots.add(slot);
                    
                    return {
                        id: item.id || `item_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 9)}`,
                        name: item.name,
                        type: item.type || 'weapon',
                        rarity: item.rarity || 'normal',
                        color: item.color || '#808080',
                        emoji: item.emoji || '⚔️',
                        stats: item.stats || {},
                        description: item.description || '',
                        price: item.price || 10000,
                        sellPrice: item.sellPrice || Math.floor((item.price || 10000) * 0.6),
                        enhanceLevel: item.enhanceLevel || 0,
                        enhancement: item.enhancement || 0,
                        score: item.score || 0,
                        setName: item.setName || '장비',
                        quantity: item.quantity || 1,
                        appraisedAt: new Date(),
                        foundAt: new Date(),
                        inventorySlot: slot,
                        equipped: false
                    };
                });
                
                // 직접 save 사용 (더 안전)
                user.inventory.push(...newItems);
                await user.save();
                
                console.log(`[InventoryManager] ${newItems.length}개 아이템 추가 성공`);
                return user;
                
            } catch (error) {
                lastError = error;
                retries--;
                
                if (error.name === 'VersionError' || 
                    error.message.includes('No matching document found') ||
                    error.message.includes('version')) {
                    
                    console.log(`[InventoryManager] 버전 충돌, 재시도 중... (남은 시도: ${retries})`);
                    await new Promise(resolve => setTimeout(resolve, 200 * (maxRetries - retries)));
                    continue;
                }
                
                // 다른 오류는 즉시 throw
                throw error;
            }
        }
        
        // 모든 재시도 실패
        throw new Error(`아이템 추가 실패 (${maxRetries}회 시도): ${lastError?.message || '알 수 없는 오류'}`);
    }
    
    /**
     * 아이템을 인벤토리에서 안전하게 제거
     * @param {string} userId - Discord ID
     * @param {Array} itemIds - 제거할 아이템 ID 배열
     * @returns {Object} 업데이트된 유저 객체
     */
    static async removeItems(userId, itemIds) {
        const user = await User.findOne({ discordId: userId });
        if (!user) {
            throw new Error('사용자를 찾을 수 없습니다');
        }
        
        // 아이템 제거
        user.inventory = user.inventory.filter(item => 
            !itemIds.includes(item.id) && !itemIds.includes(item._id?.toString())
        );
        
        await user.save();
        return user;
    }
    
    /**
     * 인벤토리의 빈 슬롯 번호 찾기
     * @param {Array} inventory - 인벤토리 배열
     * @returns {number} 사용 가능한 슬롯 번호
     */
    static findEmptySlot(inventory) {
        const usedSlots = new Set(
            inventory
                .map(item => item?.inventorySlot)
                .filter(slot => slot !== undefined && slot !== null)
        );
        
        let slot = 0;
        while (usedSlots.has(slot)) {
            slot++;
        }
        
        return slot;
    }
    
    /**
     * 골드 업데이트 (버전 충돌 방지)
     * @param {string} userId - Discord ID
     * @param {number} amount - 변경할 골드 양 (음수 가능)
     * @returns {Object} 업데이트된 유저 객체
     */
    static async updateGold(userId, amount) {
        let retries = 3;
        
        while (retries > 0) {
            try {
                const user = await User.findOne({ discordId: userId });
                if (!user) {
                    throw new Error('사용자를 찾을 수 없습니다');
                }
                
                user.gold = Math.max(0, user.gold + amount);
                await user.save();
                
                return user;
                
            } catch (error) {
                retries--;
                if (retries > 0 && (error.name === 'VersionError' || error.message.includes('version'))) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
                throw error;
            }
        }
    }
}

module.exports = InventoryManager;