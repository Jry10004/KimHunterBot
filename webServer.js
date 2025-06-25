const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/User');
const IPBan = require('./models/IPBan');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.WEB_PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 임시 인증 토큰 저장소 (실제로는 Redis 등을 사용하는 것이 좋습니다)
const authTokens = new Map();

// IP 가져오기 함수
function getClientIP(req) {
    // Cloudflare 실제 IP 헤더 확인
    const cfConnectingIP = req.headers['cf-connecting-ip'];
    if (cfConnectingIP) {
        return cfConnectingIP;
    }
    
    // 일반 프록시 헤더 확인
    const xRealIP = req.headers['x-real-ip'];
    if (xRealIP) {
        return xRealIP;
    }
    
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    
    // 기본 IP
    const ip = req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           req.connection.socket.remoteAddress;
           
    // IPv6 localhost를 IPv4로 변환
    if (ip === '::1') {
        return '127.0.0.1';
    }
    
    return ip;
}

// 인증 페이지
app.get('/auth/:token', async (req, res) => {
    const token = req.params.token;
    const authData = authTokens.get(token);
    
    if (!authData) {
        return res.send(`
            <html>
            <head>
                <title>강화왕 김헌터 RPG - 인증 오류</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .error { color: red; }
                </style>
            </head>
            <body>
                <h1>인증 오류</h1>
                <p class="error">유효하지 않거나 만료된 인증 링크입니다.</p>
            </body>
            </html>
        `);
    }
    
    // IP 수집
    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'];
    
    try {
        // IP 차단 확인
        const bannedIP = await IPBan.findOne({ ip: clientIP, active: true });
        if (bannedIP) {
            return res.send(`
                <html>
                <head>
                    <title>강화왕 김헌터 RPG - 접근 차단</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f8d7da; }
                        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
                        .blocked { color: #721c24; font-size: 24px; margin-bottom: 20px; }
                        .reason { color: #721c24; background: #f5c6cb; padding: 10px; border-radius: 5px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="blocked">⛔ 접근이 차단되었습니다</div>
                        <p>귀하의 IP 주소는 차단 목록에 있습니다.</p>
                        <div class="reason">
                            <strong>차단 사유:</strong> ${bannedIP.reason}<br>
                            <strong>차단일:</strong> ${bannedIP.bannedAt.toLocaleString('ko-KR')}
                        </div>
                        <p style="color: #666; font-size: 12px;">문의: sup.kimhunter@gmail.com</p>
                    </div>
                </body>
                </html>
            `);
        }
        
        // 사용자 정보 업데이트
        const user = await User.findOne({ discordId: authData.discordId });
        if (user) {
            // IP 정보 업데이트
            if (!user.registrationIP) {
                user.registrationIP = clientIP;
            }
            user.lastLoginIP = clientIP;
            
            // IP 히스토리에 추가
            user.ipHistory.push({
                ip: clientIP,
                timestamp: new Date(),
                action: authData.action || 'web_auth',
                userAgent: userAgent
            });
            
            await user.save();
            
            // 토큰 제거 (일회용)
            authTokens.delete(token);
            
            // 성공 페이지
            res.send(`
                <html>
                <head>
                    <title>강화왕 김헌터 RPG - 인증 완료</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f0f0f0; }
                        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
                        .success { color: green; font-size: 24px; margin-bottom: 20px; }
                        .info { color: #666; margin: 10px 0; }
                        .ip { font-family: monospace; background: #f5f5f5; padding: 5px 10px; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="success">✅ 인증 완료!</div>
                        <h2>${user.nickname}님, 환영합니다!</h2>
                        <div class="info">귀하의 IP 주소: <span class="ip">${clientIP}</span></div>
                        <div class="info">인증 시간: ${new Date().toLocaleString('ko-KR')}</div>
                        <hr>
                        <p>Discord로 돌아가서 게임을 계속하세요!</p>
                        <p style="color: #999; font-size: 12px;">이 창은 닫으셔도 됩니다.</p>
                    </div>
                </body>
                </html>
            `);
            
            // Discord에 알림 (선택사항)
            if (authData.callback) {
                authData.callback(true, clientIP);
            }
            
        } else {
            throw new Error('사용자를 찾을 수 없습니다.');
        }
        
    } catch (error) {
        console.error('인증 처리 오류:', error);
        res.send(`
            <html>
            <head>
                <title>강화왕 김헌터 RPG - 오류</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .error { color: red; }
                </style>
            </head>
            <body>
                <h1>처리 중 오류 발생</h1>
                <p class="error">인증 처리 중 오류가 발생했습니다. 관리자에게 문의하세요.</p>
            </body>
            </html>
        `);
    }
});

// IP 차단 체크 API
app.post('/api/check-ip', async (req, res) => {
    const clientIP = getClientIP(req);
    
    // 여기에 IP 차단 로직 구현
    // 예: 차단된 IP 목록과 비교
    
    res.json({ 
        ip: clientIP,
        blocked: false // 차단 여부
    });
});

// 이메일 추적 픽셀 (자동 IP 수집)
app.get('/track/:trackingId', async (req, res) => {
    const trackingId = req.params.trackingId;
    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'];
    
    // 모든 접속 로깅
    console.log(`🔍 추적 픽셀 접속: ${trackingId} - IP: ${clientIP}`);
    
    try {
        // trackingId에서 userId 추출
        const parts = trackingId.split('_');
        const userId = parts[0];
        
        if (userId && userId !== 'default' && userId !== 'test') {
            const user = await User.findOne({ discordId: userId });
            if (user) {
                // IP 정보 업데이트
                if (!user.registrationIP) {
                    user.registrationIP = clientIP;
                }
                user.lastLoginIP = clientIP;
                
                // IP 히스토리에 추가
                user.ipHistory.push({
                    ip: clientIP,
                    timestamp: new Date(),
                    action: 'email_open',
                    userAgent: userAgent
                });
                
                await user.save();
                console.log(`📧 이메일 추적: ${user.nickname} (${userId}) - IP: ${clientIP}`);
            } else {
                console.log(`⚠️ 사용자를 찾을 수 없음: ${userId}`);
            }
        }
    } catch (error) {
        console.error('추적 픽셀 처리 오류:', error);
    }
    
    // 1x1 투명 GIF 이미지 반환
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.end(pixel);
});

// 웹 서버 시작 함수
function startWebServer() {
    app.listen(PORT, () => {
        console.log(`🌐 웹 서버가 포트 ${PORT}에서 실행 중입니다.`);
        console.log(`📍 인증 URL 예시: http://localhost:${PORT}/auth/[token]`);
    });
}

// 인증 토큰 생성 함수
function generateAuthToken(discordId, action = 'verify', callback = null) {
    const token = crypto.randomBytes(32).toString('hex');
    authTokens.set(token, {
        discordId,
        action,
        callback,
        createdAt: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 1000) // 10분 후 만료
    });
    
    // 만료된 토큰 정리
    setInterval(() => {
        for (const [key, value] of authTokens.entries()) {
            if (value.expiresAt < Date.now()) {
                authTokens.delete(key);
            }
        }
    }, 60000); // 1분마다 정리
    
    return token;
}

module.exports = { startWebServer, generateAuthToken };