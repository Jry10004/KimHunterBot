// 게임 액션별 GIF 애니메이션 URL 모음
const GAME_GIFS = {
    // 사냥 관련
    hunting: {
        start: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyC/giphy.gif', // 사냥 시작
        attack: 'https://media.giphy.com/media/xUPGcz2H1TXdCz4suY/giphy.gif', // 공격
        victory: 'https://media.giphy.com/media/l3q2Z9667uYOVOod2/giphy.gif', // 승리
        defeat: 'https://media.giphy.com/media/d2W7eZX5z62ziqdi/giphy.gif', // 패배
        critical: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnG/giphy.gif' // 크리티컬
    },
    
    // 상점/가차 관련
    shop: {
        purchase: 'https://media.giphy.com/media/67ThRZM9fBq9y/giphy.gif', // 구매
        gacha: 'https://media.giphy.com/media/DhstvI3zZ4pgYl2hUq/giphy.gif', // 가차
        jackpot: 'https://media.giphy.com/media/5VKbfrlwiM9cY/giphy.gif', // 대박
        sold: 'https://media.giphy.com/media/xT5LMFfqi3FZ6Q3gYM/giphy.gif' // 판매
    },
    
    // 던전 관련
    dungeon: {
        enter: 'https://media.giphy.com/media/3o6gDPXMNxFhvHCcPC/giphy.gif', // 입장
        battle: 'https://media.giphy.com/media/l0HlFZ3c4NENSMQsU/giphy.gif', // 전투
        boss: 'https://media.giphy.com/media/VdWnBa3I6sZmY/giphy.gif', // 보스전
        treasure: 'https://media.giphy.com/media/xT5LMunCnfMUdJiAKs/giphy.gif', // 보물
        escape: 'https://media.giphy.com/media/3o7TKP9ln2Dr6ze6f6/giphy.gif' // 탈출
    },
    
    // 강화 관련
    enhancement: {
        start: 'https://media.giphy.com/media/26BRsQk8PxqaBxPVK/giphy.gif', // 강화 시작
        success: 'https://media.giphy.com/media/xT5LMESsx1kUe3Hiyk/giphy.gif', // 성공
        failure: 'https://media.giphy.com/media/3oEjI8JeFozLGfr5DO/giphy.gif', // 실패
        destroy: 'https://media.giphy.com/media/xT0xeJpnrVAyfX5sRy/giphy.gif' // 파괴
    },
    
    // 운동/활동 관련
    exercise: {
        workout: 'https://media.giphy.com/media/3o6ZtrbzjGAAXyx2WA/giphy.gif', // 운동
        running: 'https://media.giphy.com/media/l2Jhok92mZ2PG5Qsg/giphy.gif', // 달리기
        rest: 'https://media.giphy.com/media/krP2k0HJzQiD6/giphy.gif', // 휴식
        levelup: 'https://media.giphy.com/media/xT5LMESsx1kUe3Hiyk/giphy.gif' // 레벨업
    },
    
    // PVP 관련
    pvp: {
        challenge: 'https://media.giphy.com/media/l0HlQXtUlrLkdcNDW/giphy.gif', // 도전
        fight: 'https://media.giphy.com/media/xT5LMyKEOVCZDaAhRS/giphy.gif', // 대결
        win: 'https://media.giphy.com/media/xT5LMFZ5l4CETJTfHy/giphy.gif', // 승리
        lose: 'https://media.giphy.com/media/xT5LMFnKnhOcLTpEek/giphy.gif' // 패배
    },
    
    // 기타 액션
    misc: {
        loading: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', // 로딩
        error: 'https://media.giphy.com/media/xT5LMJMYlc9XhSDW1y/giphy.gif', // 에러
        success: 'https://media.giphy.com/media/xT5LMESsx1kUe3Hiyk/giphy.gif', // 성공
        thinking: 'https://media.giphy.com/media/a5viI92PAqkBa/giphy.gif', // 생각중
        celebration: 'https://media.giphy.com/media/l3q2Z9667uYOVOod2/giphy.gif' // 축하
    }
};

module.exports = GAME_GIFS;