require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function migrateInfpDiscordId() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kimhunter', {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        console.log('✅ MongoDB 연결 성공!');
        
        const oldId = '592659577384730645';  // 구 Discord ID
        const newId = '1374702838541168650'; // 신규 Discord ID
        
        console.log('\n=== 인프 Discord ID 마이그레이션 시작 ===');
        console.log(`구 ID: ${oldId}`);
        console.log(`신규 ID: ${newId}`);
        
        // 트랜잭션 시작
        const session = await mongoose.startSession();
        
        try {
            await session.withTransaction(async () => {
                // 1. 먼저 신규 ID로 이미 계정이 있는지 확인
                const existingNewUser = await User.findOne({ discordId: newId }).session(session);
                if (existingNewUser) {
                    throw new Error('신규 ID로 이미 다른 사용자가 존재합니다. 수동 병합이 필요합니다.');
                }
                
                // 2. 구 ID로 사용자 찾기
                const oldUser = await User.findOne({ discordId: oldId }).session(session);
                if (!oldUser) {
                    throw new Error('구 ID로 사용자를 찾을 수 없습니다.');
                }
                
                console.log('\n[마이그레이션 전 정보]');
                console.log(`- 닉네임: ${oldUser.nickname}`);
                console.log(`- 레벨: ${oldUser.level}`);
                console.log(`- 골드: ${oldUser.gold}`);
                console.log(`- 인벤토리 아이템: ${oldUser.inventory?.length || 0}개`);
                
                // 3. Discord ID 업데이트
                const result = await User.updateOne(
                    { discordId: oldId },
                    { $set: { discordId: newId } },
                    { session }
                );
                
                if (result.modifiedCount === 0) {
                    throw new Error('Discord ID 업데이트 실패');
                }
                
                console.log('\n✅ Discord ID 업데이트 성공!');
                
                // 4. 업데이트 확인
                const updatedUser = await User.findOne({ discordId: newId }).session(session);
                if (!updatedUser) {
                    throw new Error('업데이트 후 사용자를 찾을 수 없습니다.');
                }
                
                console.log('\n[마이그레이션 후 정보]');
                console.log(`- Discord ID: ${updatedUser.discordId}`);
                console.log(`- 닉네임: ${updatedUser.nickname}`);
                console.log(`- 레벨: ${updatedUser.level}`);
                console.log(`- 골드: ${updatedUser.gold}`);
                console.log(`- 인벤토리 아이템: ${updatedUser.inventory?.length || 0}개`);
            });
            
            console.log('\n✅ 마이그레이션 완료!');
            console.log('인프님의 Discord ID가 성공적으로 업데이트되었습니다.');
            
        } catch (error) {
            console.error('\n❌ 마이그레이션 실패:', error.message);
            throw error;
        } finally {
            await session.endSession();
        }
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 확인 프롬프트
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('⚠️  주의: 이 스크립트는 인프님의 Discord ID를 변경합니다.');
console.log('구 ID (592659577384730645) → 신규 ID (1374702838541168650)');
rl.question('\n계속하시겠습니까? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        rl.close();
        migrateInfpDiscordId();
    } else {
        console.log('마이그레이션을 취소했습니다.');
        rl.close();
        process.exit(0);
    }
});