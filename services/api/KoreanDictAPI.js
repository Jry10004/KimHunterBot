// 한국어 사전 API 클라이언트
const BaseAPIClient = require('./BaseAPIClient');
const parseString = require('xml2js').parseString;
const { promisify } = require('util');
const parseXML = promisify(parseString);

class KoreanDictAPI extends BaseAPIClient {
    constructor() {
        super({
            baseURL: 'https://stdict.korean.go.kr/api',
            timeout: 5000,
            cacheTimeout: 24 * 60 * 60 * 1000, // 24시간 캐시
            headers: {
                'Accept': 'application/xml'
            }
        });
        
        this.apiKey = process.env.URIMAL_API_KEY;
        if (!this.apiKey) {
            console.warn('⚠️ URIMAL_API_KEY가 설정되지 않았습니다. 단어 검증이 제한됩니다.');
        }
    }
    
    // 단어 검색
    async searchWord(word) {
        if (!this.apiKey) {
            return { found: false, error: 'API_KEY_MISSING' };
        }
        
        try {
            const response = await this.get('/search.do', {
                params: {
                    key: this.apiKey,
                    q: word,
                    req_type: 'xml',
                    num: 10
                },
                responseType: 'text'
            });
            
            const result = await parseXML(response);
            
            // 검색 결과 파싱
            const channel = result?.rss?.channel?.[0];
            if (!channel || !channel.item || channel.item.length === 0) {
                return { found: false };
            }
            
            // 정확한 매칭 찾기
            const exactMatch = channel.item.find(item => {
                const itemWord = item.word?.[0].replace(/-/g, '').replace(/\^/g, '');
                return itemWord === word;
            });
            
            if (exactMatch) {
                return {
                    found: true,
                    word: word,
                    definition: exactMatch.sense?.[0]?.definition?.[0] || '정의 없음',
                    pos: exactMatch.pos?.[0] || '품사 정보 없음'
                };
            }
            
            // 부분 매칭
            const partialMatch = channel.item[0];
            return {
                found: true,
                partial: true,
                word: partialMatch.word?.[0],
                definition: partialMatch.sense?.[0]?.definition?.[0] || '정의 없음',
                pos: partialMatch.pos?.[0] || '품사 정보 없음'
            };
            
        } catch (error) {
            console.error('단어 검색 오류:', error.message);
            return { found: false, error: error.message };
        }
    }
    
    // 단어 존재 여부만 확인 (빠른 체크)
    async checkWordExists(word) {
        const result = await this.searchWord(word);
        return result.found && !result.partial;
    }
    
    // 초성으로 시작하는 단어 찾기
    async findWordsByChosung(chosung) {
        if (!this.apiKey) {
            return [];
        }
        
        try {
            const response = await this.get('/search.do', {
                params: {
                    key: this.apiKey,
                    q: chosung + '*',
                    req_type: 'xml',
                    num: 100,
                    advanced: 'y',
                    method: 'start'
                },
                responseType: 'text'
            });
            
            const result = await parseXML(response);
            const items = result?.rss?.channel?.[0]?.item || [];
            
            return items.map(item => ({
                word: item.word?.[0].replace(/-/g, '').replace(/\^/g, ''),
                definition: item.sense?.[0]?.definition?.[0] || '정의 없음',
                pos: item.pos?.[0] || '품사 정보 없음'
            }));
            
        } catch (error) {
            console.error('초성 검색 오류:', error.message);
            return [];
        }
    }
    
    // 끝말잇기용 단어 검색
    async findWordsStartingWith(char) {
        if (!this.apiKey) {
            return [];
        }
        
        try {
            const response = await this.get('/search.do', {
                params: {
                    key: this.apiKey,
                    q: char + '*',
                    req_type: 'xml',
                    num: 50,
                    advanced: 'y',
                    method: 'start',
                    pos: '1'  // 명사만
                },
                responseType: 'text'
            });
            
            const result = await parseXML(response);
            const items = result?.rss?.channel?.[0]?.item || [];
            
            // 두 글자 이상인 단어만 필터링
            return items
                .map(item => item.word?.[0].replace(/-/g, '').replace(/\^/g, ''))
                .filter(word => word && word.length >= 2);
            
        } catch (error) {
            console.error('끝말잇기 단어 검색 오류:', error.message);
            return [];
        }
    }
    
    // API 사용량 확인
    async checkUsage() {
        // 국립국어원 API는 사용량 조회 엔드포인트가 없으므로
        // 자체적으로 통계 반환
        const stats = this.getStats();
        return {
            totalRequests: stats.totalRequests,
            successfulRequests: stats.successfulRequests,
            failedRequests: stats.failedRequests,
            cacheHitRate: stats.cacheHitRate,
            dailyLimit: 10000, // 기본 일일 한도
            remainingRequests: Math.max(0, 10000 - stats.totalRequests)
        };
    }
}

module.exports = new KoreanDictAPI();