const BaseAPIClient = require('../../../services/api/BaseAPIClient');
const nock = require('nock');

describe('BaseAPIClient Integration', () => {
    let apiClient;
    const baseURL = 'https://api.test.com';
    
    beforeEach(() => {
        apiClient = new BaseAPIClient({
            baseURL,
            timeout: 5000,
            retryConfig: {
                retries: 2,
                retryDelay: 100
            }
        });
        
        // nock 초기화
        nock.cleanAll();
    });
    
    afterEach(() => {
        nock.cleanAll();
    });
    
    describe('Request Handling', () => {
        test('성공적인 GET 요청', async () => {
            const mockData = { id: 1, name: 'Test' };
            
            nock(baseURL)
                .get('/users/1')
                .reply(200, mockData);
            
            const response = await apiClient.get('/users/1');
            expect(response.data).toEqual(mockData);
        });
        
        test('POST 요청 with 데이터', async () => {
            const postData = { name: 'New User', email: 'test@test.com' };
            const responseData = { id: 2, ...postData };
            
            nock(baseURL)
                .post('/users', postData)
                .reply(201, responseData);
            
            const response = await apiClient.post('/users', postData);
            expect(response.data).toEqual(responseData);
        });
        
        test('헤더 전달', async () => {
            nock(baseURL)
                .get('/protected')
                .matchHeader('authorization', 'Bearer test-token')
                .reply(200, { success: true });
            
            apiClient.setAuthToken('test-token');
            const response = await apiClient.get('/protected');
            
            expect(response.data.success).toBe(true);
        });
    });
    
    describe('Error Handling', () => {
        test('404 에러', async () => {
            nock(baseURL)
                .get('/not-found')
                .reply(404, { error: 'Not Found' });
            
            await expect(apiClient.get('/not-found'))
                .rejects.toThrow('Request failed with status code 404');
        });
        
        test('네트워크 에러', async () => {
            nock(baseURL)
                .get('/network-error')
                .replyWithError('Network Error');
            
            await expect(apiClient.get('/network-error'))
                .rejects.toThrow('Network Error');
        });
        
        test('타임아웃', async () => {
            const slowClient = new BaseAPIClient({
                baseURL,
                timeout: 100
            });
            
            nock(baseURL)
                .get('/slow')
                .delay(200)
                .reply(200);
            
            await expect(slowClient.get('/slow'))
                .rejects.toThrow();
        });
    });
    
    describe('Retry Logic', () => {
        test('일시적 실패 후 재시도 성공', async () => {
            nock(baseURL)
                .get('/flaky')
                .reply(500)
                .get('/flaky')
                .reply(200, { success: true });
            
            const response = await apiClient.get('/flaky');
            expect(response.data.success).toBe(true);
        });
        
        test('최대 재시도 횟수 초과', async () => {
            nock(baseURL)
                .get('/always-fail')
                .times(3) // 초기 시도 + 2번 재시도
                .reply(500);
            
            await expect(apiClient.get('/always-fail'))
                .rejects.toThrow();
        });
    });
    
    describe('Caching', () => {
        test('캐시된 응답 반환', async () => {
            nock(baseURL)
                .get('/cached')
                .once() // 한 번만 호출됨
                .reply(200, { data: 'cached' });
            
            // 첫 번째 요청
            const response1 = await apiClient.get('/cached');
            expect(response1.data).toEqual({ data: 'cached' });
            
            // 두 번째 요청 (캐시에서)
            const response2 = await apiClient.get('/cached');
            expect(response2.data).toEqual({ data: 'cached' });
        });
        
        test('POST 요청은 캐시하지 않음', async () => {
            nock(baseURL)
                .post('/data')
                .twice()
                .reply(200, { id: 1 });
            
            await apiClient.post('/data', { test: true });
            await apiClient.post('/data', { test: true });
            
            // 두 번 모두 실제 요청이 발생해야 함
            expect(nock.isDone()).toBe(true);
        });
    });
    
    describe('Rate Limiting', () => {
        test('Rate limit 헤더 처리', async () => {
            nock(baseURL)
                .get('/rate-limited')
                .reply(429, { error: 'Too Many Requests' }, {
                    'Retry-After': '2'
                });
            
            const startTime = Date.now();
            
            try {
                await apiClient.get('/rate-limited');
            } catch (error) {
                expect(error.response.status).toBe(429);
                
                // Rate limit 정보가 저장되어야 함
                const rateLimitInfo = apiClient.getRateLimitInfo();
                expect(rateLimitInfo).toBeDefined();
            }
        });
    });
});