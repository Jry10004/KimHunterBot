// 통합 캐싱 서비스
const NodeCache = require('node-cache');

class CacheService {
    constructor() {
        // 캐시 타입별 인스턴스
        this.caches = {
            // 유저 데이터 캐시 (5분)
            user: new NodeCache({ 
                stdTTL: 300, 
                checkperiod: 60,
                useClones: false // 성능 향상을 위해 복제 비활성화
            }),
            
            // 랭킹 캐시 (10분)
            ranking: new NodeCache({ 
                stdTTL: 600, 
                checkperiod: 120 
            }),
            
            // 주식 데이터 캐시 (1분)
            stock: new NodeCache({ 
                stdTTL: 60, 
                checkperiod: 30 
            }),
            
            // 게임 설정 캐시 (1시간)
            config: new NodeCache({ 
                stdTTL: 3600, 
                checkperiod: 600 
            }),
            
            // 임시 데이터 캐시 (30초)
            temp: new NodeCache({ 
                stdTTL: 30, 
                checkperiod: 10 
            })
        };
        
        // 캐시 통계
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            flushes: 0
        };
        
        // 캐시 이벤트 리스너 설정
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        Object.entries(this.caches).forEach(([name, cache]) => {
            cache.on('set', (key, value) => {
                this.stats.sets++;
                console.log(`📥 [${name}] 캐시 저장: ${key}`);
            });
            
            cache.on('del', (key, value) => {
                this.stats.deletes++;
            });
            
            cache.on('expired', (key, value) => {
                console.log(`⏰ [${name}] 캐시 만료: ${key}`);
            });
            
            cache.on('flush', () => {
                this.stats.flushes++;
            });
        });
    }
    
    // 캐시 가져오기
    get(type, key) {
        const cache = this.caches[type];
        if (!cache) {
            console.error(`❌ 알 수 없는 캐시 타입: ${type}`);
            return null;
        }
        
        const value = cache.get(key);
        if (value !== undefined) {
            this.stats.hits++;
            return value;
        } else {
            this.stats.misses++;
            return null;
        }
    }
    
    // 캐시 저장
    set(type, key, value, ttl = undefined) {
        const cache = this.caches[type];
        if (!cache) {
            console.error(`❌ 알 수 없는 캐시 타입: ${type}`);
            return false;
        }
        
        return cache.set(key, value, ttl);
    }
    
    // 캐시 삭제
    delete(type, key) {
        const cache = this.caches[type];
        if (!cache) {
            return false;
        }
        
        return cache.del(key);
    }
    
    // 캐시 타입별 전체 삭제
    flush(type) {
        const cache = this.caches[type];
        if (!cache) {
            return false;
        }
        
        cache.flushAll();
        return true;
    }
    
    // 모든 캐시 삭제
    flushAll() {
        Object.values(this.caches).forEach(cache => cache.flushAll());
        console.log('🗑️ 모든 캐시가 삭제되었습니다.');
    }
    
    // 캐시 통계
    getStats() {
        const cacheStats = {};
        
        Object.entries(this.caches).forEach(([name, cache]) => {
            const keys = cache.keys();
            cacheStats[name] = {
                keys: keys.length,
                size: cache.getStats().ksize + cache.getStats().vsize
            };
        });
        
        return {
            ...this.stats,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
            caches: cacheStats
        };
    }
    
    // 유저 데이터 캐싱 헬퍼
    async getUserCached(userId, fetchFunction) {
        const cacheKey = `user:${userId}`;
        let user = this.get('user', cacheKey);
        
        if (!user && fetchFunction) {
            user = await fetchFunction(userId);
            if (user) {
                this.set('user', cacheKey, user);
            }
        }
        
        return user;
    }
    
    // 랭킹 데이터 캐싱 헬퍼
    async getRankingCached(type, fetchFunction) {
        const cacheKey = `ranking:${type}`;
        let ranking = this.get('ranking', cacheKey);
        
        if (!ranking && fetchFunction) {
            ranking = await fetchFunction();
            if (ranking) {
                this.set('ranking', cacheKey, ranking);
            }
        }
        
        return ranking;
    }
    
    // 유저 데이터 무효화
    invalidateUser(userId) {
        this.delete('user', `user:${userId}`);
        console.log(`🔄 유저 캐시 무효화: ${userId}`);
    }
    
    // 패턴으로 캐시 삭제
    deleteByPattern(type, pattern) {
        const cache = this.caches[type];
        if (!cache) return 0;
        
        const keys = cache.keys();
        const regex = new RegExp(pattern);
        let deleted = 0;
        
        keys.forEach(key => {
            if (regex.test(key)) {
                cache.del(key);
                deleted++;
            }
        });
        
        return deleted;
    }
    
    // 캐시 워밍 (미리 로드)
    async warmCache(type, keys, fetchFunction) {
        console.log(`🔥 캐시 워밍 시작: ${type} (${keys.length}개)`);
        
        const promises = keys.map(async (key) => {
            const value = await fetchFunction(key);
            if (value) {
                this.set(type, key, value);
            }
        });
        
        await Promise.all(promises);
        console.log(`✅ 캐시 워밍 완료: ${type}`);
    }
    
    // TTL 업데이트
    updateTTL(type, key, ttl) {
        const cache = this.caches[type];
        if (!cache) return false;
        
        return cache.ttl(key, ttl);
    }
    
    // 캐시 크기 제한 설정
    setMaxKeys(type, max) {
        const cache = this.caches[type];
        if (!cache) return false;
        
        cache.options.maxKeys = max;
        return true;
    }
}

// 싱글톤 인스턴스
const cacheService = new CacheService();

// 정기적인 통계 로깅 (개발 모드에서만)
if (process.env.DEV_MODE === 'true') {
    setInterval(() => {
        const stats = cacheService.getStats();
        console.log('📊 캐시 통계:', {
            hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
            totalHits: stats.hits,
            totalMisses: stats.misses,
            totalSets: stats.sets
        });
    }, 5 * 60 * 1000); // 5분마다
}

module.exports = cacheService;