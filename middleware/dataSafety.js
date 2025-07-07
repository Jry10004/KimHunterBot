// 데이터 안전성 보장 미들웨어
const cacheService = require('../services/CacheService');
const { ensureSave } = require('../database/optimization');
const { errorHandler, GameError } = require('../systems/enhancedErrorHandler');

// 트랜잭션 래퍼
async function withTransaction(operations) {
    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();
        
        const result = await operations(session);
        
        await session.commitTransaction();
        return result;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

// 안전한 유저 업데이트
async function safeUserUpdate(userId, updateFunction, options = {}) {
    const {
        retries = 3,
        useTransaction = false,
        invalidateCache = true
    } = options;
    
    const User = require('../models/User');
    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            let user;
            
            if (useTransaction) {
                // 트랜잭션 사용
                user = await withTransaction(async (session) => {
                    const u = await User.findOne({ discordId: userId }).session(session);
                    if (!u) throw new GameError('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
                    
                    await updateFunction(u);
                    return await u.save({ session });
                });
            } else {
                // 일반 업데이트
                user = await User.findOne({ discordId: userId });
                if (!user) throw new GameError('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND');
                
                await updateFunction(user);
                user = await ensureSave(user, 2);
            }
            
            // 캐시 무효화
            if (invalidateCache) {
                cacheService.invalidateUser(userId);
            }
            
            console.log(`✅ 유저 데이터 안전하게 업데이트됨: ${userId}`);
            return user;
            
        } catch (error) {
            lastError = error;
            console.error(`유저 업데이트 시도 ${attempt}/${retries} 실패:`, error.message);
            
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }
    
    await errorHandler.handleError(lastError, {
        operation: 'safeUserUpdate',
        userId,
        attempts: retries
    });
    
    throw lastError;
}

// 안전한 인벤토리 업데이트
async function safeInventoryUpdate(userId, updateFunction, options = {}) {
    const UserInventory = require('../models/game/UserInventory');
    const { useTransaction = true } = options;
    
    if (useTransaction) {
        return await withTransaction(async (session) => {
            const inventory = await UserInventory.findOne({ discordId: userId }).session(session);
            if (!inventory) {
                // 인벤토리가 없으면 생성
                const newInventory = new UserInventory({
                    userId,
                    discordId: userId,
                    inventory: [],
                    equipment: {}
                });
                await newInventory.save({ session });
                return newInventory;
            }
            
            await updateFunction(inventory);
            return await inventory.save({ session });
        });
    } else {
        let inventory = await UserInventory.findOne({ discordId: userId });
        if (!inventory) {
            inventory = new UserInventory({
                userId,
                discordId: userId,
                inventory: [],
                equipment: {}
            });
        }
        
        await updateFunction(inventory);
        return await ensureSave(inventory);
    }
}

// 안전한 경제 활동 업데이트
async function safeEconomyUpdate(userId, updateFunction, options = {}) {
    const UserEconomy = require('../models/game/UserEconomy');
    const { useTransaction = true, description = '경제 활동' } = options;
    
    return await withTransaction(async (session) => {
        let economy = await UserEconomy.findOne({ discordId: userId }).session(session);
        
        if (!economy) {
            economy = new UserEconomy({
                userId,
                discordId: userId,
                currencies: { gold: 0, gems: 0, tokens: 0, energyFragments: 0 }
            });
        }
        
        const beforeGold = economy.currencies.gold;
        
        await updateFunction(economy);
        
        // 변경사항 로깅
        const afterGold = economy.currencies.gold;
        if (beforeGold !== afterGold) {
            console.log(`💰 골드 변경: ${userId} | ${beforeGold} → ${afterGold} (${afterGold - beforeGold > 0 ? '+' : ''}${afterGold - beforeGold}) | ${description}`);
        }
        
        return await economy.save({ session });
    });
}

// 배치 업데이트 (여러 유저 동시)
async function safeBatchUpdate(userIds, updateFunction, options = {}) {
    const {
        parallel = 5, // 동시 처리 수
        onProgress
    } = options;
    
    const results = {
        success: [],
        failed: []
    };
    
    // 배치 처리
    for (let i = 0; i < userIds.length; i += parallel) {
        const batch = userIds.slice(i, i + parallel);
        
        const promises = batch.map(async (userId) => {
            try {
                await safeUserUpdate(userId, updateFunction, options);
                results.success.push(userId);
            } catch (error) {
                results.failed.push({ userId, error: error.message });
            }
        });
        
        await Promise.all(promises);
        
        if (onProgress) {
            onProgress({
                processed: i + batch.length,
                total: userIds.length,
                successRate: results.success.length / (i + batch.length)
            });
        }
    }
    
    console.log(`✅ 배치 업데이트 완료: ${results.success.length}개 성공, ${results.failed.length}개 실패`);
    return results;
}

// 데이터 일관성 검증 데코레이터
function validateConsistency(validationRules) {
    return function(target, propertyName, descriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args) {
            const result = await originalMethod.apply(this, args);
            
            // 검증 실행
            for (const rule of validationRules) {
                const isValid = await rule(result);
                if (!isValid) {
                    throw new Error(`데이터 일관성 검증 실패: ${rule.name}`);
                }
            }
            
            return result;
        };
        
        return descriptor;
    };
}

// 중요 데이터 백업
async function backupCriticalData(userId, dataType) {
    const backupData = {
        userId,
        dataType,
        timestamp: new Date(),
        data: null
    };
    
    switch (dataType) {
        case 'user':
            const User = require('../models/User');
            backupData.data = await User.findOne({ discordId: userId }).lean();
            break;
            
        case 'inventory':
            const UserInventory = require('../models/game/UserInventory');
            backupData.data = await UserInventory.findOne({ discordId: userId }).lean();
            break;
            
        case 'economy':
            const UserEconomy = require('../models/game/UserEconomy');
            backupData.data = await UserEconomy.findOne({ discordId: userId }).lean();
            break;
    }
    
    // 백업 저장 (Redis나 별도 컬렉션)
    cacheService.set('temp', `backup:${userId}:${dataType}`, backupData, 3600); // 1시간 보관
    
    return backupData;
}

// 백업에서 복원
async function restoreFromBackup(userId, dataType) {
    const backupKey = `backup:${userId}:${dataType}`;
    const backup = cacheService.get('temp', backupKey);
    
    if (!backup) {
        throw new Error('백업을 찾을 수 없습니다.');
    }
    
    console.log(`🔄 백업에서 복원 중: ${userId} - ${dataType}`);
    
    // 복원 로직 구현
    switch (dataType) {
        case 'user':
            const User = require('../models/User');
            await User.findOneAndUpdate(
                { discordId: userId },
                backup.data,
                { upsert: true }
            );
            break;
            
        // 다른 데이터 타입도 동일하게 구현
    }
    
    return backup;
}

module.exports = {
    withTransaction,
    safeUserUpdate,
    safeInventoryUpdate,
    safeEconomyUpdate,
    safeBatchUpdate,
    validateConsistency,
    backupCriticalData,
    restoreFromBackup
};