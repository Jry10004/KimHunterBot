// 📈 실제 주식 시장 동기화 시스템
const axios = require('axios');
const { updateCompanyPrice, getCompanyById } = require('../data/companiesData');
const newsSystem = require('./newsSystem');

class RealStockSync {
    constructor() {
        this.apiKey = process.env.NEWS_API_KEY;
        this.syncInterval = null;
        this.lastSyncTime = 0;
        this.priceMultiplier = 3; // 실제 변동률의 3배
        
        // 실제 기업과 게임 기업 매핑
        this.companyMapping = {
            // 한국 대기업
            '삼성전자': { gameId: 'SSE', name: '김헌터전자' },
            '삼성': { gameId: 'SSE', name: '김헌터전자' },
            'SK하이닉스': { gameId: 'HHX', name: '헌터하이닉스' },
            'LG전자': { gameId: 'LGE', name: '엘지헌터' },
            'LG': { gameId: 'LGE', name: '엘지헌터' },
            '현대차': { gameId: 'HMC', name: '헌터모터스' },
            '현대자동차': { gameId: 'HMC', name: '헌터모터스' },
            '기아': { gameId: 'KIA', name: '기아헌터' },
            '카카오': { gameId: 'KKO', name: '김헌터톡' },
            '네이버': { gameId: 'NVR', name: '헌터포털' },
            'NAVER': { gameId: 'NVR', name: '헌터포털' },
            '쿠팡': { gameId: 'CPG', name: '헌터마켓' },
            '배달의민족': { gameId: 'BMJ', name: '배달의헌터' },
            '토스': { gameId: 'TSS', name: '헌터페이' },
            'NC소프트': { gameId: 'NCS', name: '헌터소프트' },
            '넥슨': { gameId: 'NXN', name: '헌터게임즈' },
            '카카오게임즈': { gameId: 'KGM', name: '김헌터게임즈' },
            
            // 금융
            'KB금융': { gameId: 'KBF', name: '헌터금융' },
            '신한금융': { gameId: 'SHF', name: '신한헌터' },
            '하나금융': { gameId: 'HNF', name: '하나헌터' },
            '삼성증권': { gameId: 'SSS', name: '김헌터증권' },
            '미래에셋': { gameId: 'MAS', name: '미래헌터' },
            
            // 엔터테인먼트
            'SM': { gameId: 'SME', name: '헌터엔터' },
            'JYP': { gameId: 'JYP', name: '제이헌터' },
            'YG': { gameId: 'YGE', name: '와이헌터' },
            'HYBE': { gameId: 'HYB', name: '하이브헌터' },
            'CJ ENM': { gameId: 'CJE', name: '씨제이헌터' },
            
            // 미국 기업 (한국 뉴스에 자주 나오는)
            '애플': { gameId: 'APL', name: '사과컴퍼니' },
            'Apple': { gameId: 'APL', name: '사과컴퍼니' },
            '테슬라': { gameId: 'TSL', name: '헌터카' },
            'Tesla': { gameId: 'TSL', name: '헌터카' },
            '구글': { gameId: 'GGL', name: '헌터서치' },
            'Google': { gameId: 'GGL', name: '헌터서치' },
            '아마존': { gameId: 'AMZ', name: '헌터존' },
            'Amazon': { gameId: 'AMZ', name: '헌터존' },
            '마이크로소프트': { gameId: 'MSF', name: '마이크로헌터' },
            'Microsoft': { gameId: 'MSF', name: '마이크로헌터' },
            '메타': { gameId: 'MTA', name: '메타헌터' },
            'Meta': { gameId: 'MTA', name: '메타헌터' },
            
            // 가상화폐 (주식처럼 취급)
            '비트코인': { gameId: 'BTC', name: '헌터코인' },
            'Bitcoin': { gameId: 'BTC', name: '헌터코인' },
            '이더리움': { gameId: 'ETH', name: '마나리움' },
            'Ethereum': { gameId: 'ETH', name: '마나리움' },
            '리플': { gameId: 'XRP', name: '리플헌터' },
            'Ripple': { gameId: 'XRP', name: '리플헌터' }
        };
        
        // 섹터 키워드 매핑
        this.sectorKeywords = {
            technology: ['전자', '반도체', 'IT', '소프트웨어', '게임', '인터넷', '플랫폼', '테크'],
            finance: ['금융', '은행', '증권', '보험', '카드', '핀테크'],
            entertainment: ['엔터', '연예', '음악', '드라마', '영화', '콘텐츠'],
            automotive: ['자동차', '전기차', '모빌리티', '배터리'],
            retail: ['유통', '쇼핑', '이커머스', '배달', '마켓'],
            crypto: ['가상화폐', '암호화폐', '코인', '블록체인', 'NFT']
        };
    }

    // 뉴스에서 주식 관련 정보 추출
    extractStockInfo(newsArticle) {
        const { title, description, content } = newsArticle;
        const fullText = `${title} ${description || ''} ${content || ''}`;
        
        const stockInfo = [];
        
        // 기업명 찾기
        for (const [realName, gameCompany] of Object.entries(this.companyMapping)) {
            if (fullText.includes(realName)) {
                // 변동률 추출 시도
                const changePattern = new RegExp(`${realName}.*?(\\d+\\.?\\d*)%`, 'i');
                const match = fullText.match(changePattern);
                
                let change = 0;
                if (match) {
                    change = parseFloat(match[1]);
                    // 상승/하락 키워드 확인
                    const contextPattern = new RegExp(`${realName}.{0,50}(상승|올라|증가|급등|폭등|하락|내려|감소|급락|폭락)`, 'i');
                    const contextMatch = fullText.match(contextPattern);
                    if (contextMatch && ['하락', '내려', '감소', '급락', '폭락'].includes(contextMatch[1])) {
                        change = -change;
                    }
                } else {
                    // 변동률이 없으면 키워드로 추정
                    if (fullText.includes('급등') || fullText.includes('폭등')) change = 5;
                    else if (fullText.includes('상승') || fullText.includes('올라')) change = 2;
                    else if (fullText.includes('급락') || fullText.includes('폭락')) change = -5;
                    else if (fullText.includes('하락') || fullText.includes('내려')) change = -2;
                }
                
                if (change !== 0) {
                    stockInfo.push({
                        gameId: gameCompany.gameId,
                        gameName: gameCompany.name,
                        realName: realName,
                        change: change * this.priceMultiplier // 3배 적용
                    });
                }
            }
        }
        
        // 섹터 영향 분석
        const affectedSectors = [];
        for (const [sector, keywords] of Object.entries(this.sectorKeywords)) {
            if (keywords.some(keyword => fullText.includes(keyword))) {
                affectedSectors.push(sector);
            }
        }
        
        return { stockInfo, affectedSectors };
    }

    // 뉴스 API에서 다양한 카테고리 뉴스 가져오기
    async fetchBusinessNews() {
        if (!this.apiKey) return [];

        try {
            const allArticles = [];
            
            // 비즈니스 뉴스
            const businessResponse = await axios.get('https://newsapi.org/v2/top-headlines', {
                params: {
                    country: 'kr',
                    category: 'business',
                    apiKey: this.apiKey,
                    pageSize: 10
                }
            });
            
            if (businessResponse.data.articles) {
                allArticles.push(...businessResponse.data.articles);
            }
            
            // 일반 뉴스 (범죄, 스캔들, 사건사고 포함)
            const generalResponse = await axios.get('https://newsapi.org/v2/top-headlines', {
                params: {
                    country: 'kr',
                    category: 'general',
                    apiKey: this.apiKey,
                    pageSize: 5
                }
            });
            
            if (generalResponse.data.articles) {
                allArticles.push(...generalResponse.data.articles);
            }
            
            // 엔터테인먼트 뉴스
            const entertainmentResponse = await axios.get('https://newsapi.org/v2/top-headlines', {
                params: {
                    country: 'kr',
                    category: 'entertainment',
                    apiKey: this.apiKey,
                    pageSize: 5
                }
            });
            
            if (entertainmentResponse.data.articles) {
                allArticles.push(...entertainmentResponse.data.articles);
            }

            return allArticles;
        } catch (error) {
            console.error('비즈니스 뉴스 가져오기 실패:', error.message);
        }

        return [];
    }

    // 주식 시장 동기화
    async syncStockMarket() {
        const news = await this.fetchBusinessNews();
        const processedCompanies = new Set();
        const marketImpacts = [];

        for (const article of news) {
            const { stockInfo, affectedSectors } = this.extractStockInfo(article);
            
            // 게임 뉴스로 변환
            const gameNews = this.convertToGameNews(article, stockInfo);
            
            // 카테고리별 뉴스 처리
            let newsType = 'market_update';
            switch(gameNews.category) {
                case 'CRIME':
                    newsType = 'corporate_scandal';
                    break;
                case 'SCANDAL':
                    newsType = 'breaking_news';
                    break;
                case 'ACCIDENT':
                    newsType = 'emergency_news';
                    break;
                case 'ENTERTAINMENT':
                    newsType = 'entertainment_news';
                    break;
            }
            
            // 뉴스 시스템에 전달
            if (newsSystem) {
                newsSystem.addNews(newsType, {
                    title: gameNews.title,
                    content: gameNews.content,
                    category: gameNews.category
                });
                
                console.log(`📰 [${gameNews.category}] ${gameNews.title}`);
            }
            
            // 주식 시장 영향 처리 (시장 관련 뉴스만)
            if (stockInfo.length > 0) {
                // 개별 기업 주가 업데이트
                for (const stock of stockInfo) {
                    if (!processedCompanies.has(stock.gameId)) {
                        processedCompanies.add(stock.gameId);
                        
                        // 주가 변동 적용
                        const changeRate = stock.change / 100;
                        updateCompanyPrice(stock.gameId, changeRate);
                        
                        marketImpacts.push({
                            company: stock.gameName,
                            realCompany: stock.realName,
                            change: stock.change,
                            newsTitle: article.title
                        });
                        
                        console.log(`📈 ${stock.gameName} (${stock.realName}) 주가 ${stock.change > 0 ? '상승' : '하락'}: ${stock.change}%`);
                    }
                }
            }
            
            // 섹터 전체 영향 (작은 변동)
            for (const sector of affectedSectors) {
                const sectorChange = (Math.random() - 0.5) * 0.02 * this.priceMultiplier; // ±3%
                marketImpacts.push({
                    sector: sector,
                    change: sectorChange * 100,
                    newsTitle: article.title
                });
            }
        }

        return marketImpacts;
    }

    // 동기화 시작
    start() {
        if (!this.apiKey) {
            console.log('📈 실시간 주식 동기화: API 키가 없어 비활성화됨');
            return;
        }

        // 즉시 한번 실행
        this.syncStockMarket();

        // 10분마다 동기화 (NewsAPI 무료 플랜 제한 고려)
        this.syncInterval = setInterval(() => {
            this.syncStockMarket();
        }, 10 * 60 * 1000);

        console.log('📈 실시간 주식 동기화 시작 (10분 간격)');
    }

    // 동기화 중지
    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        console.log('📈 실시간 주식 동기화 중지');
    }

    // 실시간 뉴스를 게임 뉴스로 변환
    convertToGameNews(article, stockInfo) {
        let gameTitle = article.title;
        let gameContent = article.description || '';

        // 기업명 변환
        for (const [realName, gameCompany] of Object.entries(this.companyMapping)) {
            const regex = new RegExp(realName, 'gi');
            gameTitle = gameTitle.replace(regex, gameCompany.name);
            gameContent = gameContent.replace(regex, gameCompany.name);
        }

        // 추가 변환
        gameTitle = gameTitle.replace(/원|₩/g, 'G');
        gameContent = gameContent.replace(/원|₩/g, 'G');
        
        // 뉴스 카테고리 분류
        let category = 'MARKET'; // 기본값
        const lowerTitle = gameTitle.toLowerCase();
        const lowerContent = gameContent.toLowerCase();
        const fullText = lowerTitle + ' ' + lowerContent;
        
        // 카테고리 키워드 매칭
        if (fullText.includes('범죄') || fullText.includes('구속') || fullText.includes('횡령') || 
            fullText.includes('사기') || fullText.includes('검찰') || fullText.includes('경찰')) {
            category = 'CRIME';
        } else if (fullText.includes('스캔들') || fullText.includes('논란') || fullText.includes('파문') ||
                   fullText.includes('불륜') || fullText.includes('폭로')) {
            category = 'SCANDAL';
        } else if (fullText.includes('사고') || fullText.includes('화재') || fullText.includes('폭발') ||
                   fullText.includes('충돌') || fullText.includes('재해')) {
            category = 'ACCIDENT';
        } else if (fullText.includes('연예') || fullText.includes('가수') || fullText.includes('배우') ||
                   fullText.includes('아이돌') || fullText.includes('드라마')) {
            category = 'ENTERTAINMENT';
        }

        return {
            title: gameTitle,
            content: gameContent,
            originalTitle: article.title,
            stockImpacts: stockInfo,
            category: category
        };
    }
}

// 싱글톤 인스턴스
const realStockSync = new RealStockSync();

module.exports = realStockSync;