// 뉴스 시스템 디버그 테스트
require('dotenv').config();
const mongoose = require('mongoose');
const { Client, GatewayIntentBits } = require('discord.js');

// 몽고DB 연결
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB 연결 성공'))
    .catch(err => console.error('❌ MongoDB 연결 실패:', err));

// Discord 클라이언트 생성
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// 뉴스 시스템 테스트
async function testNewsSystem() {
    console.log('🔍 뉴스 시스템 테스트 시작...\n');
    
    const newsSystem = require('../systems/newsSystem');
    
    // 1. 초기 상태 확인
    console.log('📋 뉴스 시스템 초기 상태:');
    console.log(`- 초기화 여부: ${newsSystem.isInitialized}`);
    console.log(`- 클라이언트 설정: ${newsSystem.client ? '있음' : '없음'}`);
    console.log(`- 뉴스 채널 수: ${newsSystem.newsChannels.size}`);
    console.log(`- 뉴스 채널 목록: ${Array.from(newsSystem.newsChannels).join(', ')}`);
    console.log('');
    
    // 2. 하드코딩된 채널 확인
    const hardcodedChannelId = '1389401523418693723';
    console.log(`📌 하드코딩된 채널 ID: ${hardcodedChannelId}`);
    console.log(`- 뉴스 채널에 포함됨: ${newsSystem.newsChannels.has(hardcodedChannelId)}`);
    console.log('');
    
    // 3. Discord 봇 로그인 및 채널 확인
    client.once('ready', async () => {
        console.log(`✅ Discord 봇 로그인 성공: ${client.user.tag}`);
        console.log('');
        
        // 4. 채널 접근 가능 여부 확인
        console.log('🔍 채널 접근 테스트:');
        try {
            const channel = await client.channels.fetch(hardcodedChannelId);
            if (channel) {
                console.log(`✅ 채널 발견: ${channel.name} (타입: ${channel.type})`);
                console.log(`- 서버: ${channel.guild.name}`);
                console.log(`- 메시지 전송 가능: ${channel.permissionsFor(client.user).has('SendMessages')}`);
                console.log(`- 임베드 전송 가능: ${channel.permissionsFor(client.user).has('EmbedLinks')}`);
                console.log(`- 채널 보기 가능: ${channel.permissionsFor(client.user).has('ViewChannel')}`);
            } else {
                console.log('❌ 채널을 찾을 수 없음');
            }
        } catch (error) {
            console.error(`❌ 채널 접근 오류: ${error.message}`);
            if (error.code === 50001) {
                console.log('-> 봇이 해당 채널에 접근 권한이 없습니다.');
            } else if (error.code === 10003) {
                console.log('-> 채널이 존재하지 않습니다.');
            }
        }
        console.log('');
        
        // 5. 뉴스 시스템 초기화 테스트
        console.log('🚀 뉴스 시스템 초기화 시도:');
        await newsSystem.start(client);
        
        console.log(`- 초기화 후 상태: ${newsSystem.isInitialized}`);
        console.log(`- 클라이언트 설정: ${newsSystem.client ? '있음' : '없음'}`);
        console.log(`- 뉴스 채널 수: ${newsSystem.newsChannels.size}`);
        console.log(`- 스케줄러 실행 중: ${newsSystem.scheduleInterval ? '예' : '아니오'}`);
        console.log(`- 가짜뉴스 생성기 실행 중: ${newsSystem.fakeNewsTimeout ? '예' : '아니오'}`);
        console.log('');
        
        // 6. 테스트 뉴스 생성
        console.log('📰 테스트 뉴스 생성:');
        const testNews = newsSystem.addNews('breaking_news', {
            title: '테스트 뉴스 - 뉴스 시스템 디버그 중',
            category: 'SPECIAL'
        });
        
        if (testNews) {
            console.log('✅ 뉴스 생성 성공:');
            console.log(`- ID: ${testNews.id}`);
            console.log(`- 내용: ${testNews.content}`);
            console.log(`- 카테고리: ${testNews.category}`);
            console.log(`- 속보 여부: ${testNews.isBreaking}`);
        } else {
            console.log('❌ 뉴스 생성 실패');
        }
        console.log('');
        
        // 7. 수동으로 속보 발송 테스트
        console.log('📢 수동 속보 발송 테스트:');
        const breakingNews = {
            id: Date.now().toString(),
            type: 'test',
            category: 'SPECIAL',
            content: '🧪 뉴스 시스템 테스트 중입니다. 이 메시지가 보이면 뉴스 시스템이 정상 작동 중입니다!',
            timestamp: new Date(),
            isBreaking: true
        };
        
        await newsSystem.publishBreakingNews(breakingNews);
        console.log('✅ 속보 발송 시도 완료');
        console.log('');
        
        // 8. 데이터베이스의 뉴스 채널 설정 확인
        console.log('💾 데이터베이스 설정 확인:');
        const ServerSettings = require('../models/ServerSettings');
        const settings = await ServerSettings.find({ newsChannelId: { $ne: null } });
        console.log(`- 뉴스 채널이 설정된 서버 수: ${settings.length}`);
        settings.forEach(setting => {
            console.log(`  - 서버 ID: ${setting.guildId}, 채널 ID: ${setting.newsChannelId}`);
        });
        console.log('');
        
        // 9. 가짜 뉴스 생성 테스트
        console.log('🎭 가짜 뉴스 생성 테스트:');
        const User = require('../models/User');
        const activeUsers = await User.find({ registered: true }).limit(10);
        console.log(`- 활성 유저 수: ${activeUsers.length}`);
        
        if (activeUsers.length >= 3) {
            const fakeNewsGenerator = require('../systems/fakeNewsGenerator');
            const fakeNews = fakeNewsGenerator.generateFakeNews(activeUsers);
            console.log('✅ 가짜 뉴스 생성 성공:');
            console.log(`- 내용: ${fakeNews.content}`);
            console.log(`- 심각도: ${fakeNews.severity}`);
        } else {
            console.log('❌ 가짜 뉴스 생성 실패: 활성 유저가 3명 미만');
        }
        
        console.log('\n🏁 테스트 완료');
        
        // 종료
        setTimeout(() => {
            newsSystem.stop();
            client.destroy();
            process.exit(0);
        }, 5000);
    });
    
    // Discord 봇 로그인
    client.login(process.env.DISCORD_TOKEN);
}

// 테스트 실행
testNewsSystem().catch(console.error);