// 🌐 외부 뉴스 API 어댑터 - 실제 뉴스를 게임 뉴스로 변환
const axios = require('axios');
const { COMPANIES, SECTORS } = require('../data/companiesData');

class ExternalNewsAdapter {
    constructor() {
        this.newsApiKey = process.env.NEWS_API_KEY || '6b6825dcd5174fff86fe809d1a39b364';
        this.lastFetchTime = 0;
        this.cachedNews = [];
        this.cacheTimeout = 720 * 60 * 1000; // 720분(12시간) 캐시 (API 제한 회피)
    }

    // 실제 기업명을 게임 기업명으로 변환 (companiesData.js와 매칭)
    companyNameMap = {
        // 기술/전자
        '삼성': ['헌터 테크놀로지', 'HTK'],
        'LG': ['마법 공학 연구소', 'MEL'],
        '애플': ['픽셀 게임즈', 'PXG'],
        'SK': ['마나 에너지', 'MNE'],
        '카카오': ['김헌터 엔터테인먼트', 'KHE'],
        '네이버': ['포털 마법진', 'PRT'],
        
        // 금융
        '국민은행': ['헌터 은행', 'HBK'],
        'KB': ['헌터 은행', 'HBK'],
        '신한': ['길드 증권', 'GSC'],
        '하나': ['모험가 금융', 'AFG'],
        '우리': ['헌터 은행', 'HBK'],
        
        // 엔터테인먼트
        'SM': ['드래곤 픽처스', 'DRP'],
        'JYP': ['매직 스튜디오', 'MGS'],
        'YG': ['헌터 방송국', 'HBC'],
        'HYBE': ['헌터 방송국', 'HBC'],
        '하이브': ['헌터 방송국', 'HBC'],
        'CJ': ['드래곤 픽처스', 'DRP'],
        
        // 유통/서비스
        '쿠팡': ['드래곤 배송', 'DDS'],
        '이마트': ['왕국 마트', 'KMT'],
        '롯데': ['왕국 마트', 'KMT'],
        'GS': ['왕국 마트', 'KMT'],
        '신세계': ['왕국 마트', 'KMT'],
        
        // 제조업
        '현대': ['드워프 자동차', 'DWC'],
        '기아': ['드워프 자동차', 'DWC'],
        '포스코': ['아이언 골렘 제철', 'IGS'],
        'LG화학': ['연금술사 길드', 'ALC'],
        '한화': ['폭탄 제조 길드', 'EMC'],
        
        // 게임사
        '넥슨': ['김헌터 엔터테인먼트', 'KHE'],
        '엔씨': ['픽셀 게임즈', 'PXG'],
        'NC': ['픽셀 게임즈', 'PXG'],
        '넷마블': ['매직 스튜디오', 'MGS'],
        
        // 지역명
        '서울': '왕도',
        '부산': '항구도시',
        '대구': '상업도시',
        '인천': '무역도시',
        '광주': '마법도시',
        '대전': '학술도시',
        '울산': '공업도시',
        '세종': '행정도시',
        '한국': '김헌터 왕국',
        '미국': '서부 대륙',
        '중국': '동부 제국',
        '일본': '섬나라 연합',
        '유럽': '북부 연합국'
    };

    // 실제 이름을 게임 캐릭터로 변환
    personNameMap = {
        // 정치인 -> NPC
        '대통령': '길드마스터',
        '총리': '부길드마스터',
        '장관': '길드임원',
        '의원': '길드의원',
        '시장': '도시장',
        
        // 연예인 카테고리 -> 직업
        '가수': '음유시인',
        '배우': '연극배우',
        '개그맨': '광대',
        '아이돌': '무희',
        'MC': '사회자',
        'PD': '연출가',
        '감독': '감독',
        '작가': '이야기꾼',
        
        // 스포츠 -> 게임
        '축구': '몬스터볼',
        '야구': '마법구',
        '농구': '공중구',
        '골프': '정밀타격',
        '테니스': '라켓술',
        
        // 직업 -> 게임 직업
        'CEO': '길드장',
        '회장': '대길드장',
        '사장': '길드장',
        '부장': '파티장',
        '과장': '분대장',
        '대리': '부분대장',
        '사원': '길드원',
        '교수': '현자',
        '의사': '힐러',
        '변호사': '변론사',
        '검사': '검사관',
        '판사': '심판관'
    };

    // 텍스트 변환
    transformText(text, players = []) {
        let transformed = text;
        let matchedCompany = null;
        let companyId = null;
        
        // 기업명 변환 (배열 형태로 변경됨)
        Object.entries(this.companyNameMap).forEach(([real, gameData]) => {
            if (Array.isArray(gameData)) {
                const [gameName, gameId] = gameData;
                const regex = new RegExp(real, 'gi');
                if (text.match(regex)) {
                    transformed = transformed.replace(regex, gameName);
                    matchedCompany = gameName;
                    companyId = gameId;
                }
            } else {
                // 단순 문자열인 경우 (지역명 등)
                const regex = new RegExp(real, 'gi');
                transformed = transformed.replace(regex, gameData);
            }
        });
        
        // 인물/직업 변환
        Object.entries(this.personNameMap).forEach(([real, game]) => {
            const regex = new RegExp(real, 'gi');
            transformed = transformed.replace(regex, game);
        });
        
        // 통화 단위 변환
        transformed = transformed.replace(/원|₩|KRW/gi, 'G');
        transformed = transformed.replace(/달러|\$|USD/gi, '골드');
        transformed = transformed.replace(/엔|¥|JPY/gi, '실버');
        transformed = transformed.replace(/위안|元|CNY/gi, '동전');
        
        // 숫자 단위 변환 (억, 조 등)
        transformed = transformed.replace(/(\d+)조\s*원/g, (match, num) => `${num * 10000}억G`);
        transformed = transformed.replace(/(\d+)억\s*원/g, (match, num) => `${num}억G`);
        transformed = transformed.replace(/(\d+)만\s*원/g, (match, num) => `${num}만G`);
        transformed = transformed.replace(/(\d+)조/g, (match, num) => `${num}0000억`);
        transformed = transformed.replace(/(\d+)억/g, (match, num) => `${num}억G`);
        transformed = transformed.replace(/(\d+)만/g, (match, num) => `${num}만G`);
        
        // 랜덤하게 실제 플레이어 이름 삽입 (30% 확률)
        if (players.length > 0 && Math.random() < 0.3) {
            const randomPlayer = players[Math.floor(Math.random() * players.length)];
            const playerName = randomPlayer.nickname || randomPlayer.username || '모험가';
            // 일반적인 이름 패턴을 플레이어 이름으로 교체
            transformed = transformed.replace(
                /[가-힣]{2,3}(?=씨|님|이|가|은|는|을|를|의|과|와)/,
                playerName
            );
        }
        
        return { transformed, matchedCompany, companyId };
    }

    // 외부 뉴스 가져오기 (NewsAPI 사용 예시)
    async fetchExternalNews() {
        // API 키가 없으면 샘플 뉴스 반환
        if (!this.newsApiKey) {
            return this.getSampleNews();
        }

        // 캐시 확인
        if (Date.now() - this.lastFetchTime < this.cacheTimeout) {
            return this.cachedNews;
        }

        try {
            const response = await axios.get('https://newsapi.org/v2/top-headlines', {
                params: {
                    country: 'kr',
                    apiKey: this.newsApiKey,
                    pageSize: 10
                }
            });

            if (response.data.articles) {
                this.cachedNews = response.data.articles.map(article => ({
                    title: article.title,
                    description: article.description,
                    source: article.source.name,
                    publishedAt: article.publishedAt
                }));
                this.lastFetchTime = Date.now();
                return this.cachedNews;
            }
        } catch (error) {
            console.error('외부 뉴스 API 오류:', error.message);
            // 429 오류(요청 제한)일 경우 더 긴 캐시 시간 설정
            if (error.response && error.response.status === 429) {
                this.cacheTimeout = 1440 * 60 * 1000; // 24시간으로 늘림
                console.log('⚠️ API 요청 제한 도달 - 캐시 시간을 24시간으로 연장');
                // 캐시된 뉴스가 있으면 그대로 사용
                if (this.cachedNews.length > 0) {
                    return this.cachedNews;
                }
            }
        }

        return this.getSampleNews();
    }

    // 샘플 뉴스 (API 없을 때)
    getSampleNews() {
        return [
            {
                title: '삼성전자, 신제품 발표로 주가 상승',
                description: '삼성전자가 혁신적인 신제품을 발표하며 주가가 5% 상승했다.',
                category: 'business'
            },
            {
                title: '유명 가수 A씨, 깜짝 결혼 발표',
                description: '톱스타 A씨가 일반인과의 결혼 소식을 전해 팬들을 놀라게 했다.',
                category: 'entertainment'
            },
            {
                title: '코스피 3000 돌파, 역대 최고치 경신',
                description: '한국 증시가 호황을 맞아 코스피 지수가 3000을 돌파했다.',
                category: 'economy'
            },
            {
                title: '프로야구 한국시리즈 우승팀 결정',
                description: 'LG 트윈스가 10년 만에 한국시리즈 우승을 차지했다.',
                category: 'sports'
            },
            {
                title: '서울시, 새로운 교통 정책 발표',
                description: '서울시가 대중교통 요금 인상과 함께 새로운 교통카드 시스템을 도입한다.',
                category: 'social'
            }
        ];
    }

    // 외부 뉴스를 게임 뉴스로 변환
    async convertToGameNews(players = []) {
        const externalNews = await this.fetchExternalNews();
        const gameNews = [];

        for (const news of externalNews) {
            const { transformed: transformedTitle, matchedCompany, companyId } = 
                this.transformText(news.title, players);
            const { transformed: transformedDesc } = news.description ? 
                this.transformText(news.description, players) : { transformed: '' };

            // 매칭된 기업이 없으면 랜덤 기업 선택
            let targetCompany = matchedCompany;
            let targetCompanyId = companyId;
            
            if (!targetCompany) {
                const companies = Object.values(COMPANIES);
                const randomCompany = companies[Math.floor(Math.random() * companies.length)];
                targetCompany = randomCompany.name;
                targetCompanyId = randomCompany.id;
            }

            // 감정 분석
            const sentiment = this.analyzeSentiment(news.title + ' ' + (news.description || ''));
            
            // 카테고리별 시장 영향 결정
            let impact = {
                companies: [targetCompanyId],
                impact: 0
            };
            
            if (news.category === 'business' || news.category === 'economy') {
                impact.impact = (Math.random() - 0.5) * 0.15; // -7.5% ~ +7.5%
                if (sentiment > 0) {
                    impact.impact = Math.abs(impact.impact) * 1.5; // 긍정적이면 더 큰 상승
                } else if (sentiment < 0) {
                    impact.impact = -Math.abs(impact.impact) * 1.5; // 부정적이면 더 큰 하락
                }
            } else if (news.category === 'entertainment') {
                impact.impact = (Math.random() - 0.5) * 0.10; // -5% ~ +5%
            } else {
                impact.impact = (Math.random() - 0.5) * 0.05; // -2.5% ~ +2.5%
            }

            // 영향도 제한
            impact.impact = Math.max(-0.20, Math.min(0.20, impact.impact));

            gameNews.push({
                content: `📰 [실시간] ${transformedTitle}`,
                description: transformedDesc,
                company: targetCompany,
                companyId: targetCompanyId,
                category: this.mapCategory(news.category),
                impact: impact,
                source: 'real_news',
                timestamp: Date.now()
            });
        }

        return gameNews;
    }

    // 감정 분석 (간단한 키워드 기반)
    analyzeSentiment(text) {
        const positiveWords = [
            '성장', '상승', '증가', '호황', '성공', '달성', '신기록', '혁신', '개선', '회복',
            '흑자', '수익', '이익', '승리', '돌파', '최고', '호조', '상장', '확대', '강세',
            '급등', '상승세', '긍정적', '호평', '대박'
        ];
        const negativeWords = [
            '하락', '감소', '위기', '손실', '적자', '실패', '우려', '논란', '사고', '문제',
            '리콜', '파업', '중단', '지연', '폭락', '파산', '침체', '악화', '약세', '철수',
            '급락', '하락세', '부정적', '비판', '쪽박'
        ];
        
        let score = 0;
        
        positiveWords.forEach(word => {
            if (text.includes(word)) score += 1;
        });
        
        negativeWords.forEach(word => {
            if (text.includes(word)) score -= 1;
        });
        
        return score;
    }

    // 카테고리 매핑
    mapCategory(externalCategory) {
        const categoryMap = {
            'business': 'ECONOMY',
            'entertainment': 'ENTERTAINMENT',
            'sports': 'SPORTS',
            'technology': 'SPECIAL',
            'economy': 'ECONOMY',
            'politics': 'GUILD',
            'social': 'SOCIAL'
        };
        return categoryMap[externalCategory] || 'SPECIAL';
    }
}

// 싱글톤 인스턴스
const externalNewsAdapter = new ExternalNewsAdapter();

module.exports = externalNewsAdapter;