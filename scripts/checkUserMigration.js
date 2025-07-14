require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function checkUserMigration() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kimhunter', {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        console.log('✅ MongoDB 연결 성공!');
        
        const oldId = '592659577384730645';  // 구 Discord ID
        const newId = '1374702838541168650'; // 신규 Discord ID
        
        console.log('\n=== Discord ID 마이그레이션 확인 ===');
        console.log(`구 ID: ${oldId}`);
        console.log(`신규 ID: ${newId}`);
        
        // 구 ID로 사용자 찾기
        const oldUser = await User.findOne({ discordId: oldId });
        if (oldUser) {
            console.log('\n[구 ID로 찾은 사용자]');
            console.log(`- 닉네임: ${oldUser.nickname}`);
            console.log(`- 레벨: ${oldUser.level}`);
            console.log(`- 골드: ${oldUser.gold}`);
            console.log(`- 등록일: ${oldUser.registeredAt || oldUser.createdAt}`);
            console.log(`- 인벤토리 아이템 수: ${oldUser.inventory?.length || 0}`);
        } else {
            console.log('\n❌ 구 ID로는 사용자를 찾을 수 없습니다.');
        }
        
        // 신규 ID로 사용자 찾기
        const newUser = await User.findOne({ discordId: newId });
        if (newUser) {
            console.log('\n[신규 ID로 찾은 사용자]');
            console.log(`- 닉네임: ${newUser.nickname}`);
            console.log(`- 레벨: ${newUser.level}`);
            console.log(`- 골드: ${newUser.gold}`);
            console.log(`- 등록일: ${newUser.registeredAt || newUser.createdAt}`);
            console.log(`- 인벤토리 아이템 수: ${newUser.inventory?.length || 0}`);
        } else {
            console.log('\n❌ 신규 ID로는 사용자를 찾을 수 없습니다.');
        }
        
        // 닉네임으로 검색
        console.log('\n=== 닉네임으로 관련 사용자 검색 ===');
        const relatedUsers = await User.find({
            $or: [
                { nickname: { $regex: '인프', $options: 'i' } },
                { nickname: { $regex: '해물파전', $options: 'i' } },
                { nickname: { $regex: 'infp', $options: 'i' } }
            ]
        });
        
        if (relatedUsers.length > 0) {
            console.log(`\n관련 닉네임을 가진 사용자 ${relatedUsers.length}명 발견:`);
            relatedUsers.forEach(user => {
                console.log(`- ${user.nickname} (Discord ID: ${user.discordId})`);
                console.log(`  레벨: ${user.level}, 골드: ${user.gold}`);
                console.log(`  등록일: ${user.registeredAt || user.createdAt}`);
            });
        }
        
        // 마이그레이션 제안
        if (oldUser && !newUser) {
            console.log('\n⚠️  마이그레이션 필요!');
            console.log('구 ID로 사용자가 존재하지만 신규 ID로는 없습니다.');
            console.log('Discord ID를 업데이트해야 합니다.');
        } else if (oldUser && newUser) {
            console.log('\n⚠️  중복 계정 발견!');
            console.log('구 ID와 신규 ID 모두에 사용자가 존재합니다.');
            console.log('데이터 병합이 필요할 수 있습니다.');
        } else if (!oldUser && newUser) {
            console.log('\n✅ 이미 마이그레이션 완료!');
            console.log('신규 ID로만 사용자가 존재합니다.');
        }
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 스크립트 실행
checkUserMigration();