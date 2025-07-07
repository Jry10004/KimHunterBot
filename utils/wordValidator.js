const axios = require('axios');
require('dotenv').config();

// 한방 단어 체크
const hanBangChars = ['늄', '듐', '륨', '퀸', '슘', '늬', '틴', '녘', '숍'];

// 국립국어원 표준국어대사전 API를 사용한 단어 검증
async function validateWordAPI(word) {
    // 기본 검증
    if (!word || word.length < 2) return false;
    if (!/^[가-힣]+$/.test(word)) return false;
    
    // 이상한 패턴 필터링
    const strangePatterns = [
        /[ㄱ-ㅎㅏ-ㅣ]/,  // 자음/모음만 있는 경우
        /(.)\1{3,}/,      // 같은 글자가 4번 이상 반복
        /^[가-힣]$/       // 1글자
    ];
    
    for (const pattern of strangePatterns) {
        if (pattern.test(word)) return false;
    }
    
    try {
        // 국립국어원 표준국어대사전 API
        const apiKey = process.env.URIMAL_API_KEY;
        if (!apiKey) {
            console.error('[단어 API] API 키가 설정되지 않았습니다!');
            return false;
        }
        
        const response = await axios.get('https://stdict.korean.go.kr/api/search.do', {
            params: {
                key: apiKey,
                q: word,
                req_type: 'json',
                start: 1,
                num: 10
            },
            timeout: 3000
        });
        
        // API 응답 검증
        if (response.data && response.data.channel) {
            const items = response.data.channel.item;
            if (items) {
                // 정확히 일치하는 단어가 있는지 확인
                // 배열이 아닌 경우 배열로 변환
                const itemArray = Array.isArray(items) ? items : [items];
                
                // 정확히 일치하는 단어가 있는지 확인
                const exactMatch = itemArray.some(item => {
                    const cleanWord = item.word.replace(/[^가-힣]/g, ''); // 특수문자 제거
                    return cleanWord === word;
                });
                
                if (exactMatch) {
                    console.log(`[국립국어원 API] ${word} - 표준국어대사전에 있음`);
                    return true;
                }
            }
        }
        
        console.log(`[국립국어원 API] ${word} - 사전에 없음`);
        return false;
    } catch (error) {
        console.error(`[국립국어원 API] ${word} - API 오류: ${error.message}`);
        return false;
    }
}

// 단어 검증 - 무조건 API로만 검증
async function validateWord(word) {
    return await validateWordAPI(word);
}

// 한방 단어인지 확인
function isHanBangWord(word) {
    if (!word || word.length < 1) return false;
    return hanBangChars.includes(word[word.length - 1]);
}

// 초성 추출
function extractChosung(word) {
    const cho = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    let result = '';
    
    for (let i = 0; i < word.length; i++) {
        const code = word.charCodeAt(i) - 44032;
        if (code > -1 && code < 11172) {
            result += cho[Math.floor(code / 588)];
        }
    }
    
    return result;
}

// 봇용 단어 목록 (기본 단어들 - API 검증 필요)
const botWords = {
    쉬움: [
        '사과', '바나나', '학교', '친구', '하늘', '강아지', '고양이', '나무', '음악', '영화',
        '컴퓨터', '책상', '차량', '집', '밥', '물', '불', '바람', '비', '눈',
        '구름', '차', '버스', '기차', '자동차', '비행기', '배', '택시', '공원', '도서관'
    ].filter(w => w.length <= 3),
    
    보통: [
        '사과', '바나나', '학교', '친구', '하늘', '강아지', '고양이', '나무', '음악', '영화',
        '컴퓨터', '책상', '차량', '김치', '한국', '게임', '학생', '선생님', '과학', '예술',
        '운동', '독서', '여행', '음식', '사람', '가족', '친척', '동물', '식물', '자연',
        '도시', '시골', '바다', '산', '강', '호수', '섬', '건물', '아파트', '집'
    ].filter(w => w.length <= 4),
    
    어려움: [
        '컴퓨터', '프로그램', '인터넷', '스마트폰', '텔레비전', '랩탑', '키보드', '마우스',
        '모니터', '스피커', '프린터', '카메라', '전화기', '에어컨', '냉장고', '세탁기',
        '청소기', '전자레인지', '믹서기', '토스터', '커피머신', '전기밥솥', '에어프라이어',
        '제습기', '가습기', '공기청정기', '전기히터', '선풍기', '차량', '자동차', '비행기',
        '기차', '배', '택시', '버스', '트럭', '오토바이', '자전거', '스쿠터', '헬리콥터'
    ]
};

module.exports = {
    validateWord,
    validateWordAPI,
    isHanBangWord,
    extractChosung,
    botWords
};