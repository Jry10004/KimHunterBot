const cacheService = require('../../../services/CacheService');

describe('CacheService', () => {
    beforeEach(() => {
        // 각 테스트 전 캐시 초기화
        cacheService.flushAll();
    });
    
    describe('Basic Operations', () => {
        test('set과 get', () => {
            cacheService.set('user', 'test-key', { name: 'John' });
            const result = cacheService.get('user', 'test-key');
            
            expect(result).toEqual({ name: 'John' });
        });
        
        test('존재하지 않는 키 get', () => {
            const result = cacheService.get('user', 'non-existent');
            expect(result).toBeNull();
        });
        
        test('TTL 설정', async () => {
            cacheService.set('temp', 'test-key', 'data', 1); // 1초 TTL
            
            expect(cacheService.get('temp', 'test-key')).toBe('data');
            
            // 1.5초 대기
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            expect(cacheService.get('temp', 'test-key')).toBeNull();
        });
        
        test('delete 동작', () => {
            cacheService.set('user', 'test-key', 'data');
            expect(cacheService.get('user', 'test-key')).toBe('data');
            
            cacheService.delete('user', 'test-key');
            expect(cacheService.get('user', 'test-key')).toBeNull();
        });
    });
    
    describe('Layer Management', () => {
        test('다른 레이어는 독립적', () => {
            cacheService.set('user', 'key1', 'userData');
            cacheService.set('game', 'key1', 'gameData');
            
            expect(cacheService.get('user', 'key1')).toBe('userData');
            expect(cacheService.get('game', 'key1')).toBe('gameData');
        });
        
        test('레이어별 flush', () => {
            cacheService.set('user', 'key1', 'data1');
            cacheService.set('user', 'key2', 'data2');
            cacheService.set('game', 'key1', 'gameData');
            
            cacheService.flush('user');
            
            expect(cacheService.get('user', 'key1')).toBeNull();
            expect(cacheService.get('user', 'key2')).toBeNull();
            expect(cacheService.get('game', 'key1')).toBe('gameData');
        });
    });
    
    describe('GetOrSet Pattern', () => {
        test('캐시 미스 시 함수 실행', async () => {
            const fetchFunction = jest.fn().mockResolvedValue({ id: 1, name: 'Test' });
            
            const result = await cacheService.getOrSet(
                'user',
                'user-1',
                fetchFunction,
                60
            );
            
            expect(result).toEqual({ id: 1, name: 'Test' });
            expect(fetchFunction).toHaveBeenCalledTimes(1);
        });
        
        test('캐시 히트 시 함수 미실행', async () => {
            const fetchFunction = jest.fn().mockResolvedValue({ id: 1, name: 'Test' });
            
            // 첫 번째 호출 - 캐시 미스
            await cacheService.getOrSet('user', 'user-1', fetchFunction, 60);
            
            // 두 번째 호출 - 캐시 히트
            const result = await cacheService.getOrSet('user', 'user-1', fetchFunction, 60);
            
            expect(result).toEqual({ id: 1, name: 'Test' });
            expect(fetchFunction).toHaveBeenCalledTimes(1); // 한 번만 호출됨
        });
    });
    
    describe('Statistics', () => {
        test('통계 수집', () => {
            // 캐시 미스
            cacheService.get('user', 'key1');
            
            // 캐시 히트
            cacheService.set('user', 'key2', 'data');
            cacheService.get('user', 'key2');
            
            const stats = cacheService.getStats();
            
            expect(stats.user.hits).toBe(1);
            expect(stats.user.misses).toBe(1);
            expect(stats.user.hitRate).toBe('50.00%');
        });
    });
    
    describe('Memory Management', () => {
        test('최대 키 제한', () => {
            // 최대 3개로 설정
            cacheService.setMaxKeys('test', 3);
            
            cacheService.set('test', 'key1', 'data1');
            cacheService.set('test', 'key2', 'data2');
            cacheService.set('test', 'key3', 'data3');
            cacheService.set('test', 'key4', 'data4'); // 이때 가장 오래된 것이 삭제됨
            
            // key1은 삭제되어야 함
            expect(cacheService.get('test', 'key1')).toBeNull();
            expect(cacheService.get('test', 'key4')).toBe('data4');
        });
    });
});