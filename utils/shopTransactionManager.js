// 상점 트랜잭션 매니저
const mongoose = require('mongoose');
const User = require('../models/User');
const ShopRetryManager = require('./shopRetryManager');
const ShopGachaLogger = require('./shopGachaLogger');

class ShopTransactionManager {
    // 트랜잭션 지원 여부 확인
    static supportsTransactions() {
        return mongoose.connection.readyState === 1 && 
               mongoose.connection.db.serverConfig &&
               mongoose.connection.db.serverConfig.capabilities &&
               mongoose.connection.db.serverConfig.capabilities.supportsTransactions;
    }
    // 단일 뽑기 트랜잭션
    static async executeSingleGacha(userId, selectedSlot, generateItemFunc) {
        let session = null;
        let useTransaction = false;
        
        try {
            // 트랜잭션 지원 확인
            try {
                session = await mongoose.startSession();
                session.startTransaction();
                useTransaction = true;
            } catch (err) {
                console.log('[ShopTransaction] 트랜잭션 미지원 환경 - 일반 처리 진행');
                useTransaction = false;
            }
        
        try {
            // 1. 사용자 조회 및 골드 차감
            const user = await User.findOneAndUpdate(
                { 
                    discordId: userId,
                    gold: { $gte: 10000 } // 골드 충분한지 확인
                },
                {
                    $inc: { 
                        gold: -10000,
                        [`shopLevels.${selectedSlot}.exp`]: 1,
                        [`shopLevels.${selectedSlot}.totalPulls`]: 1
                    }
                },
                { 
                    new: true, 
                    session: useTransaction ? session : undefined,
                    runValidators: true
                }
            );
            
            if (!user) {
                throw new Error('골드가 부족하거나 사용자를 찾을 수 없습니다.');
            }
            
            // 2. 아이템 생성
            const item = await generateItemFunc(selectedSlot, user.shopLevels[selectedSlot], user);
            
            if (!item || !item.name) {
                throw new Error('아이템 생성에 실패했습니다.');
            }
            
            // 3. 인벤토리 슬롯 찾기
            const maxSlot = user.inventory.reduce((max, item) => 
                Math.max(max, item.inventorySlot || 0), -1
            );
            item.inventorySlot = maxSlot + 1;
            
            // 4. 아이템 추가
            const updatedUser = await User.findOneAndUpdate(
                { discordId: userId },
                { 
                    $push: { inventory: item },
                    $set: { [`shopLevels.${selectedSlot}`]: user.shopLevels[selectedSlot] }
                },
                { 
                    new: true, 
                    session: useTransaction ? session : undefined,
                    runValidators: true
                }
            );
            
            if (!updatedUser) {
                throw new Error('아이템 저장에 실패했습니다.');
            }
            
            // 트랜잭션 커밋
            if (useTransaction) {
                await session.commitTransaction();
            }
            
            // 레벨업 체크
            const requiredExp = getRequiredExp(updatedUser.shopLevels[selectedSlot].level);
            let leveledUp = false;
            
            if (updatedUser.shopLevels[selectedSlot].exp >= requiredExp && 
                updatedUser.shopLevels[selectedSlot].level < 20) {
                updatedUser.shopLevels[selectedSlot].level++;
                updatedUser.shopLevels[selectedSlot].exp -= requiredExp;
                leveledUp = true;
                await updatedUser.save();
            }
            
            return { 
                success: true, 
                user: updatedUser, 
                item, 
                leveledUp 
            };
            
        } catch (error) {
            if (useTransaction && session) {
                await session.abortTransaction();
            }
            console.error('[ShopTransaction] 단일 뽑기 실패:', error);
            return { 
                success: false, 
                error: error.message 
            };
        } finally {
            if (session) {
                await session.endSession();
            }
        }
        } catch (sessionError) {
            console.error('[ShopTransaction] 세션 생성 실패:', sessionError);
            console.log('[ShopTransaction] 재시도 방식으로 전환...');
            
            // 트랜잭션 없이 재시도
            try {
                const slotUpdates = {};
                slotUpdates[`shopLevels.${selectedSlot}.exp`] = 
                    (await ShopRetryManager.safeGetUser(userId)).shopLevels[selectedSlot].exp + 1;
                slotUpdates[`shopLevels.${selectedSlot}.totalPulls`] = 
                    (await ShopRetryManager.safeGetUser(userId)).shopLevels[selectedSlot].totalPulls + 1;
                
                // 아이템 생성
                const tempUser = await ShopRetryManager.safeGetUser(userId);
                const item = await generateItemFunc(selectedSlot, tempUser.shopLevels[selectedSlot], tempUser);
                
                if (!item || !item.name) {
                    throw new Error('아이템 생성에 실패했습니다.');
                }
                
                // 인벤토리 슬롯 계산
                const user = await ShopRetryManager.safeGetUser(userId);
                const maxSlot = user.inventory.reduce((max, item) => 
                    Math.max(max, item.inventorySlot || 0), -1
                );
                item.inventorySlot = maxSlot + 1;
                
                // 원자적 연산으로 처리
                const updatedUser = await ShopRetryManager.atomicGachaOperation(
                    userId,
                    10000,
                    item,
                    slotUpdates
                );
                
                // 레벨업 체크
                const requiredExp = getRequiredExp(updatedUser.shopLevels[selectedSlot].level);
                let leveledUp = false;
                
                if (updatedUser.shopLevels[selectedSlot].exp >= requiredExp && 
                    updatedUser.shopLevels[selectedSlot].level < 20) {
                    updatedUser.shopLevels[selectedSlot].level++;
                    updatedUser.shopLevels[selectedSlot].exp -= requiredExp;
                    leveledUp = true;
                    await ShopRetryManager.safeSaveUser(updatedUser);
                }
                
                return { 
                    success: true, 
                    user: updatedUser, 
                    item, 
                    leveledUp 
                };
            } catch (retryError) {
                console.error('[ShopTransaction] 재시도도 실패:', retryError);
                return { 
                    success: false, 
                    error: retryError.message 
                };
            }
        }
    }
    
    // 10회 뽑기 트랜잭션
    static async executeMultiGacha(userId, selectedSlot, generateItemFunc) {
        let session = null;
        let useTransaction = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                // 트랜잭션 지원 확인
                try {
                    session = await mongoose.startSession();
                    session.startTransaction();
                    useTransaction = true;
                } catch (err) {
                    console.log('[ShopTransaction] 트랜잭션 미지원 환경 - 일반 처리 진행');
                    useTransaction = false;
                }
            
            try {
                // 1. 사용자 조회 및 골드 차감
                const user = await User.findOneAndUpdate(
                    { 
                        discordId: userId,
                        gold: { $gte: 100000 } // 골드 충분한지 확인
                    },
                    {
                        $inc: { 
                            gold: -100000,
                            [`shopLevels.${selectedSlot}.exp`]: 10,
                            [`shopLevels.${selectedSlot}.totalPulls`]: 10
                        }
                    },
                    { 
                        new: true, 
                        session: useTransaction ? session : undefined,
                        runValidators: true
                    }
                );
            
                if (!user) {
                    throw new Error('골드가 부족하거나 사용자를 찾을 수 없습니다.');
                }
                
                // 2. 10개 아이템 생성
            const items = [];
            let maxSlot = user.inventory.reduce((max, item) => 
                Math.max(max, item.inventorySlot || 0), -1
            );
            
            for (let i = 0; i < 10; i++) {
                try {
                    const item = await generateItemFunc(selectedSlot, user.shopLevels[selectedSlot], user);
                    
                    if (!item || !item.name) {
                        throw new Error(`아이템 생성 실패 (${i + 1}/10)`);
                    }
                    
                    item.inventorySlot = ++maxSlot;
                    items.push(item);
                } catch (itemError) {
                    console.error(`아이템 생성 오류 (${i + 1}/10):`, itemError);
                    // 기본 아이템으로 대체
                    const fallbackItem = createFallbackItem(selectedSlot, ++maxSlot);
                    items.push(fallbackItem);
                }
            }
            
            // 3. 모든 아이템 한 번에 추가
            const updatedUser = await User.findOneAndUpdate(
                { discordId: userId },
                { 
                    $push: { 
                        inventory: { $each: items } 
                    },
                    $set: { 
                        [`shopLevels.${selectedSlot}`]: user.shopLevels[selectedSlot] 
                    }
                },
                { 
                    new: true, 
                    session: useTransaction ? session : undefined,
                    runValidators: true
                }
            );
            
            if (!updatedUser) {
                throw new Error('아이템 저장에 실패했습니다.');
            }
            
            // 트랜잭션 커밋
            if (useTransaction) {
                await session.commitTransaction();
            }
            
            // 레벨업 체크
            let levelUps = 0;
            let currentLevel = updatedUser.shopLevels[selectedSlot].level;
            let currentExp = updatedUser.shopLevels[selectedSlot].exp;
            
            while (currentExp >= getRequiredExp(currentLevel) && currentLevel < 20) {
                const requiredExp = getRequiredExp(currentLevel);
                currentLevel++;
                currentExp -= requiredExp;
                levelUps++;
            }
            
            if (levelUps > 0) {
                updatedUser.shopLevels[selectedSlot].level = currentLevel;
                updatedUser.shopLevels[selectedSlot].exp = currentExp;
                await updatedUser.save();
            }
            
            return { 
                success: true, 
                user: updatedUser, 
                items, 
                levelUps 
            };
            
            } catch (error) {
                if (useTransaction && session) {
                    await session.abortTransaction();
                }
                
                // Write conflict 에러인 경우 재시도
                if (error.code === 112 || error.codeName === 'WriteConflict') {
                    retryCount++;
                    console.log(`[ShopTransaction] Write conflict 발생, 재시도 ${retryCount}/${maxRetries}`);
                    if (session) {
                        await session.endSession();
                        session = null;
                    }
                    // 잠시 대기 후 재시도
                    await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
                    continue;
                }
                
                console.error('[ShopTransaction] 10회 뽑기 실패:', error);
                return { 
                    success: false, 
                    error: error.message 
                };
            } finally {
                if (session) {
                    await session.endSession();
                }
            }
            
            // 재시도 없이 성공했으면 break
            break;
        } catch (sessionError) {
            console.error('[ShopTransaction] 세션 생성 실패:', sessionError);
            console.log('[ShopTransaction] 재시도 방식으로 전환...');
            
            // 트랜잭션 없이 재시도
            try {
                const slotUpdates = {};
                slotUpdates[`shopLevels.${selectedSlot}.exp`] = 
                    (await ShopRetryManager.safeGetUser(userId)).shopLevels[selectedSlot].exp + 1;
                slotUpdates[`shopLevels.${selectedSlot}.totalPulls`] = 
                    (await ShopRetryManager.safeGetUser(userId)).shopLevels[selectedSlot].totalPulls + 1;
                
                // 아이템 생성
                const tempUser = await ShopRetryManager.safeGetUser(userId);
                const item = await generateItemFunc(selectedSlot, tempUser.shopLevels[selectedSlot], tempUser);
                
                if (!item || !item.name) {
                    throw new Error('아이템 생성에 실패했습니다.');
                }
                
                // 인벤토리 슬롯 계산
                const user = await ShopRetryManager.safeGetUser(userId);
                const maxSlot = user.inventory.reduce((max, item) => 
                    Math.max(max, item.inventorySlot || 0), -1
                );
                item.inventorySlot = maxSlot + 1;
                
                // 원자적 연산으로 처리
                const updatedUser = await ShopRetryManager.atomicGachaOperation(
                    userId,
                    10000,
                    item,
                    slotUpdates
                );
                
                // 레벨업 체크
                const requiredExp = getRequiredExp(updatedUser.shopLevels[selectedSlot].level);
                let leveledUp = false;
                
                if (updatedUser.shopLevels[selectedSlot].exp >= requiredExp && 
                    updatedUser.shopLevels[selectedSlot].level < 20) {
                    updatedUser.shopLevels[selectedSlot].level++;
                    updatedUser.shopLevels[selectedSlot].exp -= requiredExp;
                    leveledUp = true;
                    await ShopRetryManager.safeSaveUser(updatedUser);
                }
                
                return { 
                    success: true, 
                    user: updatedUser, 
                    item, 
                    leveledUp 
                };
            } catch (retryError) {
                console.error('[ShopTransaction] 재시도도 실패:', retryError);
                return { 
                    success: false, 
                    error: retryError.message 
                };
            }
            }
        }
        
        // 모든 재시도 실패
        return {
            success: false,
            error: '10회 뽑기 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
        };
    }
    
    // 100회 뽑기 트랜잭션
    static async executeHundredGacha(userId, selectedSlot, generateItemFunc) {
        let session = null;
        let useTransaction = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                // 트랜잭션 지원 확인
                try {
                    session = await mongoose.startSession();
                    session.startTransaction();
                    useTransaction = true;
                } catch (err) {
                    console.log('[ShopTransaction] 트랜잭션 미지원 환경 - 일반 처리 진행');
                    useTransaction = false;
                }
            
            try {
                // 1. 사용자 조회 및 골드 차감
                const user = await User.findOneAndUpdate(
                    { 
                        discordId: userId,
                        gold: { $gte: 900000 } // 골드 충분한지 확인
                    },
                    {
                        $inc: { 
                            gold: -900000,
                            [`shopLevels.${selectedSlot}.exp`]: 100,
                            [`shopLevels.${selectedSlot}.totalPulls`]: 100
                        }
                    },
                    { 
                        new: true, 
                        session: useTransaction ? session : undefined,
                        runValidators: true
                    }
                );
            
                if (!user) {
                    throw new Error('골드가 부족하거나 사용자를 찾을 수 없습니다.');
                }
                
                // 2. 100개 아이템 생성
            const items = [];
            let maxSlot = user.inventory.reduce((max, item) => 
                Math.max(max, item.inventorySlot || 0), -1
            );
            
            for (let i = 0; i < 100; i++) {
                try {
                    const item = await generateItemFunc(selectedSlot, user.shopLevels[selectedSlot], user);
                    
                    if (!item || !item.name) {
                        throw new Error(`아이템 생성 실패 (${i + 1}/100)`);
                    }
                    
                    item.inventorySlot = ++maxSlot;
                    items.push(item);
                } catch (itemError) {
                    console.error(`아이템 생성 오류 (${i + 1}/100):`, itemError);
                    // 기본 아이템으로 대체
                    const fallbackItem = createFallbackItem(selectedSlot, ++maxSlot);
                    items.push(fallbackItem);
                }
            }
            
            // 3. 모든 아이템 한 번에 추가
            const updatedUser = await User.findOneAndUpdate(
                { discordId: userId },
                { 
                    $push: { 
                        inventory: { $each: items } 
                    },
                    $set: { 
                        [`shopLevels.${selectedSlot}`]: user.shopLevels[selectedSlot] 
                    }
                },
                { 
                    new: true, 
                    session: useTransaction ? session : undefined,
                    runValidators: true
                }
            );
            
            if (!updatedUser) {
                throw new Error('아이템 저장에 실패했습니다.');
            }
            
            // 트랜잭션 커밋
            if (useTransaction) {
                await session.commitTransaction();
            }
            
            // 레벨업 체크
            let levelUps = 0;
            let currentLevel = updatedUser.shopLevels[selectedSlot].level;
            let currentExp = updatedUser.shopLevels[selectedSlot].exp;
            
            while (currentExp >= getRequiredExp(currentLevel) && currentLevel < 20) {
                const requiredExp = getRequiredExp(currentLevel);
                currentLevel++;
                currentExp -= requiredExp;
                levelUps++;
            }
            
            if (levelUps > 0) {
                updatedUser.shopLevels[selectedSlot].level = currentLevel;
                updatedUser.shopLevels[selectedSlot].exp = currentExp;
                await updatedUser.save();
            }
            
            return { 
                success: true, 
                user: updatedUser, 
                items, 
                levelUps 
            };
            
            } catch (error) {
                if (useTransaction && session) {
                    await session.abortTransaction();
                }
                
                // Write conflict 에러인 경우 재시도
                if (error.code === 112 || error.codeName === 'WriteConflict') {
                    retryCount++;
                    console.log(`[ShopTransaction] Write conflict 발생, 재시도 ${retryCount}/${maxRetries}`);
                    if (session) {
                        await session.endSession();
                        session = null;
                    }
                    // 잠시 대기 후 재시도
                    await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
                    continue;
                }
                
                console.error('[ShopTransaction] 100회 뽑기 실패:', error);
                return { 
                    success: false, 
                    error: error.message 
                };
            } finally {
                if (session) {
                    await session.endSession();
                }
            }
            
            // 재시도 없이 성공했으면 break
            break;
        } catch (sessionError) {
            console.error('[ShopTransaction] 세션 생성 실패:', sessionError);
            return { 
                success: false, 
                error: '100회 뽑기 처리에 실패했습니다.' 
            };
            }
        }
        
        // 모든 재시도 실패
        return {
            success: false,
            error: '100회 뽑기 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
        };
    }
}

// 레벨업 필요 경험치 계산
function getRequiredExp(level) {
    if (level <= 5) return level * 10;
    if (level <= 10) return level * 15;
    if (level <= 15) return level * 25;
    return level * 40;
}

// 폴백 아이템 생성
function createFallbackItem(selectedSlot, inventorySlot) {
    const slotNames = {
        weapon: '무기',
        armor: '갑옷',
        helmet: '투구',
        gloves: '장갑',
        boots: '신발',
        shield: '방패',
        accessory: '장신구'
    };
    
    const item = {
        id: `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: `평범한 ${slotNames[selectedSlot] || '장비'}`,
        type: selectedSlot,
        rarity: 'normal',
        color: '#95a5a6',
        emoji: '⚪',
        stats: {},
        description: '평범하지만 쓸만한 아이템입니다.',
        price: 1000,
        sellPrice: 300,
        enhanceLevel: 0,
        score: 15,
        setName: '장비',
        quantity: 1,
        appraisedAt: new Date(),
        foundAt: new Date(),
        inventorySlot
    };
    
    // 기본 스탯 설정
    switch(selectedSlot) {
        case 'weapon':
            item.stats.attack = 10;
            break;
        case 'armor':
        case 'helmet':
        case 'shield':
            item.stats.defense = 10;
            break;
        case 'gloves':
            item.stats.attack = 5;
            item.stats.agility = 5;
            break;
        case 'boots':
            item.stats.agility = 10;
            break;
        case 'accessory':
            item.stats.luck = 10;
            break;
    }
    
    return item;
}

module.exports = ShopTransactionManager;