// API 클라이언트 통합 인덱스
const BaseAPIClient = require('./BaseAPIClient');
const koreanDictAPI = require('./KoreanDictAPI');
const newsAPI = require('./NewsAPI');

// API 상태 모니터링
class APIMonitor {
    constructor() {
        this.apis = {
            koreanDict: koreanDictAPI,
            news: newsAPI
        };
        
        this.healthCheckInterval = null;
    }
    
    // 모든 API 상태 확인
    async checkAllAPIs() {
        const results = {};
        
        for (const [name, api] of Object.entries(this.apis)) {
            try {
                const stats = api.getStats();
                results[name] = {
                    healthy: true,
                    stats,
                    lastCheck: new Date()
                };
            } catch (error) {
                results[name] = {
                    healthy: false,
                    error: error.message,
                    lastCheck: new Date()
                };
            }
        }
        
        return results;
    }
    
    // 정기적인 헬스 체크 시작
    startHealthCheck(interval = 5 * 60 * 1000) { // 5분마다
        this.healthCheckInterval = setInterval(async () => {
            const results = await this.checkAllAPIs();
            console.log('📊 API 상태 체크:', results);
        }, interval);
    }
    
    // 헬스 체크 중지
    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
    
    // 모든 API 캐시 클리어
    clearAllCaches() {
        for (const api of Object.values(this.apis)) {
            if (api.clearCache) {
                api.clearCache();
            }
        }
        console.log('✅ 모든 API 캐시가 클리어되었습니다.');
    }
}

// 싱글톤 인스턴스
const apiMonitor = new APIMonitor();

module.exports = {
    // API 클라이언트들
    BaseAPIClient,
    koreanDictAPI,
    newsAPI,
    
    // 모니터링
    apiMonitor,
    
    // 헬퍼 함수들
    checkWordExists: (word) => koreanDictAPI.checkWordExists(word),
    searchNews: (query, options) => newsAPI.searchNews(query, options),
    getTopHeadlines: (options) => newsAPI.getTopHeadlines(options),
    
    // 초기화 함수
    initializeAPIs: () => {
        console.log('🔌 API 클라이언트 초기화 중...');
        
        // API 키 확인
        const apiKeys = {
            '한국어 사전': process.env.URIMAL_API_KEY,
            '뉴스': process.env.NEWS_API_KEY
        };
        
        for (const [name, key] of Object.entries(apiKeys)) {
            if (key) {
                console.log(`✅ ${name} API 키 설정됨`);
            } else {
                console.log(`⚠️ ${name} API 키 없음 - 제한된 기능`);
            }
        }
        
        // 헬스 체크 시작
        if (process.env.NODE_ENV !== 'test') {
            apiMonitor.startHealthCheck();
        }
        
        return apiMonitor;
    }
};