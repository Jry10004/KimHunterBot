// 뉴스 API 통합 클라이언트
const BaseAPIClient = require('./BaseAPIClient');

class NewsAPI extends BaseAPIClient {
    constructor() {
        super({
            baseURL: 'https://newsapi.org/v2',
            timeout: 10000,
            cacheTimeout: 720 * 60 * 1000, // 12시간 캐시 (API 제한 회피)
            headers: {
                'X-Api-Key': process.env.NEWS_API_KEY || ''
            }
        });
        
        this.apiKey = process.env.NEWS_API_KEY;
        this.mockMode = !this.apiKey; // API 키가 없으면 모의 모드
        
        if (this.mockMode) {
            console.log('📰 뉴스 API 키가 없어 모의 뉴스 모드로 작동합니다.');
        }
    }
    
    // 헤드라인 가져오기
    async getTopHeadlines(options = {}) {
        if (this.mockMode) {
            return this.generateMockNews('headlines', options);
        }
        
        try {
            const response = await this.get('/top-headlines', {
                params: {
                    country: options.country || 'kr',
                    category: options.category || 'business',
                    pageSize: options.pageSize || 10,
                    page: options.page || 1
                }
            });
            
            return this.formatNewsResponse(response);
        } catch (error) {
            console.error('헤드라인 가져오기 실패:', error.message);
            // 429 에러(요청 제한)일 경우 캐시 시간 연장
            if (error.response && error.response.status === 429) {
                console.log('⚠️ 뉴스 API 요청 제한 도달');
            }
            return this.generateMockNews('headlines', options);
        }
    }
    
    // 키워드로 뉴스 검색
    async searchNews(query, options = {}) {
        if (this.mockMode) {
            return this.generateMockNews('search', { query, ...options });
        }
        
        try {
            const response = await this.get('/everything', {
                params: {
                    q: query,
                    language: options.language || 'ko',
                    sortBy: options.sortBy || 'publishedAt',
                    pageSize: options.pageSize || 10,
                    page: options.page || 1,
                    from: options.from,
                    to: options.to
                }
            });
            
            return this.formatNewsResponse(response);
        } catch (error) {
            console.error('뉴스 검색 실패:', error.message);
            // 429 에러(요청 제한)일 경우 캐시 시간 연장
            if (error.response && error.response.status === 429) {
                console.log('⚠️ 뉴스 API 요청 제한 도달');
            }
            return this.generateMockNews('search', { query, ...options });
        }
    }
    
    // 뉴스 응답 포맷팅
    formatNewsResponse(response) {
        if (!response.articles) {
            return { articles: [], totalResults: 0 };
        }
        
        return {
            articles: response.articles.map(article => ({
                title: article.title,
                description: article.description,
                url: article.url,
                source: article.source?.name || '알 수 없음',
                publishedAt: article.publishedAt,
                image: article.urlToImage,
                content: article.content
            })),
            totalResults: response.totalResults || 0
        };
    }
    
    // 모의 뉴스 생성
    generateMockNews(type, options = {}) {
        const mockTemplates = {
            business: [
                '김헌터 전자, 신제품 출시로 주가 {change}% 상승',
                '몬스터 사육장, 분기 실적 예상치 {exceed}% 초과',
                '드래곤 배송, 글로벌 시장 진출 선언',
                '길드 금융, 새로운 투자 상품 출시'
            ],
            technology: [
                '포털 운송, AI 기반 텔레포트 기술 개발',
                '크리스탈 광산, 블록체인 기술 도입',
                '헌터하이닉스, 차세대 마법 칩 개발 성공',
                '픽셀 게임즈, 메타버스 플랫폼 오픈'
            ],
            market: [
                '오늘의 주식 시장: {trend} 마감',
                '전문가들 "{company}" 주목해야',
                '시장 변동성 증가, 투자자들 주의 필요',
                '신규 상장 기업 큰 관심'
            ]
        };
        
        const companies = ['김헌터 전자', '몬스터 사육장', '드래곤 배송', '길드 금융', '포털 운송'];
        const trends = ['상승세로', '하락세로', '보합세로', '변동성 있게'];
        
        const articles = [];
        const count = options.pageSize || 10;
        
        for (let i = 0; i < count; i++) {
            const category = options.category || 'business';
            const templates = mockTemplates[category] || mockTemplates.business;
            const template = templates[Math.floor(Math.random() * templates.length)];
            
            const title = template
                .replace('{change}', Math.floor(Math.random() * 10 + 1))
                .replace('{exceed}', Math.floor(Math.random() * 20 + 10))
                .replace('{trend}', trends[Math.floor(Math.random() * trends.length)])
                .replace('{company}', companies[Math.floor(Math.random() * companies.length)]);
            
            articles.push({
                title,
                description: `${title}에 대한 상세 내용입니다. 시장 전문가들은 이번 발표가 업계에 큰 영향을 미칠 것으로 예상하고 있습니다.`,
                url: `https://mock-news.kimhunter.bot/article/${Date.now()}-${i}`,
                source: '김헌터 경제신문',
                publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
                image: null,
                content: null
            });
        }
        
        return {
            articles,
            totalResults: articles.length,
            mock: true
        };
    }
    
    // 게임 관련 뉴스 생성 (주식 시스템용)
    async generateGameNews(companies) {
        const newsTypes = [
            {
                type: 'positive',
                templates: [
                    '{company}, 신제품 출시로 매출 급증 예상',
                    '{company}, 해외 시장 진출 성공',
                    '{company}, 대규모 투자 유치 성공',
                    '{company}, 혁신 기술 개발로 업계 선도'
                ],
                impact: { min: 5, max: 15 }
            },
            {
                type: 'negative',
                templates: [
                    '{company}, 제품 리콜로 주가 하락',
                    '{company}, 경영진 교체 소식에 시장 불안',
                    '{company}, 실적 부진으로 투자자 이탈',
                    '{company}, 보안 사고로 신뢰도 하락'
                ],
                impact: { min: -15, max: -5 }
            },
            {
                type: 'neutral',
                templates: [
                    '{company}, 신규 파트너십 체결',
                    '{company}, 조직 개편 단행',
                    '{company}, 새로운 마케팅 전략 발표',
                    '{company}, 업계 컨퍼런스 참가'
                ],
                impact: { min: -3, max: 3 }
            }
        ];
        
        const selectedCompany = companies[Math.floor(Math.random() * companies.length)];
        const newsType = newsTypes[Math.floor(Math.random() * newsTypes.length)];
        const template = newsType.templates[Math.floor(Math.random() * newsType.templates.length)];
        
        const title = template.replace('{company}', selectedCompany.name);
        const impact = Math.random() * (newsType.impact.max - newsType.impact.min) + newsType.impact.min;
        
        return {
            title,
            company: selectedCompany.id,
            type: newsType.type,
            impact: Math.round(impact * 10) / 10,
            timestamp: new Date(),
            source: '김헌터 증권 뉴스'
        };
    }
}

module.exports = new NewsAPI();