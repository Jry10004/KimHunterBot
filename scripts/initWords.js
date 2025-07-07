const mongoose = require('mongoose');
const Word = require('../models/Word');
const { validateWordAPI, extractChosung, isHanBangWord } = require('../utils/wordValidator');
require('dotenv').config();

const commonWords = [
    // 2글자 기본 단어들
    '가구', '가방', '가위', '가지', '각도', '감기', '강물', '거리', '거울', '게임',
    '고기', '고래', '고양', '공기', '공원', '과일', '교실', '구름', '국가', '국어',
    '그림', '기계', '기름', '기분', '기차', '김치', '까치', '꽃병', '나라', '나무',
    '날개', '남자', '내일', '노래', '눈물', '다리', '달력', '대학', '도시', '도서',
    '동물', '동생', '두부', '라면', '마을', '마음', '모자', '목욕', '무지', '문제',
    '물고', '바다', '바람', '반지', '발목', '방향', '배추', '버스', '병원', '보람',
    '부모', '비행', '빨래', '사과', '사람', '사진', '산책', '상자', '생각', '생활',
    '서랍', '선물', '설탕', '소금', '소리', '손목', '수박', '수업', '숙제', '시간',
    '시장', '신발', '실내', '아기', '아침', '안경', '야구', '약속', '양말', '어른',
    '언어', '여름', '여자', '연필', '영화', '예술', '오늘', '옷장', '우산', '우유',
    '운동', '원숭', '음식', '음악', '의사', '이름', '인간', '일본', '자동', '자리',
    '장갑', '장소', '재미', '전화', '점심', '정원', '종이', '주말', '주소', '지구',
    '지도', '직업', '진실', '차량', '책상', '천사', '청소', '초록', '축구', '친구',
    '커피', '컴퓨', '태양', '토끼', '통신', '학교', '학생', '한국', '할머', '해변',
    '행복', '현재', '형제', '호수', '화면', '회사', '휴일', '희망',
    
    // 3글자 단어들
    '가나다', '가로수', '가족들', '감사함', '거북이', '건강함', '고등어', '고마움',
    '과학자', '교과서', '구두쇠', '국수집', '그리움', '기념품', '기쁨이', '김밥집',
    '까마귀', '나무꾼', '날씨가', '노란색', '눈사람', '다람쥐', '달나라', '대나무',
    '도서관', '동화책', '따뜻함', '라디오', '마법사', '모래성', '목도리', '무지개',
    '미술관', '바나나', '방학날', '배고픔', '벚꽃이', '보물섬', '부엌칼', '비둘기',
    '빨간색', '사과나', '사탕을', '산토끼', '생일날', '선생님', '설날날', '소나무',
    '손가락', '수영장', '숙제함', '시골길', '신나게', '아름답', '안녕히', '양념장',
    '어머니', '여행지', '연못가', '영어책', '예쁘게', '오렌지', '우체국', '운동장',
    '음악실', '이야기', '인사말', '자전거', '장난감', '재미남', '전등불', '정답게',
    '종소리', '즐거움', '지렁이', '진달래', '참새들', '책가방', '천둥이', '청개구',
    '초등생', '축하함', '친구야', '컴퓨터', '코끼리', '태극기', '토마토', '파란색',
    '학용품', '할아버', '해바라', '행복함', '호랑이', '화가남', '회색빛', '흰구름'
];

async function initializeWords() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 기존 단어 모두 삭제
        await Word.deleteMany({});
        console.log('🗑️ 기존 단어 데이터 삭제 완료');

        let addedCount = 0;
        let failedCount = 0;

        // 기본 단어들 추가
        for (const word of commonWords) {
            try {
                // API로 검증
                const isValidInAPI = await validateWordAPI(word);
                
                await Word.addOrUpdate(word, isValidInAPI ? 'urimal' : 'local');
                addedCount++;
                
                if (addedCount % 10 === 0) {
                    console.log(`📝 ${addedCount}개 단어 추가 중...`);
                }
            } catch (error) {
                console.error(`❌ "${word}" 추가 실패:`, error.message);
                failedCount++;
            }
        }

        console.log(`\n✅ 단어 초기화 완료!`);
        console.log(`📊 통계:`);
        console.log(`  - 추가 성공: ${addedCount}개`);
        console.log(`  - 추가 실패: ${failedCount}개`);
        console.log(`  - 총 단어 수: ${await Word.countDocuments()}개`);

        // 한방 단어 확인
        const hanBangWords = await Word.find({ isHanBang: true });
        console.log(`  - 한방 단어: ${hanBangWords.length}개`);

        process.exit(0);
    } catch (error) {
        console.error('❌ 초기화 실패:', error);
        process.exit(1);
    }
}

initializeWords();