const mongoose = require('mongoose');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
require('dotenv').config();

async function analyzeActivities() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 인프와 하연 유저 찾기
        const inpf = await User.findOne({ nickname: '인프' });
        const hayeon = await User.findOne({ nickname: '하연94' });
        
        if (!inpf || !hayeon) {
            console.log('유저를 찾을 수 없습니다.');
            return;
        }
        
        console.log('=== 유저 기본 정보 ===');
        console.log(`인프: Lv.${inpf.level} (${inpf.exp} EXP) - Discord ID: ${inpf.discordId}`);
        console.log(`하연: Lv.${hayeon.level} (${hayeon.exp} EXP) - Discord ID: ${hayeon.discordId}`);
        console.log(`가입일 차이: ${Math.floor((hayeon.createdAt - inpf.createdAt) / (1000 * 60 * 60 * 24))}일`);
        
        // 총 누적 경험치 계산
        function getTotalExp(user) {
            let total = 0;
            for (let i = 1; i < user.level; i++) {
                total += i * 100;
            }
            total += user.exp;
            return total;
        }
        
        const inpfTotalExp = getTotalExp(inpf);
        const hayeonTotalExp = getTotalExp(hayeon);
        
        console.log('\n=== 총 누적 경험치 ===');
        console.log(`인프: ${inpfTotalExp.toLocaleString()} EXP`);
        console.log(`하연: ${hayeonTotalExp.toLocaleString()} EXP`);
        console.log(`차이: ${(inpfTotalExp - hayeonTotalExp).toLocaleString()} EXP`);
        
        // 던전 기록 분석
        console.log('\n=== 던전 활동 분석 ===');
        console.log('인프 던전 클리어:', JSON.stringify(inpf.dungeonClears || {}, null, 2));
        console.log('하연 던전 클리어:', JSON.stringify(hayeon.dungeonClears || {}, null, 2));
        
        // 7일간 활동 로그 분석 (만약 ActivityLog가 기록되어 있다면)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const [inpfLogs, hayeonLogs] = await Promise.all([
            ActivityLog.find({
                userId: inpf.discordId,
                timestamp: { $gte: sevenDaysAgo }
            }).sort({ timestamp: -1 }),
            ActivityLog.find({
                userId: hayeon.discordId,
                timestamp: { $gte: sevenDaysAgo }
            }).sort({ timestamp: -1 })
        ]);
        
        console.log('\n=== 최근 7일 활동 로그 ===');
        console.log(`인프: ${inpfLogs.length}개 활동`);
        console.log(`하연: ${hayeonLogs.length}개 활동`);
        
        // 활동 타입별 분석
        const analyzeByType = (logs) => {
            const summary = {};
            let totalExp = 0;
            let totalGold = 0;
            
            logs.forEach(log => {
                if (!summary[log.activityType]) {
                    summary[log.activityType] = {
                        count: 0,
                        totalExp: 0,
                        totalGold: 0
                    };
                }
                summary[log.activityType].count++;
                summary[log.activityType].totalExp += log.details.expGained || 0;
                summary[log.activityType].totalGold += log.details.goldChange || 0;
                totalExp += log.details.expGained || 0;
                totalGold += log.details.goldChange || 0;
            });
            
            return { summary, totalExp, totalGold };
        };
        
        const inpfAnalysis = analyzeByType(inpfLogs);
        const hayeonAnalysis = analyzeByType(hayeonLogs);
        
        console.log('\n인프 최근 활동 상세:');
        console.log(JSON.stringify(inpfAnalysis, null, 2));
        
        console.log('\n하연 최근 활동 상세:');
        console.log(JSON.stringify(hayeonAnalysis, null, 2));
        
        // 일일 평균 계산
        console.log('\n=== 일일 평균 활동 ===');
        const daysActive = 7; // 최근 7일 기준
        console.log(`인프 일평균 경험치: ${Math.floor(inpfAnalysis.totalExp / daysActive).toLocaleString()} EXP`);
        console.log(`하연 일평균 경험치: ${Math.floor(hayeonAnalysis.totalExp / daysActive).toLocaleString()} EXP`);
        
        // 레벨업 속도 계산
        console.log('\n=== 레벨업 속도 분석 ===');
        const inpfDaysPlayed = Math.floor((Date.now() - inpf.createdAt) / (1000 * 60 * 60 * 24));
        const hayeonDaysPlayed = Math.floor((Date.now() - hayeon.createdAt) / (1000 * 60 * 60 * 24));
        
        console.log(`인프: ${inpfDaysPlayed}일 동안 Lv.${inpf.level} 달성 (일평균 ${(inpf.level / inpfDaysPlayed).toFixed(2)} 레벨)`);
        console.log(`하연: ${hayeonDaysPlayed}일 동안 Lv.${hayeon.level} 달성 (일평균 ${(hayeon.level / hayeonDaysPlayed).toFixed(2)} 레벨)`);
        
        // 예상 분석 결과
        console.log('\n=== 분석 결과 ===');
        console.log('인프가 하연보다 레벨이 높은 이유:');
        
        if (inpfDaysPlayed > hayeonDaysPlayed) {
            console.log(`1. 더 오래 플레이 (${inpfDaysPlayed - hayeonDaysPlayed}일 차이)`);
        }
        
        if (inpfAnalysis.totalExp > hayeonAnalysis.totalExp) {
            console.log(`2. 최근 7일간 더 많은 경험치 획득 (${(inpfAnalysis.totalExp - hayeonAnalysis.totalExp).toLocaleString()} EXP 차이)`);
        }
        
        if (inpf.dungeonClears && hayeon.dungeonClears) {
            const inpfDungeonTotal = Object.values(inpf.dungeonClears).reduce((a, b) => a + b, 0);
            const hayeonDungeonTotal = Object.values(hayeon.dungeonClears).reduce((a, b) => a + b, 0);
            if (inpfDungeonTotal > hayeonDungeonTotal) {
                console.log(`3. 더 많은 던전 클리어 (${inpfDungeonTotal - hayeonDungeonTotal}회 차이)`);
            }
        }
        
    } catch (error) {
        console.error('분석 중 오류:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

analyzeActivities();