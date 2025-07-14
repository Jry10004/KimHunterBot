const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
// Jimp 1.x 버전의 올바른 import
const JimpModule = require('jimp');
const Jimp = JimpModule.Jimp;
const { loadFont } = JimpModule;

// 이미지 캐시
const imageCache = new Map();

// Jimp 기반 틱택토 게임 시스템
const TIC_TAC_TOE_GAME = {
    // 게임 설정
    config: {
        boardSize: 3,
        winReward: 10000,
        loseReward: 0,
        drawReward: 0,
        botDifficulty: 0.8,
        turnTimeout: 30000,  // 30초
        maxPieces: 3,        // 각 플레이어당 최대 3개까지만
    },
    
    // 활성 게임 저장소
    activeGames: new Map(),
    
    // 색상 정의
    colors: {
        background: 0x36393FFF,  // Discord 배경색
        boardBg: 0x2F3136FF,     // 보드 배경
        cell: 0x202225FF,        // 셀 배경
        cellHover: 0x4F545CFF,   // 셀 호버 효과
        cellBorder: 0x72767DFF,  // 셀 테두리
        activePlayer: 0x57F287FF, // 활성 플레이어 (초록)
        inactivePlayer: 0x4F545CFF, // 비활성 플레이어
        xColor: 0xED4245FF,      // X 색상 (빨강)
        oColor: 0x5865F2FF,      // O 색상 (파랑)
        winCell: 0xFEE75CFF,     // 승리 셀 (노랑)
        lastMoveCell: 0x57F287FF, // 마지막 수 (초록)
        white: 0xFFFFFFFF,
        yellow: 0xFEE75CFF,
        gridLine: 0x72767DFF     // 격자선
    },
    
    // 폰트 캐시
    fonts: {
        title: null,
        normal: null,
        large: null
    },
    
    // 초기화
    async initialize() {
        try {
            // 한글 폰트를 지원하지 않으므로 폰트 로드를 건너뜀
            console.log('[TicTacToe] Jimp 시스템 초기화 완료 (폰트 없이 도형만 사용)');
        } catch (error) {
            console.error('[TicTacToe] 초기화 실패:', error);
            console.error('상세 오류:', error.stack);
        }
    },
    
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
    
    // Jimp로 이미지 생성
    async createBoardImage(board, player1, player2, winPattern = [], lastMovePosition = null, gameId = null) {
        try {
            console.log('[TicTacToe] createBoardImage 호출:', {
                board: board,
                winPattern: winPattern,
                lastMovePosition: lastMovePosition,
                gameId: gameId
            });
            
            // Jimp 확인
            if (!Jimp) {
                console.error('[TicTacToe] Jimp가 로드되지 않음');
                return null;
            }
            
            // 캐시 확인
            const boardState = board.map(cell => cell === 'X' ? '1' : cell === 'O' ? '2' : '0').join('');
            const cacheKey = `${boardState}_${winPattern.join(',')}_${lastMovePosition || ''}`;
            
            if (imageCache.has(cacheKey)) {
                const cachedBuffer = imageCache.get(cacheKey);
                console.log('[TicTacToe] 캐시에서 이미지 반환');
                return new AttachmentBuilder(cachedBuffer, { name: 'tictactoe.png' });
            }
            
            // 이미지 생성 - 더 크게
            const width = 500;
            const height = 600;
            const image = new Jimp({ width, height, color: this.colors.background });
            
            // 타이틀은 표시하지 않음 (한글 폰트 문제)
            
            // 플레이어 정보
            const xCount = board.filter(cell => cell === 'X').length;
            const oCount = board.filter(cell => cell === 'O').length;
            const isXActive = xCount <= oCount;
            
            // 상단 정보 패널 배경
            const infoPanelBg = new Jimp({ width: 460, height: 100, color: this.colors.boardBg });
            image.composite(infoPanelBg, 20, 20);
            
            // 플레이어 1 (X) 박스
            const p1Active = isXActive;
            const p1Box = new Jimp({ width: 210, height: 80, color: p1Active ? this.colors.activePlayer : this.colors.inactivePlayer });
            image.composite(p1Box, 30, 30);
            
            // X 심볼 - 더 크고 선명하게
            const xColor = this.colors.xColor;
            const xCenterX = 60;
            const xCenterY = 70;
            const xSize = 20;
            for (let thickness = -4; thickness <= 4; thickness++) {
                for (let i = -xSize; i <= xSize; i++) {
                    // 첫 번째 대각선
                    image.setPixelColor(xColor, xCenterX + i, xCenterY + i + thickness);
                    // 두 번째 대각선
                    image.setPixelColor(xColor, xCenterX + i, xCenterY - i + thickness);
                }
            }
            
            // 플레이어 1 이름 (작은 글자로 표시)
            const p1Name = player1.username.slice(0, 10);
            // 이름은 도형으로 표시하기 어려우므로 생략
            
            // 플레이어 2 (O) 박스
            const p2Active = !isXActive;
            const p2Box = new Jimp({ width: 210, height: 80, color: p2Active ? this.colors.activePlayer : this.colors.inactivePlayer });
            image.composite(p2Box, 260, 30);
            
            // O 심볼 - 더 크고 선명하게
            const oColor = this.colors.oColor;
            const oCenterX = 410;
            const oCenterY = 70;
            const oRadius = 20;
            for (let angle = 0; angle < 360; angle++) {
                const rad = angle * Math.PI / 180;
                for (let thickness = -4; thickness <= 4; thickness++) {
                    const px = Math.round(oCenterX + (oRadius + thickness) * Math.cos(rad));
                    const py = Math.round(oCenterY + (oRadius + thickness) * Math.sin(rad));
                    image.setPixelColor(oColor, px, py);
                }
            }
            
            // VS 구분선
            const vsLineX = width / 2;
            for (let y = 40; y < 100; y++) {
                image.setPixelColor(this.colors.gridLine, vsLineX, y);
                image.setPixelColor(this.colors.gridLine, vsLineX + 1, y);
            }
            
            // 현재 턴 표시 - 활성 플레이어 박스로 표시됨
            
            // 게임 보드 - 더 크게
            const boardSize = 360;
            const cellSize = 120;
            const boardX = (width - boardSize) / 2;
            const boardY = 180;
            
            // 보드 외곽 테두리
            const boardBorder = new Jimp({ width: boardSize + 40, height: boardSize + 40, color: this.colors.boardBg });
            image.composite(boardBorder, boardX - 20, boardY - 20);
            
            // 보드 배경
            const boardBg = new Jimp({ width: boardSize + 20, height: boardSize + 20, color: this.colors.cell });
            image.composite(boardBg, boardX - 10, boardY - 10);
            
            // 셀 그리기
            for (let i = 0; i < 9; i++) {
                const row = Math.floor(i / 3);
                const col = i % 3;
                const x = boardX + col * cellSize;
                const y = boardY + row * cellSize;
                
                // 셀 배경 - 둥근 모서리 효과
                let cellColor = this.colors.cell;
                if (winPattern.includes(i)) {
                    cellColor = this.colors.winCell;
                } else if (i === lastMovePosition) {
                    cellColor = this.colors.lastMoveCell;
                }
                
                // 메인 셀
                const cell = new Jimp({ width: cellSize - 12, height: cellSize - 12, color: cellColor });
                image.composite(cell, x + 6, y + 6);
                
                // 셀 테두리 효과
                const cellBorder = new Jimp({ width: cellSize - 10, height: cellSize - 10, color: this.colors.cellBorder });
                for (let bx = 0; bx < cellSize - 10; bx++) {
                    image.setPixelColor(this.colors.cellBorder, x + 5 + bx, y + 5);
                    image.setPixelColor(this.colors.cellBorder, x + 5 + bx, y + cellSize - 6);
                }
                for (let by = 0; by < cellSize - 10; by++) {
                    image.setPixelColor(this.colors.cellBorder, x + 5, y + 5 + by);
                    image.setPixelColor(this.colors.cellBorder, x + cellSize - 6, y + 5 + by);
                }
                
                // X나 O 표시 - 항상 도형으로만
                if (board[i]) {
                    const symbol = board[i];
                    const color = board[i] === 'X' ? this.colors.xColor : this.colors.oColor;
                    
                    if (symbol === 'X') {
                        // X 그리기 - 부드럽고 굵게
                        const centerX = x + cellSize / 2;
                        const centerY = y + cellSize / 2;
                        const xRadius = 35;
                        
                        for (let thickness = -5; thickness <= 5; thickness++) {
                            for (let i = -xRadius; i <= xRadius; i++) {
                                // 첫 번째 대각선
                                const x1 = centerX + i;
                                const y1 = centerY + i + thickness;
                                if (x1 >= x + 15 && x1 < x + cellSize - 15 && y1 >= y + 15 && y1 < y + cellSize - 15) {
                                    image.setPixelColor(color, x1, y1);
                                }
                                // 두 번째 대각선
                                const x2 = centerX + i;
                                const y2 = centerY - i + thickness;
                                if (x2 >= x + 15 && x2 < x + cellSize - 15 && y2 >= y + 15 && y2 < y + cellSize - 15) {
                                    image.setPixelColor(color, x2, y2);
                                }
                            }
                        }
                    } else {
                        // O 그리기 - 부드럽고 굵게
                        const centerX = x + cellSize / 2;
                        const centerY = y + cellSize / 2;
                        const oRadius = 35;
                        
                        for (let angle = 0; angle < 360; angle++) {
                            const rad = angle * Math.PI / 180;
                            for (let thickness = -5; thickness <= 5; thickness++) {
                                const px = Math.round(centerX + (oRadius + thickness) * Math.cos(rad));
                                const py = Math.round(centerY + (oRadius + thickness) * Math.sin(rad));
                                if (px >= x + 15 && px < x + cellSize - 15 && py >= y + 15 && py < y + cellSize - 15) {
                                    image.setPixelColor(color, px, py);
                                }
                            }
                        }
                    }
                }
            }
            
            // 격자선 그리기 - 더 부드럽게
            for (let i = 1; i < 3; i++) {
                // 세로선
                for (let y = 0; y < boardSize; y++) {
                    for (let thickness = -2; thickness <= 2; thickness++) {
                        image.setPixelColor(this.colors.gridLine, boardX + i * cellSize + thickness, boardY + y);
                    }
                }
                
                // 가로선
                for (let x = 0; x < boardSize; x++) {
                    for (let thickness = -2; thickness <= 2; thickness++) {
                        image.setPixelColor(this.colors.gridLine, boardX + x, boardY + i * cellSize + thickness);
                    }
                }
            }
            
            // 남은 말 개수 - 도형으로 표시
            const xHistory = gameId ? this.activeGames.get(gameId)?.moveHistory?.X || [] : [];
            const oHistory = gameId ? this.activeGames.get(gameId)?.moveHistory?.O || [] : [];
            const xRemaining = 3 - Math.min(xHistory.length, 3);
            const oRemaining = 3 - Math.min(oHistory.length, 3);
            
            // X 남은 수 - 점으로 표시
            for (let i = 0; i < xRemaining; i++) {
                const dotX = 50 + i * 25;
                const dotY = 570;
                // 작은 X 그리기
                for (let j = -5; j <= 5; j++) {
                    image.setPixelColor(this.colors.xColor, dotX + j, dotY + j);
                    image.setPixelColor(this.colors.xColor, dotX + j, dotY - j);
                }
            }
            
            // O 남은 수 - 점으로 표시
            for (let i = 0; i < oRemaining; i++) {
                const dotX = width - 125 + i * 25;
                const dotY = 570;
                // 작은 O 그리기
                for (let angle = 0; angle < 360; angle += 10) {
                    const rad = angle * Math.PI / 180;
                    const px = Math.round(dotX + 8 * Math.cos(rad));
                    const py = Math.round(dotY + 8 * Math.sin(rad));
                    image.setPixelColor(this.colors.oColor, px, py);
                }
            }
            
            // 버퍼로 변환
            const buffer = await image.getBuffer('image/png');
            
            // 캐시에 저장
            imageCache.set(cacheKey, buffer);
            
            console.log('[TicTacToe] 이미지 생성 성공');
            return new AttachmentBuilder(buffer, { name: 'tictactoe.png' });
            
        } catch (error) {
            console.error('[TicTacToe] Jimp 이미지 생성 오류:', error);
            console.error(error.stack);
            return null;
        }
    },
    
    // 게임 버튼 생성
    createGameButtons(gameId, currentTurn, board, isYourTurn = true) {
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
                        .setDisabled(isOccupied || !isYourTurn)
                );
            }
            rows.push(row);
        }
        
        // 포기 버튼
        const controlRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`tictactoe_forfeit_${gameId}`)
                    .setLabel('🏳️ 포기하기')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(!isYourTurn)
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
                    winner: game.botSettings?.reward || this.config.winReward,
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
                    winner: Math.floor((game.botSettings?.bet || 0) * 0.5), // 무승부시 배팅금액의 50% 반환
                    loser: Math.floor((game.botSettings?.bet || 0) * 0.5)
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
    
    // 텍스트 기반 보드 생성 (폴백)
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
        const playerSymbol = player.id === game.player1.id ? 'X' : 'O';
        const gameEmbed = new EmbedBuilder()
            .setColor(isYourTurn ? '#00ff00' : '#ff0000')
            .setTitle('🤖 봇 대전')
            .setDescription(`**당신은 ${playerSymbol === 'X' ? '❌' : '⭕'} ${playerSymbol} 플레이어입니다!**\n${isYourTurn ? '🟢 당신의 턴입니다!' : '🔴 상대의 턴입니다!'}`)
            .addFields(
                { name: '❌ X 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ O 플레이어', value: `${game.player2.username}`, inline: true },
                { name: '💰 배팅', value: `${settings.bet.toLocaleString()}G`, inline: true },
                { name: '🏆 승리 보상', value: `${settings.reward.toLocaleString()}G`, inline: true },
                { name: '🎯 현재 차례', value: `${firstPlayer.username} (${game.currentTurn})`, inline: true }
            );
        
        const boardImage = await this.createBoardImage(game.board, game.player1, game.player2, [], null, game.id);
        const buttons = this.createGameButtons(game.id, game.currentTurn, game.board, isYourTurn);
        
        // 보드 이미지 확인 및 처리
        let sentMessage;
        if (!boardImage) {
            // 이미지 생성 실패 시 텍스트로 표시
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
                const botMove = this.getBotMove(game.board, difficulty);
                const result = this.makeMove(game.id, botMove, 'bot');
                
                if (!result.gameOver) {
                    await this.updateGameMessage(sentMessage, game, true);
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
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        } else if (difficulty === 'medium') {
            if (Math.random() < 0.5) {
                return availableMoves[Math.floor(Math.random() * availableMoves.length)];
            }
        }
        
        // 미니맥스 알고리즘
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
    
    // 게임 메시지 업데이트
    async updateGameMessage(message, game, isYourTurn) {
        const currentPlayer = game.currentTurn === 'X' ? game.player1 : game.player2;
        
        const gameEmbed = new EmbedBuilder()
            .setColor(isYourTurn ? '#00ff00' : '#ff0000')
            .setTitle(game.isBotGame ? '🤖 봇 대전' : '👥 유저 대전')
            .setDescription(isYourTurn ? '🟢 당신의 턴입니다!' : '🔴 상대의 턴입니다!')
            .addFields(
                { name: '❌ X 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ O 플레이어', value: `${game.player2.username}`, inline: true },
                { name: '🎯 현재 차례', value: `${currentPlayer.username} (${game.currentTurn})`, inline: true }
            );
        
        const boardImage = await this.createBoardImage(
            game.board, 
            game.player1, 
            game.player2, 
            [], 
            game.lastMovePosition,
            game.id
        );
        
        const buttons = this.createGameButtons(game.id, game.currentTurn, game.board, isYourTurn);
        
        if (!boardImage) {
            gameEmbed.addFields({
                name: '🎮 게임 보드',
                value: this.createTextBoard(game.board)
            });
            await message.edit({
                embeds: [gameEmbed],
                components: buttons
            });
        } else {
            // 이미지는 setImage URL로 설정
            gameEmbed.setImage('attachment://tictactoe.png');
            await message.edit({
                embeds: [gameEmbed],
                files: [boardImage],
                components: buttons
            });
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
        await this.updateGameMessage(message, game, false);
        
        // 봇 이동
        setTimeout(async () => {
            const botMove = this.getBotMove(game.board, game.botDifficulty);
            const botResult = this.makeMove(gameId, botMove, 'bot');
            
            if (botResult.gameOver) {
                // 게임 종료 처리
                await this.handleGameEnd(message, game, botResult);
            } else {
                // 게임 계속
                await this.updateGameMessage(message, game, true);
            }
        }, 1500);
        
        return result;
    },
    
    // 게임 종료 처리
    async handleGameEnd(message, game, result) {
        let gameEndEmbed;
        
        if (result.isDraw) {
            gameEndEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🤝 무승부!')
                .setDescription('아무도 승리하지 못했습니다!')
                .addFields(
                    { name: '🏆 보상', value: `${this.config.drawReward.toLocaleString()}G`, inline: true }
                );
        } else {
            const winner = result.winner === game.player1.id ? game.player1 : game.player2;
            const loser = result.winner === game.player1.id ? game.player2 : game.player1;
            
            gameEndEmbed = new EmbedBuilder()
                .setColor(result.winner === 'bot' ? '#FF0000' : '#00FF00')
                .setTitle(result.winner === 'bot' ? '💔 패배!' : '🎉 승리!')
                .setDescription(`${winner.username}의 승리!`)
                .addFields(
                    { 
                        name: result.winner === 'bot' ? '💰 위로금' : '🏆 보상', 
                        value: `${(result.winner === 'bot' ? this.config.loseReward : game.botSettings?.reward || this.config.winReward).toLocaleString()}G`, 
                        inline: true 
                    }
                );
        }
        
        const finalBoardImage = await this.createBoardImage(
            game.board,
            game.player1,
            game.player2,
            result.winPattern || [],
            game.lastMovePosition,
            game.id
        );
        
        if (!finalBoardImage) {
            gameEndEmbed.addFields({
                name: '🎮 최종 보드',
                value: this.createTextBoard(game.board)
            });
            await message.edit({
                embeds: [gameEndEmbed],
                components: []
            });
        } else {
            // 빙고 라인이 표시된 이미지를 embed에 추가
            gameEndEmbed.setImage('attachment://tictactoe.png');
            
            await message.edit({
                embeds: [gameEndEmbed],
                files: [finalBoardImage],
                components: []
            });
        }
        
        this.endGame(game.id);
        
        // 3초 후 채널 삭제
        setTimeout(async () => {
            try {
                const channel = message.channel;
                if (channel && !channel.deleted) {
                    await channel.send('🎮 5초 후 채널이 삭제됩니다...');
                    setTimeout(async () => {
                        try {
                            // 채널이 여전히 존재하는지 확인
                            const channelStillExists = await channel.guild.channels.fetch(channel.id).catch(() => null);
                            if (channelStillExists && !channelStillExists.deleted) {
                                await channelStillExists.delete('틱택토 게임 종료');
                            }
                        } catch (err) {
                            // Unknown Channel 오류는 무시
                            if (err.code !== 10003) {
                                console.error('봇 게임 종료 채널 삭제 실패:', err);
                            }
                        }
                    }, 5000);
                }
            } catch (error) {
                console.error('게임 채널 삭제 실패:', error);
            }
        }, 2000);
    }
};

module.exports = TIC_TAC_TOE_GAME;