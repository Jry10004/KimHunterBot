const mongoose = require('mongoose');
require('dotenv').config();

async function removeGoldenPickaxe() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');
        
        const db = mongoose.connection.db;
        const collection = db.collection('userartifacts');
        
        // pickaxes.gold.level > 0인 유저 찾기
        const users = await collection.find({ 
            'pickaxes.gold.level': { $gt: 0 } 
        }).toArray();
        
        console.log(`\n📋 회수할 금곡괭이 보유자: ${users.length}명`);
        
        if (users.length === 0) {
            console.log('금곡괭이 보유자가 없습니다.');
            return;
        }
        
        // 백업 데이터 생성
        const backup = users.map(user => ({
            _id: user._id,
            userId: user.userId,
            username: user.username,
            pickaxes: user.pickaxes,
            currentPickaxe: user.currentPickaxe,
            backupDate: new Date()
        }));
        
        // 백업 파일 저장
        const fs = require('fs');
        const backupDir = './backups';
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupFile = `${backupDir}/golden_pickaxe_backup_${Date.now()}.json`;
        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
        console.log(`✅ 백업 파일 생성: ${backupFile}`);
        
        // 각 유저의 금곡괭이 회수
        for (const user of users) {
            console.log(`\n🔄 처리 중: ${user.username} (ID: ${user.userId})`);
            console.log(`   - 금곡괭이 레벨: ${user.pickaxes.gold.level}`);
            console.log(`   - 금곡괭이 경험치: ${user.pickaxes.gold.experience}`);
            console.log(`   - 현재 사용 곡괭이: ${user.currentPickaxe}`);
            
            // 업데이트 쿼리
            const updateQuery = {
                $set: {
                    'pickaxes.gold.unlocked': false,
                    'pickaxes.gold.level': 0,
                    'pickaxes.gold.experience': 0
                }
            };
            
            // 현재 금곡괭이 사용 중이면 브론즈로 변경
            if (user.currentPickaxe === 'gold') {
                updateQuery.$set.currentPickaxe = 'bronze';
                console.log('   → 현재 사용 곡괭이를 브론즈로 변경');
            }
            
            // 업데이트 실행
            const result = await collection.updateOne(
                { _id: user._id },
                updateQuery
            );
            
            if (result.modifiedCount > 0) {
                console.log('   ✅ 금곡괭이 회수 완료');
            } else {
                console.log('   ❌ 업데이트 실패');
            }
        }
        
        console.log('\n========================================');
        console.log('✅ 모든 금곡괭이 회수 작업 완료!');
        console.log(`총 ${users.length}명의 금곡괭이가 회수되었습니다.`);
        console.log('========================================');
        
        // 결과 확인
        const remainingUsers = await collection.find({ 
            'pickaxes.gold.level': { $gt: 0 } 
        }).toArray();
        console.log(`\n📊 회수 후 금곡괭이 보유자: ${remainingUsers.length}명`);
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 실행
removeGoldenPickaxe();