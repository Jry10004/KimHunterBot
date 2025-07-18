const mongoose = require('mongoose');
require('dotenv').config();

async function checkAndRemoveGoldenPickaxe() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');
        
        const db = mongoose.connection.db;
        
        // 모든 컬렉션 확인
        const collections = await db.listCollections().toArray();
        console.log('\n📋 컬렉션 목록:');
        collections.forEach(col => console.log(' - ' + col.name));
        
        // 각 컬렉션에서 금곡괭이 검색
        console.log('\n🔍 금곡괭이 보유자 검색 중...');
        
        for (const col of collections) {
            const collection = db.collection(col.name);
            
            // goldPickaxe 필드가 있는 문서 검색
            const query = { 'goldPickaxe.level': { $gt: 0 } };
            const count = await collection.countDocuments(query);
            
            if (count > 0) {
                console.log(`\n✅ ${col.name} 컬렉션에서 ${count}명의 금곡괭이 보유자 발견!`);
                
                // 사용자 정보 출력
                const users = await collection.find(query).toArray();
                
                // 백업 생성
                const fs = require('fs');
                const backupDir = './backups';
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, { recursive: true });
                }
                
                const backupFile = `${backupDir}/golden_pickaxe_backup_${col.name}_${Date.now()}.json`;
                fs.writeFileSync(backupFile, JSON.stringify(users, null, 2));
                console.log(`📁 백업 파일 생성: ${backupFile}`);
                
                // 각 유저 처리
                for (const user of users) {
                    console.log(`\n👤 유저: ${user.username || user.userId}`);
                    console.log(`   - 금곡괭이 레벨: ${user.goldPickaxe.level}`);
                    console.log(`   - 금곡괭이 경험치: ${user.goldPickaxe.experience}`);
                    console.log(`   - 현재 사용 곡괭이: ${user.currentPickaxe || 'N/A'}`);
                    
                    // 금곡괭이 회수
                    const updateQuery = {
                        $set: {
                            'goldPickaxe.unlocked': false,
                            'goldPickaxe.level': 0,
                            'goldPickaxe.experience': 0
                        }
                    };
                    
                    // 금곡괭이 사용 중이면 브론즈로 변경
                    if (user.currentPickaxe === 'gold') {
                        updateQuery.$set.currentPickaxe = 'bronze';
                        console.log('   → 브론즈 곡괭이로 변경');
                    }
                    
                    const result = await collection.updateOne(
                        { _id: user._id },
                        updateQuery
                    );
                    
                    if (result.modifiedCount > 0) {
                        console.log('   ✅ 금곡괭이 회수 완료');
                    } else {
                        console.log('   ❌ 회수 실패');
                    }
                }
                
                // 회수 후 확인
                const remaining = await collection.countDocuments(query);
                console.log(`\n📊 ${col.name} 컬렉션 회수 후 금곡괭이 보유자: ${remaining}명`);
            }
        }
        
        console.log('\n========================================');
        console.log('✅ 전체 금곡괭이 회수 작업 완료!');
        console.log('========================================');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 실행
checkAndRemoveGoldenPickaxe();