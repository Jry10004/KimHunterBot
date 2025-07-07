// 기본 API 클라이언트
const axios = require('axios');
const { errorHandler } = require('../../systems/enhancedErrorHandler');

class BaseAPIClient {
    constructor(config = {}) {
        this.baseURL = config.baseURL;
        this.timeout = config.timeout || 10000;
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000;
        this.headers = config.headers || {};
        this.cache = new Map();
        this.cacheTimeout = config.cacheTimeout || 5 * 60 * 1000; // 5분
        
        // Axios 인스턴스 생성
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: {
                'User-Agent': 'KimHunter-Discord-Bot/1.0',
                ...this.headers
            }
        });
        
        // 요청/응답 인터셉터
        this.setupInterceptors();
        
        // 통계
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cacheHits: 0,
            totalRetries: 0,
            averageResponseTime: 0
        };
    }
    
    setupInterceptors() {
        // 요청 인터셉터
        this.client.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: Date.now() };
                this.stats.totalRequests++;
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );
        
        // 응답 인터셉터
        this.client.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.metadata.startTime;
                this.updateAverageResponseTime(duration);
                this.stats.successfulRequests++;
                return response;
            },
            async (error) => {
                this.stats.failedRequests++;
                
                // 재시도 가능한 에러인지 확인
                if (this.shouldRetry(error) && error.config._retryCount < this.maxRetries) {
                    error.config._retryCount = (error.config._retryCount || 0) + 1;
                    this.stats.totalRetries++;
                    
                    console.log(`🔄 API 재시도 ${error.config._retryCount}/${this.maxRetries}...`);
                    
                    // 지수 백오프
                    const delay = this.retryDelay * Math.pow(2, error.config._retryCount - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    return this.client.request(error.config);
                }
                
                // 에러 핸들링
                await errorHandler.handleError(error, {
                    api: this.constructor.name,
                    url: error.config?.url,
                    method: error.config?.method
                });
                
                throw error;
            }
        );
    }
    
    shouldRetry(error) {
        // 네트워크 에러나 5xx 에러는 재시도
        if (!error.response) return true;
        if (error.response.status >= 500) return true;
        if (error.response.status === 429) return true; // Rate limit
        if (error.code === 'ECONNRESET') return true;
        if (error.code === 'ETIMEDOUT') return true;
        return false;
    }
    
    updateAverageResponseTime(duration) {
        const totalRequests = this.stats.successfulRequests;
        const currentAverage = this.stats.averageResponseTime;
        this.stats.averageResponseTime = 
            (currentAverage * (totalRequests - 1) + duration) / totalRequests;
    }
    
    // 캐시 키 생성
    getCacheKey(method, url, params) {
        return `${method}:${url}:${JSON.stringify(params || {})}`;
    }
    
    // 캐시에서 가져오기
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            this.stats.cacheHits++;
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }
    
    // 캐시에 저장
    saveToCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // 캐시 크기 제한 (최대 1000개)
        if (this.cache.size > 1000) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }
    
    // GET 요청
    async get(url, config = {}) {
        const cacheKey = this.getCacheKey('GET', url, config.params);
        
        // 캐시 확인
        if (config.useCache !== false) {
            const cached = this.getFromCache(cacheKey);
            if (cached) return cached;
        }
        
        const response = await this.client.get(url, {
            ...config,
            _retryCount: 0
        });
        
        // 캐시 저장
        if (config.useCache !== false) {
            this.saveToCache(cacheKey, response.data);
        }
        
        return response.data;
    }
    
    // POST 요청
    async post(url, data, config = {}) {
        const response = await this.client.post(url, data, {
            ...config,
            _retryCount: 0
        });
        return response.data;
    }
    
    // PUT 요청
    async put(url, data, config = {}) {
        const response = await this.client.put(url, data, {
            ...config,
            _retryCount: 0
        });
        return response.data;
    }
    
    // DELETE 요청
    async delete(url, config = {}) {
        const response = await this.client.delete(url, {
            ...config,
            _retryCount: 0
        });
        return response.data;
    }
    
    // 캐시 클리어
    clearCache() {
        this.cache.clear();
    }
    
    // 통계 가져오기
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            cacheHitRate: this.stats.cacheHits / this.stats.totalRequests || 0
        };
    }
    
    // 헬스 체크
    async healthCheck() {
        try {
            await this.client.get('/health', { timeout: 5000 });
            return { healthy: true };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
}

module.exports = BaseAPIClient;