require('dotenv').config();
const mongoose = require('mongoose');
const DailyMission = require('../models/DailyMission');

async function fixMissionProgress() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // earnGold 필드가 누락된 미션 데이터 수정
        const missions = await DailyMission.find({});
        let fixedCount = 0;
        
        for (const mission of missions) {
            let needsUpdate = false;
            
            // earnGold 미션이 없거나 구조가 잘못된 경우
            if (!mission.dailyMissions.earnGold || 
                typeof mission.dailyMissions.earnGold.progress === 'undefined' ||
                typeof mission.dailyMissions.earnGold.target === 'undefined') {
                
                console.log(`❌ ${mission.userId}의 earnGold 미션 구조 오류 발견`);
                
                // 수동으로 설정
                if (!mission.dailyMissions.earnGold) {
                    mission.dailyMissions.earnGold = {};
                }
                
                mission.dailyMissions.earnGold.completed = false;
                mission.dailyMissions.earnGold.progress = 0;
                mission.dailyMissions.earnGold.target = 50000;
                
                needsUpdate = true;
            }
            
            // 다른 미션들도 체크
            const missionDefaults = {
                attendance: { target: 1 },
                miniGames: { target: 3 },
                pvpBattles: { target: 10 },
                earnGold: { target: 50000 },
                enhanceTries: { target: 3 },
                exercise: { target: 1 },
                hunting: { target: 5 },
                stockTrade: { target: 1 },
                artifactExplore: { target: 3 },
                energyMining: { target: 10 }
            };
            
            Object.entries(missionDefaults).forEach(([key, defaults]) => {
                if (!mission.dailyMissions[key]) {
                    mission.dailyMissions[key] = {
                        completed: false,
                        progress: 0,
                        target: defaults.target
                    };
                    needsUpdate = true;
                    console.log(`✅ ${mission.userId}의 ${key} 미션 추가됨`);
                }
            });
            
            if (needsUpdate) {
                await mission.save();
                fixedCount++;
            }
        }
        
        console.log(`\n✅ 총 ${fixedCount}개의 미션 데이터가 수정되었습니다.`);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 작업 완료');
    }
}

// 스크립트 실행
fixMissionProgress();