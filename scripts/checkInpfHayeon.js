const mongoose = require('mongoose');
const User = require('../models/User');

async function checkUsers() {
    try {
        await mongoose.connect('mongodb://localhost:27017/discord-bot');
        
        // 인프 유저 찾기
        const inpf = await User.findOne({ 
            nickname: '인프'
        });
        
        // 하연 유저 찾기
        const hayeon = await User.findOne({ 
            nickname: '하연94'
        });
        
        console.log('=== 인프 유저 정보 ===');
        if (inpf) {
            console.log('닉네임:', inpf.nickname);
            console.log('Discord ID:', inpf.discordId);
            console.log('레벨:', inpf.level);
            console.log('경험치:', inpf.exp);
            console.log('골드:', inpf.gold);
            console.log('관리자:', inpf.isAdmin);
            console.log('가입일:', inpf.createdAt);
            console.log('던전 클리어:', JSON.stringify(inpf.dungeonClears || {}));
            console.log('총 사냥 횟수:', inpf.totalHunts || 0);
            console.log('PVP 정보:', JSON.stringify(inpf.pvp || {}));
            console.log('미니게임 통계:', JSON.stringify(inpf.minigameStats || {}));
        } else {
            console.log('인프 유저를 찾을 수 없습니다.');
        }
        
        console.log('\n=== 하연 유저 정보 ===');
        if (hayeon) {
            console.log('닉네임:', hayeon.nickname);
            console.log('Discord ID:', hayeon.discordId);
            console.log('레벨:', hayeon.level);
            console.log('경험치:', hayeon.exp);
            console.log('골드:', hayeon.gold);
            console.log('관리자:', hayeon.isAdmin);
            console.log('가입일:', hayeon.createdAt);
            console.log('던전 클리어:', JSON.stringify(hayeon.dungeonClears || {}));
            console.log('총 사냥 횟수:', hayeon.totalHunts || 0);
            console.log('PVP 정보:', JSON.stringify(hayeon.pvp || {}));
            console.log('미니게임 통계:', JSON.stringify(hayeon.minigameStats || {}));
        } else {
            console.log('하연 유저를 찾을 수 없습니다.');
        }
        
        // 경험치 비교
        console.log('\n=== 경험치 비교 ===');
        if (inpf && hayeon) {
            console.log(`인프: Lv.${inpf.level} (${inpf.exp} EXP)`);
            console.log(`하연: Lv.${hayeon.level} (${hayeon.exp} EXP)`);
            
            // 총 누적 경험치 계산
            let inpfTotal = 0;
            for (let i = 1; i < inpf.level; i++) {
                inpfTotal += i * 100;
            }
            inpfTotal += inpf.exp;
            
            let hayeonTotal = 0;
            for (let i = 1; i < hayeon.level; i++) {
                hayeonTotal += i * 100;
            }
            hayeonTotal += hayeon.exp;
            
            console.log(`인프 총 누적 경험치: ${inpfTotal}`);
            console.log(`하연 총 누적 경험치: ${hayeonTotal}`);
            console.log(`차이: ${inpfTotal - hayeonTotal}`);
        }
        
    } catch (error) {
        console.error('오류:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkUsers();