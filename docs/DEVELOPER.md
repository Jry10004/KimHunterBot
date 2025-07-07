# 개발자 가이드

## 개발 환경 설정

### 1. 필수 도구
- Visual Studio Code (권장 에디터)
- Node.js 16+
- MongoDB Compass (DB 관리)
- Postman (API 테스트)
- Git

### 2. VS Code 확장 프로그램
- ESLint
- Prettier
- MongoDB for VS Code
- GitLens
- Thunder Client

### 3. 개발 설정
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript"],
  "prettier.requireConfig": true
}
```

## 코드 스타일 가이드

### 네이밍 규칙
- **파일명**: camelCase (예: userController.js)
- **클래스**: PascalCase (예: UserService)
- **함수/변수**: camelCase (예: getUserById)
- **상수**: UPPER_SNAKE_CASE (예: MAX_LEVEL)

### 코드 구조
```javascript
// 모듈 임포트 순서
// 1. Node.js 내장 모듈
const fs = require('fs');
const path = require('path');

// 2. 외부 라이브러리
const discord = require('discord.js');
const mongoose = require('mongoose');

// 3. 내부 모듈
const User = require('./models/User');
const logger = require('./services/Logger');

// 클래스 정의
class ExampleService {
    constructor() {
        // 초기화
    }
    
    // Public 메서드
    async publicMethod() {
        // 구현
    }
    
    // Private 메서드 (언더스코어 접두사)
    _privateMethod() {
        // 구현
    }
}

// 모듈 내보내기
module.exports = ExampleService;
```

## 새 기능 추가하기

### 1. 새 명령어 추가
```javascript
// commands/newCommand.js
const { SlashCommandBuilder } = require('discord.js');
const { secureCommand } = require('../security/SecurityMiddleware');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('newcommand')
        .setDescription('새로운 명령어'),
    
    security: secureCommand({
        rateLimit: true,
        validateInput: true,
        checkPermission: true
    }),
    
    async execute(interaction) {
        // 명령어 로직
        await interaction.reply('Hello World!');
    }
};
```

### 2. 새 모델 추가
```javascript
// models/NewModel.js
const mongoose = require('mongoose');

const newSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    value: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// 인덱스
newSchema.index({ name: 1 });

// 메서드
newSchema.methods.increment = function(amount) {
    this.value += amount;
    return this.save();
};

module.exports = mongoose.model('NewModel', newSchema);
```

### 3. 새 서비스 추가
```javascript
// services/NewService.js
const logger = require('./Logger');
const cacheService = require('./CacheService');

class NewService {
    constructor() {
        this.cache = cacheService;
    }
    
    async getData(id) {
        // 캐시 확인
        const cached = this.cache.get('new', id);
        if (cached) return cached;
        
        // DB 조회
        const data = await this.fetchFromDB(id);
        
        // 캐시 저장
        this.cache.set('new', id, data, 300);
        
        return data;
    }
}

module.exports = new NewService();
```

## 테스트 작성

### 단위 테스트
```javascript
// tests/unit/services/NewService.test.js
const NewService = require('../../../services/NewService');

describe('NewService', () => {
    describe('getData', () => {
        test('캐시에서 데이터 반환', async () => {
            const mockData = { id: 1, name: 'Test' };
            cacheService.get = jest.fn().mockReturnValue(mockData);
            
            const result = await NewService.getData(1);
            
            expect(result).toEqual(mockData);
            expect(cacheService.get).toHaveBeenCalledWith('new', 1);
        });
    });
});
```

### 통합 테스트
```javascript
// tests/integration/commands/newCommand.test.js
describe('New Command Integration', () => {
    test('명령어 실행', async () => {
        const interaction = createMockInteraction({
            command: 'newcommand'
        });
        
        await commands.newcommand.execute(interaction);
        
        expect(interaction.replied).toBe(true);
        expect(interaction.getLastReply().content).toBe('Hello World!');
    });
});
```

## 디버깅

### 로그 레벨
```javascript
// 개발 환경에서 상세 로그
LOG_LEVEL=debug

// 로그 사용
logger.debug('상세 디버그 정보', { data });
logger.info('일반 정보');
logger.warn('경고');
logger.error('에러', { error });
```

### 디버거 사용
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Bot",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/index.js",
      "envFile": "${workspaceFolder}/.env"
    }
  ]
}
```

## 성능 최적화

### 1. 캐싱 활용
```javascript
// 자주 조회되는 데이터 캐싱
const userData = await cacheService.getOrSet(
    'user',
    userId,
    () => User.findOne({ discordId: userId }),
    3600 // 1시간
);
```

### 2. 데이터베이스 쿼리 최적화
```javascript
// 나쁨: N+1 쿼리
const users = await User.find();
for (const user of users) {
    const items = await Item.find({ userId: user._id });
}

// 좋음: 조인 사용
const users = await User.aggregate([
    { $lookup: {
        from: 'items',
        localField: '_id',
        foreignField: 'userId',
        as: 'items'
    }}
]);
```

### 3. 비동기 처리
```javascript
// 나쁨: 순차 처리
const user = await User.findById(id);
const items = await Item.find({ userId: id });
const stats = await Stats.findOne({ userId: id });

// 좋음: 병렬 처리
const [user, items, stats] = await Promise.all([
    User.findById(id),
    Item.find({ userId: id }),
    Stats.findOne({ userId: id })
]);
```

## Git 워크플로우

### 브랜치 전략
- `main`: 프로덕션 브랜치
- `develop`: 개발 브랜치
- `feature/*`: 기능 개발
- `bugfix/*`: 버그 수정
- `hotfix/*`: 긴급 수정

### 커밋 메시지
```
<type>: <subject>

<body>

<footer>
```

**Type:**
- feat: 새 기능
- fix: 버그 수정
- docs: 문서 수정
- style: 코드 포맷팅
- refactor: 리팩토링
- test: 테스트 추가
- chore: 빌드, 설정 수정

**예시:**
```
feat: 거래 시스템 구현

- 아이템 거래 기능 추가
- 거래 내역 저장
- 거래 수수료 적용

Closes #123
```

## 문제 해결 체크리스트

### 개발 중 일반적인 문제

1. **모듈을 찾을 수 없음**
   - 경로 확인
   - npm install 실행
   - require 구문 확인

2. **비동기 에러**
   - async/await 사용
   - Promise 체인 확인
   - 에러 핸들링 추가

3. **메모리 누수**
   - 이벤트 리스너 정리
   - 타이머 정리
   - 큰 객체 참조 해제

## 유용한 스니펫

### 에러 핸들링
```javascript
try {
    // 위험한 작업
} catch (error) {
    logger.error('작업 실패', {
        error: error.message,
        stack: error.stack,
        context: { /* 추가 정보 */ }
    });
    
    // 사용자에게 친화적인 메시지
    await interaction.reply({
        content: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true
    });
}
```

### 트랜잭션 처리
```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
    // 여러 DB 작업
    await User.updateOne({ _id: userId }, update, { session });
    await Item.create([newItem], { session });
    
    await session.commitTransaction();
} catch (error) {
    await session.abortTransaction();
    throw error;
} finally {
    session.endSession();
}
```

## 리소스

- [Discord.js 가이드](https://discordjs.guide/)
- [Mongoose 문서](https://mongoosejs.com/docs/)
- [Node.js 베스트 프랙티스](https://github.com/goldbergyoni/nodebestpractices)
- [JavaScript 스타일 가이드](https://github.com/airbnb/javascript)
