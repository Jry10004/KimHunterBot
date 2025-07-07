const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
    // 테스트 실행 순서 커스터마이징
    sort(tests) {
        // 복사본 생성
        const copyTests = Array.from(tests);
        
        return copyTests.sort((testA, testB) => {
            // 1. setup 파일을 먼저 실행
            if (testA.path.includes('setup')) return -1;
            if (testB.path.includes('setup')) return 1;
            
            // 2. 단위 테스트 -> 통합 테스트 -> E2E 테스트 순서
            const orderA = this.getTestOrder(testA.path);
            const orderB = this.getTestOrder(testB.path);
            
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            
            // 3. 실패한 테스트를 먼저 실행 (빠른 피드백)
            const statsA = this.getTestStats(testA.path);
            const statsB = this.getTestStats(testB.path);
            
            if (statsA && statsB) {
                if (statsA.failures > 0 && statsB.failures === 0) return -1;
                if (statsA.failures === 0 && statsB.failures > 0) return 1;
            }
            
            // 4. 실행 시간이 짧은 테스트부터
            if (statsA && statsB && statsA.duration !== statsB.duration) {
                return statsA.duration - statsB.duration;
            }
            
            // 5. 알파벳 순서
            return testA.path.localeCompare(testB.path);
        });
    }
    
    getTestOrder(path) {
        if (path.includes('/unit/')) return 1;
        if (path.includes('/integration/')) return 2;
        if (path.includes('/e2e/')) return 3;
        return 4;
    }
    
    getTestStats(path) {
        // Jest의 캐시된 테스트 통계 사용
        try {
            const cache = this.cache.get(path);
            return cache || null;
        } catch {
            return null;
        }
    }
}

module.exports = CustomSequencer;