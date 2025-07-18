const mongoose = require('mongoose');
require('dotenv').config();

async function checkUserArtifacts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');
        
        const db = mongoose.connection.db;
        const collection = db.collection('userartifacts');
        
        // 전체 문서 수 확인
        const totalCount = await collection.countDocuments();
        console.log(`\n📊 userartifacts 컬렉션 총 문서 수: ${totalCount}`);
        
        // 샘플 문서 확인
        console.log('\n📋 샘플 문서 구조:');
        const sample = await collection.findOne();
        if (sample) {
            console.log(JSON.stringify(sample, null, 2));
        }
        
        // goldPickaxe가 있는 문서 찾기
        console.log('\n🔍 goldPickaxe 필드 검색...');
        
        // 다양한 방법으로 검색
        const queries = [
            { 'goldPickaxe': { $exists: true } },
            { 'goldPickaxe.level': { $gt: 0 } },
            { 'goldPickaxe.unlocked': true },
            { 'pickaxes.gold': { $exists: true } },
            { 'pickaxes.gold.level': { $gt: 0 } }
        ];
        
        for (const query of queries) {
            const count = await collection.countDocuments(query);
            console.log(`\n쿼리: ${JSON.stringify(query)}`);
            console.log(`결과: ${count}개 문서`);
            
            if (count > 0) {
                const docs = await collection.find(query).limit(3).toArray();
                docs.forEach(doc => {
                    console.log(`  - ${doc.username || doc.userId}`);
                });
            }
        }
        
        // userId로 직접 검색
        console.log('\n🔍 특정 유저 검색...');
        const targetUsers = ['592659577384730645', '492637745043341313'];
        
        for (const userId of targetUsers) {
            const user = await collection.findOne({ userId });
            if (user) {
                console.log(`\n👤 ${userId} 유저 발견:`);
                console.log(`  - username: ${user.username}`);
                console.log(`  - goldPickaxe:`, JSON.stringify(user.goldPickaxe || '없음'));
                console.log(`  - pickaxes:`, JSON.stringify(user.pickaxes || '없음'));
            } else {
                console.log(`\n❌ ${userId} 유저를 찾을 수 없음`);
            }
        }
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 실행
checkUserArtifacts();