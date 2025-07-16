const mongoose = require('mongoose');
require('dotenv').config();

async function addIndexes() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        const User = require('../models/User');
        
        // 기존 인덱스 확인
        const existingIndexes = await User.collection.indexes();
        console.log('기존 인덱스:', existingIndexes.map(idx => idx.name));
        
        // discordId 인덱스 추가 (가장 중요)
        try {
            await User.collection.createIndex({ discordId: 1 }, { 
                unique: true,
                background: true,
                name: 'discordId_unique_idx'
            });
            console.log('✅ discordId 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 11000 || error.code === 85) {
                console.log('ℹ️ discordId 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ discordId 인덱스 생성 실패:', error);
            }
        }
        
        // level 인덱스 추가 (랭킹용)
        try {
            await User.collection.createIndex({ level: -1 }, { 
                background: true,
                name: 'level_desc_idx'
            });
            console.log('✅ level 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 11000 || error.code === 85) {
                console.log('ℹ️ level 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ level 인덱스 생성 실패:', error);
            }
        }
        
        // gold 인덱스 추가 (랭킹용)
        try {
            await User.collection.createIndex({ gold: -1 }, { 
                background: true,
                name: 'gold_desc_idx'
            });
            console.log('✅ gold 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 11000 || error.code === 85) {
                console.log('ℹ️ gold 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ gold 인덱스 생성 실패:', error);
            }
        }
        
        // registered 인덱스 추가 (회원가입 여부 확인용)
        try {
            await User.collection.createIndex({ registered: 1 }, { 
                background: true,
                sparse: true,
                name: 'registered_idx'
            });
            console.log('✅ registered 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 11000 || error.code === 85) {
                console.log('ℹ️ registered 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ registered 인덱스 생성 실패:', error);
            }
        }
        
        // 복합 인덱스: discordId + registered (게임 명령어 최적화)
        try {
            await User.collection.createIndex(
                { discordId: 1, registered: 1 }, 
                { 
                    background: true,
                    name: 'discordId_registered_idx'
                }
            );
            console.log('✅ discordId + registered 복합 인덱스 생성 완료');
        } catch (error) {
            if (error.code === 11000 || error.code === 85) {
                console.log('ℹ️ discordId + registered 복합 인덱스가 이미 존재합니다');
            } else {
                console.error('❌ 복합 인덱스 생성 실패:', error);
            }
        }
        
        // 최종 인덱스 목록
        const finalIndexes = await User.collection.indexes();
        console.log('\n최종 인덱스 목록:');
        finalIndexes.forEach(idx => {
            console.log(`- ${idx.name}: ${JSON.stringify(idx.key)}`);
        });
        
        console.log('\n✅ 인덱스 추가 작업 완료!');
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB 연결 종료');
    }
}

// 스크립트 실행
addIndexes();