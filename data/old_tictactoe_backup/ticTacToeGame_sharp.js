const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const sharp = require('sharp');
const axios = require('axios');

// 틱택토 게임 시스템 (Sharp 버전)
const TIC_TAC_TOE_GAME = {
    // 게임 설정
    config: {
        boardSize: 3,
        winReward: 300000,
        loseReward: 50000,
        drawReward: 100000,
        botDifficulty: 0.8, // 봇 난이도 (0-1)
        turnTimeout: 30000, // 30초
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
    
    // 게임 보드 이미지 생성 (SVG -> PNG)
    async createBoardImage(board, player1, player2, winPattern = [], lastMovePosition = null) {
        // 큰 보드 SVG 템플릿 생성
        const xCount = board.filter(cell => cell === 'X').length;
        const oCount = board.filter(cell => cell === 'O').length;
        const isXActive = xCount <= oCount;
        
        let svg = `<svg width="800" height="900" xmlns="http://www.w3.org/2000/svg">
            <!-- 배경 -->
            <rect width="800" height="900" fill="white"/>
            
            <!-- 타이틀 -->
            <text x="400" y="60" font-family="Arial, sans-serif" font-size="48" font-weight="bold" text-anchor="middle" fill="#333">TIC TAC TOE</text>
            
            <!-- 플레이어 정보 -->
            <g transform="translate(0, 100)">
                <!-- Player 1 -->
                <rect x="50" y="0" width="250" height="80" rx="20" fill="${isXActive ? '#e3f2fd' : '#f5f5f5'}" stroke="${isXActive ? '#2196f3' : 'transparent'}" stroke-width="4"/>
                <text x="175" y="35" font-family="Arial, sans-serif" font-size="20" font-weight="600" text-anchor="middle" fill="#333">${player1.username.substring(0, 15)}</text>
                <text x="175" y="65" font-family="Arial, sans-serif" font-size="32" text-anchor="middle">❌</text>
                
                <!-- VS -->
                <text x="400" y="50" font-family="Arial, sans-serif" font-size="32" font-weight="bold" text-anchor="middle" fill="#666">VS</text>
                
                <!-- Player 2 -->
                <rect x="500" y="0" width="250" height="80" rx="20" fill="${!isXActive ? '#e3f2fd' : '#f5f5f5'}" stroke="${!isXActive ? '#2196f3' : 'transparent'}" stroke-width="4"/>
                <text x="625" y="35" font-family="Arial, sans-serif" font-size="20" font-weight="600" text-anchor="middle" fill="#333">${player2.username.substring(0, 15)}</text>
                <text x="625" y="65" font-family="Arial, sans-serif" font-size="32" text-anchor="middle">⭕</text>
            </g>
            
            <!-- 게임 보드 배경 -->
            <rect x="60" y="230" width="680" height="680" rx="25" fill="#333"/>`;
        
        // 게임 셀 그리기
        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const x = 80 + col * 220;
            const y = 250 + row * 220;
            
            let cellFill = 'white';
            if (winPattern.includes(i)) {
                cellFill = '#ffeb3b';
            } else if (i === lastMovePosition) {
                cellFill = '#e8f5e9';
            }
            
            svg += `
                <rect x="${x}" y="${y}" width="200" height="200" rx="25" fill="${cellFill}"/>`;
            
            if (board[i] === 'X') {
                svg += `<text x="${x + 100}" y="${y + 140}" font-family="Arial, sans-serif" font-size="120" text-anchor="middle" fill="#e74c3c">❌</text>`;
            } else if (board[i] === 'O') {
                svg += `<text x="${x + 100}" y="${y + 140}" font-family="Arial, sans-serif" font-size="120" text-anchor="middle" fill="#3498db">⭕</text>`;
            }
        }
        
        svg += '</svg>';
        
        // SVG를 PNG로 변환 (고품질)
        const buffer = await sharp(Buffer.from(svg))
            .png({ quality: 95 })
            .toBuffer();
        
        return new AttachmentBuilder(buffer, { name: 'tictactoe.png' });
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
                    .setLabel(board[index] || '⬜')
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
            avatar: null,
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

        const gameMessage = await channel.send({
            embeds: [gameEmbed],
            files: [boardImage],
            components: buttons
        });
        
        // 봇이 먼저 시작하는 경우
        if (game.currentTurn === 'O') {
            setTimeout(async () => {
                await this.makeBotMove(game.id, gameMessage);
            }, 1500);
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
            
            await message.edit({
                embeds: [embed],
                files: [boardImage],
                components: result.gameOver ? [] : buttons
            });
        }
    }
};

module.exports = TIC_TAC_TOE_GAME;