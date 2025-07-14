require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function deleteUserByEmail() {
    try {
        // 직접 MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('데이터베이스 연결 완료');

        // rla00823이 포함된 이메일을 가진 사용자 찾기
        const users = await User.find({
            email: { $regex: 'rla00823', $options: 'i' }
        });

        console.log(`\n=== rla00823이 포함된 이메일을 가진 사용자 ===`);
        
        if (users.length === 0) {
            console.log('해당하는 사용자를 찾을 수 없습니다.');
            process.exit(0);
            return;
        }

        console.log(`총 ${users.length}명 발견:\n`);
        
        for (const user of users) {
            console.log(`사용자 정보:`);
            console.log(`- Discord ID: ${user.discordId}`);
            console.log(`- 닉네임: ${user.nickname || 'N/A'}`);
            console.log(`- 이메일: ${user.email || 'N/A'}`);
            console.log(`- 레벨: ${user.level}`);
            console.log(`- 골드: ${user.gold}`);
            console.log(`- 가입 여부: ${user.registered ? '가입됨' : '미가입'}`);
            console.log(`- 이메일 인증: ${user.emailVerified ? '인증됨' : '미인증'}`);
            console.log(`- 가입일: ${user.createdAt || 'N/A'}`);
            
            // 사용자 삭제
            await User.deleteOne({ _id: user._id });
            console.log(`\n✅ 사용자 삭제 완료: ${user.email}`);
            console.log('-'.repeat(50));
        }

        console.log(`\n총 ${users.length}명의 사용자가 삭제되었습니다.`);
        process.exit(0);
    } catch (error) {
        console.error('오류 발생:', error);
        process.exit(1);
    }
}

// 확인 메시지
console.log('⚠️  경고: 이 스크립트는 rla00823이 포함된 이메일을 가진 모든 사용자를 삭제합니다.');
console.log('계속하려면 3초 후에 실행됩니다...\n');

setTimeout(() => {
    deleteUserByEmail();
}, 3000);