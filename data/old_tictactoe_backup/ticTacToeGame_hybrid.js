const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// 로컬 Canvas로 이미지 생성하는 하이브리드 버전
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
    
    // Canvas로 이미지 생성
    async createBoardImage(board, player1, player2, winPattern = [], lastMovePosition = null) {
        try {
            // Canvas 생성
            const width = 450;
            const height = 550;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');
            
            // 배경
            ctx.fillStyle = '#2C2F33';
            ctx.fillRect(0, 0, width, height);
            
            // 제목
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('TIC TAC TOE', width / 2, 50);
            
            // 플레이어 정보
            const xCount = board.filter(cell => cell === 'X').length;
            const oCount = board.filter(cell => cell === 'O').length;
            const isXActive = xCount <= oCount;
            
            // 플레이어 박스
            ctx.fillStyle = isXActive ? '#5865F2' : '#99AAB5';
            ctx.fillRect(40, 80, 160, 50);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('❌ ' + player1.username.substring(0, 10), 120, 110);
            
            ctx.fillStyle = !isXActive ? '#5865F2' : '#99AAB5';
            ctx.fillRect(250, 80, 160, 50);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('⭕ ' + player2.username.substring(0, 10), 330, 110);
            
            // VS
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('VS', width / 2, 110);
            
            // 현재 턴
            ctx.font = '22px Arial';
            ctx.fillStyle = isXActive ? '#FF6B6B' : '#4ECDC4';
            const turnText = isXActive ? `${player1.username}님의 턴!` : `${player2.username}님의 턴!`;
            ctx.fillText(turnText, width / 2, 160);
            
            // 특별 규칙 표시
            ctx.font = '14px Arial';
            ctx.fillStyle = '#FFD93D';
            ctx.fillText('※ 각 플레이어는 최대 3개까지만 놓을 수 있습니다', width / 2, 180);
            
            // 게임 보드
            const boardSize = 300;
            const cellSize = boardSize / 3;
            const boardX = (width - boardSize) / 2;
            const boardY = 200;
            
            // 보드 배경
            ctx.fillStyle = '#23272A';
            ctx.fillRect(boardX - 10, boardY - 10, boardSize + 20, boardSize + 20);
            
            // 격자선
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            
            for (let i = 1; i < 3; i++) {
                // 세로선
                ctx.beginPath();
                ctx.moveTo(boardX + i * cellSize, boardY);
                ctx.lineTo(boardX + i * cellSize, boardY + boardSize);
                ctx.stroke();
                
                // 가로선
                ctx.beginPath();
                ctx.moveTo(boardX, boardY + i * cellSize);
                ctx.lineTo(boardX + boardSize, boardY + i * cellSize);
                ctx.stroke();
            }
            
            // 말 그리기
            ctx.font = 'bold 60px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            for (let i = 0; i < 9; i++) {
                const row = Math.floor(i / 3);
                const col = i % 3;
                const x = boardX + col * cellSize + cellSize / 2;
                const y = boardY + row * cellSize + cellSize / 2;
                
                // 셀 배경색
                if (winPattern.includes(i)) {
                    ctx.fillStyle = '#FFD700';
                    ctx.fillRect(boardX + col * cellSize + 5, boardY + row * cellSize + 5, cellSize - 10, cellSize - 10);
                } else if (i === lastMovePosition) {
                    ctx.fillStyle = '#98FB98';
                    ctx.fillRect(boardX + col * cellSize + 5, boardY + row * cellSize + 5, cellSize - 10, cellSize - 10);
                }
                
                // X나 O 그리기
                if (board[i] === 'X') {
                    ctx.fillStyle = '#FF6B6B';
                    ctx.fillText('❌', x, y);
                } else if (board[i] === 'O') {
                    ctx.fillStyle = '#4ECDC4';
                    ctx.fillText('⭕', x, y);
                }
            }
            
            // 남은 말 개수 표시
            const xHistory = this.activeGames.get(player1.id + player2.id)?.moveHistory?.X || [];
            const oHistory = this.activeGames.get(player1.id + player2.id)?.moveHistory?.O || [];
            
            ctx.font = '16px Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'left';
            ctx.fillText(`❌ 남은 수: ${3 - Math.min(xHistory.length, 3)}`, 40, 530);
            ctx.textAlign = 'right';
            ctx.fillText(`⭕ 남은 수: ${3 - Math.min(oHistory.length, 3)}`, width - 40, 530);
            
            // 버퍼로 변환
            const buffer = canvas.toBuffer('image/png');
            const attachment = new AttachmentBuilder(buffer, { name: 'tictactoe.png' });
            
            return attachment;
            
        } catch (error) {
            console.error('Canvas 이미지 생성 오류:', error);
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
        
        // 3개 이상이면 가장 오래된 것 제거
        if (game.moveHistory[game.currentTurn].length > this.config.maxPieces) {
            const oldestPosition = game.moveHistory[game.currentTurn].shift();
            game.board[oldestPosition] = null;
        }
        
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
        const game = this.activeGames.get(gameId);
        if (game && game.turnTimer) {
            clearTimeout(game.turnTimer);
        }
        this.activeGames.delete(gameId);
    },
    
    // 텍스트 기반 보드 생성 (Canvas 실패 시 사용)
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
            // Canvas 실패 시 텍스트로 표시
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
        console.log('[TicTacToe] Canvas 기반 로컬 이미지 생성 시스템 초기화');
    }
};

module.exports = TIC_TAC_TOE_GAME;