require('dotenv').config();
const connectDB = require('../database/connection');
const User = require('../models/User');

async function analyzeUserDocumentSizes() {
    try {
        await connectDB();
        console.log('=== User 도큐먼트 크기 분석 ===\n');
        
        // 전체 유저 수
        const totalUsers = await User.countDocuments();
        console.log(`총 유저 수: ${totalUsers}명\n`);
        
        // 샘플 유저들의 도큐먼트 크기 분석
        const users = await User.find({}).limit(100); // 100명 샘플링
        
        let totalSize = 0;
        let minSize = Infinity;
        let maxSize = 0;
        let largestUser = null;
        let smallestUser = null;
        
        const sizeBuckets = {
            'under_5KB': 0,
            '5KB_10KB': 0,
            '10KB_20KB': 0,
            '20KB_50KB': 0,
            '50KB_100KB': 0,
            'over_100KB': 0
        };
        
        // 각 유저의 도큐먼트 크기 계산
        for (const user of users) {
            const userObj = user.toObject();
            const jsonString = JSON.stringify(userObj);
            const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');
            const sizeInKB = sizeInBytes / 1024;
            
            totalSize += sizeInBytes;
            
            if (sizeInBytes < minSize) {
                minSize = sizeInBytes;
                smallestUser = { nickname: user.nickname, id: user.discordId, size: sizeInKB };
            }
            
            if (sizeInBytes > maxSize) {
                maxSize = sizeInBytes;
                largestUser = { nickname: user.nickname, id: user.discordId, size: sizeInKB };
            }
            
            // 크기별 분류
            if (sizeInKB < 5) sizeBuckets['under_5KB']++;
            else if (sizeInKB < 10) sizeBuckets['5KB_10KB']++;
            else if (sizeInKB < 20) sizeBuckets['10KB_20KB']++;
            else if (sizeInKB < 50) sizeBuckets['20KB_50KB']++;
            else if (sizeInKB < 100) sizeBuckets['50KB_100KB']++;
            else sizeBuckets['over_100KB']++;
        }
        
        const avgSize = totalSize / users.length;
        
        console.log('=== 도큐먼트 크기 통계 ===');
        console.log(`평균 크기: ${(avgSize / 1024).toFixed(2)} KB (${avgSize.toLocaleString()} bytes)`);
        console.log(`최소 크기: ${(minSize / 1024).toFixed(2)} KB`);
        console.log(`최대 크기: ${(maxSize / 1024).toFixed(2)} KB`);
        
        console.log('\n=== 크기별 분포 ===');
        console.log(`5KB 미만: ${sizeBuckets['under_5KB']}명`);
        console.log(`5KB-10KB: ${sizeBuckets['5KB_10KB']}명`);
        console.log(`10KB-20KB: ${sizeBuckets['10KB_20KB']}명`);
        console.log(`20KB-50KB: ${sizeBuckets['20KB_50KB']}명`);
        console.log(`50KB-100KB: ${sizeBuckets['50KB_100KB']}명`);
        console.log(`100KB 초과: ${sizeBuckets['over_100KB']}명`);
        
        console.log('\n=== 가장 큰/작은 도큐먼트 ===');
        if (smallestUser) {
            console.log(`가장 작은 유저: ${smallestUser.nickname} (${smallestUser.size.toFixed(2)} KB)`);
        }
        if (largestUser) {
            console.log(`가장 큰 유저: ${largestUser.nickname} (${largestUser.size.toFixed(2)} KB)`);
        }
        
        // 대용량 필드 분석
        console.log('\n=== 대용량 필드 분석 (상위 유저 기준) ===');
        if (largestUser) {
            const bigUser = await User.findOne({ discordId: largestUser.id });
            const userObj = bigUser.toObject();
            
            const fieldSizes = {};
            for (const [key, value] of Object.entries(userObj)) {
                const fieldSize = Buffer.byteLength(JSON.stringify(value), 'utf8');
                if (fieldSize > 1024) { // 1KB 이상인 필드만
                    fieldSizes[key] = fieldSize;
                }
            }
            
            const sortedFields = Object.entries(fieldSizes).sort((a, b) => b[1] - a[1]);
            console.log('주요 대용량 필드:');
            for (const [field, size] of sortedFields.slice(0, 10)) {
                console.log(`- ${field}: ${(size / 1024).toFixed(2)} KB`);
                
                // 배열 필드인 경우 요소 수 표시
                if (Array.isArray(userObj[field])) {
                    console.log(`  (${userObj[field].length}개 요소)`);
                }
            }
        }
        
        // MongoDB 도큐먼트 크기 제한 정보
        console.log('\n=== MongoDB 제한 정보 ===');
        console.log('MongoDB 도큐먼트 최대 크기: 16 MB');
        console.log(`현재 최대 도큐먼트 크기: ${(maxSize / 1024 / 1024).toFixed(2)} MB (${((maxSize / 1024 / 1024 / 16) * 100).toFixed(2)}% 사용)`);
        
        process.exit(0);
    } catch (error) {
        console.error('오류:', error);
        process.exit(1);
    }
}

analyzeUserDocumentSizes();