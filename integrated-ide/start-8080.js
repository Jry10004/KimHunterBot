const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'web')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

app.get('/test', (req, res) => {
    res.send(`
        <h1>🎮 KimHunter IDE</h1>
        <h2>포트 8080에서 실행 중!</h2>
        <p>현재 시간: ${new Date().toLocaleString()}</p>
        <a href="/">메인 페이지로 이동</a>
    `);
});

app.post('/api/authenticate', (req, res) => {
    res.json({ success: true, message: '인증 성공!' });
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`🎮 KimHunter IDE가 포트 ${PORT}에서 실행 중입니다!`);
    console.log(`🌐 브라우저에서 http://localhost:${PORT} 에 접속하세요`);
    console.log(`🧪 테스트: http://localhost:${PORT}/test`);
});