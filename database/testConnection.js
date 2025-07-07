const mongoose = require('mongoose');

// 테스트 환경용 연결 설정
const connectTestDB = async () => {
    if (process.env.NODE_ENV === 'test') {
        console.log('🧪 테스트 환경 - 간소화된 데이터베이스 모드');
        
        // Mongoose 모델들을 메모리에 저장
        global.testDB = {
            users: new Map(),
            mineEntries: new Map(),
            ipBans: new Map()
        };
        
        // 가짜 연결 성공 반환
        return Promise.resolve();
    }
    
    // 프로덕션 환경은 정상 연결
    return mongoose.connect(process.env.MONGODB_URI);
};

// 테스트용 User 모델 래퍼
const createTestUserModel = () => {
    return {
        findOne: async (query) => {
            if (query.discordId) {
                return global.testDB.users.get(query.discordId);
            }
            return null;
        },
        create: async (data) => {
            const user = { 
                ...data, 
                save: async function() { 
                    global.testDB.users.set(this.discordId, this);
                    return this;
                }
            };
            global.testDB.users.set(data.discordId, user);
            return user;
        }
    };
};

module.exports = { connectTestDB, createTestUserModel };