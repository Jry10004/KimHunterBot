// 관리자가 골드를 지급한 것으로 추정되는 유저 찾기
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function findGoldGifts() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');

        // 골드가 많은 상위 유저들 찾기 (관리자 지급 가능성 높음)
        const richUsers = await User.find({
            gold: { $gte: 10000000 } // 1천만 골드 이상
        })
        .select('discordId nickname gold level lastDaily createdAt')
        .sort({ gold: -1 })
        .limit(50);

        console.log('\n=== 고액 골드 보유 유저 목록 ===');
        console.log('(관리자 지급 가능성이 있는 유저들)\n');

        richUsers.forEach((user, index) => {
            const dailyPlays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000));
            const avgGoldPerDay = user.gold / (dailyPlays || 1);
            
            console.log(`${index + 1}. ${user.nickname || user.discordId}`);
            console.log(`   골드: ${user.gold.toLocaleString()}G`);
            console.log(`   레벨: ${user.level}`);
            console.log(`   계정 생성일: ${new Date(user.createdAt).toLocaleDateString()}`);
            console.log(`   일평균 골드: ${Math.floor(avgGoldPerDay).toLocaleString()}G`);
            
            // 일평균 골드가 비정상적으로 높으면 관리자 지급 가능성
            if (avgGoldPerDay > 5000000) {
                console.log(`   ⚠️ 관리자 지급 가능성 높음`);
            }
            console.log('');
        });

        // 레벨 대비 골드가 많은 유저 찾기
        console.log('\n=== 레벨 대비 골드가 많은 유저 ===');
        const suspiciousUsers = await User.find({
            level: { $lte: 50 },
            gold: { $gte: 5000000 }
        })
        .select('discordId nickname gold level')
        .sort({ gold: -1 })
        .limit(20);

        suspiciousUsers.forEach((user, index) => {
            const goldPerLevel = Math.floor(user.gold / user.level);
            console.log(`${index + 1}. ${user.nickname || user.discordId}`);
            console.log(`   레벨: ${user.level}, 골드: ${user.gold.toLocaleString()}G`);
            console.log(`   레벨당 골드: ${goldPerLevel.toLocaleString()}G`);
            console.log('');
        });

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

// 스크립트 실행
findGoldGifts();