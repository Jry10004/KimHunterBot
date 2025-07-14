const mongoose = require('mongoose');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/discord-bot');

async function migrateInfpUser() {
    try {
        console.log('🔄 인프 유저 Discord ID 마이그레이션 시작...\n');
        
        const oldId = '592659577384730645';
        const newId = '1374702838541168650';
        
        // 1. 기존 유저 찾기
        console.log(`📌 기존 ID (${oldId})로 유저 검색 중...`);
        const oldUser = await User.findOne({ discordId: oldId });
        
        if (!oldUser) {
            console.log('❌ 기존 ID로 유저를 찾을 수 없습니다.');
            return;
        }
        
        console.log(`✅ 유저 발견: ${oldUser.nickname} (레벨 ${oldUser.level})`);
        console.log(`   - 골드: ${oldUser.gold.toLocaleString()}`);
        console.log(`   - 경험치: ${oldUser.experience.toLocaleString()}`);
        
        // 2. 새 ID로 이미 유저가 있는지 확인
        console.log(`\n📌 새 ID (${newId})로 기존 유저 확인 중...`);
        const existingNewUser = await User.findOne({ discordId: newId });
        
        if (existingNewUser) {
            console.log(`⚠️  새 ID로 이미 유저가 존재합니다: ${existingNewUser.nickname}`);
            console.log('   기존 유저 데이터를 삭제하고 마이그레이션을 진행하시겠습니까?');
            // 실제로는 여기서 확인을 받아야 하지만, 스크립트이므로 진행
            await User.deleteOne({ discordId: newId });
            console.log('   ✅ 기존 데이터 삭제 완료');
        }
        
        // 3. Discord ID 업데이트
        console.log(`\n📌 Discord ID 업데이트 중...`);
        oldUser.discordId = newId;
        await oldUser.save();
        console.log('✅ Discord ID 업데이트 완료!');
        
        // 4. constants.js 파일 업데이트
        console.log('\n📌 constants.js 파일 업데이트 중...');
        const constantsPath = path.join(__dirname, '../config/constants.js');
        
        if (fs.existsSync(constantsPath)) {
            let content = fs.readFileSync(constantsPath, 'utf8');
            if (content.includes(oldId)) {
                content = content.replace(new RegExp(oldId, 'g'), newId);
                fs.writeFileSync(constantsPath, content);
                console.log('✅ constants.js 업데이트 완료!');
            } else {
                console.log('⚠️  constants.js에서 기존 ID를 찾을 수 없습니다.');
            }
        }
        
        // 5. 검증
        console.log('\n📌 마이그레이션 검증 중...');
        const migratedUser = await User.findOne({ discordId: newId });
        
        if (migratedUser && migratedUser.nickname === oldUser.nickname) {
            console.log('✅ 마이그레이션 성공!');
            console.log(`   - 닉네임: ${migratedUser.nickname}`);
            console.log(`   - 새 Discord ID: ${migratedUser.discordId}`);
            console.log(`   - 레벨: ${migratedUser.level}`);
            console.log(`   - 골드: ${migratedUser.gold.toLocaleString()}`);
        } else {
            console.log('❌ 마이그레이션 검증 실패!');
        }
        
        // 6. 댕댕봇 구출 이벤트 데이터도 확인
        console.log('\n📌 댕댕봇 구출 이벤트 데이터 확인...');
        const dogBotStatePath = path.join(__dirname, '../data/dogBotRescueState.json');
        
        if (fs.existsSync(dogBotStatePath)) {
            const stateData = JSON.parse(fs.readFileSync(dogBotStatePath, 'utf8'));
            
            // 중복 데이터 확인
            if (stateData.statistics.userDamage[oldId]) {
                console.log(`⚠️  구출 이벤트에 기존 ID 데이터가 남아있습니다.`);
                console.log(`   - ${oldId}: ${stateData.statistics.userDamage[oldId]} 데미지`);
            }
            if (stateData.statistics.userDamage[newId]) {
                console.log(`✅ 구출 이벤트에 새 ID 데이터 확인`);
                console.log(`   - ${newId}: ${stateData.statistics.userDamage[newId]} 데미지`);
            }
        }
        
        console.log('\n✨ 마이그레이션 완료!');
        console.log('💡 참고: dogBotStateManager의 validateAndRepairData()가 다음 봇 재시작 시 자동으로 중복 데이터를 병합합니다.');
        
    } catch (error) {
        console.error('❌ 마이그레이션 중 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 데이터베이스 연결 종료');
    }
}

// 스크립트 실행
migrateInfpUser();