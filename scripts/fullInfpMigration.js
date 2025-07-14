require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const fs = require('fs').promises;
const path = require('path');

async function fullInfpMigration() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kimhunter', {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        console.log('✅ MongoDB 연결 성공!');
        
        const oldId = '592659577384730645';  // 구 Discord ID
        const newId = '1374702838541168650'; // 신규 Discord ID
        
        console.log('\n=== 인프 Discord ID 전체 마이그레이션 시작 ===');
        console.log(`구 ID: ${oldId} → 신규 ID: ${newId}`);
        
        // 1. MongoDB 사용자 데이터 마이그레이션
        console.log('\n[1단계] MongoDB 사용자 데이터 마이그레이션');
        
        const session = await mongoose.startSession();
        
        try {
            await session.withTransaction(async () => {
                // 신규 ID로 이미 계정이 있는지 확인
                const existingNewUser = await User.findOne({ discordId: newId }).session(session);
                if (existingNewUser) {
                    console.log('⚠️  신규 ID로 이미 사용자가 존재합니다.');
                    console.log(`- 닉네임: ${existingNewUser.nickname}`);
                    console.log(`- 레벨: ${existingNewUser.level}`);
                    console.log('데이터 병합이 필요할 수 있습니다.');
                    return;
                }
                
                // 구 ID로 사용자 찾기
                const oldUser = await User.findOne({ discordId: oldId }).session(session);
                if (!oldUser) {
                    console.log('❌ 구 ID로 사용자를 찾을 수 없습니다.');
                    return;
                }
                
                console.log('\n마이그레이션 전:');
                console.log(`- 닉네임: ${oldUser.nickname}`);
                console.log(`- 레벨: ${oldUser.level}`);
                console.log(`- 골드: ${oldUser.gold}`);
                
                // Discord ID 업데이트
                const result = await User.updateOne(
                    { discordId: oldId },
                    { $set: { discordId: newId } },
                    { session }
                );
                
                if (result.modifiedCount > 0) {
                    console.log('✅ MongoDB 사용자 데이터 업데이트 성공!');
                }
            });
        } finally {
            await session.endSession();
        }
        
        // 2. constants.js 파일 업데이트
        console.log('\n[2단계] constants.js 파일 업데이트');
        const constantsPath = path.join(__dirname, '../config/constants.js');
        
        try {
            let constantsContent = await fs.readFile(constantsPath, 'utf8');
            const originalContent = constantsContent;
            
            // 구 ID를 신규 ID로 교체
            if (constantsContent.includes(oldId)) {
                constantsContent = constantsContent.replace(oldId, newId);
                await fs.writeFile(constantsPath, constantsContent);
                console.log('✅ constants.js 파일 업데이트 성공!');
                
                // 변경 내용 확인
                console.log('\n변경된 내용:');
                console.log(`- '${oldId}' → '${newId}'`);
            } else {
                console.log('⚠️  constants.js에서 구 ID를 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('❌ constants.js 업데이트 실패:', error);
        }
        
        // 3. 다른 파일들에서 하드코딩된 ID 검색
        console.log('\n[3단계] 다른 파일에서 하드코딩된 ID 확인');
        const filesToCheck = [
            'utils/permissions.js',
            'handlers/index.js',
            'handlers/common/utils.js',
            'interactionHandler.js'
        ];
        
        for (const file of filesToCheck) {
            const filePath = path.join(__dirname, '..', file);
            try {
                const content = await fs.readFile(filePath, 'utf8');
                if (content.includes(oldId)) {
                    console.log(`⚠️  ${file}에서 구 ID 발견됨`);
                }
            } catch (error) {
                // 파일이 없을 수 있음
            }
        }
        
        // 4. 최종 확인
        console.log('\n[4단계] 마이그레이션 결과 확인');
        const migratedUser = await User.findOne({ discordId: newId });
        if (migratedUser) {
            console.log('\n✅ 마이그레이션 성공!');
            console.log(`- Discord ID: ${migratedUser.discordId}`);
            console.log(`- 닉네임: ${migratedUser.nickname}`);
            console.log(`- 레벨: ${migratedUser.level}`);
        }
        
        // 구 ID로 남은 데이터가 있는지 확인
        const remainingOldUser = await User.findOne({ discordId: oldId });
        if (remainingOldUser) {
            console.log('\n⚠️  경고: 구 ID로 여전히 사용자가 존재합니다.');
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

console.log('⚠️  주의: 이 스크립트는 다음 작업을 수행합니다:');
console.log('1. MongoDB에서 인프님의 Discord ID 변경');
console.log('2. constants.js 파일에서 ADMIN_IDS 업데이트');
console.log('3. 다른 파일에서 하드코딩된 ID 확인');
console.log('\n구 ID: 592659577384730645');
console.log('신규 ID: 1374702838541168650');

rl.question('\n계속하시겠습니까? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        rl.close();
        fullInfpMigration();
    } else {
        console.log('마이그레이션을 취소했습니다.');
        rl.close();
        process.exit(0);
    }
});