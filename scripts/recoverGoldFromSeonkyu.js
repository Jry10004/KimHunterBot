const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/discord-bot', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB 연결 성공!');
    recoverGold();
}).catch(err => {
    console.error('MongoDB 연결 실패:', err);
    process.exit(1);
});

async function recoverGold() {
    try {
        console.log('========== 선규 유저 골드 회수 작업 시작 ==========');
        console.log(`회수할 골드: 190,000,000 골드`);
        console.log('');
        
        // 1. nickname에 '선규'가 포함된 유저 검색
        const users = await User.find({
            $or: [
                { nickname: { $regex: '선규', $options: 'i' } },
                { nickname: { $regex: 'seonkyu', $options: 'i' } },
                { nickname: { $regex: 'sungyoo', $options: 'i' } },
                { nickname: { $regex: 'sungyu', $options: 'i' } }
            ]
        });
        
        console.log(`검색된 유저 수: ${users.length}명`);
        
        if (users.length === 0) {
            console.log('선규 유저를 찾을 수 없습니다.');
            await mongoose.connection.close();
            return;
        }
        
        // 2. 각 유저 정보 출력
        console.log('\n--- 검색된 유저 목록 ---');
        for (const user of users) {
            console.log(`닉네임: ${user.nickname || '없음'}`);
            console.log(`Discord ID: ${user.discordId}`);
            console.log(`현재 골드: ${user.gold.toLocaleString()}`);
            console.log(`레벨: ${user.level}`);
            console.log('---');
        }
        
        // 3. 가장 많은 골드를 보유한 유저 찾기
        const targetUser = users.reduce((prev, current) => 
            (prev.gold > current.gold) ? prev : current
        );
        
        console.log(`\n대상 유저: ${targetUser.nickname || targetUser.discordId}`);
        console.log(`현재 보유 골드: ${targetUser.gold.toLocaleString()}`);
        
        // 4. 골드 회수
        const goldToRecover = 190000000; // 1억 9천만
        
        if (targetUser.gold < goldToRecover) {
            console.log(`\n경고: 유저의 현재 골드(${targetUser.gold.toLocaleString()})가 회수할 금액(${goldToRecover.toLocaleString()})보다 적습니다.`);
            console.log('전체 골드를 회수하시겠습니까? (실행 중단됨)');
            await mongoose.connection.close();
            return;
        }
        
        // 5. 골드 차감 실행
        console.log(`\n골드 회수 실행 중...`);
        
        const previousGold = targetUser.gold;
        targetUser.gold -= goldToRecover;
        
        // 저장
        await targetUser.save();
        
        console.log('\n========== 골드 회수 완료 ==========');
        console.log(`대상 유저: ${targetUser.nickname || targetUser.discordId}`);
        console.log(`Discord ID: ${targetUser.discordId}`);
        console.log(`이전 골드: ${previousGold.toLocaleString()}`);
        console.log(`차감된 골드: ${goldToRecover.toLocaleString()}`);
        console.log(`현재 골드: ${targetUser.gold.toLocaleString()}`);
        console.log('====================================');
        
        // 6. 검증
        const verifyUser = await User.findOne({ discordId: targetUser.discordId });
        console.log(`\n검증 - DB에서 다시 조회한 골드: ${verifyUser.gold.toLocaleString()}`);
        
        if (verifyUser.gold === targetUser.gold) {
            console.log('✅ 골드 회수가 정상적으로 완료되었습니다.');
        } else {
            console.log('❌ 골드 회수 중 오류가 발생했습니다.');
        }
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}