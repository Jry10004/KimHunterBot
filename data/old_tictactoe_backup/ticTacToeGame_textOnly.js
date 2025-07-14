const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 텍스트 기반 틱택토 게임 시스템 (이미지 생성 없음)
const TIC_TAC_TOE_GAME = {
    // 게임 설정
    config: {
        boardSize: 3,
        winReward: 300000,
        loseReward: 50000,
        drawReward: 100000,
        botDifficulty: 0.8,
        turnTimeout: 15000,  // 15초
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
            moveHistory: {
                X: [],
                O: []
            },
            turnTimer: null
        };
        
        this.activeGames.set(gameId, gameData);
        return gameData;
    },
    
    // 텍스트 기반 보드 생성 (이모지 사용)
    createTextBoard(board, winPattern = [], lastMovePosition = null) {
        let boardDisplay = '';
        
        for (let i = 0; i < 9; i++) {
            let cell = '';
            
            // 셀 내용 결정
            if (board[i] === 'X') {
                cell = '❌';
            } else if (board[i] === 'O') {
                cell = '⭕';
            } else {
                // 빈 칸은 숫자 이모지로 표시
                const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
                cell = numbers[i];
            }
            
            // 특수 표시 (승리 패턴이나 마지막 수)
            if (winPattern.includes(i)) {
                cell = `**${cell}**`; // 승리 패턴은 굵게
            } else if (i === lastMovePosition) {
                cell = `__${cell}__`; // 마지막 수는 밑줄
            }
            
            boardDisplay += cell + ' ';
            
            // 3개마다 줄바꿈
            if ((i + 1) % 3 === 0 && i < 8) {
                boardDisplay += '\n';
            }
        }
        
        return boardDisplay;
    },
    
    // 이미지 대신 텍스트 보드를 반환하도록 수정
    async createBoardImage(board, player1, player2, winPattern = [], lastMovePosition = null) {
        // 텍스트 보드만 반환
        return 'TEXT_ONLY';
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
        
        const xCount = game.board.filter(cell => cell === 'X').length;
        const oCount = game.board.filter(cell => cell === 'O').length;
        const isXActive = xCount <= oCount;
        
        const gameEmbed = new EmbedBuilder()
            .setColor(isYourTurn ? '#00ff00' : '#ff0000')
            .setTitle('🤖 봇 대전')
            .setDescription(
                `${isXActive ? '❌' : '⭕'} **${isXActive ? game.player1.username : game.player2.username}**님의 차례!\n\n` +
                `**🎮 게임 보드**\n${this.createTextBoard(game.board)}`
            )
            .addFields(
                { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true },
                { name: '💰 배팅', value: `${settings.bet.toLocaleString()}G`, inline: true },
                { name: '🏆 승리 보상', value: `${settings.reward.toLocaleString()}G`, inline: true }
            )
            .setFooter({ text: '버튼을 클릭하여 수를 놓으세요! (15초 제한)' });
        
        const buttons = this.createGameButtons(game.id, game.currentTurn, game.board);
        
        const sentMessage = await channel.send({
            embeds: [gameEmbed],
            components: buttons
        });
        
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
                        .setDescription(
                            `❌ **${game.player1.username}**님의 차례!\n\n` +
                            `**🎮 게임 보드**\n${this.createTextBoard(game.board, [], game.lastMovePosition)}`
                        )
                        .addFields(
                            { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                            { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true }
                        )
                        .setFooter({ text: '버튼을 클릭하여 수를 놓으세요! (15초 제한)' });
                    
                    const updatedButtons = this.createGameButtons(game.id, game.currentTurn, game.board);
                    
                    await sentMessage.edit({
                        embeds: [updatedEmbed],
                        components: updatedButtons
                    });
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
            .setDescription(
                `⭕ **봇이 생각 중입니다...**\n\n` +
                `**🎮 게임 보드**\n${this.createTextBoard(game.board, [], game.lastMovePosition)}`
            )
            .addFields(
                { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true }
            );
        
        const disabledButtons = this.createGameButtons(game.id, game.currentTurn, game.board)
            .map(row => {
                row.components.forEach(button => button.setDisabled(true));
                return row;
            });
        
        await message.edit({
            embeds: [playerMoveEmbed],
            components: disabledButtons
        });
        
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
                        .setDescription(
                            `아무도 승리하지 못했습니다!\n\n` +
                            `**🎮 최종 보드**\n${this.createTextBoard(game.board)}`
                        )
                        .addFields(
                            { name: '🏆 보상', value: `${this.config.drawReward.toLocaleString()}G`, inline: true }
                        );
                } else if (botResult.winner === 'bot') {
                    gameEndEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('💔 패배!')
                        .setDescription(
                            `${game.player2.username}의 승리!\n\n` +
                            `**🎮 최종 보드**\n${this.createTextBoard(game.board, botResult.winPattern || [])}`
                        )
                        .addFields(
                            { name: '💰 위로금', value: `${this.config.loseReward.toLocaleString()}G`, inline: true }
                        );
                } else {
                    gameEndEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('🎉 승리!')
                        .setDescription(
                            `${game.player1.username}님의 승리!\n\n` +
                            `**🎮 최종 보드**\n${this.createTextBoard(game.board, botResult.winPattern || [])}`
                        )
                        .addFields(
                            { name: '🏆 보상', value: `${game.botSettings.reward.toLocaleString()}G`, inline: true }
                        );
                }
                
                await message.edit({
                    embeds: [gameEndEmbed],
                    components: []
                });
                
                // 보상 처리는 핸들러에서 수행
                return botResult;
            } else {
                // 게임 계속
                const updatedEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🤖 봇 대전')
                    .setDescription(
                        `❌ **${game.player1.username}**님의 차례!\n\n` +
                        `**🎮 게임 보드**\n${this.createTextBoard(game.board, [], game.lastMovePosition)}`
                    )
                    .addFields(
                        { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                        { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true }
                    )
                    .setFooter({ text: '버튼을 클릭하여 수를 놓으세요! (15초 제한)' });
                
                const updatedButtons = this.createGameButtons(game.id, game.currentTurn, game.board);
                
                await message.edit({
                    embeds: [updatedEmbed],
                    components: updatedButtons
                });
                
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
        // 아무것도 하지 않음
    },
    
    // 초기화 비활성화
    async initialize() {
        console.log('[TicTacToe] 텍스트 모드로 실행');
    }
};

module.exports = TIC_TAC_TOE_GAME;