# 🎮 미니게임 핸들러 모듈

원본 index.js의 미니게임 코드를 모듈화하여 분리한 핸들러들입니다.

## 📁 파일 구조

```
handlers/minigames/
├── monsterBattle.js    # 몬스터 배틀 아레나
├── mushroomGame.js     # 독버섯 게임
├── slotMachine.js      # 슬롯머신
├── rockPaperScissors.js # 가위바위보
├── wordGames.js        # 워드게임 (초성게임, 끝말잇기)
└── README.md           # 이 파일
```

## 🎯 각 게임 설명

### 1. 몬스터 배틀 아레나 (monsterBattle.js)
- **설명**: 1~100 레벨 몬스터가 랜덤 등장, 특성 예측하여 베팅
- **주요 기능**:
  - 홀수/짝수, 약한/강한 몬스터 예측
  - 다중 베팅 시스템
  - 연승 보너스
  - 특별 이벤트 (치명타, 차원의 균열 등)

### 2. 독버섯 게임 (mushroomGame.js)
- **설명**: 12개 버섯 중 독버섯을 피하고 생존하는 게임
- **게임 모드**:
  - 혼자 플레이
  - 봇과 대결
  - 유저와 대결 (매칭 시스템)
  - 멀티플레이어 (최대 4명)
- **특수 버섯**: 황금버섯, 미스터리버섯

### 3. 슬롯머신 (slotMachine.js)
- **설명**: 김헌터 테마 슬롯머신
- **주요 기능**:
  - 8종류 심볼 (김헌터, 다이아몬드, 스타 등)
  - 잭팟 시스템 (김헌터 3개)
  - 자동 스핀 기능
  - 스핀 기록 및 통계

### 4. 가위바위보 (rockPaperScissors.js)
- **게임 모드**:
  - 봇 대전 (티켓 시스템)
  - 유저 대전 (1:1 매칭)
  - 베팅 모드 (골드 베팅)
- **티켓 시스템**: 5분마다 1개 재생성, 최대 20개

### 5. 워드게임 (wordGames.js)
- **초성게임**:
  - 제시된 초성에 맞는 단어 맞추기
  - 15초 제한시간
  - 5라운드 진행
  - 난이도별 초성 (쉬움 2글자, 보통 3글자, 어려움 4글자)
  
- **끝말잇기**:
  - 앞 단어의 마지막 글자로 시작하는 단어
  - 10초 제한시간
  - 한방단어 시스템
  - 마지막 생존자가 승리

## 🔧 기술적 특징

### 공통 기능
- 임시 채널 생성 시스템
- 관전자 베팅 시스템 연동
- 봇 플레이어 AI
- 세션 관리 및 자동 정리
- 통계 추적 시스템

### 데이터 구조
```javascript
// 게임 세션 예시
{
  gameId: string,
  players: Map<userId, playerData>,
  gameState: object,
  tempChannel: Channel,
  createdAt: timestamp
}
```

### 상호작용 패턴
```javascript
// 모든 게임이 동일한 패턴 사용
async function handleGameInteraction(interaction) {
  const customId = interaction.customId;
  
  if (customId === 'game_menu') {
    return await game.showMenu(interaction);
  }
  // ... 각 게임별 처리
}
```

## 📊 성능 최적화

- **세션 관리**: Map 구조로 빠른 조회
- **메모리 관리**: 30분 이상된 세션 자동 정리
- **타이머 정리**: 게임 종료시 모든 타이머 clear
- **채널 관리**: 게임 종료 5분 후 임시 채널 자동 삭제

## 🔗 의존성

- Discord.js v14
- User 모델 (MongoDB)
- 게임별 데이터 파일:
  - `/data/mushroomGame.js`
  - `/data/mushroomGameEnhanced.js`
  - `/data/mushroomGameImproved.js`
  - `/data/wordList.js`
  - `/data/spectatorBetting.js`

## 📝 사용법

handlers/index.js에서 각 게임의 customId 패턴에 따라 라우팅됩니다:

```javascript
if (customId.includes('monster_')) {
  const { handleMonsterBattleInteraction } = require('./minigames/monsterBattle');
  return await handleMonsterBattleInteraction(interaction);
}
```

## 🚀 추가 개발 가이드

새로운 미니게임 추가시:
1. `/handlers/minigames/` 폴더에 새 파일 생성
2. 게임 클래스 및 핸들러 함수 구현
3. `/handlers/index.js`에 라우팅 추가
4. 필요한 데이터 파일은 `/data/` 폴더에 생성

---

모든 미니게임 핸들러는 원본 index.js의 기능을 100% 보존하면서 모듈화되었습니다.