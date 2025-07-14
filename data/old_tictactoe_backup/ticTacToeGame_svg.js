const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');

// 틱택토 게임 시스템 (SVG 버전)
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
    
    // 게임 보드 SVG 생성
    async createBoardImage(board, player1, player2, winPattern = []) {
        const width = 800;
        const height = 900;
        const cellSize = 250;
        const padding = 25;
        const boardStartY = 100;
        
        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
        
        // 배경 그라디언트
        svg += `
            <defs>
                <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#2C2F33;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#23272A;stop-opacity:1" />
                </linearGradient>
                <filter id="shadow">
                    <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
                </filter>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <clipPath id="circleClip">
                    <circle cx="125" cy="125" r="110"/>
                </clipPath>
            </defs>
        `;
        
        // 배경
        svg += `<rect width="${width}" height="${height}" fill="url(#bgGradient)"/>`;
        
        // 타이틀
        svg += `
            <text x="${width/2}" y="50" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#FFFFFF" filter="url(#shadow)">
                틱택토 게임
            </text>
        `;
        
        // 플레이어 정보 표시
        svg += `
            <text x="150" y="85" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#FF6B6B">
                ❌ ${player1.username}
            </text>
            <text x="650" y="85" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#4ECDC4">
                ⭕ ${player2.username}
            </text>
        `;
        
        // 게임 보드 격자
        const gridStartX = padding;
        const gridStartY = boardStartY;
        
        // 격자선 그리기
        svg += `<g stroke="#4A4D52" stroke-width="6" stroke-linecap="round" filter="url(#shadow)">`;
        
        // 세로선
        for (let i = 1; i < 3; i++) {
            const x = gridStartX + i * cellSize;
            svg += `<line x1="${x}" y1="${gridStartY}" x2="${x}" y2="${gridStartY + 3 * cellSize}"/>`;
        }
        
        // 가로선
        for (let i = 1; i < 3; i++) {
            const y = gridStartY + i * cellSize;
            svg += `<line x1="${gridStartX}" y1="${y}" x2="${gridStartX + 3 * cellSize}" y2="${y}"/>`;
        }
        
        svg += `</g>`;
        
        // 셀 내용 그리기
        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const x = gridStartX + col * cellSize + cellSize / 2;
            const y = gridStartY + row * cellSize + cellSize / 2;
            
            if (board[i]) {
                const player = board[i] === 'X' ? player1 : player2;
                const isWinCell = winPattern.includes(i);
                
                // 프로필 이미지 배경 원
                if (isWinCell) {
                    svg += `<circle cx="${x}" cy="${y}" r="115" fill="none" stroke="#FFD700" stroke-width="8" filter="url(#glow)"/>`;
                }
                
                // 프로필 이미지를 위한 패턴 정의
                const patternId = `avatar${i}`;
                svg += `
                    <defs>
                        <pattern id="${patternId}" x="0" y="0" width="100%" height="100%" viewBox="0 0 250 250">
                            <image href="${player.avatar}" x="0" y="0" width="250" height="250" preserveAspectRatio="xMidYMid slice"/>
                        </pattern>
                    </defs>
                `;
                
                // 프로필 이미지 원
                svg += `
                    <circle cx="${x}" cy="${y}" r="110" fill="url(#${patternId})" stroke="${board[i] === 'X' ? '#FF6B6B' : '#4ECDC4'}" stroke-width="4" filter="url(#shadow)"/>
                `;
                
                // 플레이어 이름 표시
                svg += `
                    <text x="${x}" y="${y + 140}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="${board[i] === 'X' ? '#FF6B6B' : '#4ECDC4'}">
                        ${player.username.substring(0, 10)}
                    </text>
                `;
            } else {
                // 빈 셀 - 호버 효과를 위한 투명한 원
                svg += `<circle cx="${x}" cy="${y}" r="110" fill="#2C2F33" fill-opacity="0.3" stroke="#4A4D52" stroke-width="2" stroke-dasharray="5,5"/>`;
            }
        }
        
        // 승리 라인 그리기
        if (winPattern.length === 3) {
            const [start, , end] = winPattern;
            const startRow = Math.floor(start / 3);
            const startCol = start % 3;
            const endRow = Math.floor(end / 3);
            const endCol = end % 3;
            
            const x1 = gridStartX + startCol * cellSize + cellSize / 2;
            const y1 = gridStartY + startRow * cellSize + cellSize / 2;
            const x2 = gridStartX + endCol * cellSize + cellSize / 2;
            const y2 = gridStartY + endRow * cellSize + cellSize / 2;
            
            svg += `
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                      stroke="#FFD700" stroke-width="12" stroke-linecap="round" 
                      opacity="0.8" filter="url(#glow)"/>
            `;
        }
        
        // 푸터
        svg += `
            <text x="${width/2}" y="${height - 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#7289DA">
                🎮 Discord 틱택토 게임
            </text>
        `;
        
        svg += `</svg>`;
        
        // SVG를 버퍼로 변환
        const buffer = Buffer.from(svg, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: 'tictactoe.svg' });
        
        return attachment;
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
                    .setStyle(board[index] !== null ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    .setDisabled(board[index] !== null);
                
                // 버튼 레이블
                if (board[index] === 'X') {
                    button.setLabel('❌');
                } else if (board[index] === 'O') {
                    button.setLabel('⭕');
                } else {
                    button.setLabel('⬜');
                }
                
                buttons.push(button);
            }
            rows.push(new ActionRowBuilder().addComponents(buttons));
        }
        
        // 게임 포기 버튼
        const controlRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`tictactoe_forfeit_${gameId}`)
                    .setLabel('포기')
                    .setStyle(ButtonStyle.Danger)
            );
        
        rows.push(controlRow);
        return rows;
    },
    
    // 움직임 처리
    makeMove(gameId, position, playerId) {
        const game = this.activeGames.get(gameId);
        if (!game) return { success: false, error: '게임을 찾을 수 없습니다.' };
        
        // 차례 확인
        const playerSymbol = game.player1.id === playerId ? 'X' : 'O';
        if (game.currentTurn !== playerSymbol) {
            return { success: false, error: '당신의 차례가 아닙니다!' };
        }
        
        // 이미 놓여진 곳인지 확인
        if (game.board[position] !== null) {
            return { success: false, error: '이미 선택된 위치입니다!' };
        }
        
        // 움직임 적용
        game.board[position] = playerSymbol;
        game.lastMoveTime = Date.now();
        
        // 승리 확인
        const winPattern = this.checkWin(game.board, playerSymbol);
        if (winPattern) {
            game.winner = playerSymbol;
            game.winPattern = winPattern;
            return { success: true, gameOver: true, winner: playerSymbol, winPattern };
        }
        
        // 무승부 확인
        if (game.board.every(cell => cell !== null)) {
            game.isDraw = true;
            return { success: true, gameOver: true, isDraw: true };
        }
        
        // 턴 교체
        game.currentTurn = game.currentTurn === 'X' ? 'O' : 'X';
        return { success: true, gameOver: false };
    },
    
    // 승리 조건 확인
    checkWin(board, symbol) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // 가로
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // 세로
            [0, 4, 8], [2, 4, 6] // 대각선
        ];
        
        for (const pattern of winPatterns) {
            if (pattern.every(index => board[index] === symbol)) {
                return pattern;
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
    },
    
    // handleMove 메소드 추가 (handler와의 호환성을 위해)
    async handleMove(gameId, position, playerId, message) {
        const result = this.makeMove(gameId, position, playerId);
        
        if (!result.success) {
            return result;
        }
        
        const game = this.activeGames.get(gameId);
        if (!game) return { success: false, error: '게임을 찾을 수 없습니다.' };
        
        // 게임 종료 시
        if (result.gameOver) {
            let rewards = {};
            if (result.isDraw) {
                rewards = { winner: this.config.drawReward, loser: this.config.drawReward };
            } else {
                const winnerId = result.winner === 'X' ? game.player1.id : game.player2.id;
                const loserId = result.winner === 'X' ? game.player2.id : game.player1.id;
                
                if (game.settings) {
                    rewards = { winner: game.settings.reward, loser: 0 };
                } else {
                    rewards = { winner: this.config.winReward, loser: this.config.loseReward };
                }
                
                return {
                    success: true,
                    gameOver: true,
                    winner: winnerId,
                    loser: loserId,
                    winPattern: result.winPattern,
                    isDraw: result.isDraw,
                    rewards: rewards
                };
            }
            
            return {
                success: true,
                gameOver: true,
                isDraw: true,
                rewards: rewards
            };
        }
        
        // 봇 차례인 경우 봇 움직임 처리
        if (game.currentTurn === 'O' && game.player2.id === 'bot') {
            setTimeout(async () => {
                await this.makeBotMove(gameId, message);
            }, 1500);
        }
        
        return { success: true, gameOver: false };
    }
};

module.exports = TIC_TAC_TOE_GAME;