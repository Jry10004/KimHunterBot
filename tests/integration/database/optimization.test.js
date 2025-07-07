const { DatabaseOptimizer, DataIntegrityChecker, ensureSave } = require('../../../database/optimization');
const User = require('../../../models/User');
const mongoose = require('mongoose');

describe('Database Optimization', () => {
    let optimizer;
    let integrityChecker;
    
    beforeEach(() => {
        optimizer = new DatabaseOptimizer();
        integrityChecker = new DataIntegrityChecker();
    });
    
    describe('DatabaseOptimizer', () => {
        test('인덱스 분석', async () => {
            const analysis = await optimizer.analyzeIndexes();
            
            expect(analysis).toHaveProperty('User');
            expect(Array.isArray(analysis.User.existing)).toBe(true);
            expect(Array.isArray(analysis.User.suggested)).toBe(true);
        });
        
        test('쿼리 성능 분석', async () => {
            // 테스트 유저 생성
            await createTestUser({ level: 10 });
            await createTestUser({ level: 20 });
            
            const query = User.find({ level: { $gte: 10 } });
            const analysis = await optimizer.analyzeQuery(query);
            
            expect(analysis).toHaveProperty('executionStats');
            expect(analysis).toHaveProperty('executionTimeMillis');
        });
        
        test('컬렉션 통계', async () => {
            const stats = await optimizer.getCollectionStats();
            
            expect(stats).toHaveProperty('users');
            expect(stats.users).toHaveProperty('count');
            expect(stats.users).toHaveProperty('size');
            expect(stats.users).toHaveProperty('avgObjSize');
        });
    });
    
    describe('DataIntegrityChecker', () => {
        test('유저 데이터 무결성 검사', async () => {
            // 정상 유저
            const validUser = await createTestUser();
            
            // 비정상 유저 (직접 DB 조작)
            await User.collection.insertOne({
                discordId: '999999999999999999',
                username: 'invalid',
                level: -1, // 비정상적인 레벨
                gold: -1000, // 음수 골드
                exp: 99999999 // 너무 큰 경험치
            });
            
            const results = await integrityChecker.checkUserIntegrity();
            
            expect(results.total).toBeGreaterThan(0);
            expect(results.issues.length).toBeGreaterThan(0);
            
            const issue = results.issues.find(i => i.discordId === '999999999999999999');
            expect(issue).toBeDefined();
            expect(issue.problems).toContain('음수 레벨');
            expect(issue.problems).toContain('음수 골드');
        });
        
        test('중복 데이터 검사', async () => {
            // 중복 닉네임 유저들
            await createTestUser({ nickname: '중복닉네임' });
            await createTestUser({ 
                discordId: '222222222222222222',
                nickname: '중복닉네임' 
            });
            
            const duplicates = await integrityChecker.findDuplicates();
            
            expect(duplicates.nicknames.length).toBeGreaterThan(0);
            expect(duplicates.nicknames[0].nickname).toBe('중복닉네임');
            expect(duplicates.nicknames[0].users.length).toBe(2);
        });
        
        test('데이터 정리', async () => {
            // 오래된 비등록 유저
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 40);
            
            await User.collection.insertOne({
                discordId: '888888888888888888',
                username: 'olduser',
                registered: false,
                createdAt: oldDate
            });
            
            const cleaned = await integrityChecker.cleanupOldData();
            
            expect(cleaned.deletedUnregistered).toBeGreaterThan(0);
        });
    });
    
    describe('ensureSave', () => {
        test('저장 재시도', async () => {
            const user = await createTestUser();
            
            // 버전 충돌 시뮬레이션
            const user1 = await User.findById(user._id);
            const user2 = await User.findById(user._id);
            
            user1.gold = 2000;
            await user1.save();
            
            user2.gold = 3000;
            
            // ensureSave는 재시도하여 성공해야 함
            const saved = await ensureSave(user2);
            expect(saved.gold).toBe(3000);
        });
        
        test('최대 재시도 초과', async () => {
            const user = new User({
                discordId: 'invalid-id', // 유효성 검사 실패
                username: ''
            });
            
            await expect(ensureSave(user, 3)).rejects.toThrow();
        });
    });
    
    describe('Performance Optimization', () => {
        test('대량 작업 최적화', async () => {
            const users = [];
            for (let i = 0; i < 100; i++) {
                users.push({
                    discordId: `bulk${i}`,
                    username: `bulkuser${i}`,
                    level: Math.floor(Math.random() * 100)
                });
            }
            
            const startTime = Date.now();
            await User.insertMany(users);
            const insertTime = Date.now() - startTime;
            
            // 대량 삽입은 빨라야 함
            expect(insertTime).toBeLessThan(1000);
            
            // 인덱스를 활용한 조회
            const highLevelUsers = await User.find({ level: { $gte: 50 } })
                .select('username level')
                .lean();
            
            expect(highLevelUsers.length).toBeGreaterThan(0);
        });
    });
});