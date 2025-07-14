const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const axios = require('axios');

// 이미지 캐시 (간단한 메모리 캐시)
const imageCache = new Map();

// 프리로드 큐
const preloadQueue = [];

// HTML/CSS to Image API를 사용한 틱택토 게임 시스템
const TIC_TAC_TOE_GAME = {
    // 게임 설정
    config: {
        boardSize: 3,
        winReward: 300000,
        loseReward: 50000,
        drawReward: 100000,
        botDifficulty: 0.8,
        turnTimeout: 30000,
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
            lastMoveTime: Date.now()
        };
        
        this.activeGames.set(gameId, gameData);
        return gameData;
    },
    
    // HTML/CSS to Image API를 사용한 게임 보드 이미지 생성
    async createBoardImage(board, player1, player2, winPattern = []) {
        // 빈 보드는 캐싱 (게임 시작 시)
        const boardKey = board.join('');
        if (boardKey === 'nullnullnullnullnullnullnullnullnull' && imageCache.has('empty_board')) {
            const cachedBuffer = imageCache.get('empty_board');
            return new AttachmentBuilder(cachedBuffer, { name: 'tictactoe.png' });
        }
        // HTML 템플릿 생성
        let cellsHTML = '';
        for (let i = 0; i < 9; i++) {
            const isWinning = winPattern.includes(i);
            const cellClass = isWinning ? 'cell winning' : 'cell';
            let content = '';
            
            if (board[i] === 'X') {
                content = '<div class="x-mark">❌</div>';
            } else if (board[i] === 'O') {
                content = '<div class="o-mark">⭕</div>';
            }
            
            cellsHTML += `<div class="${cellClass}">${content}</div>`;
        }
        
        // 최적화된 HTML (간결하지만 보기 좋게)
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    margin: 0;
                    background: #f5f5f5;
                    width: 500px;
                    height: 600px;
                    font-family: Arial, sans-serif;
                }
                .header {
                    text-align: center;
                    padding: 20px;
                    background: #333;
                    color: white;
                }
                .title {
                    font-size: 32px;
                    font-weight: bold;
                    margin: 0;
                }
                .players {
                    display: flex;
                    justify-content: space-around;
                    padding: 20px;
                    background: white;
                    font-size: 20px;
                    font-weight: bold;
                }
                .p1 { color: #ff4444; }
                .p2 { color: #4444ff; }
                .board {
                    display: grid;
                    grid-template-columns: repeat(3, 150px);
                    grid-gap: 8px;
                    padding: 20px;
                    justify-content: center;
                }
                .cell {
                    width: 150px;
                    height: 150px;
                    background: white;
                    border: 2px solid #ddd;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 80px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .cell:hover {
                    background: #f9f9f9;
                }
                .winning {
                    background: #ffd700 !important;
                    border-color: #ffaa00 !important;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">TIC TAC TOE</div>
            </div>
            <div class="players">
                <div class="p1">❌ ${player1.username.substring(0, 10)}</div>
                <div>VS</div>
                <div class="p2">${player2.username.substring(0, 10)} ⭕</div>
            </div>
            <div class="board">
                ${board.map((cell, i) => 
                    `<div class="cell${winPattern.includes(i) ? ' winning' : ''}">
                        ${cell === 'X' ? '❌' : cell === 'O' ? '⭕' : ''}
                    </div>`
                ).join('')}
            </div>
        </body>
        </html>
        `;
        
        try {
            console.time('API 전체 시간');
            
            // HTML/CSS to Image API 호출 (최적화된 설정)
            console.time('API 호출');
            const response = await axios.post('https://hcti.io/v1/image', {
                html: html,
                css: '', // CSS는 HTML에 포함됨
                // 속도 최적화 옵션들
                viewport_width: 500,
                viewport_height: 600,
                device_scale: 1, // 고해상도 불필요
                render_when_ready: false, // 즉시 렌더링
                wait_for_event: false, // 이벤트 대기 안함
                wait_to_render: 0 // 렌더링 대기 시간 없음
            }, {
                auth: {
                    username: process.env.HCTI_API_USER_ID,
                    password: process.env.HCTI_API_KEY
                },
                timeout: 5000 // 5초 타임아웃
            });
            console.timeEnd('API 호출');
            
            // 이미지 URL에서 버퍼로 변환
            console.time('이미지 다운로드');
            const imageResponse = await axios.get(response.data.url, {
                responseType: 'arraybuffer',
                timeout: 3000 // 3초 타임아웃
            });
            console.timeEnd('이미지 다운로드');
            
            const buffer = Buffer.from(imageResponse.data);
            
            // 빈 보드면 캐싱
            if (boardKey === 'nullnullnullnullnullnullnullnullnull') {
                imageCache.set('empty_board', buffer);
            }
            
            console.timeEnd('API 전체 시간');
            return new AttachmentBuilder(buffer, { name: 'tictactoe.png' });
            
        } catch (error) {
            console.error('이미지 생성 실패:', error);
            // 실패 시 null 반환 (텍스트 모드로 폴백)
            return null;
        }
    },
    
    // 게임 버튼 생성
    createGameButtons(gameId, currentTurn, board) {
        const rows = [];
        for (let row = 0; row < 3; row++) {
            const buttons = [];
            for (let col = 0; col < 3; col++) {
                const index = row * 3 + col;
                const button = new ButtonBuilder()
                    .setCustomId(`tictactoe_move_${gameId}_${index}`)
                    .setStyle(board[index] ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    .setLabel(board[index] === 'X' ? '❌' : board[index] === 'O' ? '⭕' : '⬜')
                    .setDisabled(board[index] !== null);
                buttons.push(button);
            }
            rows.push(new ActionRowBuilder().addComponents(buttons));
        }
        return rows;
    },
    
    // 움직임 처리
    makeMove(gameId, position, playerId) {
        const game = this.activeGames.get(gameId);
        if (!game) return { success: false, error: '게임을 찾을 수 없습니다.' };
        
        // 게임이 끝났는지 확인
        if (game.winner || game.isDraw) {
            return { success: false, error: '게임이 이미 종료되었습니다.' };
        }
        
        // 현재 차례 확인
        const currentPlayer = game.currentTurn === 'X' ? game.player1 : game.player2;
        if (currentPlayer.id !== playerId && playerId !== 'bot') {
            return { success: false, error: '당신의 차례가 아닙니다.' };
        }
        
        // 빈 칸인지 확인
        if (game.board[position] !== null) {
            return { success: false, error: '이미 선택된 칸입니다.' };
        }
        
        // 움직임 적용
        game.board[position] = game.currentTurn;
        game.lastMoveTime = Date.now();
        
        // 승리 확인
        const winPattern = this.checkWinPattern(game.board, game.currentTurn);
        if (winPattern) {
            game.winner = game.currentTurn;
            return { 
                success: true, 
                gameOver: true, 
                winner: game.currentTurn,
                winPattern: winPattern
            };
        }
        
        // 무승부 확인
        if (game.board.every(cell => cell !== null)) {
            game.isDraw = true;
            return { success: true, gameOver: true, isDraw: true };
        }
        
        // 차례 변경
        game.currentTurn = game.currentTurn === 'X' ? 'O' : 'X';
        
        return { success: true, gameOver: false };
    },
    
    // 승리 조건 확인
    checkWin(board, symbol) {
        const winConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // 가로
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // 세로
            [0, 4, 8], [2, 4, 6] // 대각선
        ];
        
        return winConditions.some(condition => 
            condition.every(index => board[index] === symbol)
        );
    },
    
    // 승리 패턴 반환
    checkWinPattern(board, symbol) {
        const winConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // 가로
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // 세로
            [0, 4, 8], [2, 4, 6] // 대각선
        ];
        
        for (const condition of winConditions) {
            if (condition.every(index => board[index] === symbol)) {
                return condition;
            }
        }
        
        return null;
    },
    
    // AI 움직임 계산 (미니맥스 알고리즘)
    getBotMove(board, botSymbol, difficulty = 'medium') {
        const opponentSymbol = botSymbol === 'X' ? 'O' : 'X';
        
        // 난이도별 설정
        const difficultySettings = {
            easy: 0.2,    // 20% 확률로 최적 플레이
            medium: 0.6,  // 60% 확률로 최적 플레이
            hard: 0.95    // 95% 확률로 최적 플레이
        };
        
        const botDifficulty = difficultySettings[difficulty] || 0.6;
        
        // 난이도에 따라 랜덤 움직임 선택
        if (Math.random() > botDifficulty) {
            const availableMoves = [];
            for (let i = 0; i < 9; i++) {
                if (board[i] === null) availableMoves.push(i);
            }
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }
        
        // 미니맥스 알고리즘
        let bestScore = -Infinity;
        let bestMove = null;
        
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = botSymbol;
                const score = this.minimax(board, 0, false, botSymbol, opponentSymbol);
                board[i] = null;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = i;
                }
            }
        }
        
        return bestMove;
    },
    
    // 미니맥스 알고리즘
    minimax(board, depth, isMaximizing, botSymbol, playerSymbol) {
        // 게임 상태 평가
        const botWin = this.checkWin(board, botSymbol);
        const playerWin = this.checkWin(board, playerSymbol);
        
        if (botWin) return 10 - depth;
        if (playerWin) return depth - 10;
        if (board.every(cell => cell !== null)) return 0; // 무승부
        
        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === null) {
                    board[i] = botSymbol;
                    const score = this.minimax(board, depth + 1, false, botSymbol, playerSymbol);
                    board[i] = null;
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === null) {
                    board[i] = playerSymbol;
                    const score = this.minimax(board, depth + 1, true, botSymbol, playerSymbol);
                    board[i] = null;
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    },
    
    // 게임 종료 처리
    endGame(gameId) {
        const game = this.activeGames.get(gameId);
        if (game) {
            this.activeGames.delete(gameId);
            return game;
        }
        return null;
    },
    
    // 활성 게임 가져오기
    getGame(gameId) {
        return this.activeGames.get(gameId);
    },
    
    // 타임아웃된 게임 정리
    cleanupTimedOutGames() {
        const now = Date.now();
        for (const [gameId, game] of this.activeGames.entries()) {
            if (now - game.lastMoveTime > this.config.turnTimeout * 2) {
                this.activeGames.delete(gameId);
            }
        }
    },
    
    // 유저 ID로 게임 찾기
    findGameByUserId(userId) {
        for (const [gameId, game] of this.activeGames.entries()) {
            if (game.player1.id === userId || game.player2.id === userId) {
                return game;
            }
        }
        return null;
    },
    
    // 유저의 모든 게임 강제 종료
    forceEndUserGames(userId) {
        const gamesToEnd = [];
        for (const [gameId, game] of this.activeGames.entries()) {
            if (game.player1.id === userId || game.player2.id === userId) {
                gamesToEnd.push(gameId);
            }
        }
        gamesToEnd.forEach(gameId => this.endGame(gameId));
        return gamesToEnd.length;
    },
    
    // handleMove 함수 추가 (핸들러와의 호환성을 위해)
    async handleMove(gameId, position, userId, message) {
        const game = this.activeGames.get(gameId);
        if (!game) return { success: false, error: '게임을 찾을 수 없습니다.' };
        
        // makeMove 호출
        const result = this.makeMove(gameId, position, userId);
        
        if (result.success && !result.gameOver && game.player2.id === 'bot') {
            // 봇 차례인 경우 봇 움직임 처리 (더 빠르게)
            setTimeout(async () => {
                await this.makeBotMove(gameId, message);
            }, 600); // 1초에서 0.6초로 단축
        }
        
        return result;
    },
    
    // 봇과의 게임 생성
    async createBotGame(player, channel, difficulty = 'medium', settings = null) {
        const botNames = {
            easy: '초급 AI',
            medium: '중급 AI',
            hard: '상급 AI'
        };
        
        const botUser = {
            id: 'bot',
            username: botNames[difficulty] || '김헌터 AI',
            avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
            discriminator: '0000',
            displayAvatarURL: (options) => 'https://cdn.discordapp.com/embed/avatars/0.png'
        };
        
        // 게임 생성
        const game = this.createGame(player, botUser, channel);
        game.difficulty = difficulty;
        game.settings = settings;
        
        // 초기 게임 상태 표시
        const firstPlayer = game.currentTurn === 'X' ? game.player1 : game.player2;
        const gameEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('⭕ 틱택토 vs AI')
            .setDescription(`${firstPlayer.username}님의 차례입니다! (${game.currentTurn})`)
            .addFields(
                { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true }
            );

        const boardImage = await this.createBoardImage(game.board, game.player1, game.player2);
        const buttons = this.createGameButtons(game.id, game.currentTurn, game.board);

        const messageOptions = {
            embeds: [gameEmbed],
            components: buttons
        };
        
        if (boardImage) {
            messageOptions.files = [boardImage];
        }

        const gameMessage = await channel.send(messageOptions);
        
        // 봇이 먼저 시작하는 경우
        if (game.currentTurn === 'O') {
            setTimeout(async () => {
                await this.makeBotMove(game.id, gameMessage);
            }, 800); // 1.5초에서 0.8초로 단축
        }
        
        return game;
    },
    
    // 봇 움직임 처리
    async makeBotMove(gameId, message) {
        const game = this.activeGames.get(gameId);
        if (!game || game.winner || game.isDraw) return;
        
        // 봇 움직임 계산 (난이도 포함)
        const botMove = this.getBotMove(game.board, 'O', game.difficulty || 'medium');
        if (botMove === null) return;
        
        // 움직임 적용
        const result = this.makeMove(gameId, botMove, 'bot');
        
        if (result.success) {
            const client = message.client;
            const channel = await client.channels.fetch(game.channel);
            
            // 게임 상태 업데이트
            let embed;
            if (result.gameOver) {
                if (result.isDraw) {
                    embed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('🤝 무승부!')
                        .setDescription('아무도 승리하지 못했습니다!')
                        .addFields(
                            { name: '🏆 보상', value: `${this.config.drawReward.toLocaleString()}G`, inline: true }
                        );
                } else {
                    const winner = result.winner === 'X' ? game.player1 : game.player2;
                    const loser = result.winner === 'X' ? game.player2 : game.player1;
                    
                    // 봇 게임인 경우 설정된 보상 사용
                    let winReward = this.config.winReward;
                    let loseReward = this.config.loseReward;
                    
                    if (game.settings) {
                        winReward = game.settings.reward;
                        loseReward = 0; // 봇 게임에서 패배 시 보상 없음 (이미 배팅금 차감됨)
                    }
                    
                    embed = new EmbedBuilder()
                        .setColor(result.winner === 'X' ? '#00FF00' : '#FF0000')
                        .setTitle(`🎉 ${winner.username}님의 승리!`)
                        .setDescription(`${loser.username}님이 패배했습니다.`)
                        .addFields(
                            { name: '🏆 승자 보상', value: `${winReward.toLocaleString()}G`, inline: true },
                            { name: '💔 패자 보상', value: `${loseReward.toLocaleString()}G`, inline: true }
                        );
                }
                
                // 게임 종료
                this.endGame(gameId);
                
                // 3초 후 채널 삭제
                setTimeout(async () => {
                    try {
                        if (channel && !channel.deleted) {
                            await channel.send('🎮 3초 후 채널이 삭제됩니다...');
                            setTimeout(async () => {
                                try {
                                    // 채널이 여전히 존재하는지 확인
                                    const client = message.client;
                                    const channelStillExists = await client.channels.fetch(channel.id).catch(() => null);
                                    if (channelStillExists && !channelStillExists.deleted) {
                                        await channelStillExists.delete('틱택토 게임 종료');
                                    }
                                } catch (err) {
                                    // Unknown Channel 오류는 무시
                                    if (err.code !== 10003) {
                                        console.error('봇 게임 채널 삭제 실패:', err);
                                    }
                                }
                            }, 3000);
                        }
                    } catch (error) {
                        console.error('게임 채널 삭제 실패:', error);
                    }
                }, 2000);
            } else {
                const currentPlayer = game.currentTurn === 'X' ? game.player1 : game.player2;
                embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('⭕ 틱택토 vs AI')
                    .setDescription(`${currentPlayer.username}님의 차례입니다! (${game.currentTurn})`)
                    .addFields(
                        { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                        { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true }
                    );
            }
            
            const boardImage = await this.createBoardImage(game.board, game.player1, game.player2, result.winPattern);
            const buttons = this.createGameButtons(game.id, game.currentTurn, game.board);
            
            const updateOptions = {
                embeds: [embed],
                components: result.gameOver ? [] : buttons
            };
            
            if (boardImage) {
                updateOptions.files = [boardImage];
            }
            
            await message.edit(updateOptions);
        }
    }
};

module.exports = TIC_TAC_TOE_GAME;