const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const axios = require('axios');

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

// 간단한 캐시
const imageCache = new Map();

// 일반적인 틱택토 게임 시스템
const TIC_TAC_TOE_GAME = {
    // 게임 설정
    config: {
        boardSize: 3,
        winReward: 300000,
        loseReward: 50000,
        drawReward: 100000,
        turnTimeout: 30000,  // 30초
        maxPieces: 3        // 각 플레이어당 최대 3개씩만 놓을 수 있음
    },
    
    // 활성 게임 저장소
    activeGames: new Map(),
    
    // 새 게임 생성
    createGame(player1, player2, channel) {
        const gameId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const firstTurn = Math.random() < 0.5 ? 'X' : 'O';
        
        const gameData = {
            id: gameId,
            player1: {
                id: player1.id,
                username: player1.username,
                avatar: player1.displayAvatarURL({ format: 'png', size: 128 }),
                symbol: 'X'
            },
            player2: {
                id: player2.id,
                username: player2.username,
                avatar: player2.displayAvatarURL({ format: 'png', size: 128 }),
                symbol: 'O'
            },
            board: Array(9).fill(null),
            currentTurn: firstTurn,
            winner: null,
            isDraw: false,
            channel: channel.id,
            startTime: Date.now(),
            lastMoveTime: Date.now(),
            lastMovePosition: null,
            moveHistory: {  // 이동 기록 추가
                X: [],
                O: []
            },
            turnTimer: null
        };
        
        this.activeGames.set(gameId, gameData);
        return gameData;
    },
    
    // 이미지 생성 (rate limit 안전 버전)
    async createBoardImage(board, player1, player2, winPattern = [], lastMovePosition = null) {
        try {
            // 캐시 키 생성
            const boardState = board.map(cell => cell === 'X' ? '1' : cell === 'O' ? '2' : '0').join('');
            const cacheKey = `${boardState}_${winPattern.join(',')}_${lastMovePosition || ''}`;
            
            // 캐시 확인
            const cached = imageCache.get(cacheKey);
            if (cached) {
                console.log('[TicTacToe] 캐시된 이미지 사용');
                return cached;
            }
            
            const xCount = board.filter(cell => cell === 'X').length;
            const oCount = board.filter(cell => cell === 'O').length;
            const isXActive = xCount <= oCount;
            
            // HTML 생성
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
<span class="n">❌ ${player1.username.substring(0,10)}</span>
<span>VS</span>
<span class="n2">⭕ ${player2.username.substring(0,10)}</span>
</div>
<div class="t">${isXActive ? `${player1.username}님의 턴입니다!` : `${player2.username}님의 턴입니다!`} (30초)<br><small>※ 각 플레이어는 최대 3개까지만 놓을 수 있습니다</small></div>
<div class="g">
${board.map((cell,i)=>{
let cls='c';
if(winPattern.includes(i))cls+=' w';
else if(i===lastMovePosition)cls+=' l';
return`<div class="${cls}">${cell==='X'?'❌':cell==='O'?'⭕':''}</div>`;
}).join('')}
</div>
</body>
</html>`;
            
            const html = minifyHTML(rawHTML);
            
            // HCTI API 호출 (타임아웃 증가)
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
                timeout: 15000
            });
            
            // 이미지 다운로드
            const imageResponse = await axios.get(response.data.url, {
                responseType: 'arraybuffer',
                timeout: 15000
            });
            
            const buffer = Buffer.from(imageResponse.data);
            const attachment = new AttachmentBuilder(buffer, { name: 'tictactoe.png' });
            
            // 캐시에 저장
            imageCache.set(cacheKey, attachment);
            
            return attachment;
            
        } catch (error) {
            console.error('[TicTacToe] 이미지 생성 오류:', error.message);
            // 에러 시 텍스트 보드 사용
            return 'RATE_LIMITED';
        }
    },
    
    // 게임 버튼 생성
    createGameButtons(gameId, currentTurn, board) {
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 3; j++) {
                const position = i * 3 + j;
                const isOccupied = board[position] !== null;
                const label = board[position] === 'X' ? '❌' : board[position] === 'O' ? '⭕' : `${position + 1}`;
                
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`tictactoe_move_${gameId}_${position}`)
                        .setLabel(label)
                        .setStyle(isOccupied ? ButtonStyle.Secondary : ButtonStyle.Primary)
                        .setDisabled(isOccupied)
                );
            }
            rows.push(row);
        }
        
        // 포기 버튼 추가
        const controlRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`tictactoe_forfeit_${gameId}`)
                    .setLabel('🏳️ 포기하기')
                    .setStyle(ButtonStyle.Danger)
            );
        
        rows.push(controlRow);
        return rows;
    },
    
    // 게임 찾기
    getGame(gameId) {
        return this.activeGames.get(gameId);
    },
    
    // 유저 ID로 게임 찾기
    findGameByUserId(userId) {
        for (const [gameId, game] of this.activeGames) {
            if (game.player1.id === userId || game.player2.id === userId) {
                return game;
            }
        }
        return null;
    },
    
    // 유저의 모든 게임 강제 종료
    forceEndUserGames(userId) {
        const gamesToEnd = [];
        for (const [gameId, game] of this.activeGames) {
            if (game.player1.id === userId || game.player2.id === userId) {
                gamesToEnd.push(gameId);
            }
        }
        
        for (const gameId of gamesToEnd) {
            this.activeGames.delete(gameId);
        }
        
        return gamesToEnd.length;
    },
    
    // 게임 이동 처리
    makeMove(gameId, position, playerId) {
        const game = this.activeGames.get(gameId);
        if (!game) {
            return { success: false, error: '게임을 찾을 수 없습니다.' };
        }
        
        // 게임이 이미 끝났는지 확인
        if (game.winner || game.isDraw) {
            return { success: false, error: '게임이 이미 종료되었습니다.' };
        }
        
        // 현재 차례 확인
        const currentPlayer = game.currentTurn === 'X' ? game.player1 : game.player2;
        if (currentPlayer.id !== playerId) {
            return { success: false, error: '당신의 차례가 아닙니다!' };
        }
        
        // 이미 놓인 위치인지 확인
        if (game.board[position] !== null) {
            return { success: false, error: '이미 놓인 위치입니다!' };
        }
        
        // 이동 처리
        game.board[position] = game.currentTurn;
        game.lastMovePosition = position;
        game.lastMoveTime = Date.now();
        
        // 이동 기록에 추가
        game.moveHistory[game.currentTurn].push(position);
        
        // 3개 이상이면 가장 오래된 것 제거 (승리 체크 전에)
        if (game.moveHistory[game.currentTurn].length > this.config.maxPieces) {
            const oldestPosition = game.moveHistory[game.currentTurn].shift();
            game.board[oldestPosition] = null;
        }
        
        // 승리 확인 (제거 후에 체크)
        const winPattern = this.checkWin(game.board, game.currentTurn);
        if (winPattern) {
            game.winner = currentPlayer.id;
            const loser = game.currentTurn === 'X' ? game.player2 : game.player1;
            return {
                success: true,
                gameOver: true,
                winner: game.winner,
                loser: loser.id,
                winPattern: winPattern,
                rewards: {
                    winner: this.config.winReward,
                    loser: this.config.loseReward
                }
            };
        }
        
        // 무승부 확인 (보드가 꽉 찬 경우)
        if (game.board.every(cell => cell !== null)) {
            game.isDraw = true;
            return {
                success: true,
                gameOver: true,
                isDraw: true,
                rewards: {
                    winner: this.config.drawReward,
                    loser: this.config.drawReward
                }
            };
        }
        
        // 차례 변경
        game.currentTurn = game.currentTurn === 'X' ? 'O' : 'X';
        
        return { success: true };
    },
    
    // 승리 조건 확인
    checkWin(board, symbol) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // 가로
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // 세로
            [0, 4, 8], [2, 4, 6] // 대각선
        ];
        
        for (const pattern of winPatterns) {
            if (pattern.every(pos => board[pos] === symbol)) {
                return pattern;
            }
        }
        
        return null;
    },
    
    // 게임 종료
    endGame(gameId) {
        const game = this.activeGames.get(gameId);
        if (game && game.turnTimer) {
            clearTimeout(game.turnTimer);
        }
        this.activeGames.delete(gameId);
    },
    
    // 텍스트 기반 보드 생성
    createTextBoard(board) {
        let text = '```\n';
        for (let i = 0; i < 9; i++) {
            if (board[i] === 'X') text += '❌ ';
            else if (board[i] === 'O') text += '⭕ ';
            else text += `${i + 1}⃣ `;
            
            if ((i + 1) % 3 === 0) text += '\n';
        }
        text += '```';
        return text;
    },
    
    // 봇 게임 생성
    async createBotGame(player, channel, difficulty = 'medium', settings = null) {
        const botPlayer = {
            id: 'bot',
            username: `AI (${settings?.name || '중급'})`,
            displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png'
        };
        
        const game = this.createGame(player, botPlayer, channel);
        game.isBotGame = true;
        game.botDifficulty = difficulty;
        game.botSettings = settings;
        
        // 게임 시작 메시지
        const firstPlayer = game.currentTurn === 'X' ? game.player1 : game.player2;
        const isYourTurn = firstPlayer.id === player.id;
        const gameEmbed = new EmbedBuilder()
            .setColor(isYourTurn ? '#00ff00' : '#ff0000')
            .setTitle('🤖 봇 대전')
            .setDescription(isYourTurn ? '🟢 당신의 턴입니다!' : '🔴 상대의 턴입니다!')
            .addFields(
                { name: '📌 특별 규칙', value: '각 플레이어는 최대 3개까지만 놓을 수 있습니다.\n4번째부터는 가장 오래된 말이 사라집니다.', inline: false },
                { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true },
                { name: '💰 배팅', value: `${settings.bet.toLocaleString()}G`, inline: true },
                { name: '🏆 승리 보상', value: `${settings.reward.toLocaleString()}G`, inline: true },
                { name: '🎯 현재 차례', value: `${firstPlayer.username} (${game.currentTurn})`, inline: true }
            );
        
        const boardImage = await this.createBoardImage(game.board, game.player1, game.player2);
        const buttons = this.createGameButtons(game.id, game.currentTurn, game.board);
        
        // 보드 이미지 확인 및 처리
        let sentMessage;
        if (boardImage === 'RATE_LIMITED') {
            gameEmbed.addFields({
                name: '🎮 게임 보드',
                value: this.createTextBoard(game.board)
            });
            sentMessage = await channel.send({
                embeds: [gameEmbed],
                components: buttons
            });
        } else {
            sentMessage = await channel.send({
                embeds: [gameEmbed],
                files: [boardImage],
                components: buttons
            });
        }
        
        // 봇이 먼저 시작하는 경우
        if (game.currentTurn === 'O') {
            setTimeout(async () => {
                await this.makeBotMove(game, sentMessage);
            }, 1500);
        }
        
        return game;
    },
    
    // 봇 이동 처리
    async makeBotMove(game, message) {
        const botMove = this.getBotMove(game.board, game.botDifficulty);
        const result = this.makeMove(game.id, botMove, 'bot');
        
        if (result.gameOver) {
            // 게임 종료
            await this.updateGameEnd(game, result, message);
        } else {
            // 게임 계속
            await this.updateGameBoard(game, message);
        }
    },
    
    // 봇의 다음 수 계산
    getBotMove(board, difficulty) {
        const availableMoves = [];
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                availableMoves.push(i);
            }
        }
        
        if (difficulty === 'easy') {
            // 쉬움: 완전 랜덤
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        } else if (difficulty === 'medium') {
            // 중간: 50% 확률로 최선의 수
            if (Math.random() < 0.5) {
                return availableMoves[Math.floor(Math.random() * availableMoves.length)];
            }
        }
        
        // 어려움: 최선의 수 (미니맥스)
        let bestScore = -Infinity;
        let bestMove = availableMoves[0];
        
        for (const move of availableMoves) {
            board[move] = 'O';
            const score = this.minimax(board, 0, false);
            board[move] = null;
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    },
    
    // 미니맥스 알고리즘
    minimax(board, depth, isMaximizing) {
        const xWin = this.checkWin(board, 'X');
        const oWin = this.checkWin(board, 'O');
        
        if (xWin) return -10 + depth;
        if (oWin) return 10 - depth;
        if (board.every(cell => cell !== null)) return 0;
        
        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === null) {
                    board[i] = 'O';
                    const score = this.minimax(board, depth + 1, false);
                    board[i] = null;
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === null) {
                    board[i] = 'X';
                    const score = this.minimax(board, depth + 1, true);
                    board[i] = null;
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    },
    
    // 게임 보드 업데이트
    async updateGameBoard(game, message) {
        const currentPlayer = game.currentTurn === 'X' ? game.player1 : game.player2;
        const isPlayerTurn = currentPlayer.id !== 'bot';
        
        const gameEmbed = new EmbedBuilder()
            .setColor(isPlayerTurn ? '#00ff00' : '#ff0000')
            .setTitle('🤖 봇 대전')
            .setDescription(isPlayerTurn ? '🟢 당신의 턴입니다!' : '🔴 봇의 턴입니다!')
            .addFields(
                { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true },
                { name: '🎯 현재 차례', value: `${currentPlayer.username} (${game.currentTurn})`, inline: true }
            );
        
        const boardImage = await this.createBoardImage(game.board, game.player1, game.player2, [], game.lastMovePosition);
        const buttons = this.createGameButtons(game.id, game.currentTurn, game.board);
        
        if (boardImage === 'RATE_LIMITED') {
            gameEmbed.addFields({
                name: '🎮 게임 보드',
                value: this.createTextBoard(game.board)
            });
            await message.edit({
                embeds: [gameEmbed],
                components: buttons
            });
        } else {
            await message.edit({
                embeds: [gameEmbed],
                files: [boardImage],
                components: buttons
            });
        }
    },
    
    // 게임 종료 업데이트
    async updateGameEnd(game, result, message) {
        let gameEndEmbed;
        if (result.isDraw) {
            gameEndEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🤝 무승부!')
                .setDescription('아무도 승리하지 못했습니다!')
                .addFields(
                    { name: '🏆 보상', value: `${this.config.drawReward.toLocaleString()}G`, inline: true }
                );
        } else if (result.winner === 'bot') {
            gameEndEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('💔 패배!')
                .setDescription(`${game.player2.username}의 승리!`)
                .addFields(
                    { name: '💰 위로금', value: `${this.config.loseReward.toLocaleString()}G`, inline: true }
                );
        } else {
            gameEndEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎉 승리!')
                .setDescription(`${game.player1.username}님의 승리!`)
                .addFields(
                    { name: '🏆 보상', value: `${game.botSettings.reward.toLocaleString()}G`, inline: true }
                );
        }
        
        const finalBoardImage = await this.createBoardImage(
            game.board, 
            game.player1, 
            game.player2,
            result.winPattern || []
        );
        
        if (finalBoardImage === 'RATE_LIMITED') {
            gameEndEmbed.addFields({
                name: '🎮 최종 보드',
                value: this.createTextBoard(game.board)
            });
            await message.edit({
                embeds: [gameEndEmbed],
                components: []
            });
        } else {
            await message.edit({
                embeds: [gameEndEmbed],
                files: [finalBoardImage],
                components: []
            });
        }
    },
    
    // 봇 게임 이동 처리 (플레이어가 수를 놓았을 때)
    async handleMove(gameId, position, playerId, message) {
        const result = this.makeMove(gameId, position, playerId);
        if (!result.success) {
            return result;
        }
        
        const game = this.getGame(gameId);
        if (!game || !game.isBotGame) {
            return result;
        }
        
        if (result.gameOver) {
            // 게임 종료
            await this.updateGameEnd(game, result, message);
            return result;
        }
        
        // 플레이어 이동 후 잠시 대기
        await this.updateGameBoard(game, message);
        
        // 봇 차례
        setTimeout(async () => {
            await this.makeBotMove(game, message);
        }, 1500);
        
        return result;
    },
    
    // 초기화
    async initialize() {
        console.log('[TicTacToe] 게임 시스템 초기화 완료');
    },
    
    // 예측 프리렌더링 비활성화
    async predictivePrerender() {
        // 사용하지 않음
    }
};

module.exports = TIC_TAC_TOE_GAME;