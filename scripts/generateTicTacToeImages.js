const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// 진행 상황 추적
let generated = 0;
let failed = 0;
let skipped = 0;

// HTML 최적화 함수
function minifyHTML(html) {
    return html
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><')
        .replace(/<!--.*?-->/g, '')
        .replace(/\s*{\s*/g, '{')
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*:\s*/g, ':')
        .replace(/\s*;\s*/g, ';')
        .trim();
}

// 보드 상태를 문자열로 변환
function boardToString(board) {
    return board.map(cell => cell === 'X' ? '1' : cell === 'O' ? '2' : '0').join('');
}

// 보드 HTML 생성
function createBoardHTML(board, player1Name = 'Player 1', player2Name = 'Player 2', winPattern = [], lastMove = null) {
    const xCount = board.filter(cell => cell === 'X').length;
    const oCount = board.filter(cell => cell === 'O').length;
    const isXActive = xCount <= oCount;
    
    const rawHTML = `<!DOCTYPE html>
<html>
<head>
<style>
*{margin:0;padding:0}
body{width:450px;height:550px;background:#fff;font-family:Arial,sans-serif}
.h{text-align:center;padding:15px 0;font-size:24px;font-weight:bold;color:#333}
.p{display:flex;justify-content:space-around;margin:0 30px 15px;font-size:16px}
.n{padding:5px 15px;border-radius:15px;background:${isXActive?'#e3f2fd':'#f0f0f0'}}
.n2{background:${!isXActive?'#e3f2fd':'#f0f0f0'}}
.t{text-align:center;margin:10px 0;font-size:18px;font-weight:bold;color:${isXActive?'#e74c3c':'#3498db'}}
.g{display:grid;grid-template:repeat(3,120px)/repeat(3,120px);gap:8px;padding:10px;margin:0 auto;width:fit-content;background:#222}
.c{background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:50px;border-radius:8px}
.w{background:#ffd700!important}
.l{background:#c8ffc8!important}
</style>
</head>
<body>
<div class="h">TIC TAC TOE</div>
<div class="p">
<span class="n">❌ ${player1Name}</span>
<span>VS</span>
<span class="n2">⭕ ${player2Name}</span>
</div>
<div class="t">${isXActive ? `${player1Name}님의 턴입니다!` : `${player2Name}님의 턴입니다!`} (15초)</div>
<div class="g">
${board.map((cell,i)=>{
let cls='c';
if(winPattern.includes(i))cls+=' w';
else if(i===lastMove)cls+=' l';
return`<div class="${cls}">${cell==='X'?'❌':cell==='O'?'⭕':''}</div>`;
}).join('')}
</div>
</body>
</html>`;
    
    return minifyHTML(rawHTML);
}

// 승리 패턴 확인
function checkWin(board) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // 가로
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // 세로
        [0, 4, 8], [2, 4, 6] // 대각선
    ];
    
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return pattern;
        }
    }
    
    return null;
}

// 게임이 유효한지 확인
function isValidGameState(board) {
    const xCount = board.filter(cell => cell === 'X').length;
    const oCount = board.filter(cell => cell === 'O').length;
    
    // X와 O의 개수 차이는 0 또는 1이어야 함
    if (Math.abs(xCount - oCount) > 1) return false;
    
    // 둘 다 승리할 수는 없음
    const xWin = checkWin(board.map(cell => cell === 'X' ? 'X' : null));
    const oWin = checkWin(board.map(cell => cell === 'O' ? 'O' : null));
    if (xWin && oWin) return false;
    
    return true;
}

// 필수 게임 상태 생성
function generateEssentialStates() {
    const states = [];
    
    // 1. 빈 보드
    states.push({
        board: Array(9).fill(null),
        priority: 1
    });
    
    // 2. 첫 수 (9개)
    for (let i = 0; i < 9; i++) {
        const board = Array(9).fill(null);
        board[i] = 'X';
        states.push({
            board: board,
            priority: 1,
            lastMove: i
        });
    }
    
    // 3. 중요한 2수 상태 (센터 및 코너)
    const importantFirstMoves = [4, 0, 2, 6, 8]; // 센터와 코너
    const importantSecondMoves = [4, 0, 2, 6, 8, 1, 3, 5, 7]; // 모든 위치
    
    for (const first of importantFirstMoves) {
        for (const second of importantSecondMoves) {
            if (first !== second) {
                const board = Array(9).fill(null);
                board[first] = 'X';
                board[second] = 'O';
                states.push({
                    board: board,
                    priority: 2,
                    lastMove: second
                });
            }
        }
    }
    
    // 4. 중요한 3수 상태 (승부처)
    generateCriticalThreeMoveStates(states);
    
    // 5. 승리 상태들
    generateWinStates(states);
    
    return states;
}

// 중요한 3수 상태 생성
function generateCriticalThreeMoveStates(states) {
    // 코너 오프닝 후 중요한 패턴들
    const criticalPatterns = [
        { board: ['X', null, null, null, 'O', null, null, null, 'X'], lastMove: 8 }, // 대각선 공격
        { board: ['X', null, 'O', null, 'X', null, null, null, null], lastMove: 4 }, // 센터 장악
        { board: ['X', 'O', null, null, null, null, null, null, 'X'], lastMove: 8 }, // 코너 투 코너
    ];
    
    criticalPatterns.forEach(pattern => {
        if (isValidGameState(pattern.board)) {
            states.push({
                board: pattern.board,
                priority: 2,
                lastMove: pattern.lastMove
            });
        }
    });
}

// 승리 상태 생성
function generateWinStates(states) {
    // 각 승리 패턴에 대해
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // 가로
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // 세로
        [0, 4, 8], [2, 4, 6] // 대각선
    ];
    
    for (const pattern of winPatterns) {
        // X 승리
        const xWinBoard = Array(9).fill(null);
        pattern.forEach(pos => xWinBoard[pos] = 'X');
        // O를 몇 개 추가
        let oAdded = 0;
        for (let i = 0; i < 9 && oAdded < 2; i++) {
            if (!pattern.includes(i)) {
                xWinBoard[i] = 'O';
                oAdded++;
            }
        }
        states.push({
            board: xWinBoard,
            priority: 1,
            winPattern: pattern
        });
        
        // O 승리
        const oWinBoard = Array(9).fill(null);
        pattern.forEach(pos => oWinBoard[pos] = 'O');
        // X를 몇 개 추가
        let xAdded = 0;
        for (let i = 0; i < 9 && xAdded < 3; i++) {
            if (!pattern.includes(i)) {
                oWinBoard[i] = 'X';
                xAdded++;
            }
        }
        states.push({
            board: oWinBoard,
            priority: 1,
            winPattern: pattern
        });
    }
}

// 이미지 생성 및 저장
async function generateAndSaveImage(state, index, total) {
    const boardString = boardToString(state.board);
    const filename = `tictactoe_${boardString}.png`;
    const filepath = path.join(__dirname, '../tictactoe_images', filename);
    
    // 이미 존재하는지 확인
    try {
        await fs.access(filepath);
        skipped++;
        console.log(`[${index}/${total}] 스킵: ${filename} (이미 존재)`);
        return;
    } catch (error) {
        // 파일이 없으면 계속 진행
    }
    
    try {
        // HTML 생성
        const html = createBoardHTML(
            state.board, 
            'Player 1', 
            'Player 2', 
            state.winPattern || [], 
            state.lastMove
        );
        
        // HCTI API 호출
        const response = await axios.post('https://hcti.io/v1/image', {
            html: html,
            viewport_width: 450,
            viewport_height: 550,
            device_scale: 1,
            render_when_ready: false,
            wait_for_event: false,
            wait_to_render: 0,
            ms_delay: 0,
            transparent: false,
            quality: 85,
            image_format: 'png'
        }, {
            auth: {
                username: process.env.HCTI_API_USER_ID,
                password: process.env.HCTI_API_KEY
            },
            timeout: 10000
        });
        
        // 이미지 다운로드
        const imageResponse = await axios.get(response.data.url, {
            responseType: 'arraybuffer',
            timeout: 10000
        });
        
        // 파일로 저장
        await fs.writeFile(filepath, imageResponse.data);
        
        generated++;
        console.log(`[${index}/${total}] ✅ 생성 완료: ${filename}`);
        
    } catch (error) {
        failed++;
        console.error(`[${index}/${total}] ❌ 실패: ${filename}`, error.message);
        
        if (error.response && error.response.status === 429) {
            console.log('⏰ Rate limit 도달. 5분 대기 후 재시도...');
            await new Promise(resolve => setTimeout(resolve, 300000)); // 5분 대기
            // 재시도
            return generateAndSaveImage(state, index, total);
        }
    }
    
    // Rate limit 방지를 위한 딜레이 (2초)
    await new Promise(resolve => setTimeout(resolve, 2000));
}

// 메인 함수
async function main() {
    console.log('🎮 틱택토 이미지 사전 생성 시작');
    console.log('================================');
    
    // 폴더 확인
    try {
        await fs.access(path.join(__dirname, '../tictactoe_images'));
    } catch {
        await fs.mkdir(path.join(__dirname, '../tictactoe_images'), { recursive: true });
    }
    
    // 필수 상태 생성
    const states = generateEssentialStates();
    console.log(`📊 총 ${states.length}개의 게임 상태 생성 예정`);
    
    // 우선순위별로 정렬
    states.sort((a, b) => a.priority - b.priority);
    
    // 이미지 생성
    for (let i = 0; i < states.length; i++) {
        await generateAndSaveImage(states[i], i + 1, states.length);
    }
    
    console.log('\n================================');
    console.log('🎯 작업 완료!');
    console.log(`✅ 생성 성공: ${generated}개`);
    console.log(`⏭️  스킵됨: ${skipped}개`);
    console.log(`❌ 실패: ${failed}개`);
    console.log('================================');
}

// 실행
main().catch(console.error);