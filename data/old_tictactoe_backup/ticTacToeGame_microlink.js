const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const mql = require('@microlink/mql');
const fs = require('fs').promises;
const path = require('path');

// 간단한 캐시
const imageCache = new Map();

// Microlink를 사용한 틱택토 게임 시스템
const TIC_TAC_TOE_GAME = {
    // 게임 설정
    config: {
        boardSize: 3,
        winReward: 300000,
        loseReward: 50000,
        drawReward: 100000,
        botDifficulty: 0.8,
        turnTimeout: 30000,  // 30초
        maxPieces: 3,        // 각 플레이어당 최대 3개까지만
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
            turnTimer: null  // 턴 타이머
        };
        
        this.activeGames.set(gameId, gameData);
        return gameData;
    },
    
    // HTML 생성
    createBoardHTML(board, player1, player2, winPattern = [], lastMovePosition = null) {
        const xCount = board.filter(cell => cell === 'X').length;
        const oCount = board.filter(cell => cell === 'O').length;
        const isXActive = xCount <= oCount;
        
        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    width: 450px;
    height: 550px;
    background: #2C2F33;
    font-family: 'Arial', sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
}
.title {
    font-size: 32px;
    font-weight: bold;
    color: #FFFFFF;
    margin-bottom: 20px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}
.players {
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin-bottom: 20px;
}
.player {
    background: ${isXActive ? '#5865F2' : '#99AAB5'};
    padding: 10px 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.player.active {
    background: #5865F2;
}
.player.inactive {
    background: #99AAB5;
}
.vs {
    color: #FFFFFF;
    font-size: 20px;
    font-weight: bold;
    align-self: center;
}
.turn-info {
    color: #FFFFFF;
    font-size: 18px;
    margin-bottom: 10px;
}
.special-rule {
    color: #FFD93D;
    font-size: 14px;
    margin-bottom: 20px;
}
.board {
    display: grid;
    grid-template-columns: repeat(3, 100px);
    grid-template-rows: repeat(3, 100px);
    gap: 10px;
    background: #23272A;
    padding: 15px;
    border-radius: 12px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
}
.cell {
    background: #40444B;
    border: 2px solid #5865F2;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    cursor: pointer;
    transition: all 0.3s;
}
.cell:hover {
    background: #4E535A;
}
.cell.win {
    background: #FFD700 !important;
    border-color: #FFA500 !important;
}
.cell.last {
    background: #98FB98 !important;
    border-color: #7CFC00 !important;
}
.piece-count {
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin-top: 20px;
    color: #FFFFFF;
    font-size: 16px;
}
</style>
</head>
<body>
<div class="title">TIC TAC TOE</div>
<div class="players">
    <div class="player ${isXActive ? 'active' : 'inactive'}">❌ ${player1.username.substring(0, 10)}</div>
    <div class="vs">VS</div>
    <div class="player ${!isXActive ? 'active' : 'inactive'}">⭕ ${player2.username.substring(0, 10)}</div>
</div>
<div class="turn-info">${isXActive ? player1.username : player2.username}님의 턴!</div>
<div class="special-rule">※ 각 플레이어는 최대 3개까지만 놓을 수 있습니다</div>
<div class="board">
    ${board.map((cell, i) => {
        let cellClass = 'cell';
        if (winPattern.includes(i)) cellClass += ' win';
        else if (i === lastMovePosition) cellClass += ' last';
        return `<div class="${cellClass}">${cell === 'X' ? '❌' : cell === 'O' ? '⭕' : ''}</div>`;
    }).join('')}
</div>
<div class="piece-count">
    <span>❌ 남은 수: ${3 - Math.min(this.activeGames.get(player1.id + player2.id)?.moveHistory?.X?.length || 0, 3)}</span>
    <span>⭕ 남은 수: ${3 - Math.min(this.activeGames.get(player1.id + player2.id)?.moveHistory?.O?.length || 0, 3)}</span>
</div>
</body>
</html>`;
    },
    
    // Microlink로 이미지 생성
    async createBoardImage(board, player1, player2, winPattern = [], lastMovePosition = null) {
        try {
            // 캐시 확인
            const boardState = board.map(cell => cell === 'X' ? '1' : cell === 'O' ? '2' : '0').join('');
            const cacheKey = `${boardState}_${winPattern.join(',')}_${lastMovePosition || ''}`;
            
            const cached = imageCache.get(cacheKey);
            if (cached) {
                return cached;
            }
            
            // HTML 생성
            const html = this.createBoardHTML(board, player1, player2, winPattern, lastMovePosition);
            
            // HTML을 임시 파일로 저장
            const tempDir = path.join(__dirname, '../temp');
            try {
                await fs.mkdir(tempDir, { recursive: true });
            } catch (e) {
                // 이미 존재하면 무시
            }
            
            const tempFileName = `tictactoe_${Date.now()}.html`;
            const tempFilePath = path.join(tempDir, tempFileName);
            await fs.writeFile(tempFilePath, html);
            
            // 로컬 파일 URL 생성 (Windows 경로 변환)
            const fileUrl = `file:///${tempFilePath.replace(/\\/g, '/')}`;
            
            // Microlink API 호출
            const { status, data } = await mql(fileUrl, {
                screenshot: true,
                viewport: {
                    width: 450,
                    height: 550,
                    deviceScaleFactor: 1
                },
                waitUntil: 'networkidle0',
                type: 'png'
            });
            
            if (status !== 'success' || !data.screenshot) {
                console.error('Microlink API 실패:', status);
                // 임시 파일 삭제
                await fs.unlink(tempFilePath).catch(() => {});
                return 'RATE_LIMITED';
            }
            
            // 이미지 다운로드
            const axios = require('axios');
            const imageResponse = await axios.get(data.screenshot.url, {
                responseType: 'arraybuffer',
                timeout: 5000
            });
            
            const buffer = Buffer.from(imageResponse.data);
            const attachment = new AttachmentBuilder(buffer, { name: 'tictactoe.png' });
            
            // 캐시에 저장
            imageCache.set(cacheKey, attachment);
            
            // 임시 파일 삭제
            await fs.unlink(tempFilePath).catch(() => {});
            
            return attachment;
            
        } catch (error) {
            console.error('Microlink 이미지 생성 오류:', error);
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
        
        // 승리 확인 (제거 전에!)
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
        
        // 3개 이상이면 가장 오래된 것 제거
        if (game.moveHistory[game.currentTurn].length > this.config.maxPieces) {
            const oldestPosition = game.moveHistory[game.currentTurn].shift();
            game.board[oldestPosition] = null;
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
        const game = this.activeGames.get(gameId);
        if (game && game.turnTimer) {
            clearTimeout(game.turnTimer);
        }
        this.activeGames.delete(gameId);
    },
    
    // 텍스트 기반 보드 생성 (Microlink 실패 시 사용)
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
            // Microlink 실패 시 텍스트로 표시
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
        
        // 플레이어 턴에 타이머 설정
        if (game.currentTurn === 'X') {
            game.turnTimer = setTimeout(async () => {
                // 시간 초과 - 플레이어 패배
                game.winner = 'bot';
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('⏰ 시간 초과!')
                    .setDescription(`${game.player1.username}님이 시간 내에 두지 못했습니다!`)
                    .addFields(
                        { name: '💔 패배', value: `${this.config.loseReward.toLocaleString()}G`, inline: true }
                    );
                
                await sentMessage.edit({
                    embeds: [timeoutEmbed],
                    components: []
                });
                
                this.endGame(game.id);
            }, this.config.turnTimeout);
        }
        
        // 봇이 먼저 시작하는 경우
        if (game.currentTurn === 'O') {
            setTimeout(async () => {
                const botMove = this.getBotMove(game.board, difficulty, game.moveHistory);
                const result = this.makeMove(game.id, botMove, 'bot');
                
                if (!result.gameOver) {
                    const updatedEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('🤖 봇 대전')
                        .setDescription('🟢 당신의 턴입니다!')
                        .addFields(
                            { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                            { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true },
                            { name: '🎯 현재 차례', value: `${game.player1.username} (X)`, inline: true }
                        );
                    
                    const updatedImage = await this.createBoardImage(game.board, game.player1, game.player2, [], game.lastMovePosition);
                    const updatedButtons = this.createGameButtons(game.id, game.currentTurn, game.board);
                    
                    const messages = await channel.messages.fetch({ limit: 1 });
                    const lastMessage = messages.first();
                    if (lastMessage) {
                        if (updatedImage === 'RATE_LIMITED') {
                            updatedEmbed.addFields({
                                name: '🎮 게임 보드',
                                value: this.createTextBoard(game.board)
                            });
                            await lastMessage.edit({
                                embeds: [updatedEmbed],
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
    getBotMove(board, difficulty, moveHistory = null) {
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
            .setColor('#ff0000')
            .setTitle('🤖 봇 대전')
            .setDescription('🔴 봇이 생각 중입니다...')
            .addFields(
                { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true },
                { name: '🎯 현재 차례', value: `${game.player2.username} (O)`, inline: true }
            );
        
        const playerMoveImage = await this.createBoardImage(game.board, game.player1, game.player2, [], game.lastMovePosition);
        const disabledButtons = this.createGameButtons(game.id, game.currentTurn, game.board)
            .map(row => {
                row.components.forEach(button => button.setDisabled(true));
                return row;
            });
        
        if (playerMoveImage === 'RATE_LIMITED') {
            playerMoveEmbed.addFields({
                name: '🎮 게임 보드',
                value: this.createTextBoard(game.board)
            });
            await message.edit({
                embeds: [playerMoveEmbed],
                components: disabledButtons
            });
        } else {
            await message.edit({
                embeds: [playerMoveEmbed],
                files: [playerMoveImage],
                components: disabledButtons
            });
        }
        
        // 타이머 정리
        if (game.turnTimer) {
            clearTimeout(game.turnTimer);
            game.turnTimer = null;
        }
        
        // 봇 이동 (1.5초 딜레이)
        setTimeout(async () => {
            const botMove = this.getBotMove(game.board, game.botDifficulty, game.moveHistory);
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
                
                // 보상 처리는 핸들러에서 수행
                return botResult;
            } else {
                // 게임 계속
                const updatedEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🤖 봇 대전')
                    .setDescription('🟢 당신의 턴입니다!')
                    .addFields(
                        { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                        { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true },
                        { name: '🎯 현재 차례', value: `${game.player1.username} (X)`, inline: true }
                    );
                
                const updatedImage = await this.createBoardImage(game.board, game.player1, game.player2, [], game.lastMovePosition);
                const updatedButtons = this.createGameButtons(game.id, game.currentTurn, game.board);
                
                if (updatedImage === 'RATE_LIMITED') {
                    updatedEmbed.addFields({
                        name: '🎮 게임 보드',
                        value: this.createTextBoard(game.board)
                    });
                    await message.edit({
                        embeds: [updatedEmbed],
                        components: updatedButtons
                    });
                } else {
                    await message.edit({
                        embeds: [updatedEmbed],
                        files: [updatedImage],
                        components: updatedButtons
                    });
                }
                
                // 플레이어 턴 타이머 설정
                game.turnTimer = setTimeout(async () => {
                    // 시간 초과 - 플레이어 패배
                    game.winner = 'bot';
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('⏰ 시간 초과!')
                        .setDescription(`${game.player1.username}님이 시간 내에 두지 못했습니다!`)
                        .addFields(
                            { name: '💔 패배', value: `${this.config.loseReward.toLocaleString()}G`, inline: true }
                        );
                    
                    await message.edit({
                        embeds: [timeoutEmbed],
                        components: []
                    });
                    
                    this.endGame(game.id);
                }, this.config.turnTimeout);
            }
        }, 1500);
        
        return result;
    },
    
    // 예측 프리렌더링 비활성화
    async predictivePrerender() {
        // 사용하지 않음
    },
    
    // 초기화
    async initialize() {
        console.log('[TicTacToe] Microlink API 기반 시스템 초기화');
    }
};

module.exports = TIC_TAC_TOE_GAME;