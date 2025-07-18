const mongoose = require('mongoose');

// Mongoose 설정
mongoose.set('strictQuery', false);
mongoose.set('autoIndex', false); // 자동 인덱스 생성 비활성화

const connectDB = async () => {
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
        try {
            // MongoDB 연결 설정 개선
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kimhunter', {
                serverSelectionTimeoutMS: 30000,  // 30초로 조정
                connectTimeoutMS: 30000,          // 30초로 조정
                socketTimeoutMS: 45000,           // 45초로 조정
                maxPoolSize: 10,                  // 연결 풀 크기 조정
                minPoolSize: 5,                   // 최소 연결 풀 크기 조정
                retryWrites: true,                // 재시도 쓰기 활성화
                w: 'majority',                    // 쓰기 보장 수준
                family: 4,                        // IPv4 사용 강제
                bufferCommands: false,            // 버퍼링 비활성화
                heartbeatFrequencyMS: 10000       // 하트비트 주기 10초
            });
            console.log('✅ MongoDB 연결 성공!');
            
            // 연결 이벤트 리스너 추가 (한 번만 등록)
            mongoose.connection.once('error', (err) => {
                console.error('MongoDB 연결 오류:', err.message);
            });
            
            mongoose.connection.once('disconnected', () => {
                console.warn('MongoDB 연결이 끊어졌습니다.');
            });
            
            mongoose.connection.once('reconnected', () => {
                console.log('MongoDB 재연결 성공!');
            });
            
            return; // 성공적으로 연결되면 함수 종료
        } catch (error) {
            lastError = error;
            retries--;
            console.error(`❌ MongoDB 연결 실패 (남은 재시도: ${retries}):`, error.message);
            
            if (retries > 0) {
                console.log('5초 후 재시도합니다...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    
    // 모든 재시도 실패
    console.error('MongoDB 연결이 필요합니다. 봇을 종료합니다.');
    console.error('마지막 오류:', lastError?.message);
    process.exit(1);
};

module.exports = connectDB;