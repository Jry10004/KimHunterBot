// 🎭 가짜 뉴스 생성기 - 실사용자를 활용한 재미있는 뉴스
const { formatNumber } = require('../handlers/common/utils');

class FakeNewsGenerator {
    constructor() {
        this.lastGeneratedTime = 0;
        this.usedTemplates = new Set(); // 최근 사용한 템플릿 추적
        this.npcNames = [
            '김부장', '이사장', '박회장', '최대표', '정이사', '강전무', '조상무', '윤부사장',
            '한기자', '오PD', '서감독', '임작가', '유아나운서', '진MC', '배우진', '가수린',
            '황검사', '노판사', '문변호사', '권형사', '신탐정', '차교수', '백박사', '민연구원'
        ];
    }

    // 랜덤 NPC 이름 생성
    getRandomNPC() {
        return this.npcNames[Math.floor(Math.random() * this.npcNames.length)];
    }

    // 랜덤 금액 생성
    getRandomAmount() {
        const amounts = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
        const base = amounts[Math.floor(Math.random() * amounts.length)];
        const multiplier = Math.floor(Math.random() * 10) + 1;
        return base * multiplier;
    }

    // 뉴스 템플릿
    NEWS_TEMPLATES = {
        // 금융/경제 뉴스
        FINANCE: [
            {
                template: '{player}님, 헌터은행 {amount}G 횡령 혐의로 검찰 송치',
                impact: { companies: ['HBK'], sectors: ['finance'], change: -0.05 },
                severity: 'scandal'
            },
            {
                template: '{player}님, 김헌터증권에서 {amount}G 규모 내부자거래 의혹',
                impact: { companies: ['KHS'], sectors: ['finance'], change: -0.03 },
                severity: 'scandal'
            },
            {
                template: '{player}님, 익명으로 고아원에 {amount}G 기부... 나중에 밝혀져',
                impact: { sectors: ['special'], change: 0.02 },
                severity: 'heartwarming'
            },
            {
                template: '{npc} 회계사, "{player}님 탈세 정황 포착" 제보',
                impact: { sectors: ['finance'], change: -0.02 },
                severity: 'scandal'
            },
            {
                template: '{player}님, 가상화폐 투자로 {amount}G 손실... "인생 망했다" 한탄',
                impact: { companies: ['BCX'], change: -0.01 },
                severity: 'economy'
            },
            {
                template: '헌터은행, {player}님에게 {amount}G 대출 거부... "신용등급 문제"',
                impact: { companies: ['HBK'], change: 0.01 },
                severity: 'economy'
            }
        ],

        // 연예/스캔들 뉴스
        ENTERTAINMENT: [
            {
                template: '[단독] {player}님과 {npc} 배우, 비밀 데이트 포착!',
                impact: { sectors: ['entertainment'], change: 0.03 },
                severity: 'gossip'
            },
            {
                template: '{player}님, {npc} PD와 깜짝 결혼 발표... "이미 혼인신고 완료"',
                impact: { companies: ['KHE'], change: 0.05 },
                severity: 'celebration'
            },
            {
                template: '파파라치 포착! {player}님, 새벽 3시 {npc} 가수 집 앞에서 목격',
                impact: { sectors: ['entertainment'], change: 0.02 },
                severity: 'gossip'
            },
            {
                template: '{player}님 열애설에 {npc} 측 "사실무근... 그냥 게임 친구"',
                impact: { sectors: ['entertainment'], change: 0.01 },
                severity: 'gossip'
            },
            {
                template: '[속보] {player}님, 음주 후 길드 채팅방에서 {npc} 욕설... 스크린샷 유출',
                impact: { sectors: ['entertainment'], change: -0.02 },
                severity: 'scandal'
            },
            {
                template: '{player}님 "{npc} 아나운서와 곧 결혼" 실수로 방송 중 발언',
                impact: { companies: ['HBC'], change: 0.04 },
                severity: 'gossip'
            }
        ],

        // 범죄/사건 뉴스
        CRIME: [
            {
                template: '{player}님, 불법 도박장 운영 혐의로 긴급 체포',
                impact: { sectors: ['entertainment', 'gaming'], change: -0.04 },
                severity: 'crime'
            },
            {
                template: '심야 단속! {player}님 운영 불법 강화소에서 {npc} 등 10명 적발',
                impact: { sectors: ['manufacturing'], change: -0.03 },
                severity: 'crime'
            },
            {
                template: '{player}님, 게임 아이템 현금거래 사이트 운영... 수익 {amount}G',
                impact: { sectors: ['technology'], change: -0.02 },
                severity: 'crime'
            },
            {
                template: '[긴급] {player}님 집에서 희귀 몬스터 불법 사육 발각',
                impact: { companies: ['PRT'], change: -0.02 },
                severity: 'crime'
            },
            {
                template: '{npc} 판사, {player}님에게 벌금 {amount}G 선고... "반성 없어"',
                impact: { sectors: ['special'], change: -0.01 },
                severity: 'crime'
            }
        ],

        // 비즈니스/기업 뉴스
        BUSINESS: [
            {
                template: '{player}님, 김헌터전자 신임 CEO 내정... 업계 "파격 인사"',
                impact: { companies: ['KHE'], change: 0.08 },
                severity: 'business'
            },
            {
                template: '헌터마트, {player}님과 {amount}G 규모 독점 공급계약 체결',
                impact: { companies: ['HMT'], change: 0.04 },
                severity: 'business'
            },
            {
                template: '{player}님 스타트업, 벤처캐피탈로부터 {amount}G 투자 유치',
                impact: { sectors: ['technology'], change: 0.03 },
                severity: 'business'
            },
            {
                template: '[단독] {player}님, {npc} 회장과 골프장에서 비밀 회동',
                impact: { sectors: ['special'], change: 0.02 },
                severity: 'business'
            },
            {
                template: '길드파워社, {player}님을 새 홍보대사로 선정... "이미지 쇄신"',
                impact: { companies: ['GP'], change: 0.03 },
                severity: 'business'
            }
        ],

        // 사회/이슈 뉴스
        SOCIAL: [
            {
                template: '{player}님 실언 논란... "가난한 사람은 게으르다" SNS 파문',
                impact: { sectors: ['media'], change: -0.02 },
                severity: 'controversy'
            },
            {
                template: '[미담] {player}님, 몰래 {npc} 할머니 병원비 {amount}G 대납',
                impact: { sectors: ['healthcare'], change: 0.02 },
                severity: 'heartwarming'
            },
            {
                template: '{player}님 펫 학대 논란... 영상 속 "때리는 장면" 포착',
                impact: { companies: ['PRT'], change: -0.03 },
                severity: 'controversy'
            },
            {
                template: '시민단체, {player}님 고발... "공공장소에서 {npc}에게 폭언"',
                impact: { sectors: ['special'], change: -0.01 },
                severity: 'controversy'
            },
            {
                template: '{player}님, 장애인 시설에 게임 아이템 {amount}G어치 기부',
                impact: { sectors: ['special'], change: 0.03 },
                severity: 'heartwarming'
            }
        ],

        // 스포츠/게임 뉴스
        SPORTS: [
            {
                template: '[e스포츠] {player}님, 불법 프로그램 사용 적발... 계정 정지',
                impact: { sectors: ['gaming', 'entertainment'], change: -0.03 },
                severity: 'scandal'
            },
            {
                template: '{player}님, 길드 대항전에서 {npc} 팀에게 굴욕적 패배',
                impact: { companies: ['GDF'], change: -0.01 },
                severity: 'sports'
            },
            {
                template: '김헌터 리그, {player}님 영구 제명... "승부 조작 가담"',
                impact: { sectors: ['gaming'], change: -0.04 },
                severity: 'scandal'
            },
            {
                template: '[속보] {player}님, PVP 토너먼트 결승서 {npc}에게 역전승!',
                impact: { sectors: ['entertainment'], change: 0.02 },
                severity: 'sports'
            },
            {
                template: '{player}님 도핑 테스트 양성... "강화 물약 과다 복용"',
                impact: { sectors: ['healthcare'], change: -0.02 },
                severity: 'scandal'
            }
        ]
    };

    // 뉴스 생성
    generateFakeNews(players = [], specificCategories = null) {
        if (players.length === 0) return null;

        // 카테고리 선택
        let category;
        if (specificCategories && specificCategories.length > 0) {
            // 특정 카테고리에서만 선택
            const availableCategories = specificCategories.filter(cat => this.NEWS_TEMPLATES[cat]);
            if (availableCategories.length === 0) return null;
            category = availableCategories[Math.floor(Math.random() * availableCategories.length)];
        } else {
            // 모든 카테고리에서 랜덤 선택
            const categories = Object.keys(this.NEWS_TEMPLATES);
            category = categories[Math.floor(Math.random() * categories.length)];
        }
        
        const templates = this.NEWS_TEMPLATES[category];
        
        // 템플릿 랜덤 선택
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        // 플레이어 랜덤 선택
        const player = players[Math.floor(Math.random() * players.length)];
        
        // 데이터 치환
        const data = {
            player: player.nickname || player.username,
            npc: this.getRandomNPC(),
            amount: formatNumber(this.getRandomAmount())
        };
        
        // 뉴스 내용 생성
        let content = template.template;
        for (const [key, value] of Object.entries(data)) {
            content = content.replace(`{${key}}`, value);
        }
        
        return {
            content,
            category,
            severity: template.severity,
            impact: template.impact,
            player: player
        };
    }

    // 여러 개의 가짜 뉴스 생성
    generateMultipleFakeNews(players, count = 3) {
        const news = [];
        const usedPlayers = new Set();
        
        for (let i = 0; i < count && i < players.length; i++) {
            // 이미 사용한 플레이어 제외
            const availablePlayers = players.filter(p => !usedPlayers.has(p.discordId));
            if (availablePlayers.length === 0) break;
            
            const fakeNews = this.generateFakeNews(availablePlayers);
            if (fakeNews) {
                news.push(fakeNews);
                usedPlayers.add(fakeNews.player.discordId);
            }
        }
        
        return news;
    }

    // 뉴스 심각도에 따른 이모지
    getSeverityEmoji(severity) {
        const emojis = {
            scandal: '🚨',
            crime: '⚖️',
            gossip: '💬',
            controversy: '🔥',
            business: '💼',
            sports: '🏆',
            heartwarming: '💖',
            economy: '💰',
            celebration: '🎉'
        };
        return emojis[severity] || '📰';
    }
}

// 싱글톤 인스턴스
const fakeNewsGenerator = new FakeNewsGenerator();

module.exports = fakeNewsGenerator;