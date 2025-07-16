const mongoose = require('mongoose');
const User = require('../models/User');
const UserArtifacts = require('../models/UserArtifacts');
require('dotenv').config();

async function migrateRankingData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📊 랭킹 데이터 마이그레이션 시작...');
        
        const users = await User.find({});
        let migratedCount = 0;
        
        for (const user of users) {
            let updated = false;
            
            // 던전 데이터 통합
            if (user.dungeonProgress || user.dungeonStats) {
                const maxFloor = Math.max(
                    user.dungeonProgress?.bestFloor || 0,
                    user.dungeonProgress?.lastFloor || 0,
                    user.dungeonStats?.maxFloor || 0
                );
                
                const totalClears = Math.max(
                    user.dungeonProgress?.totalClears || 0,
                    user.dungeonStats?.totalClears || 0
                );
                
                if (!user.rankingStats) user.rankingStats = {};
                user.rankingStats.dungeon = {
                    maxFloor,
                    totalClears,
                    lastUpdated: new Date()
                };
                updated = true;
            }
            
            // 보스 데이터 통합
            if (user.bossKills || user.raidStats) {
                const totalKills = Math.max(
                    user.bossKills || 0,
                    user.raidStats?.victories || 0
                );
                
                const totalDamage = user.raidStats?.totalDamageDealt || 0;
                
                if (!user.rankingStats) user.rankingStats = {};
                user.rankingStats.boss = {
                    totalKills,
                    totalDamage,
                    maxDamage: 0, // 이 데이터는 현재 추적되지 않음
                    lastUpdated: new Date()
                };
                updated = true;
            }
            
            // 낚시 데이터 통합
            if (user.fishing?.stats || user.fishingStats) {
                const totalCaught = Math.max(
                    user.fishing?.stats?.totalCaught || 0,
                    user.fishingStats?.totalCaught || 0
                );
                
                let bestCatch = { name: null, size: 0 };
                
                if (user.fishingStats?.bestCatch) {
                    bestCatch = {
                        name: user.fishingStats.bestCatch.name || null,
                        size: user.fishingStats.bestCatch.size || 0
                    };
                } else if (user.fishing?.stats?.biggestCatch) {
                    bestCatch = {
                        name: user.fishing.stats.biggestCatch.fishId || null,
                        size: user.fishing.stats.biggestCatch.size || 0
                    };
                }
                
                if (!user.rankingStats) user.rankingStats = {};
                user.rankingStats.fishing = {
                    totalCaught,
                    bestCatch,
                    lastUpdated: new Date()
                };
                updated = true;
            }
            
            if (updated) {
                await user.save();
                migratedCount++;
                console.log(`✅ ${user.nickname || user.discordId} 데이터 마이그레이션 완료`);
            }
        }
        
        // 유물 데이터는 별도 모델에서 마이그레이션
        console.log('\n🏺 유물 데이터 마이그레이션 시작...');
        const artifacts = await UserArtifacts.find({});
        
        for (const artifact of artifacts) {
            const user = await User.findOne({ discordId: artifact.userId });
            if (user) {
                if (!user.rankingStats) user.rankingStats = {};
                user.rankingStats.artifact = {
                    totalEarnings: artifact.statistics?.totalEarnings || 0,
                    totalFound: artifact.statistics?.totalArtifactsFound || 0,
                    highestValue: 0, // 이 데이터는 현재 추적되지 않음
                    lastUpdated: new Date()
                };
                await user.save();
                console.log(`✅ ${user.nickname || user.discordId} 유물 데이터 마이그레이션 완료`);
            }
        }
        
        console.log(`\n✨ 총 ${migratedCount}명의 유저 데이터 마이그레이션 완료!`);
        
    } catch (error) {
        console.error('❌ 마이그레이션 오류:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// 스크립트 실행
migrateRankingData();