const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../database/connection');

async function getRecentRegistrations() {
    try {
        await connectDB();
        console.log('데이터베이스 연결 완료');

        // 최근 30일 이내 가입한 사용자들 찾기 (가입일 기준 내림차순)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentUsers = await User.find({
            registered: true,
            createdAt: { $gte: thirtyDaysAgo }
        })
        .sort({ createdAt: -1 }) // 최신 가입자 먼저
        .select('email nickname discordId createdAt emailVerified')
        .limit(100); // 최대 100명

        console.log(`\n=== 최근 30일 이내 가입자 목록 (총 ${recentUsers.length}명) ===\n`);

        if (recentUsers.length === 0) {
            console.log('최근 가입한 사용자가 없습니다.');
        } else {
            console.log('가입일시 | 닉네임 | 이메일 | Discord ID | 이메일 인증');
            console.log('-'.repeat(100));
            
            recentUsers.forEach(user => {
                const date = user.createdAt ? 
                    new Date(user.createdAt).toLocaleString('ko-KR', { 
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : 
                    'N/A';
                const verified = user.emailVerified ? '✅' : '❌';
                
                console.log(`${date} | ${user.nickname || 'N/A'} | ${user.email || 'N/A'} | ${user.discordId} | ${verified}`);
            });
        }

        // 오늘 가입한 사용자 수
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayUsers = await User.countDocuments({
            registered: true,
            createdAt: { $gte: today }
        });

        console.log(`\n📊 통계:`);
        console.log(`- 오늘 가입자: ${todayUsers}명`);
        console.log(`- 최근 30일 가입자: ${recentUsers.length}명`);

        // 전체 등록 사용자 수
        const totalUsers = await User.countDocuments({ registered: true });
        console.log(`- 전체 등록 사용자: ${totalUsers}명`);

        process.exit(0);
    } catch (error) {
        console.error('오류 발생:', error);
        process.exit(1);
    }
}

getRecentRegistrations();