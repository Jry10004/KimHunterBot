// 뉴스 채널 문제 해결 스크립트
require('dotenv').config();
const mongoose = require('mongoose');
const newsSystem = require('../systems/newsSystem');

async function fixNewsChannel() {
    console.log('=== 뉴스 채널 문제 해결 스크립트 ===\n');
    
    // 1. 현재 뉴스 시스템 상태 확인
    console.log('1. 현재 뉴스 시스템 상태:');
    console.log('   - 초기화 여부:', newsSystem.isInitialized);
    console.log('   - 메모리 상의 채널 수:', newsSystem.newsChannels.size);
    console.log('   - 채널 ID들:', Array.from(newsSystem.newsChannels));
    
    // 2. 하드코딩된 채널 ID 추가
    const targetChannelId = '1389401523418693723';
    console.log('\n2. 타겟 채널 ID 추가:', targetChannelId);
    newsSystem.addNewsChannel(targetChannelId);
    console.log('   - 추가 후 채널 수:', newsSystem.newsChannels.size);
    
    // 3. 데이터베이스 연결 및 설정 저장
    try {
        await mongoose.connect(process.env.DB_URI || 'mongodb://localhost:27017/kim-hunter');
        console.log('\n3. 데이터베이스 연결 성공');
        
        const ServerSettings = require('../models/ServerSettings');
        
        // 기존 설정 확인
        const existingSettings = await ServerSettings.find({});
        console.log('   - 기존 서버 설정 수:', existingSettings.length);
        
        // 뉴스 채널이 설정된 서버 찾기
        for (const setting of existingSettings) {
            if (setting.newsChannelId) {
                console.log(`   - 서버 ${setting.guildId}: 뉴스 채널 ${setting.newsChannelId}`);
                // 메모리에 추가
                newsSystem.addNewsChannel(setting.newsChannelId);
            }
        }
        
        console.log('\n4. 최종 상태:');
        console.log('   - 총 뉴스 채널 수:', newsSystem.newsChannels.size);
        console.log('   - 모든 채널 ID:', Array.from(newsSystem.newsChannels));
        
        await mongoose.disconnect();
        console.log('\n✅ 수정 완료!');
        
    } catch (error) {
        console.error('\n❌ 데이터베이스 오류:', error.message);
    }
    
    // 5. 테스트 뉴스 생성
    console.log('\n5. 테스트 뉴스 생성:');
    const testNews = newsSystem.createNews('enhancement_success', {
        player: '테스트유저',
        item: '테스트검',
        level: 15
    });
    
    if (testNews) {
        console.log('   - 뉴스 생성 성공:', testNews.content);
        console.log('   - 속보 여부:', testNews.isBreaking);
    } else {
        console.log('   - 뉴스 생성 실패');
    }
    
    console.log('\n=== 스크립트 완료 ===');
    console.log('\n💡 추천 사항:');
    console.log('1. 봇을 재시작하여 뉴스 시스템이 제대로 초기화되는지 확인');
    console.log('2. /뉴스채널확인 명령어로 상태 확인');
    console.log('3. /뉴스테스트 명령어로 뉴스 발송 테스트');
}

// 스크립트 실행
fixNewsChannel().catch(console.error);