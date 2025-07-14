const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // MongoDB 연결 설정 개선
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kimhunter', {
            serverSelectionTimeoutMS: 30000,  // 30초로 증가
            connectTimeoutMS: 30000,          // 30초로 증가
            socketTimeoutMS: 45000,           // 소켓 타임아웃 추가
            maxPoolSize: 10,                  // 연결 풀 크기
            minPoolSize: 5,                   // 최소 연결 풀 크기
            retryWrites: true,                // 재시도 쓰기 활성화
            w: 'majority'                     // 쓰기 보장 수준
        });
        console.log('✅ MongoDB 연결 성공!');
        
        // 연결 이벤트 리스너 추가
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB 연결 오류:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB 연결이 끊어졌습니다. 재연결 시도 중...');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB 재연결 성공!');
        });
    } catch (error) {
        console.error('❌ MongoDB 연결 실패:', error);
        console.error('MongoDB 연결이 필요합니다. 봇을 종료합니다.');
        process.exit(1);
    }
};

module.exports = connectDB;