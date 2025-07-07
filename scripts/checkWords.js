const mongoose = require('mongoose');
const Word = require('../models/Word');
require('dotenv').config();

async function checkWords() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 현재 단어 수 확인
        const count = await Word.countDocuments();
        console.log(`\n현재 데이터베이스의 단어 수: ${count}개`);
        
        if (count > 0) {
            // 샘플 단어 표시
            const samples = await Word.find().limit(10);
            console.log('\n샘플 단어:');
            samples.forEach(word => {
                console.log(`- ${word.word} (${word.source}, 사용: ${word.usageCount}회)`);
            });
            
            // 출처별 통계
            const stats = await Word.aggregate([
                { $group: { _id: '$source', count: { $sum: 1 } } }
            ]);
            console.log('\n출처별 통계:');
            stats.forEach(stat => {
                console.log(`- ${stat._id}: ${stat.count}개`);
            });
        }
        
    } catch (error) {
        console.error('오류:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

checkWords();