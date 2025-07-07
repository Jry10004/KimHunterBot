// 데이터베이스 최적화 및 인덱스 관리
const mongoose = require('mongoose');

class DatabaseOptimizer {
    constructor() {
        this.models = {
            User: require('../models/User'),
            UserGameStats: require('../models/game/UserGameStats'),
            UserInventory: require('../models/game/UserInventory'),
            UserEconomy: require('../models/game/UserEconomy'),
            Stock: require('../models/Stock'),
            Word: require('../models/Word'),
            ArtifactCompany: require('../models/ArtifactCompany')
        };
        
        this.indexRecommendations = [];
    }
    
    // 모든 인덱스 생성 및 최적화
    async optimizeAllIndexes() {
        console.log('🔧 데이터베이스 인덱스 최적화 시작...');
        
        for (const [modelName, Model] of Object.entries(this.models)) {
            await this.optimizeModelIndexes(modelName, Model);
        }
        
        console.log('✅ 인덱스 최적화 완료');
        return this.indexRecommendations;
    }
    
    // 모델별 인덱스 최적화
    async optimizeModelIndexes(modelName, Model) {
        console.log(`\n📊 ${modelName} 모델 분석 중...`);
        
        try {
            // 기존 인덱스 확인
            const indexes = await Model.collection.getIndexes();
            console.log(`  현재 인덱스: ${Object.keys(indexes).length}개`);
            
            // 추천 인덱스 생성
            const recommendations = this.getIndexRecommendations(modelName);
            
            for (const rec of recommendations) {
                const indexName = Object.keys(rec.index).join('_');
                
                if (!indexes[indexName]) {
                    try {
                        await Model.collection.createIndex(rec.index, rec.options);
                        console.log(`  ✅ 인덱스 생성: ${indexName}`);
                    } catch (error) {
                        console.error(`  ❌ 인덱스 생성 실패 (${indexName}):`, error.message);
                    }
                } else {
                    console.log(`  ⏭️  인덱스 존재: ${indexName}`);
                }
            }
            
            // 인덱스 통계 수집
            await this.collectIndexStats(modelName, Model);
            
        } catch (error) {
            console.error(`❌ ${modelName} 최적화 실패:`, error.message);
        }
    }
    
    // 모델별 추천 인덱스
    getIndexRecommendations(modelName) {
        const recommendations = {
            User: [
                { index: { discordId: 1 }, options: { unique: true } },
                { index: { nickname: 1 }, options: { sparse: true } },
                { index: { level: -1 }, options: {} },
                { index: { gold: -1 }, options: {} },
                { index: { 'emblem.type': 1, 'emblem.tier': -1 }, options: { sparse: true } },
                { index: { createdAt: -1 }, options: {} }
            ],
            UserGameStats: [
                { index: { discordId: 1 }, options: { unique: true } },
                { index: { 'pvpStats.pvpRating': -1 }, options: {} },
                { index: { 'overallStats.totalGoldEarned': -1 }, options: {} },
                { index: { 'huntingStats.monstersKilled': -1 }, options: {} }
            ],
            UserInventory: [
                { index: { discordId: 1 }, options: { unique: true } },
                { index: { 'inventory.equipped': 1 }, options: { sparse: true } },
                { index: { 'inventory.rarity': 1 }, options: {} },
                { index: { 'inventory.itemId': 1 }, options: {} }
            ],
            UserEconomy: [
                { index: { discordId: 1 }, options: { unique: true } },
                { index: { 'currencies.gold': -1 }, options: {} },
                { index: { 'stockPortfolio.stockId': 1 }, options: { sparse: true } },
                { index: { updatedAt: -1 }, options: {} }
            ],
            Stock: [
                { index: { stockId: 1 }, options: { unique: true } },
                { index: { currentPrice: -1 }, options: {} },
                { index: { dailyChange: -1 }, options: {} }
            ],
            Word: [
                { index: { word: 1 }, options: { unique: true } },
                { index: { length: 1 }, options: {} },
                { index: { 'usageStats.totalUses': -1 }, options: {} }
            ]
        };
        
        return recommendations[modelName] || [];
    }
    
    // 인덱스 통계 수집
    async collectIndexStats(modelName, Model) {
        try {
            const stats = await Model.collection.stats();
            const indexStats = await Model.collection.aggregate([
                { $indexStats: {} }
            ]).toArray();
            
            this.indexRecommendations.push({
                model: modelName,
                documentCount: stats.count,
                totalSize: stats.size,
                avgDocSize: stats.avgObjSize,
                indexes: indexStats.map(idx => ({
                    name: idx.name,
                    accesses: idx.accesses.ops,
                    since: idx.accesses.since
                }))
            });
        } catch (error) {
            console.error(`통계 수집 실패 (${modelName}):`, error.message);
        }
    }
    
    // 쿼리 성능 분석
    async analyzeQueryPerformance() {
        console.log('\n🔍 쿼리 성능 분석 중...');
        
        const slowQueries = [];
        
        // 느린 쿼리 찾기 (100ms 이상)
        const profile = await mongoose.connection.db.collection('system.profile').find({
            millis: { $gt: 100 }
        }).limit(20).toArray();
        
        profile.forEach(query => {
            slowQueries.push({
                collection: query.ns,
                operation: query.op,
                duration: query.millis,
                timestamp: query.ts,
                command: query.command
            });
        });
        
        return slowQueries;
    }
    
    // 컬렉션 통계
    async getCollectionStats() {
        const stats = {};
        
        for (const [modelName, Model] of Object.entries(this.models)) {
            try {
                const collStats = await Model.collection.stats();
                stats[modelName] = {
                    documents: collStats.count,
                    size: `${(collStats.size / 1024 / 1024).toFixed(2)} MB`,
                    avgDocSize: `${(collStats.avgObjSize / 1024).toFixed(2)} KB`,
                    indexes: collStats.nindexes,
                    indexSize: `${(collStats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`
                };
            } catch (error) {
                stats[modelName] = { error: error.message };
            }
        }
        
        return stats;
    }
    
    // 데이터베이스 정리 (오래된 데이터 제거)
    async cleanupOldData(options = {}) {
        console.log('\n🧹 오래된 데이터 정리 중...');
        
        const {
            daysToKeep = 90,
            collections = ['transactionHistory', 'logs']
        } = options;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const results = {};
        
        // 오래된 거래 내역 정리
        if (collections.includes('transactionHistory')) {
            const result = await this.models.UserEconomy.updateMany(
                {},
                {
                    $pull: {
                        transactionHistory: {
                            timestamp: { $lt: cutoffDate }
                        }
                    }
                }
            );
            results.transactionHistory = result.modifiedCount;
        }
        
        return results;
    }
}

// 데이터 무결성 검증
class DataIntegrityChecker {
    constructor() {
        this.models = {
            User: require('../models/User'),
            UserGameStats: require('../models/game/UserGameStats'),
            UserInventory: require('../models/game/UserInventory'),
            UserEconomy: require('../models/game/UserEconomy')
        };
        
        this.issues = [];
    }
    
    // 전체 데이터 무결성 검사
    async checkAllIntegrity() {
        console.log('\n🔍 데이터 무결성 검사 시작...');
        
        await this.checkUserIntegrity();
        await this.checkInventoryIntegrity();
        await this.checkEconomyIntegrity();
        await this.checkRelationIntegrity();
        
        console.log(`\n✅ 검사 완료. 발견된 문제: ${this.issues.length}개`);
        return this.issues;
    }
    
    // 유저 데이터 무결성 검사
    async checkUserIntegrity() {
        console.log('\n👤 유저 데이터 검사 중...');
        
        const users = await this.models.User.find({});
        
        for (const user of users) {
            // 기본값 검증
            if (user.gold < 0) {
                this.issues.push({
                    type: 'negative_gold',
                    userId: user.discordId,
                    value: user.gold,
                    severity: 'high'
                });
            }
            
            if (user.level < 1 || user.level > 100) {
                this.issues.push({
                    type: 'invalid_level',
                    userId: user.discordId,
                    value: user.level,
                    severity: 'medium'
                });
            }
            
            // 경험치 검증
            const requiredExp = user.level * 100 + (user.level - 1) * 50;
            if (user.exp >= requiredExp) {
                this.issues.push({
                    type: 'exp_overflow',
                    userId: user.discordId,
                    exp: user.exp,
                    required: requiredExp,
                    severity: 'low'
                });
            }
        }
        
        console.log(`  검사 완료: ${users.length}명 중 ${this.issues.length}개 문제 발견`);
    }
    
    // 인벤토리 무결성 검사
    async checkInventoryIntegrity() {
        console.log('\n🎒 인벤토리 데이터 검사 중...');
        
        const inventories = await this.models.UserInventory.find({});
        let issueCount = 0;
        
        for (const inv of inventories) {
            // 중복 슬롯 검사
            const slots = inv.inventory.map(item => item.inventorySlot);
            const duplicates = slots.filter((slot, index) => slots.indexOf(slot) !== index);
            
            if (duplicates.length > 0) {
                this.issues.push({
                    type: 'duplicate_inventory_slots',
                    userId: inv.discordId,
                    duplicates,
                    severity: 'high'
                });
                issueCount++;
            }
            
            // 장착 아이템 검증
            for (const [slotType, slotNumber] of Object.entries(inv.equipment)) {
                if (slotNumber !== null) {
                    const item = inv.inventory.find(i => i.inventorySlot === slotNumber);
                    if (!item) {
                        this.issues.push({
                            type: 'missing_equipped_item',
                            userId: inv.discordId,
                            slot: slotType,
                            slotNumber,
                            severity: 'high'
                        });
                        issueCount++;
                    }
                }
            }
        }
        
        console.log(`  검사 완료: ${inventories.length}개 인벤토리 중 ${issueCount}개 문제 발견`);
    }
    
    // 경제 데이터 무결성 검사
    async checkEconomyIntegrity() {
        console.log('\n💰 경제 데이터 검사 중...');
        
        const economies = await this.models.UserEconomy.find({});
        let issueCount = 0;
        
        for (const eco of economies) {
            // 음수 재화 검사
            for (const [currency, amount] of Object.entries(eco.currencies)) {
                if (amount < 0) {
                    this.issues.push({
                        type: 'negative_currency',
                        userId: eco.discordId,
                        currency,
                        amount,
                        severity: 'critical'
                    });
                    issueCount++;
                }
            }
            
            // 주식 포트폴리오 검증
            for (const holding of eco.stockPortfolio) {
                if (holding.quantity < 0 || holding.averagePrice < 0) {
                    this.issues.push({
                        type: 'invalid_stock_holding',
                        userId: eco.discordId,
                        stockId: holding.stockId,
                        quantity: holding.quantity,
                        price: holding.averagePrice,
                        severity: 'high'
                    });
                    issueCount++;
                }
            }
        }
        
        console.log(`  검사 완료: ${economies.length}개 경제 데이터 중 ${issueCount}개 문제 발견`);
    }
    
    // 관계 무결성 검사
    async checkRelationIntegrity() {
        console.log('\n🔗 관계 무결성 검사 중...');
        
        // 모든 User의 discordId 수집
        const userIds = await this.models.User.distinct('discordId');
        const userIdSet = new Set(userIds);
        
        // GameStats 확인
        const orphanedStats = await this.models.UserGameStats.find({
            discordId: { $nin: userIds }
        });
        
        if (orphanedStats.length > 0) {
            this.issues.push({
                type: 'orphaned_game_stats',
                count: orphanedStats.length,
                ids: orphanedStats.map(s => s.discordId),
                severity: 'medium'
            });
        }
        
        console.log(`  검사 완료: ${orphanedStats.length}개 고아 레코드 발견`);
    }
    
    // 문제 자동 수정
    async fixIssues(autoFix = false) {
        if (!autoFix) {
            console.log('\n⚠️  자동 수정이 비활성화되어 있습니다.');
            return { fixed: 0, failed: 0 };
        }
        
        console.log('\n🔧 문제 자동 수정 중...');
        let fixed = 0;
        let failed = 0;
        
        for (const issue of this.issues) {
            try {
                switch (issue.type) {
                    case 'negative_gold':
                        await this.models.User.updateOne(
                            { discordId: issue.userId },
                            { $set: { gold: 0 } }
                        );
                        fixed++;
                        break;
                        
                    case 'exp_overflow':
                        const user = await this.models.User.findOne({ discordId: issue.userId });
                        if (user) {
                            user.level++;
                            user.exp = issue.exp - issue.required;
                            await user.save();
                            fixed++;
                        }
                        break;
                        
                    case 'negative_currency':
                        await this.models.UserEconomy.updateOne(
                            { discordId: issue.userId },
                            { $set: { [`currencies.${issue.currency}`]: 0 } }
                        );
                        fixed++;
                        break;
                        
                    default:
                        console.log(`  ⏭️  자동 수정 불가: ${issue.type}`);
                }
            } catch (error) {
                console.error(`  ❌ 수정 실패:`, error.message);
                failed++;
            }
        }
        
        console.log(`✅ 수정 완료: ${fixed}개 성공, ${failed}개 실패`);
        return { fixed, failed };
    }
}

// 데이터 저장 보장 래퍼
async function ensureSave(document, retries = 3) {
    let lastError;
    
    for (let i = 0; i < retries; i++) {
        try {
            // 저장 전 검증
            await document.validate();
            
            // 저장 시도
            const saved = await document.save();
            
            // 저장 확인
            const verification = await document.constructor.findById(saved._id);
            if (verification) {
                return saved;
            }
            
            throw new Error('저장 검증 실패');
        } catch (error) {
            lastError = error;
            console.error(`저장 시도 ${i + 1}/${retries} 실패:`, error.message);
            
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }
    
    throw lastError;
}

module.exports = {
    DatabaseOptimizer,
    DataIntegrityChecker,
    ensureSave
};