// 상점 재시도 관리자
const User = require('../models/User');

class ShopRetryManager {
    // 재시도 설정
    static RETRY_OPTIONS = {
        maxRetries: 3,
        retryDelay: 1000, // 1초
        backoffMultiplier: 2 // 지수 백오프
    };
    
    // 에러가 재시도 가능한지 확인
    static isRetryableError(error) {
        const retryableErrors = [
            'MongoNetworkError',
            'MongoTimeoutError',
            'MongoServerError',
            'ETIMEDOUT',
            'ECONNRESET',
            'ECONNREFUSED'
        ];
        
        return retryableErrors.some(errType => 
            error.name === errType || 
            error.message.includes(errType) ||
            error.message.includes('timed out') ||
            error.message.includes('connection')
        );
    }
    
    // 지수 백오프로 재시도
    static async withRetry(operation, context = {}) {
        const { maxRetries, retryDelay, backoffMultiplier } = this.RETRY_OPTIONS;
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[ShopRetry] ${context.operation || 'Operation'} 시도 ${attempt}/${maxRetries}`);
                return await operation();
            } catch (error) {
                lastError = error;
                console.error(`[ShopRetry] 시도 ${attempt} 실패:`, error.message);
                
                if (attempt === maxRetries || !this.isRetryableError(error)) {
                    throw error;
                }
                
                const delay = retryDelay * Math.pow(backoffMultiplier, attempt - 1);
                console.log(`[ShopRetry] ${delay}ms 후 재시도...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }
    
    // 안전한 사용자 조회
    static async safeGetUser(userId) {
        return await this.withRetry(
            async () => {
                const user = await User.findOne({ discordId: userId })
                    .maxTimeMS(5000); // 5초 타임아웃
                    
                if (!user) {
                    throw new Error('사용자를 찾을 수 없습니다.');
                }
                
                return user;
            },
            { operation: `사용자 조회 (${userId})` }
        );
    }
    
    // 안전한 사용자 저장
    static async safeSaveUser(user) {
        return await this.withRetry(
            async () => {
                return await user.save({ 
                    validateBeforeSave: true,
                    wtimeout: 5000 // 5초 write concern timeout
                });
            },
            { operation: `사용자 저장 (${user.discordId})` }
        );
    }
    
    // 안전한 findOneAndUpdate
    static async safeFindOneAndUpdate(filter, update, options = {}) {
        return await this.withRetry(
            async () => {
                const defaultOptions = {
                    new: true,
                    runValidators: true,
                    maxTimeMS: 5000 // 5초 타임아웃
                };
                
                const finalOptions = { ...defaultOptions, ...options };
                const result = await User.findOneAndUpdate(filter, update, finalOptions);
                
                if (!result) {
                    throw new Error('업데이트할 문서를 찾을 수 없습니다.');
                }
                
                return result;
            },
            { operation: 'findOneAndUpdate' }
        );
    }
    
    // 골드 차감 및 아이템 추가 (트랜잭션 없이)
    static async atomicGachaOperation(userId, goldCost, items, slotUpdates) {
        // 1단계: 골드 차감
        const user = await this.safeFindOneAndUpdate(
            { 
                discordId: userId,
                gold: { $gte: goldCost }
            },
            {
                $inc: { gold: -goldCost },
                $set: slotUpdates
            }
        );
        
        if (!user) {
            throw new Error('골드가 부족하거나 사용자를 찾을 수 없습니다.');
        }
        
        // 2단계: 아이템 추가 시도
        try {
            const updatedUser = await this.safeFindOneAndUpdate(
                { discordId: userId },
                { 
                    $push: Array.isArray(items) 
                        ? { inventory: { $each: items } }
                        : { inventory: items }
                }
            );
            
            return updatedUser;
        } catch (itemError) {
            // 아이템 추가 실패 시 골드 복구
            console.error('[ShopRetry] 아이템 추가 실패, 골드 복구 시도:', itemError);
            
            try {
                await this.safeFindOneAndUpdate(
                    { discordId: userId },
                    { $inc: { gold: goldCost } }
                );
                console.log('[ShopRetry] 골드 복구 성공');
            } catch (rollbackError) {
                console.error('[ShopRetry] 골드 복구 실패:', rollbackError);
                // 관리자에게 알림 필요
            }
            
            throw itemError;
        }
    }
}

module.exports = ShopRetryManager;