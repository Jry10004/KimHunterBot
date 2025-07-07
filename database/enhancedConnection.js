const mongoose = require('mongoose');
const { errorHandler } = require('../systems/enhancedErrorHandler');

class DatabaseConnection {
    constructor() {
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        
        // MongoDB 이벤트 리스너 설정
        this.setupEventListeners();
    }
    
    async connect() {
        try {
            // .env 파일 로드 확인
        if (!process.env.MONGODB_URI) {
            require('dotenv').config();
        }
        
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kimhunter';
            
            console.log('🔌 MongoDB 연결 시도중...');
            console.log(`📍 연결 주소: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')}`);
            
            // 연결 옵션
            const options = {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                family: 4, // IPv4 사용
                maxPoolSize: 10,
                minPoolSize: 2,
                retryWrites: true,
                w: 'majority'
            };
            
            await mongoose.connect(mongoUri, options);
            
            this.connected = true;
            this.reconnectAttempts = 0;
            console.log('✅ MongoDB 연결 성공!');
            console.log(`📊 데이터베이스: ${mongoose.connection.db.databaseName}`);
            
            // 연결 정보
            const adminDb = mongoose.connection.db.admin();
            const serverStatus = await adminDb.serverStatus();
            console.log(`⚡ MongoDB 버전: ${serverStatus.version}`);
            console.log(`💾 메모리 사용량: ${(serverStatus.mem.resident / 1024).toFixed(2)} MB`);
            
            return true;
            
        } catch (error) {
            console.error('❌ MongoDB 연결 실패:', error.message);
            
            // 연결 실패 원인 분석
            if (error.name === 'MongoServerSelectionError') {
                console.error('💡 해결 방법:');
                console.error('   1. MongoDB가 실행 중인지 확인하세요');
                console.error('   2. 연결 문자열이 올바른지 확인하세요');
                console.error('   3. 방화벽이 MongoDB 포트(27017)를 차단하지 않는지 확인하세요');
                
                if (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongodb+srv')) {
                    console.error('   4. MongoDB Atlas를 사용 중이라면:');
                    console.error('      - IP 화이트리스트에 현재 IP가 추가되어 있는지 확인하세요');
                    console.error('      - 네트워크 연결이 안정적인지 확인하세요');
                }
            }
            
            // 재연결 시도
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`🔄 ${this.reconnectDelay / 1000}초 후 재연결 시도... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                
                await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
                return this.connect();
            }
            
            throw error;
        }
    }
    
    setupEventListeners() {
        // 연결 성공
        mongoose.connection.on('connected', () => {
            console.log('📗 MongoDB 연결됨');
            this.connected = true;
        });
        
        // 연결 끊김
        mongoose.connection.on('disconnected', () => {
            console.log('📕 MongoDB 연결 끊김');
            this.connected = false;
            
            // 자동 재연결 시도
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => {
                    console.log('🔄 자동 재연결 시도...');
                    this.connect().catch(console.error);
                }, this.reconnectDelay);
            }
        });
        
        // 에러 발생
        mongoose.connection.on('error', (error) => {
            console.error('❌ MongoDB 에러:', error.message);
            errorHandler.handleError(error, { source: 'MongoDB' });
        });
        
        // 재연결됨
        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB 재연결 성공!');
            this.connected = true;
            this.reconnectAttempts = 0;
        });
        
        // 프로세스 종료 시 연결 종료
        process.on('SIGINT', async () => {
            console.log('🛑 MongoDB 연결 종료중...');
            await mongoose.connection.close();
            console.log('✅ MongoDB 연결 종료됨');
            process.exit(0);
        });
    }
    
    // 연결 상태 확인
    isConnected() {
        return this.connected && mongoose.connection.readyState === 1;
    }
    
    // 연결 상태 상세 정보
    getConnectionStatus() {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        
        return {
            connected: this.connected,
            readyState: states[mongoose.connection.readyState],
            reconnectAttempts: this.reconnectAttempts,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }
    
    // 헬스 체크
    async healthCheck() {
        try {
            if (!this.isConnected()) {
                return { status: 'error', message: 'Not connected to MongoDB' };
            }
            
            // 간단한 쿼리로 연결 테스트
            await mongoose.connection.db.admin().ping();
            
            const stats = await mongoose.connection.db.stats();
            
            return {
                status: 'healthy',
                database: mongoose.connection.name,
                collections: stats.collections,
                dataSize: `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`,
                indexes: stats.indexes
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: error.message
            };
        }
    }
    
    // 수동 재연결
    async reconnect() {
        console.log('🔄 수동 재연결 시작...');
        
        try {
            await mongoose.connection.close();
            await this.connect();
            return true;
        } catch (error) {
            console.error('❌ 재연결 실패:', error.message);
            return false;
        }
    }
}

// 싱글톤 인스턴스
const databaseConnection = new DatabaseConnection();

// 기존 connectDB 함수와 호환성 유지
const connectDB = async () => {
    return databaseConnection.connect();
};

module.exports = {
    connectDB,
    databaseConnection
};