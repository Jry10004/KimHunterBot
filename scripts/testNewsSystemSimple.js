// 뉴스 시스템 간단한 테스트 (Discord 연결 없이)
require('dotenv').config();

async function testNewsSystemSimple() {
    console.log('🔍 뉴스 시스템 간단한 테스트 시작...\n');
    
    const newsSystem = require('../systems/newsSystem');
    
    // 1. 초기 상태 확인
    console.log('📋 뉴스 시스템 초기 상태:');
    console.log(`- 초기화 여부: ${newsSystem.isInitialized}`);
    console.log(`- 클라이언트 설정: ${newsSystem.client ? '있음' : '없음'}`);
    console.log(`- 뉴스 채널 수: ${newsSystem.newsChannels.size}`);
    console.log(`- 뉴스 채널 목록: ${Array.from(newsSystem.newsChannels).join(', ')}`);
    console.log(`- 뉴스 큐 크기: ${newsSystem.newsQueue.length}`);
    console.log(`- 뉴스 히스토리 크기: ${newsSystem.newsHistory.length}`);
    console.log(`- 속보 큐 크기: ${newsSystem.breakingNews.length}`);
    console.log('');
    
    // 2. 하드코딩된 채널 확인
    const hardcodedChannelId = '1389401523418693723';
    console.log(`📌 하드코딩된 채널 ID: ${hardcodedChannelId}`);
    console.log(`- 뉴스 채널에 포함됨: ${newsSystem.newsChannels.has(hardcodedChannelId)}`);
    console.log('');
    
    // 3. 뉴스 생성 테스트 (클라이언트 없이)
    console.log('📰 뉴스 생성 테스트:');
    
    // 수동으로 채널 추가
    newsSystem.addNewsChannel(hardcodedChannelId);
    console.log(`- 채널 추가 후 뉴스 채널 수: ${newsSystem.newsChannels.size}`);
    
    // 다양한 타입의 뉴스 생성
    const newsTypes = [
        { type: 'enhancement_success', data: { player: '테스트유저', item: '전설의 검', level: 15 } },
        { type: 'legendary_drop', data: { player: '테스트유저2', location: '드래곤 던전', item: '용의 심장' } },
        { type: 'huge_transaction', data: { player: '테스트유저3', amount: 50000000 } },
        { type: 'breaking_news', data: { title: '긴급 속보 테스트' } }
    ];
    
    newsTypes.forEach(({ type, data }) => {
        const news = newsSystem.createNews(type, data);
        if (news) {
            console.log(`\n✅ ${type} 뉴스 생성 성공:`);
            console.log(`  - ID: ${news.id}`);
            console.log(`  - 내용: ${news.content}`);
            console.log(`  - 카테고리: ${news.category}`);
            console.log(`  - 속보 여부: ${news.isBreaking}`);
            console.log(`  - 시장 영향: ${news.marketImpact ? JSON.stringify(news.marketImpact) : '없음'}`);
        } else {
            console.log(`\n❌ ${type} 뉴스 생성 실패`);
        }
    });
    
    console.log('\n');
    
    // 4. 템플릿 확인
    console.log('📋 사용 가능한 뉴스 템플릿:');
    const templateCategories = {};
    Object.entries(newsSystem.NEWS_TEMPLATES).forEach(([key, template]) => {
        const category = template.category;
        if (!templateCategories[category]) {
            templateCategories[category] = [];
        }
        templateCategories[category].push(key);
    });
    
    Object.entries(templateCategories).forEach(([category, templates]) => {
        console.log(`\n${newsSystem.NEWS_CATEGORIES[category]?.emoji || '📰'} ${category}: ${templates.length}개`);
        templates.slice(0, 3).forEach(t => console.log(`  - ${t}`));
        if (templates.length > 3) console.log(`  ... 외 ${templates.length - 3}개`);
    });
    
    console.log('\n');
    
    // 5. 가짜 뉴스 생성기 테스트
    console.log('🎭 가짜 뉴스 생성기 테스트:');
    const fakeNewsGenerator = require('../systems/fakeNewsGenerator');
    
    // 테스트용 가짜 유저 데이터
    const testUsers = [
        { nickname: '김헌터', _id: '1', level: 50 },
        { nickname: '드래곤슬레이어', _id: '2', level: 45 },
        { nickname: '마법사길드장', _id: '3', level: 60 },
        { nickname: '초보모험가', _id: '4', level: 10 },
        { nickname: '골드파머', _id: '5', level: 30 }
    ];
    
    // 가짜 뉴스 생성
    const fakeNews = fakeNewsGenerator.generateFakeNews(testUsers);
    console.log('\n생성된 가짜 뉴스:');
    console.log(`- 내용: ${fakeNews.content}`);
    console.log(`- 심각도: ${fakeNews.severity}`);
    console.log(`- 시장 영향: ${fakeNews.impact ? JSON.stringify(fakeNews.impact) : '없음'}`);
    
    // 여러 개 생성
    console.log('\n다중 가짜 뉴스 생성:');
    const multipleNews = fakeNewsGenerator.generateMultipleFakeNews(testUsers, 3);
    multipleNews.forEach((news, index) => {
        console.log(`\n${index + 1}. ${fakeNewsGenerator.getSeverityEmoji(news.severity)} ${news.content}`);
        console.log(`   - 심각도: ${news.severity}`);
    });
    
    console.log('\n');
    
    // 6. 스케줄 확인
    console.log('⏰ 정기 뉴스 스케줄:');
    Object.entries(newsSystem.SCHEDULED_NEWS).forEach(([time, schedule]) => {
        console.log(`\n${schedule.title} (${schedule.time}시)`);
        console.log(`세그먼트: ${schedule.segments.join(', ')}`);
    });
    
    console.log('\n\n🏁 테스트 완료');
}

// 테스트 실행
testNewsSystemSimple().catch(console.error);