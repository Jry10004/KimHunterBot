const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const Jimp = require('jimp');
const axios = require('axios');

// 틱택토 게임 시스템 (Jimp 버전)
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
        const gameId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const firstTurn = Math.random() < 0.5 ? 'X' : 'O';
        
        // displayAvatarURL 사용하여 최신 아바타 URL 가져오기
        const gameData = {
            id: gameId,
            player1: {
                id: player1.id,
                username: player1.username,
                avatar: player1.displayAvatarURL({ format: 'png', size: 128, dynamic: true }),
                discriminator: player1.discriminator || '0',
                symbol: 'X'
            },
            player2: {
                id: player2.id,
                username: player2.username,
                avatar: player2.displayAvatarURL({ format: 'png', size: 128, dynamic: true }),
                discriminator: player2.discriminator || '0',
                symbol: 'O'
            },
            board: Array(9).fill(null),
            moveHistory: [], // 움직임 기록 추가 [{position: 0, symbol: 'X', turnNumber: 1}]
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
    
    // 게임 보드 이미지 생성 (Jimp)
    async createBoardImage(board, player1, player2, winPattern = [], lastMove = null) {
        // 450x450 크기의 보드 생성
        const boardImage = await Jimp.create(450, 450, '#2C2F33');
        
        // 격자선 그리기
        const lineColor = 0x4A4D52FF;
        
        // 세로선
        for (let x = 150; x < 450; x += 150) {
            for (let y = 0; y < 450; y++) {
                boardImage.setPixelColor(lineColor, x, y);
                boardImage.setPixelColor(lineColor, x + 1, y);
                boardImage.setPixelColor(lineColor, x + 2, y);
                boardImage.setPixelColor(lineColor, x + 3, y);
            }
        }
        
        // 가로선
        for (let y = 150; y < 450; y += 150) {
            for (let x = 0; x < 450; x++) {
                boardImage.setPixelColor(lineColor, x, y);
                boardImage.setPixelColor(lineColor, x, y + 1);
                boardImage.setPixelColor(lineColor, x, y + 2);
                boardImage.setPixelColor(lineColor, x, y + 3);
            }
        }
        
        // 프로필 사진 로드 및 배치
        for (let i = 0; i < 9; i++) {
            if (board[i]) {
                const x = (i % 3) * 150 + 10;
                const y = Math.floor(i / 3) * 150 + 10;
                
                try {
                    const player = board[i] === 'X' ? player1 : player2;
                    
                    // 아바타 URL 확인 및 수정
                    let avatarUrl = player.avatar;
                    console.log(`[TicTacToe] Player ${player.username} (${player.id}):`, {
                        avatar: player.avatar,
                        discriminator: player.discriminator,
                        symbol: board[i]
                    });
                    
                    // 아바타가 없거나 기본 아바타인 경우
                    if (!avatarUrl || avatarUrl.includes('embed/avatars')) {
                        // Discord ID를 기반으로 기본 아바타 번호 계산
                        let defaultNum;
                        if (player.discriminator && player.discriminator !== '0') {
                            // 구형 사용자명 시스템 (username#1234)
                            defaultNum = parseInt(player.discriminator) % 5;
                        } else {
                            // 신형 사용자명 시스템 또는 봇
                            const idNum = player.id === 'bot' ? 0 : parseInt(player.id.slice(-4));
                            defaultNum = idNum % 6;
                        }
                        avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultNum}.png`;
                        console.log(`[TicTacToe] Using default avatar ${defaultNum}:`, avatarUrl);
                    }
                    
                    // URL이 전체 경로가 아닌 경우 처리
                    if (avatarUrl && !avatarUrl.startsWith('http')) {
                        avatarUrl = `https://cdn.discordapp.com${avatarUrl}`;
                    }
                    
                    // 더 강력한 캐시 방지
                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substring(7);
                    const urlWithTimestamp = avatarUrl + (avatarUrl.includes('?') ? '&' : '?') + `v=${timestamp}&r=${random}`;
                    
                    // 프로필 이미지 다운로드
                    const response = await axios.get(urlWithTimestamp, { 
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Cache-Control': 'no-cache'
                        }
                    });
                    const profileImage = await Jimp.read(Buffer.from(response.data));
                    
                    // 이미지 크기 조정 및 원형으로 만들기
                    profileImage.resize(130, 130);
                    
                    // 원형 마스크 생성
                    const mask = await Jimp.create(130, 130, 0x00000000);
                    const centerX = 65;
                    const centerY = 65;
                    const radius = 65;
                    
                    // 원 그리기
                    for (let px = 0; px < 130; px++) {
                        for (let py = 0; py < 130; py++) {
                            const distance = Math.sqrt((px - centerX) ** 2 + (py - centerY) ** 2);
                            if (distance <= radius) {
                                mask.setPixelColor(0xFFFFFFFF, px, py);
                            }
                        }
                    }
                    
                    // 마스크 적용
                    profileImage.mask(mask, 0, 0);
                    
                    // 보드에 프로필 이미지 배치
                    boardImage.composite(profileImage, x, y);
                    
                    // 방금 놓은 말이면 특별한 효과
                    if (lastMove === i) {
                        // 네온 효과를 위한 여러 겹의 테두리
                        const colors = [
                            { color: 0x00FF00FF, thickness: 8 },  // 밝은 초록
                            { color: 0x00CC00CC, thickness: 6 },  // 중간 초록
                            { color: 0x00990099, thickness: 4 },  // 어두운 초록
                        ];
                        
                        for (const {color, thickness} of colors) {
                            for (let angle = 0; angle < 360; angle++) {
                                const rad = angle * Math.PI / 180;
                                for (let r = radius; r < radius + thickness; r++) {
                                    const px = Math.round(x + centerX + r * Math.cos(rad));
                                    const py = Math.round(y + centerY + r * Math.sin(rad));
                                    if (px >= 0 && px < 450 && py >= 0 && py < 450) {
                                        boardImage.setPixelColor(color, px, py);
                                    }
                                }
                            }
                        }
                        
                        // NEW! 표시
                        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
                        const newBadge = new Jimp(50, 20, 0xFF0000FF);
                        newBadge.print(font, 5, 2, 'NEW!');
                        boardImage.composite(newBadge, x + 80, y - 10);
                    }
                    
                    // 승리 패턴이면 황금색 테두리
                    else if (winPattern.includes(i)) {
                        const goldColor = 0xFFD700FF;
                        // 원형 테두리 그리기
                        for (let angle = 0; angle < 360; angle++) {
                            const rad = angle * Math.PI / 180;
                            for (let r = radius; r < radius + 5; r++) {
                                const px = Math.round(x + centerX + r * Math.cos(rad));
                                const py = Math.round(y + centerY + r * Math.sin(rad));
                                if (px >= 0 && px < 450 && py >= 0 && py < 450) {
                                    boardImage.setPixelColor(goldColor, px, py);
                                }
                            }
                        }
                    }
                    
                    // 플레이어 이름 추가
                    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
                    const nameText = player.username.substring(0, 10);
                    const textWidth = Jimp.measureText(font, nameText);
                    boardImage.print(font, x + 65 - textWidth / 2, y + 135, nameText);
                    
                } catch (error) {
                    const player = board[i] === 'X' ? player1 : player2;
                    console.error('프로필 이미지 로드 실패:', player.username, player.avatar, error.message);
                    
                    // 프로필 로드 실패시 기본 X/O 표시
                    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
                    const symbol = board[i];
                    const color = symbol === 'X' ? 0xFF6B6BFF : 0x4ECDC4FF;
                    
                    // 배경색 설정
                    for (let px = x; px < x + 130; px++) {
                        for (let py = y; py < y + 130; py++) {
                            boardImage.setPixelColor(color, px, py);
                        }
                    }
                    
                    boardImage.print(font, x + 45, y + 35, symbol);
                    
                    // 플레이어 이름도 표시
                    const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
                    const nameText = player.username.substring(0, 10);
                    const textWidth = Jimp.measureText(smallFont, nameText);
                    boardImage.print(smallFont, x + 65 - textWidth / 2, y + 135, nameText);
                }
            }
        }
        
        // 버퍼로 변환
        const buffer = await boardImage.getBufferAsync(Jimp.MIME_PNG);
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
                    button.setLabel(`${index + 1}`);
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
        if (!game) return { success: false, error: '게임을 찾을 수 없습니다.', reason: '게임을 찾을 수 없습니다.' };
        
        // 차례 확인
        const playerSymbol = game.player1.id === playerId ? 'X' : 'O';
        if (game.currentTurn !== playerSymbol) {
            return { success: false, error: '당신의 차례가 아닙니다!', reason: '당신의 차례가 아닙니다!' };
        }
        
        // 이미 놓여진 곳인지 확인
        if (game.board[position] !== null) {
            return { success: false, error: '이미 선택된 위치입니다!', reason: '이미 선택된 위치입니다!' };
        }
        
        // 움직임 적용
        game.board[position] = playerSymbol;
        game.lastMoveTime = Date.now();
        game.lastMovePosition = position;
        
        // 움직임 기록
        const turnNumber = game.moveHistory.length + 1;
        game.moveHistory.push({
            position: position,
            symbol: playerSymbol,
            turnNumber: turnNumber
        });
        
        // 먼저 승리 확인
        const winPattern = this.checkWin(game.board, playerSymbol);
        if (winPattern) {
            game.winner = playerSymbol;
            game.winPattern = winPattern;
            const winnerId = playerSymbol === 'X' ? game.player1.id : game.player2.id;
            const loserId = playerSymbol === 'X' ? game.player2.id : game.player1.id;
            return { 
                success: true, 
                gameOver: true, 
                winner: winnerId,
                loser: loserId,
                winPattern,
                rewards: {
                    winner: this.config.winReward,
                    loser: this.config.loseReward
                }
            };
        }
        
        // 승리하지 않았다면, 7턴째부터 가장 오래된 말 제거
        if (turnNumber >= 7) {
            // 현재 플레이어의 가장 오래된 말 찾기
            const oldestMove = game.moveHistory.find(move => move.symbol === playerSymbol);
            if (oldestMove) {
                // 보드에서 제거
                game.board[oldestMove.position] = null;
                // 기록에서도 제거
                game.moveHistory = game.moveHistory.filter(move => move !== oldestMove);
            }
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
    
    // 유저 ID로 게임 찾기
    findGameByUserId(userId) {
        for (const [gameId, game] of this.activeGames.entries()) {
            if (game.player1.id === userId || game.player2.id === userId) {
                return game;
            }
        }
        return null;
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
    
    // 봇과의 게임 생성
    async createBotGame(player, channel) {
        const botUser = {
            id: 'bot',
            username: '김헌터 AI',
            avatar: null,
            discriminator: '0000',
            displayAvatarURL: (options) => 'https://cdn.discordapp.com/embed/avatars/0.png'
        };
        
        // 게임 생성
        const game = this.createGame(player, botUser, channel);
        
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
        
        // 봇 움직임 계산
        const botMove = this.getBotMove(game.board, 'O');
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
                    
                    embed = new EmbedBuilder()
                        .setColor(result.winner === 'X' ? '#00FF00' : '#FF0000')
                        .setTitle(`🎉 ${winner.username}님의 승리!`)
                        .setDescription(`${loser.username}님이 패배했습니다.`)
                        .addFields(
                            { name: '🏆 승자 보상', value: `${this.config.winReward.toLocaleString()}G`, inline: true },
                            { name: '💔 패자 보상', value: `${this.config.loseReward.toLocaleString()}G`, inline: true }
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
            
            const boardImage = await this.createBoardImage(game.board, game.player1, game.player2, result.winPattern || [], game.lastMovePosition);
            const buttons = result.gameOver ? [] : this.createGameButtons(gameId, game.currentTurn, game.board);
            
            // 봇이 둔 수에도 이펙트 추가
            if (!result.gameOver) {
                const botEffects = [
                    '🤖 **띵!** AI의 계산된 수!',
                    '🧠 **팅!** AI의 전략적인 수!',
                    '💻 **딩!** AI의 완벽한 수!',
                    '🎯 **핑!** AI의 정확한 수!'
                ];
                const randomBotEffect = botEffects[Math.floor(Math.random() * botEffects.length)];
                
                await message.edit({
                    content: randomBotEffect,
                    embeds: [embed],
                    files: [boardImage],
                    components: buttons
                });
                
                // 2초 후 이펙트 제거
                setTimeout(async () => {
                    try {
                        await message.edit({
                            content: null,
                            embeds: [embed],
                            files: [boardImage],
                            components: buttons
                        });
                    } catch (error) {
                        // 에러 무시
                    }
                }, 2000);
            } else {
                await message.edit({
                    embeds: [embed],
                    files: [boardImage],
                    components: buttons
                });
            }
        }
    },
    
    // 게임 버튼 핸들러에서 봇 차례 처리
    async handleMove(gameId, position, playerId, message) {
        const result = this.makeMove(gameId, position, playerId);
        
        if (result.success && !result.gameOver && this.activeGames.get(gameId)) {
            const game = this.activeGames.get(gameId);
            // 봇 차례인 경우
            if (game.currentTurn === 'O' && game.player2.id === 'bot') {
                setTimeout(async () => {
                    await this.makeBotMove(gameId, message);
                }, 1500);
            }
        }
        
        return result;
    }
};

module.exports = TIC_TAC_TOE_GAME;