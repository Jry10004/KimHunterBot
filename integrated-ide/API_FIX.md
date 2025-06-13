# API HTML 반환 문제 해결

## 문제점
API 호출 시 JSON 대신 HTML이 반환되는 문제가 발생했습니다.

## 원인
1. **미들웨어 순서 문제**: Express에서 정적 파일 미들웨어가 API 라우트보다 먼저 선언되어 있었습니다.
2. **Content-Type 헤더 누락**: API 응답에 명시적인 Content-Type 설정이 없었습니다.
3. **에러 핸들링 부족**: 에러 발생 시 HTML 에러 페이지가 반환될 수 있었습니다.
4. **return 문 누락**: 일부 응답 후 코드 실행이 계속되어 예상치 못한 응답이 발생할 수 있었습니다.

## 해결 방법

### 1. 미들웨어 순서 조정
```javascript
// 이전 (문제가 있는 코드)
app.use(express.static(path.join(__dirname, 'web')));
app.use(express.json());

// 수정 후
app.use(express.json()); // JSON 파싱을 먼저
app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});
app.use(express.static(path.join(__dirname, 'web'))); // 정적 파일은 나중에
```

### 2. API 응답에 명시적 return 추가
```javascript
// 이전
res.json({ success: true });

// 수정 후
return res.json({ success: true });
```

### 3. 404 및 에러 핸들러 추가
```javascript
// 404 핸들러
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.redirect('/');
});

// 에러 핸들러
app.use((err, req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ 
            error: 'Internal server error',
            message: err.message 
        });
    }
    res.status(500).send('서버 오류가 발생했습니다.');
});
```

### 4. /api/check-auth 엔드포인트 추가
클라이언트가 인증 상태를 확인할 수 있도록 GET 엔드포인트를 추가했습니다.

## 테스트 방법

1. 서버 시작:
```bash
node server.js
```

2. API 테스트:
```bash
node test-api.js
```

3. 브라우저에서 확인:
- http://localhost:3000 - HTML 페이지가 표시되어야 함
- http://localhost:3000/api/check-auth - JSON 응답이 표시되어야 함

## 수정된 파일
- `server.js`
- `full-server.js`
- `simple-server.js`

## 추가된 파일
- `test-api.js` - API 엔드포인트 테스트 스크립트
- `API_FIX.md` - 이 문서

## 주의사항
- API 엔드포인트는 항상 `/api/`로 시작해야 합니다
- 모든 API 응답은 명시적으로 `return`을 사용해야 합니다
- 에러 발생 시 적절한 HTTP 상태 코드와 JSON 응답을 반환해야 합니다