const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const axios = require('axios');

// 이미지 캐시 (간단한 메모리 캐시)
const imageCache = new Map();

// Cloudinary URL2PNG를 사용한 틱택토 게임 시스템
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
    
    // Cloudinary URL2PNG를 사용한 게임 보드 이미지 생성
    async createBoardImage(board, player1, player2, winPattern = [], lastMovePosition = null) {
        try {
            // SVG로 게임판 생성
            const svg = this.createSVGBoard(board, player1, player2, winPattern, lastMovePosition);
            
            // Cloudinary를 사용해 SVG를 PNG로 변환
            const cloudinary = require('cloudinary').v2;
            
            // Cloudinary 설정 (환경변수 사용)
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET
            });
            
            // SVG를 base64로 인코딩
            const svgBase64 = Buffer.from(svg).toString('base64');
            const svgDataUri = `data:image/svg+xml;base64,${svgBase64}`;
            
            // Cloudinary Upload API를 사용하여 SVG를 PNG로 변환
            const uploadResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload(svgDataUri, {
                    format: 'png',
                    width: 800,
                    height: 900,
                    quality: 'auto',
                    folder: 'tictactoe',
                    resource_type: 'image',
                    invalidate: true
                }, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });
            
            // 업로드된 이미지 다운로드
            const response = await axios.get(uploadResult.secure_url, {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            
            // Cloudinary에서 임시 이미지 삭제 (선택사항)
            setTimeout(() => {
                cloudinary.uploader.destroy(uploadResult.public_id).catch(() => {});
            }, 60000); // 1분 후 삭제
            
            const buffer = Buffer.from(response.data);
            return new AttachmentBuilder(buffer, { name: 'tictactoe.png' });
            
        } catch (error) {
            console.error('Cloudinary 이미지 생성 오류:', error);
            
            // 폴백: SVG 직접 사용
            const svg = this.createSVGBoard(board, player1, player2, winPattern, lastMovePosition);
            const buffer = Buffer.from(svg);
            return new AttachmentBuilder(buffer, { name: 'tictactoe.svg' });
        }
    },
    
    // SVG 보드 생성
    createSVGBoard(board, player1, player2, winPattern = [], lastMovePosition = null) {
        const xCount = board.filter(cell => cell === 'X').length;
        const oCount = board.filter(cell => cell === 'O').length;
        const isXActive = xCount <= oCount;
        
        let svg = `<svg width="800" height="900" xmlns="http://www.w3.org/2000/svg">
            <!-- 배경 -->
            <rect width="800" height="900" fill="white"/>
            
            <!-- 타이틀 -->
            <text x="400" y="60" font-family="Arial" font-size="48" font-weight="bold" text-anchor="middle" fill="#333">TIC TAC TOE</text>
            
            <!-- 플레이어 정보 -->
            <g transform="translate(0, 100)">
                <!-- Player 1 -->
                <rect x="50" y="0" width="250" height="80" rx="20" fill="${isXActive ? '#e3f2fd' : '#f5f5f5'}" stroke="${isXActive ? '#2196f3' : 'transparent'}" stroke-width="4"/>
                <text x="175" y="35" font-family="Arial" font-size="20" font-weight="600" text-anchor="middle" fill="#333">${player1.username.substring(0, 15)}</text>
                <text x="175" y="65" font-family="Arial" font-size="32" text-anchor="middle">❌</text>
                
                <!-- VS -->
                <text x="400" y="50" font-family="Arial" font-size="32" font-weight="bold" text-anchor="middle" fill="#666">VS</text>
                
                <!-- Player 2 -->
                <rect x="500" y="0" width="250" height="80" rx="20" fill="${!isXActive ? '#e3f2fd' : '#f5f5f5'}" stroke="${!isXActive ? '#2196f3' : 'transparent'}" stroke-width="4"/>
                <text x="625" y="35" font-family="Arial" font-size="20" font-weight="600" text-anchor="middle" fill="#333">${player2.username.substring(0, 15)}</text>
                <text x="625" y="65" font-family="Arial" font-size="32" text-anchor="middle">⭕</text>
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
                svg += `<text x="${x + 100}" y="${y + 140}" font-family="Arial" font-size="120" text-anchor="middle" fill="#e74c3c">❌</text>`;
            } else if (board[i] === 'O') {
                svg += `<text x="${x + 100}" y="${y + 140}" font-family="Arial" font-size="120" text-anchor="middle" fill="#3498db">⭕</text>`;
            }
        }
        
        svg += '</svg>';
        return svg;
    },
    
    // 게임 버튼 생성
    createGameButtons(gameId, currentTurn, board) {
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 3; j++) {
                const position = i * 3 + j;
                const isOccupied = board[position] !== null;
                
                const label = board[position] === 'X' ? '❌' : board[position] === 'O' ? '⭕' : '⬜';
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
        
        await channel.send({
            embeds: [gameEmbed],
            files: [boardImage],
            components: buttons
        });
        
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
                        await lastMessage.edit({
                            embeds: [updatedEmbed],
                            files: [updatedImage],
                            components: updatedButtons
                        });
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
        
        await message.edit({
            embeds: [playerMoveEmbed],
            files: [playerMoveImage],
            components: disabledButtons
        });
        
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
                
                await message.edit({
                    embeds: [gameEndEmbed],
                    files: [finalBoardImage],
                    components: []
                });
                
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
                
                await message.edit({
                    embeds: [updatedEmbed],
                    files: [updatedImage],
                    components: updatedButtons
                });
            }
        }, 1500);
        
        return result;
    }
};

module.exports = TIC_TAC_TOE_GAME;