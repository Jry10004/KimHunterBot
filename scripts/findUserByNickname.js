require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function findUserByNickname() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kimhunter', {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        console.log('✅ MongoDB 연결 성공!');
        
        // nickname이 "요리"인 사용자 찾기
        const user = await User.findOne({ nickname: '요리' });
        
        if (user) {
            console.log('\n=== 사용자 정보 ===');
            console.log(`닉네임: ${user.nickname}`);
            console.log(`Discord ID: ${user.discordId}`);
            console.log(`가입일 (registeredAt): ${user.registeredAt || '등록되지 않음'}`);
            console.log(`계정 생성일 (createdAt): ${user.createdAt}`);
            console.log(`레벨: ${user.level}`);
            console.log(`골드: ${user.gold}`);
            console.log(`PVP 티어: ${user.pvpTier || user.pvp?.tier || 'Bronze'}`);
            console.log(`인기도: ${user.popularity}`);
            
            if (user.registered) {
                console.log(`\n✅ 정식으로 등록된 사용자입니다.`);
            } else {
                console.log(`\n❌ 아직 정식 등록을 하지 않은 사용자입니다.`);
            }
            
            // 추가 정보
            console.log('\n=== 추가 정보 ===');
            console.log(`성별: ${user.gender || '미설정'}`);
            console.log(`추천인: ${user.referral || '없음'}`);
            console.log(`이메일: ${user.email || '미등록'}`);
            console.log(`이메일 인증: ${user.emailVerified ? '완료' : '미완료'}`);
            
            // 최근 활동
            if (user.lastActivity) {
                console.log(`마지막 활동: ${user.lastActivity}`);
            }
            
            // 운동 시스템 정보
            if (user.fitness) {
                console.log('\n=== 운동 정보 ===');
                console.log(`피트니스 레벨: ${user.fitness.level}`);
                console.log(`총 운동 시간: ${user.fitness.totalExerciseTime}분`);
            }
            
            // 던전 정보
            if (user.dungeonProgress) {
                console.log('\n=== 던전 진행도 ===');
                console.log(`최고 도달 층: ${user.dungeonProgress.bestFloor}층`);
                console.log(`총 시도 횟수: ${user.dungeonProgress.totalAttempts}회`);
            }
            
        } else {
            console.log('\n❌ nickname이 "요리"인 사용자를 찾을 수 없습니다.');
            
            // 비슷한 닉네임 검색
            console.log('\n=== 비슷한 닉네임 검색 중... ===');
            const similarUsers = await User.find({
                nickname: { $regex: '요리', $options: 'i' }
            }).limit(10);
            
            if (similarUsers.length > 0) {
                console.log('\n다음과 같은 유사한 닉네임을 가진 사용자들을 찾았습니다:');
                similarUsers.forEach(u => {
                    console.log(`- ${u.nickname} (Discord ID: ${u.discordId})`);
                });
            } else {
                console.log('비슷한 닉네임도 찾을 수 없습니다.');
            }
        }
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        // MongoDB 연결 종료
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 스크립트 실행
findUserByNickname();