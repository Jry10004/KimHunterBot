const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { Canvas, loadImage } = require('skia-canvas');
const path = require('path');

// 틱택토 게임 시스템
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
    
    // 게임 보드 이미지 생성
    async createBoardImage(board, player1, player2, winPattern = []) {
        const canvas = new Canvas(450, 450);
        const ctx = canvas.getContext('2d');
        
        // 배경 그라디언트
        const gradient = ctx.createLinearGradient(0, 0, 450, 450);
        gradient.addColorStop(0, '#2C2F33');
        gradient.addColorStop(1, '#23272A');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 450, 450);
        
        // 격자 그리기
        ctx.strokeStyle = '#4A4D52';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 5;
        
        // 세로선
        ctx.beginPath();
        ctx.moveTo(150, 0);
        ctx.lineTo(150, 450);
        ctx.moveTo(300, 0);
        ctx.lineTo(300, 450);
        ctx.stroke();
        
        // 가로선
        ctx.beginPath();
        ctx.moveTo(0, 150);
        ctx.lineTo(450, 150);
        ctx.moveTo(0, 300);
        ctx.lineTo(450, 300);
        ctx.stroke();
        
        // 프로필 사진 로드 및 그리기
        for (let i = 0; i < 9; i++) {
            if (board[i]) {
                const x = (i % 3) * 150 + 10;
                const y = Math.floor(i / 3) * 150 + 10;
                
                try {
                    const player = board[i] === 'X' ? player1 : player2;
                    const avatarURL = player.avatar || player.displayAvatarURL({ format: 'png', size: 128 });
                    const avatar = await loadImage(avatarURL);
                    
                    // 원형 마스크 적용
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x + 65, y + 65, 55, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    
                    // 프로필 이미지 그리기
                    ctx.drawImage(avatar, x, y, 130, 130);
                    ctx.restore();
                    
                    // 승리 패턴이면 황금색 테두리
                    if (winPattern.includes(i)) {
                        ctx.strokeStyle = '#FFD700';
                        ctx.lineWidth = 5;
                        ctx.shadowColor = '#FFD700';
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        ctx.arc(x + 65, y + 65, 60, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }
                    
                    // 플레이어 이름 표시
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = board[i] === 'X' ? '#FF6B6B' : '#4ECDC4';
                    ctx.fillText(player.username.substring(0, 10), x + 65, y + 140);
                    
                } catch (error) {
                    // 프로필 로드 실패시 기본 표시
                    if (board[i] === 'X') {
                        ctx.strokeStyle = '#FF6B6B';
                        ctx.lineWidth = 8;
                        ctx.beginPath();
                        ctx.moveTo(x + 30, y + 30);
                        ctx.lineTo(x + 100, y + 100);
                        ctx.moveTo(x + 100, y + 30);
                        ctx.lineTo(x + 30, y + 100);
                        ctx.stroke();
                    } else {
                        ctx.strokeStyle = '#4ECDC4';
                        ctx.lineWidth = 8;
                        ctx.beginPath();
                        ctx.arc(x + 65, y + 65, 40, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }
        }
        
        // 버퍼로 변환
        const buffer = await canvas.toBuffer('png');
        const attachment = new AttachmentBuilder(buffer, { name: 'tictactoe.png' });
        
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
                if (board[index] === null) {
                    button.setLabel(' ');
                } else {
                    button.setLabel(board[index]);
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
    getBotMove(board, botSymbol) {
        const opponentSymbol = botSymbol === 'X' ? 'O' : 'X';
        
        // 난이도에 따라 랜덤 움직임 선택
        if (Math.random() > this.config.botDifficulty) {
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
    }
};

module.exports = TIC_TAC_TOE_GAME;