const mongoose = require('mongoose');
require('dotenv').config();

async function removeSilverPickaxe() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');
        
        const db = mongoose.connection.db;
        const collection = db.collection('userartifacts');
        
        // 특정 유저의 은곡괭이 찾기
        const targetUserId = '592659577384730645'; // hihirr6390
        
        const user = await collection.findOne({ userId: targetUserId });
        
        if (!user) {
            console.log('❌ 유저를 찾을 수 없습니다.');
            return;
        }
        
        console.log(`\n👤 유저 정보:`);
        console.log(`  - Username: ${user.username}`);
        console.log(`  - UserId: ${user.userId}`);
        console.log(`  - 현재 사용 곡괭이: ${user.currentPickaxe}`);
        
        if (user.pickaxes?.silver) {
            console.log(`\n🥈 은곡괭이 정보:`);
            console.log(`  - 레벨: ${user.pickaxes.silver.level}`);
            console.log(`  - 경험치: ${user.pickaxes.silver.experience}`);
            console.log(`  - 잠금해제 상태: ${user.pickaxes.silver.unlocked}`);
            
            // 백업 생성
            const fs = require('fs');
            const backupDir = './backups';
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            const backupFile = `${backupDir}/silver_pickaxe_backup_${targetUserId}_${Date.now()}.json`;
            fs.writeFileSync(backupFile, JSON.stringify({
                _id: user._id,
                userId: user.userId,
                username: user.username,
                pickaxes: user.pickaxes,
                currentPickaxe: user.currentPickaxe,
                backupDate: new Date(),
                backupReason: '은곡괭이 회수 요청'
            }, null, 2));
            console.log(`\n✅ 백업 파일 생성: ${backupFile}`);
            
            // 은곡괭이 회수
            const updateQuery = {
                $set: {
                    'pickaxes.silver.unlocked': false,
                    'pickaxes.silver.level': 0,
                    'pickaxes.silver.experience': 0
                }
            };
            
            // 현재 은곡괭이 사용 중이면 브론즈로 변경
            if (user.currentPickaxe === 'silver') {
                updateQuery.$set.currentPickaxe = 'bronze';
                console.log('\n🔄 현재 사용 곡괭이를 브론즈로 변경');
            }
            
            // 업데이트 실행
            const result = await collection.updateOne(
                { _id: user._id },
                updateQuery
            );
            
            if (result.modifiedCount > 0) {
                console.log('\n✅ 은곡괭이 회수 완료!');
                
                // 확인
                const updatedUser = await collection.findOne({ userId: targetUserId });
                console.log('\n📊 회수 후 상태:');
                console.log(`  - 은곡괭이 잠금해제: ${updatedUser.pickaxes.silver.unlocked}`);
                console.log(`  - 은곡괭이 레벨: ${updatedUser.pickaxes.silver.level}`);
                console.log(`  - 현재 사용 곡괭이: ${updatedUser.currentPickaxe}`);
            } else {
                console.log('\n❌ 업데이트 실패');
            }
        } else {
            console.log('\n❌ 해당 유저는 은곡괭이를 보유하고 있지 않습니다.');
        }
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 실행
removeSilverPickaxe();