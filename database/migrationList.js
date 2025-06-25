// 📋 마이그레이션 목록
const User = require('../models/User');

// 마이그레이션 정의
const migrations = {
    // 2024-06-20: ObjectId 장비 데이터 정리 (일회성)
    'cleanup_equipment_objectid_2024_06_20': async () => {
        const result = await User.updateMany(
            {
                $or: [
                    { 'equipment.weapon': { $type: 'objectId' } },
                    { 'equipment.armor': { $type: 'objectId' } },
                    { 'equipment.helmet': { $type: 'objectId' } },
                    { 'equipment.gloves': { $type: 'objectId' } },
                    { 'equipment.boots': { $type: 'objectId' } },
                    { 'equipment.accessory': { $type: 'objectId' } }
                ]
            },
            {
                $set: {
                    'equipment.weapon': -1,
                    'equipment.armor': -1,
                    'equipment.helmet': -1,
                    'equipment.gloves': -1,
                    'equipment.boots': -1,
                    'equipment.accessory': -1
                }
            }
        );
        console.log(`  - ${result.modifiedCount}명의 유저 장비 ObjectId 데이터가 정리되었습니다.`);
        return result;
    },

    // 2024-06-21: 유물 데이터 타입 수정 (일회성)
    'fix_artifact_data_types_2024_06_21': async () => {
        const result = await User.updateMany(
            {
                $or: [
                    { artifacts: { $exists: false } },
                    { artifacts: { $not: { $type: 'array' } } }
                ]
            },
            {
                $set: { artifacts: [] }
            }
        );
        console.log(`  - ${result.modifiedCount}명의 유저 유물 데이터가 수정되었습니다.`);
        return result;
    },

    // 2024-06-26: 멀티플레이 기능 추가로 인한 스키마 업데이트
    'add_multiplayer_fields_2024_06_26': async () => {
        const result = await User.updateMany(
            {
                $or: [
                    { multiplayerStats: { $exists: false } },
                    { achievements: { $exists: false } }
                ]
            },
            {
                $setOnInsert: {
                    multiplayerStats: {
                        mushroomGame: { wins: 0, losses: 0, tournaments: 0 },
                        wordGames: { wins: 0, losses: 0, streak: 0 },
                        totalMatches: 0
                    },
                    achievements: []
                }
            },
            { upsert: false }
        );
        console.log(`  - ${result.modifiedCount}명의 유저에게 멀티플레이 필드가 추가되었습니다.`);
        return result;
    },

    // 2024-06-26: 주식 포트폴리오 초기화 보호
    'protect_stock_portfolio_2024_06_26': async () => {
        // 빈 배열이나 null인 경우만 초기화 (기존 데이터는 보호)
        const result = await User.updateMany(
            {
                $or: [
                    { stockPortfolio: { $exists: false } },
                    { stockPortfolio: null },
                    { stockPortfolio: { $size: 0 } }
                ]
            },
            {
                $set: { stockPortfolio: [] }
            }
        );
        console.log(`  - ${result.modifiedCount}명의 유저 주식 포트폴리오가 초기화되었습니다.`);
        return result;
    }
};

module.exports = migrations;