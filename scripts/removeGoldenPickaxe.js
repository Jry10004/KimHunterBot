const mongoose = require('mongoose');
require('dotenv').config();

async function backupAndRemoveGoldenPickaxe() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');
        
        const UserArtifacts = mongoose.model('UserArtifacts', require('../models/UserArtifacts').schema);
        
        // 백업할 유저들 찾기
        const users = await UserArtifacts.find({ 'goldPickaxe.level': { $gt: 0 } });
        console.log(`\n📋 회수할 금곡괭이 보유자: ${users.length}명`);
        
        if (users.length === 0) {
            console.log('금곡괭이 보유자가 없습니다.');
            return;
        }
        
        // 백업 데이터 생성
        const backup = users.map(user => ({
            userId: user.userId,
            username: user.username,
            nickname: user.nickname,
            goldPickaxe: user.goldPickaxe,
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
        
        // 금곡괭이 회수
        for (const user of users) {
            console.log(`\n🔄 처리 중: ${user.username} (ID: ${user.userId})`);
            console.log(`   - 닉네임: ${user.nickname || '없음'}`);
            console.log(`   - 금곡괭이 레벨: ${user.goldPickaxe.level}`);
            console.log(`   - 금곡괭이 경험치: ${user.goldPickaxe.experience}`);
            
            // 금곡괭이 데이터 초기화
            user.goldPickaxe = {
                unlocked: false,
                level: 0,
                experience: 0
            };
            
            // 현재 금곡괭이 사용 중이면 브론즈로 변경
            if (user.currentPickaxe === 'gold') {
                user.currentPickaxe = 'bronze';
                console.log('   → 현재 사용 곡괭이를 브론즈로 변경');
            }
            
            await user.save();
            console.log('   ✅ 금곡괭이 회수 완료');
        }
        
        console.log('\n========================================');
        console.log('✅ 모든 금곡괭이 회수 작업 완료!');
        console.log(`총 ${users.length}명의 금곡괭이가 회수되었습니다.`);
        console.log('========================================');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 실행
backupAndRemoveGoldenPickaxe();