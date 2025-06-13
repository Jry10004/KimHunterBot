const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
    console.log('API 테스트 시작...\n');
    
    // 1. 인증 확인 테스트
    try {
        console.log('1. 인증 확인 테스트 (/api/check-auth)');
        const authCheckResponse = await axios.get(`${BASE_URL}/api/check-auth`);
        console.log('응답:', authCheckResponse.data);
        console.log('Content-Type:', authCheckResponse.headers['content-type']);
        console.log('✅ 성공\n');
    } catch (error) {
        console.log('❌ 실패:', error.response ? error.response.data : error.message);
        console.log('\n');
    }
    
    // 2. 인증 테스트
    try {
        console.log('2. 인증 테스트 (/api/authenticate)');
        const authResponse = await axios.post(`${BASE_URL}/api/authenticate`, {
            authCode: 'test-authentication-code-12345'
        });
        console.log('응답:', authResponse.data);
        console.log('Content-Type:', authResponse.headers['content-type']);
        console.log('✅ 성공\n');
    } catch (error) {
        console.log('❌ 실패:', error.response ? error.response.data : error.message);
        console.log('\n');
    }
    
    // 3. 봇 시작 테스트
    try {
        console.log('3. 봇 시작 테스트 (/api/start-bot)');
        const botStartResponse = await axios.post(`${BASE_URL}/api/start-bot`);
        console.log('응답:', botStartResponse.data);
        console.log('Content-Type:', botStartResponse.headers['content-type']);
        console.log('✅ 성공\n');
    } catch (error) {
        console.log('❌ 실패:', error.response ? error.response.data : error.message);
        console.log('\n');
    }
    
    // 4. 존재하지 않는 API 엔드포인트 테스트
    try {
        console.log('4. 404 테스트 (/api/non-existent)');
        const notFoundResponse = await axios.get(`${BASE_URL}/api/non-existent`);
        console.log('응답:', notFoundResponse.data);
        console.log('❌ 404 에러가 발생해야 하는데 성공함\n');
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log('응답:', error.response.data);
            console.log('Content-Type:', error.response.headers['content-type']);
            console.log('✅ 올바른 404 응답\n');
        } else {
            console.log('❌ 예상치 못한 에러:', error.message);
            console.log('\n');
        }
    }
    
    // 5. HTML 페이지 요청 테스트
    try {
        console.log('5. HTML 페이지 요청 테스트 (/)');
        const htmlResponse = await axios.get(`${BASE_URL}/`);
        console.log('Content-Type:', htmlResponse.headers['content-type']);
        console.log('응답 시작:', htmlResponse.data.substring(0, 100) + '...');
        console.log('✅ HTML 응답 확인\n');
    } catch (error) {
        console.log('❌ 실패:', error.message);
        console.log('\n');
    }
}

// 서버 URL을 인자로 받을 수 있도록 수정
const url = process.argv[2];
if (url) {
    BASE_URL = url;
}

console.log(`테스트 서버: ${BASE_URL}\n`);
testAPI();