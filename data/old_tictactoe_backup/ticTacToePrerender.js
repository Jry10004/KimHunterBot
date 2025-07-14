const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// 모든 가능한 게임 상태의 이미지를 미리 생성
async function prerenderTicTacToeImages() {
    const HCTI_API_USER_ID = process.env.HCTI_API_USER_ID;
    const HCTI_API_KEY = process.env.HCTI_API_KEY;
    
    if (!HCTI_API_USER_ID || !HCTI_API_KEY) {
        console.error('HTML/CSS to Image API 키가 설정되지 않았습니다.');
        return;
    }
    
    const imagesDir = path.join(__dirname, 'tictactoe_images');
    
    // 디렉토리 생성
    try {
        await fs.mkdir(imagesDir, { recursive: true });
    } catch (err) {
        console.error('이미지 디렉토리 생성 실패:', err);
    }
    
    // 기본 템플릿 생성 함수
    function createHTML(positions) {
        const cells = Array(9).fill(null);
        positions.X.forEach(pos => cells[pos] = 'X');
        positions.O.forEach(pos => cells[pos] = 'O');
        
        let cellsHTML = '';
        for (let i = 0; i < 9; i++) {
            let content = '';
            if (cells[i] === 'X') {
                content = '<div class="x-mark">❌</div>';
            } else if (cells[i] === 'O') {
                content = '<div class="o-mark">⭕</div>';
            }
            cellsHTML += `<div class="cell">${content}</div>`;
        }
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background: #f8f9fa;
                    font-family: Arial, sans-serif;
                    width: 500px;
                    height: 500px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .board {
                    display: grid;
                    grid-template-columns: repeat(3, 150px);
                    grid-gap: 10px;
                    background: #e9ecef;
                    padding: 20px;
                    border-radius: 20px;
                }
                .cell {
                    width: 150px;
                    height: 150px;
                    background: #fff;
                    border-radius: 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.1);
                }
                .x-mark {
                    font-size: 80px;
                    color: #ff4444;
                }
                .o-mark {
                    font-size: 80px;
                    color: #4444ff;
                }
            </style>
        </head>
        <body>
            <div class="board">
                ${cellsHTML}
            </div>
        </body>
        </html>
        `;
    }
    
    // 자주 사용되는 게임 상태들만 프리렌더링
    const commonStates = [
        // 빈 보드
        { X: [], O: [] },
        // 첫 수들
        { X: [0], O: [] },
        { X: [1], O: [] },
        { X: [2], O: [] },
        { X: [3], O: [] },
        { X: [4], O: [] }, // 중앙
        { X: [5], O: [] },
        { X: [6], O: [] },
        { X: [7], O: [] },
        { X: [8], O: [] },
        // 일반적인 게임 진행 패턴들
        { X: [4], O: [0] },
        { X: [4], O: [1] },
        { X: [4], O: [2] },
        { X: [4], O: [3] },
        { X: [4], O: [5] },
        { X: [4], O: [6] },
        { X: [4], O: [7] },
        { X: [4], O: [8] },
        // 더 추가할 수 있음...
    ];
    
    console.log(`${commonStates.length}개의 이미지를 프리렌더링합니다...`);
    
    for (let i = 0; i < commonStates.length; i++) {
        const state = commonStates[i];
        const stateKey = `X${state.X.join('')}_O${state.O.join('')}`;
        const filePath = path.join(imagesDir, `${stateKey}.png`);
        
        // 이미 존재하는지 확인
        try {
            await fs.access(filePath);
            console.log(`✅ 이미 존재: ${stateKey}`);
            continue;
        } catch {
            // 파일이 없으면 생성
        }
        
        try {
            console.log(`⏳ 생성 중: ${stateKey}`);
            
            const html = createHTML(state);
            
            const response = await axios.post('https://hcti.io/v1/image', {
                html: html,
                viewport_width: 500,
                viewport_height: 500,
                device_scale: 1
            }, {
                auth: {
                    username: HCTI_API_USER_ID,
                    password: HCTI_API_KEY
                }
            });
            
            const imageResponse = await axios.get(response.data.url, {
                responseType: 'arraybuffer'
            });
            
            await fs.writeFile(filePath, imageResponse.data);
            console.log(`✅ 생성 완료: ${stateKey}`);
            
            // API 제한을 피하기 위한 지연
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error(`❌ 생성 실패 ${stateKey}:`, error.message);
        }
    }
    
    console.log('프리렌더링 완료!');
}

module.exports = { prerenderTicTacToeImages };