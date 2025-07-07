const DailyMission = require('../models/DailyMission');

// 미션 진행도 업데이트 헬퍼
class MissionHelper {
    // 출석 체크
    static async updateAttendance(userId) {
        let mission = await DailyMission.findOne({ userId });
        if (!mission) {
            mission = new DailyMission({ userId });
            await mission.save();
        }
        
        mission.updateDailyProgress('attendance', 1);
        await mission.save();
    }
    
    // 미니게임 플레이
    static async updateMiniGame(userId) {
        let mission = await DailyMission.findOne({ userId });
        if (!mission) {
            mission = new DailyMission({ userId });
            await mission.save();
        }
        
        mission.updateDailyProgress('miniGames', 1);
        mission.updateWeeklyProgress('totalMiniGames', 1);
        await mission.save();
    }
    
    // PVP 대전
    static async updatePVPBattle(userId, isWin = false) {
        let mission = await DailyMission.findOne({ userId });
        if (!mission) {
            mission = new DailyMission({ userId });
            await mission.save();
        }
        
        mission.updateDailyProgress('pvpBattles', 1);
        if (isWin) {
            mission.updateWeeklyProgress('totalPvpWins', 1);
        }
        await mission.save();
    }
    
    // 골드 획득
    static async updateGoldEarned(userId, amount) {
        let mission = await DailyMission.findOne({ userId });
        if (!mission) {
            mission = new DailyMission({ userId });
            await mission.save();
        }
        
        mission.updateDailyProgress('earnGold', amount);
        mission.updateWeeklyProgress('totalGoldEarned', amount);
        await mission.save();
    }
    
    // 강화 시도
    static async updateEnhanceTry(userId, isSuccess = false) {
        let mission = await DailyMission.findOne({ userId });
        if (!mission) {
            mission = new DailyMission({ userId });
            await mission.save();
        }
        
        mission.updateDailyProgress('enhanceTries', 1);
        if (isSuccess) {
            mission.updateWeeklyProgress('totalEnhanceSuccess', 1);
        }
        await mission.save();
    }
    
    // 운동
    static async updateExercise(userId) {
        let mission = await DailyMission.findOne({ userId });
        if (!mission) {
            mission = new DailyMission({ userId });
            await mission.save();
        }
        
        mission.updateDailyProgress('exercise', 1);
        await mission.save();
    }
    
    // 사냥
    static async updateHunting(userId) {
        let mission = await DailyMission.findOne({ userId });
        if (!mission) {
            // 미션 데이터가 없으면 생성
            mission = new DailyMission({ userId });
            await mission.save();
        }
        
        mission.updateDailyProgress('hunting', 1);
        mission.updateWeeklyProgress('totalHunting', 1);
        await mission.save();
    }
    
    // 주식 거래
    static async updateStockTrade(userId) {
        let mission = await DailyMission.findOne({ userId });
        if (!mission) {
            mission = new DailyMission({ userId });
            await mission.save();
        }
        
        mission.updateDailyProgress('stockTrade', 1);
        await mission.save();
    }
    
    // 유물 탐사
    static async updateArtifactExplore(userId) {
        let mission = await DailyMission.findOne({ userId });
        if (!mission) {
            mission = new DailyMission({ userId });
            await mission.save();
        }
        
        mission.updateDailyProgress('artifactExplore', 1);
        await mission.save();
    }
    
    // 에너지 채굴
    static async updateEnergyMining(userId) {
        let mission = await DailyMission.findOne({ userId });
        if (!mission) {
            mission = new DailyMission({ userId });
            await mission.save();
        }
        
        mission.updateDailyProgress('energyMining', 1);
        await mission.save();
    }
}

module.exports = MissionHelper;