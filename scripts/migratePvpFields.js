const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function migratePvpFields() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/discordbot');
        console.log('MongoDB 연결 성공');

        // 모든 유저 조회
        const users = await User.find({});
        console.log(`총 ${users.length}명의 유저 데이터를 마이그레이션합니다.`);

        let migratedCount = 0;
        for (const user of users) {
            let updated = false;

            // pvp 객체가 없으면 생성
            if (!user.pvp) {
                user.pvp = {};
                updated = true;
            }

            // 최상위 필드를 pvp 객체로 이동
            if (user.pvpRating !== undefined && user.pvpRating !== user.pvp.rating) {
                user.pvp.rating = user.pvpRating;
                updated = true;
            }

            if (user.pvpTier !== undefined && user.pvpTier !== user.pvp.tier) {
                user.pvp.tier = user.pvpTier;
                updated = true;
            }

            if (user.pvpWins !== undefined && user.pvpWins !== user.pvp.wins) {
                user.pvp.wins = user.pvpWins;
                updated = true;
            }

            if (user.pvpLosses !== undefined && user.pvpLosses !== user.pvp.losses) {
                user.pvp.losses = user.pvpLosses;
                updated = true;
            }

            if (user.pvpDraws !== undefined && user.pvpDraws !== user.pvp.draws) {
                user.pvp.draws = user.pvpDraws;
                updated = true;
            }

            if (user.pvpTickets !== undefined && user.pvpTickets !== user.pvp.duelTickets) {
                user.pvp.duelTickets = user.pvpTickets;
                updated = true;
            }

            if (user.pvpWinStreak !== undefined && user.pvpWinStreak !== user.pvp.winStreak) {
                user.pvp.winStreak = user.pvpWinStreak;
                updated = true;
            }

            if (user.pvpMaxWinStreak !== undefined && user.pvpMaxWinStreak !== user.pvp.maxWinStreak) {
                user.pvp.maxWinStreak = user.pvpMaxWinStreak;
                updated = true;
            }

            if (user.pvpTotalDuels !== undefined && user.pvpTotalDuels !== user.pvp.totalDuels) {
                user.pvp.totalDuels = user.pvpTotalDuels;
                updated = true;
            }

            if (user.pvpTotalGoldWon !== undefined && user.pvpTotalGoldWon !== user.pvp.totalGoldWon) {
                user.pvp.totalGoldWon = user.pvpTotalGoldWon;
                updated = true;
            }

            if (user.pvpTotalGoldLost !== undefined && user.pvpTotalGoldLost !== user.pvp.totalGoldLost) {
                user.pvp.totalGoldLost = user.pvpTotalGoldLost;
                updated = true;
            }

            if (user.pvpEnhancement) {
                if (!user.pvp.attackEnhancement) {
                    user.pvp.attackEnhancement = {};
                }
                user.pvp.attackEnhancement.high = user.pvpEnhancement.high || 0;
                user.pvp.attackEnhancement.middle = user.pvpEnhancement.middle || 0;
                user.pvp.attackEnhancement.low = user.pvpEnhancement.low || 0;
                updated = true;
            }

            // 기본값 설정
            user.pvp.rating = user.pvp.rating || 1000;
            user.pvp.tier = user.pvp.tier || 'Bronze';
            user.pvp.division = user.pvp.division || 5;
            user.pvp.duelTickets = user.pvp.duelTickets || 20;
            user.pvp.wins = user.pvp.wins || 0;
            user.pvp.losses = user.pvp.losses || 0;
            user.pvp.draws = user.pvp.draws || 0;
            user.pvp.totalDuels = user.pvp.totalDuels || 0;
            user.pvp.winStreak = user.pvp.winStreak || 0;
            user.pvp.maxWinStreak = user.pvp.maxWinStreak || 0;

            if (updated) {
                await user.save();
                migratedCount++;
                console.log(`✅ ${user.nickname || user.discordId} 유저 PVP 데이터 마이그레이션 완료`);
            }
        }

        console.log(`\n마이그레이션 완료! 총 ${migratedCount}명의 유저 데이터가 업데이트되었습니다.`);
        mongoose.connection.close();
    } catch (error) {
        console.error('마이그레이션 중 오류 발생:', error);
        mongoose.connection.close();
    }
}

migratePvpFields();