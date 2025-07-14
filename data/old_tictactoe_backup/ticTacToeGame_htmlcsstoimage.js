const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const axios = require('axios');

// 이미지 캐시 (메모리 절약 및 속도 향상)
const imageCache = new Map();

// HTMLCSStoImage를 사용한 빠른 틱택토 게임 시스템
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
            lastMoveTime: Date.now(),
            lastMovePosition: null
        };
        
        this.activeGames.set(gameId, gameData);
        return gameData;
    },
    
    // HTMLCSStoImage API를 사용한 게임 보드 이미지 생성
    async createBoardImage(board, player1, player2, winPattern = [], lastMovePosition = null) {
        try {
            // 캐시 키 생성
            const cacheKey = JSON.stringify({ board, winPattern, lastMovePosition, p1: player1.username, p2: player2.username });
            if (imageCache.has(cacheKey)) {
                return imageCache.get(cacheKey);
            }
            
            const xCount = board.filter(cell => cell === 'X').length;
            const oCount = board.filter(cell => cell === 'O').length;
            const isXActive = xCount <= oCount;
            
            // HTML 템플릿 생성 - 큰 게임판 (800x900)
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        width: 800px;
                        height: 900px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        color: white;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    body::before {
                        content: '';
                        position: absolute;
                        top: -50%;
                        left: -50%;
                        width: 200%;
                        height: 200%;
                        background: repeating-linear-gradient(
                            45deg,
                            transparent,
                            transparent 10px,
                            rgba(255,255,255,0.05) 10px,
                            rgba(255,255,255,0.05) 20px
                        );
                    }
                    
                    .container {
                        position: relative;
                        z-index: 1;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 40px;
                    }
                    
                    .title {
                        font-size: 56px;
                        font-weight: 800;
                        margin-bottom: 40px;
                        text-shadow: 0 4px 20px rgba(0,0,0,0.3);
                        letter-spacing: -2px;
                    }
                    
                    .players {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        width: 100%;
                        max-width: 600px;
                        margin-bottom: 40px;
                    }
                    
                    .player {
                        background: rgba(255,255,255,0.1);
                        backdrop-filter: blur(10px);
                        padding: 20px 30px;
                        border-radius: 20px;
                        border: 2px solid transparent;
                        transition: all 0.3s ease;
                    }
                    
                    .player.active {
                        background: rgba(255,255,255,0.2);
                        border-color: #fff;
                        transform: scale(1.05);
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    }
                    
                    .player-name {
                        font-size: 22px;
                        font-weight: 600;
                        margin-bottom: 8px;
                    }
                    
                    .player-symbol {
                        font-size: 36px;
                        text-align: center;
                    }
                    
                    .vs {
                        font-size: 36px;
                        font-weight: 700;
                        color: rgba(255,255,255,0.8);
                    }
                    
                    .board-container {
                        background: rgba(0,0,0,0.3);
                        padding: 30px;
                        border-radius: 30px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
                    }
                    
                    .board {
                        display: grid;
                        grid-template-columns: repeat(3, 180px);
                        grid-gap: 15px;
                    }
                    
                    .cell {
                        width: 180px;
                        height: 180px;
                        background: rgba(255,255,255,0.9);
                        border-radius: 25px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 80px;
                        font-weight: 700;
                        position: relative;
                        overflow: hidden;
                        transition: all 0.3s ease;
                    }
                    
                    .cell::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%);
                        transform: translateX(-100%);
                        transition: transform 0.6s;
                    }
                    
                    .cell:hover::before {
                        transform: translateX(100%);
                    }
                    
                    .cell.winning {
                        background: #ffd700;
                        animation: pulse 1s ease-in-out infinite;
                    }
                    
                    .cell.last-move {
                        background: #90EE90;
                        box-shadow: 0 0 40px rgba(144,238,144,0.6);
                    }
                    
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                    }
                    
                    .x-mark {
                        color: #FF1744;
                        text-shadow: 0 4px 10px rgba(255,23,68,0.4);
                    }
                    
                    .o-mark {
                        color: #00E5FF;
                        text-shadow: 0 4px 10px rgba(0,229,255,0.4);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="title">TIC TAC TOE</h1>
                    
                    <div class="players">
                        <div class="player ${isXActive ? 'active' : ''}">
                            <div class="player-name">${player1.username.substring(0, 12)}</div>
                            <div class="player-symbol">❌</div>
                        </div>
                        
                        <div class="vs">VS</div>
                        
                        <div class="player ${!isXActive ? 'active' : ''}">
                            <div class="player-name">${player2.username.substring(0, 12)}</div>
                            <div class="player-symbol">⭕</div>
                        </div>
                    </div>
                    
                    <div class="board-container">
                        <div class="board">
                            ${board.map((cell, i) => {
                                let classes = ['cell'];
                                if (winPattern.includes(i)) classes.push('winning');
                                if (i === lastMovePosition) classes.push('last-move');
                                
                                return `<div class="${classes.join(' ')}">
                                    ${cell === 'X' ? '<span class="x-mark">❌</span>' : 
                                      cell === 'O' ? '<span class="o-mark">⭕</span>' : ''}
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </body>
            </html>`;
            
            // HTMLCSStoImage API 호출
            const response = await axios.post('https://hcti.io/v1/image', {
                html: html,
                css: '', // CSS는 HTML에 포함
                google_fonts: 'Roboto'
            }, {
                auth: {
                    username: process.env.HTMLCSSTOIMAGE_USER_ID || process.env.HCTI_API_USER_ID,
                    password: process.env.HTMLCSSTOIMAGE_API_KEY || process.env.HCTI_API_KEY
                },
                timeout: 10000
            });
            
            // 이미지 다운로드
            const imageResponse = await axios.get(response.data.url, {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            
            const buffer = Buffer.from(imageResponse.data);
            const attachment = new AttachmentBuilder(buffer, { name: 'tictactoe.png' });
            
            // 캐시에 저장 (최대 20개)
            if (imageCache.size >= 20) {
                const firstKey = imageCache.keys().next().value;
                imageCache.delete(firstKey);
            }
            imageCache.set(cacheKey, attachment);
            
            return attachment;
            
        } catch (error) {
            console.error('HTMLCSStoImage 이미지 생성 오류:', error);
            
            // 폴백: 텍스트 기반 보드
            let boardText = '```\n';
            boardText += '╔═══════════════════════════════════╗\n';
            boardText += '║          TIC TAC TOE GAME         ║\n';
            boardText += '╠═══════════════════════════════════╣\n';
            boardText += `║  ❌ ${player1.username.padEnd(12)} VS ${player2.username.padEnd(12)} ⭕  ║\n`;
            boardText += '╠═══════════════════════════════════╣\n';
            
            for (let row = 0; row < 3; row++) {
                boardText += '║         ';
                for (let col = 0; col < 3; col++) {
                    const index = row * 3 + col;
                    const cell = board[index] === 'X' ? '❌' : board[index] === 'O' ? '⭕' : `${index + 1}`;
                    boardText += ` ${cell} `;
                    if (col < 2) boardText += '│';
                }
                boardText += '         ║\n';
                if (row < 2) boardText += '║         ───┼───┼───         ║\n';
            }
            
            boardText += '╚═══════════════════════════════════╝\n';
            boardText += '```';
            
            return boardText;
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
        
        // 승리 확인
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
        
        // 무승부 확인
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
        this.activeGames.delete(gameId);
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
        const gameEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🤖 봇 대전')
            .setDescription(`${firstPlayer.username}님의 차례입니다! (${game.currentTurn})`)
            .addFields(
                { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true },
                { name: '💰 배팅', value: `${settings.bet.toLocaleString()}G`, inline: true },
                { name: '🏆 승리 보상', value: `${settings.reward.toLocaleString()}G`, inline: true }
            );
        
        const boardImage = await this.createBoardImage(game.board, game.player1, game.player2);
        const buttons = this.createGameButtons(game.id, game.currentTurn, game.board);
        
        // 이미지인지 텍스트인지 확인
        if (typeof boardImage === 'string') {
            await channel.send({
                embeds: [gameEmbed],
                content: boardImage,
                components: buttons
            });
        } else {
            await channel.send({
                embeds: [gameEmbed],
                files: [boardImage],
                components: buttons
            });
        }
        
        // 봇이 먼저 시작하는 경우
        if (game.currentTurn === 'O') {
            setTimeout(async () => {
                const botMove = this.getBotMove(game.board, difficulty);
                const result = this.makeMove(game.id, botMove, 'bot');
                
                if (!result.gameOver) {
                    const updatedEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('🤖 봇 대전')
                        .setDescription(`${game.player1.username}님의 차례입니다! (X)`)
                        .addFields(
                            { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                            { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true }
                        );
                    
                    const updatedImage = await this.createBoardImage(game.board, game.player1, game.player2, [], game.lastMovePosition);
                    const updatedButtons = this.createGameButtons(game.id, game.currentTurn, game.board);
                    
                    const messages = await channel.messages.fetch({ limit: 1 });
                    const lastMessage = messages.first();
                    if (lastMessage) {
                        if (typeof updatedImage === 'string') {
                            await lastMessage.edit({
                                embeds: [updatedEmbed],
                                content: updatedImage,
                                components: updatedButtons
                            });
                        } else {
                            await lastMessage.edit({
                                embeds: [updatedEmbed],
                                files: [updatedImage],
                                components: updatedButtons
                            });
                        }
                    }
                }
            }, 1500);
        }
        
        return game;
    },
    
    // 봇의 다음 수 계산
    getBotMove(board, difficulty) {
        const availableMoves = board
            .map((cell, index) => cell === null ? index : null)
            .filter(index => index !== null);
        
        if (difficulty === 'easy') {
            // 쉬움: 완전 랜덤
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        } else if (difficulty === 'medium') {
            // 중간: 50% 확률로 최선의 수, 50% 랜덤
            if (Math.random() < 0.5) {
                return availableMoves[Math.floor(Math.random() * availableMoves.length)];
            }
        }
        
        // 어려움 또는 중간(50%): 미니맥스 알고리즘
        let bestScore = -Infinity;
        let bestMove = availableMoves[0];
        
        for (const move of availableMoves) {
            board[move] = 'O'; // 봇은 항상 O
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
        // 게임 종료 상태 확인
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
    
    // 봇 게임 이동 처리
    async handleMove(gameId, position, playerId, message) {
        const result = this.makeMove(gameId, position, playerId);
        if (!result.success || result.gameOver) {
            return result;
        }
        
        const game = this.getGame(gameId);
        if (!game || !game.isBotGame) {
            return result;
        }
        
        // 플레이어 이동 후 UI 업데이트
        const playerMoveEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🤖 봇 대전')
            .setDescription('봇이 생각 중입니다...')
            .addFields(
                { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true }
            );
        
        const playerMoveImage = await this.createBoardImage(game.board, game.player1, game.player2, [], game.lastMovePosition);
        const disabledButtons = this.createGameButtons(game.id, game.currentTurn, game.board)
            .map(row => {
                row.components.forEach(button => button.setDisabled(true));
                return row;
            });
        
        if (typeof playerMoveImage === 'string') {
            await message.edit({
                embeds: [playerMoveEmbed],
                content: playerMoveImage,
                components: disabledButtons
            });
        } else {
            await message.edit({
                embeds: [playerMoveEmbed],
                files: [playerMoveImage],
                components: disabledButtons
            });
        }
        
        // 봇 이동 (1.5초 딜레이)
        setTimeout(async () => {
            const botMove = this.getBotMove(game.board, game.botDifficulty);
            const botResult = this.makeMove(gameId, botMove, 'bot');
            
            if (botResult.gameOver) {
                // 게임 종료
                let gameEndEmbed;
                if (botResult.isDraw) {
                    gameEndEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('🤝 무승부!')
                        .setDescription('아무도 승리하지 못했습니다!')
                        .addFields(
                            { name: '🏆 보상', value: `${this.config.drawReward.toLocaleString()}G`, inline: true }
                        );
                } else if (botResult.winner === 'bot') {
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
                    botResult.winPattern || []
                );
                
                if (typeof finalBoardImage === 'string') {
                    await message.edit({
                        embeds: [gameEndEmbed],
                        content: finalBoardImage,
                        components: []
                    });
                } else {
                    await message.edit({
                        embeds: [gameEndEmbed],
                        files: [finalBoardImage],
                        components: []
                    });
                }
                
                // 보상 처리는 핸들러에서 수행
                return botResult;
            } else {
                // 게임 계속
                const updatedEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🤖 봇 대전')
                    .setDescription(`${game.player1.username}님의 차례입니다! (X)`)
                    .addFields(
                        { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                        { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true }
                    );
                
                const updatedImage = await this.createBoardImage(game.board, game.player1, game.player2, [], game.lastMovePosition);
                const updatedButtons = this.createGameButtons(game.id, game.currentTurn, game.board);
                
                if (typeof updatedImage === 'string') {
                    await message.edit({
                        embeds: [updatedEmbed],
                        content: updatedImage,
                        components: updatedButtons
                    });
                } else {
                    await message.edit({
                        embeds: [updatedEmbed],
                        files: [updatedImage],
                        components: updatedButtons
                    });
                }
            }
        }, 1500);
        
        return result;
    }
};

module.exports = TIC_TAC_TOE_GAME;