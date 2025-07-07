const mongoose = require('mongoose');
const Word = require('../models/Word');
const { WORD_LIST, ALL_WORDS } = require('../data/wordList');
require('dotenv').config();

async function migrateWords() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        let addedCount = 0;
        let skippedCount = 0;
        
        // 기존 로컬 단어들을 데이터베이스에 추가
        console.log('단어 마이그레이션 시작...');
        
        // ALL_WORDS에서 모든 단어 처리
        for (const word of ALL_WORDS) {
            try {
                const existingWord = await Word.findOne({ word });
                if (!existingWord) {
                    await Word.addOrUpdate(word, 'local');
                    addedCount++;
                    if (addedCount % 100 === 0) {
                        console.log(`${addedCount}개 단어 추가됨...`);
                    }
                } else {
                    skippedCount++;
                }
            } catch (error) {
                console.error(`단어 "${word}" 추가 실패:`, error.message);
            }
        }
        
        console.log('\n마이그레이션 완료!');
        console.log(`- 추가된 단어: ${addedCount}개`);
        console.log(`- 이미 존재하는 단어: ${skippedCount}개`);
        console.log(`- 총 데이터베이스 단어 수: ${await Word.countDocuments()}개`);
        
    } catch (error) {
        console.error('마이그레이션 오류:', error);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB 연결 종료');
    }
}

// 스크립트 실행
migrateWords();