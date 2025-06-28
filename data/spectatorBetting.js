// 🎰 관전자 베팅 시스템
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

class SpectatorBettingSystem {
    constructor() {
        // 게임별 베팅 풀
        this.bettingPools = new Map(); // gameId -> { bets: Map(userId -> betData), totalPot: number, status: string }
        
        // 베팅 설정
        this.settings = {
            minBet: 100,
            maxBet: 1000000, // 100만 골드로 증가
            betMultiplier: 2.5, // 승리 시 배당률
            houseCut: 0.1, // 하우스 수수료 10%
            betTimeout: 10000, // 10초 베팅 제한
            refundTimeout: 300000 // 5분 후 자동 환불
        };
        
        // 베팅 타입
        this.betTypes = {
            chosung: {
                winner: '승자 맞추기',
                firstSolver: '첫 정답자',
                perfectGame: '퍼펙트 게임 (한 명이 모두 맞춤)',
                rounds: '라운드 수 예측'
            },
            wordchain: {
                winner: '승자 맞추기',
                longestWord: '가장 긴 단어 사용자',
                totalWords: '총 단어 수 (오버/언더)',
                duration: '게임 지속 시간 (오버/언더)'
            },
            pvp: {
                winner: '승자 맞추기',
                firstBlood: '선제공격 성공자',
                perfectWin: '퍼펙트 승리 (체력 80% 이상)',
                rounds: '라운드 수 예측',
                totalDamage: '총 데미지 (오버/언더)'
            }
        };
    }
    
    // 새 베팅 풀 생성
    createBettingPool(gameId, gameType, players) {
        const pool = {
            gameId,
            gameType,
            players: Array.from(players),
            bets: new Map(),
            totalPot: 0,
            status: 'open', // open, closed, resolved, cancelled
            createdAt: Date.now(),
            betOptions: this.generateBetOptions(gameType, players)
        };
        
        this.bettingPools.set(gameId, pool);
        
        // 자동 환불 타이머
        setTimeout(() => {
            if (this.bettingPools.has(gameId) && this.bettingPools.get(gameId).status === 'open') {
                this.cancelPool(gameId);
            }
        }, this.settings.refundTimeout);
        
        return pool;
    }
    
    // 베팅 옵션 생성
    generateBetOptions(gameType, players) {
        const options = [];
        
        if (gameType === 'chosung') {
            // 승자 베팅
            players.forEach(player => {
                options.push({
                    id: `winner_${player.id}`,
                    type: 'winner',
                    label: `${player.username} 승리`,
                    odds: this.calculateOdds(players.length)
                });
            });
            
            // 퍼펙트 게임 베팅
            options.push({
                id: 'perfect_yes',
                type: 'perfect',
                label: '퍼펙트 게임 발생',
                odds: 5.0
            });
            
            // 라운드 수 베팅
            options.push(
                { id: 'rounds_under_5', type: 'rounds', label: '5라운드 이하', odds: 2.0 },
                { id: 'rounds_5_10', type: 'rounds', label: '5-10라운드', odds: 1.5 },
                { id: 'rounds_over_10', type: 'rounds', label: '10라운드 초과', odds: 3.0 }
            );
        } else if (gameType === 'wordchain') {
            // 승자 베팅
            players.forEach(player => {
                options.push({
                    id: `winner_${player.id}`,
                    type: 'winner',
                    label: `${player.username} 승리`,
                    odds: this.calculateOdds(players.length)
                });
            });
            
            // 총 단어 수 베팅
            options.push(
                { id: 'words_under_20', type: 'totalWords', label: '총 20단어 이하', odds: 2.0 },
                { id: 'words_over_20', type: 'totalWords', label: '총 20단어 초과', odds: 1.8 }
            );
            
            // 게임 시간 베팅
            options.push(
                { id: 'duration_under_3', type: 'duration', label: '3분 이내 종료', odds: 2.5 },
                { id: 'duration_over_3', type: 'duration', label: '3분 이상', odds: 1.5 }
            );
        } else if (gameType === 'pvp') {
            // PVP 승자 베팅만 (간소화)
            players.forEach(player => {
                options.push({
                    id: `winner_${player.id}`,
                    type: 'winner',
                    label: `${player.username} 승리`,
                    odds: this.calculatePvpOdds(player.rating, players)
                });
            });
        }
        
        return options;
    }
    
    // 배당률 계산
    calculateOdds(playerCount) {
        // 기본 배당률은 참가자 수에 따라
        const baseOdds = playerCount * 0.9; // 하우스 엣지 10%
        return Math.round(baseOdds * 10) / 10;
    }
    
    // PVP 배당률 계산 (레이팅 기반)
    calculatePvpOdds(playerRating, allPlayers) {
        const otherPlayer = allPlayers.find(p => p.rating !== playerRating);
        if (!otherPlayer) return 2.0;
        
        // ELO 기반 승률 계산
        const expectedWinRate = 1 / (1 + Math.pow(10, (otherPlayer.rating - playerRating) / 400));
        
        // 배당률 = 1 / 승률 * 0.9 (하우스 엣지)
        const odds = (1 / expectedWinRate) * 0.9;
        
        // 최소 1.1배, 최대 5.0배
        return Math.round(Math.max(1.1, Math.min(5.0, odds)) * 10) / 10;
    }
    
    // 베팅하기
    placeBet(gameId, userId, optionId, amount) {
        const pool = this.bettingPools.get(gameId);
        if (!pool) return { success: false, error: '베팅 풀을 찾을 수 없습니다.' };
        
        if (pool.status !== 'open') {
            return { success: false, error: '베팅이 마감되었습니다.' };
        }
        
        if (pool.players.find(p => p.id === userId)) {
            return { success: false, error: '게임 참가자는 베팅할 수 없습니다.' };
        }
        
        if (amount < this.settings.minBet || amount > this.settings.maxBet) {
            return { success: false, error: `베팅 금액은 ${this.settings.minBet}~${this.settings.maxBet} 골드여야 합니다.` };
        }
        
        const option = pool.betOptions.find(opt => opt.id === optionId);
        if (!option) {
            return { success: false, error: '잘못된 베팅 옵션입니다.' };
        }
        
        // 기존 베팅 확인
        if (pool.bets.has(userId)) {
            return { success: false, error: '이미 베팅하셨습니다.' };
        }
        
        // 베팅 추가
        pool.bets.set(userId, {
            userId,
            optionId,
            option,
            amount,
            potentialWin: Math.floor(amount * option.odds),
            timestamp: Date.now()
        });
        
        pool.totalPot += amount;
        
        return { success: true, bet: pool.bets.get(userId), totalPot: pool.totalPot };
    }
    
    // 베팅 마감
    closeBetting(gameId) {
        const pool = this.bettingPools.get(gameId);
        if (!pool) return false;
        
        pool.status = 'closed';
        return true;
    }
    
    // 게임 결과 처리
    async resolvePool(gameId, results) {
        const pool = this.bettingPools.get(gameId);
        if (!pool || pool.status !== 'closed') return null;
        
        const winners = [];
        const payouts = new Map();
        
        // 각 베팅 확인
        for (const [userId, bet] of pool.bets) {
            let won = false;
            
            switch (bet.option.type) {
                case 'winner':
                    if (results.winner && bet.optionId === `winner_${results.winner.id}`) {
                        won = true;
                    }
                    break;
                    
                case 'perfect':
                    if (bet.optionId === 'perfect_yes' && results.perfectGame) {
                        won = true;
                    }
                    break;
                    
                case 'rounds':
                    const rounds = results.totalRounds;
                    if ((bet.optionId === 'rounds_under_5' && rounds <= 5) ||
                        (bet.optionId === 'rounds_5_10' && rounds > 5 && rounds <= 10) ||
                        (bet.optionId === 'rounds_over_10' && rounds > 10)) {
                        won = true;
                    }
                    break;
                    
                case 'totalWords':
                    const words = results.totalWords;
                    if ((bet.optionId === 'words_under_20' && words <= 20) ||
                        (bet.optionId === 'words_over_20' && words > 20)) {
                        won = true;
                    }
                    break;
                    
                case 'duration':
                    const durationMinutes = results.duration / 60000;
                    if ((bet.optionId === 'duration_under_3' && durationMinutes < 3) ||
                        (bet.optionId === 'duration_over_3' && durationMinutes >= 3)) {
                        won = true;
                    }
                    break;
            }
            
            if (won) {
                const payout = Math.floor(bet.amount * bet.option.odds * (1 - this.settings.houseCut));
                winners.push({ userId, bet, payout });
                payouts.set(userId, payout);
            }
        }
        
        pool.status = 'resolved';
        pool.results = results;
        pool.winners = winners;
        pool.payouts = payouts;
        
        return {
            pool,
            winners,
            totalPot: pool.totalPot,
            houseCut: Math.floor(pool.totalPot * this.settings.houseCut)
        };
    }
    
    // 베팅 취소 및 환불
    cancelPool(gameId) {
        const pool = this.bettingPools.get(gameId);
        if (!pool) return null;
        
        const refunds = new Map();
        
        // 모든 베팅 환불
        for (const [userId, bet] of pool.bets) {
            refunds.set(userId, bet.amount);
        }
        
        pool.status = 'cancelled';
        pool.refunds = refunds;
        
        return refunds;
    }
    
    // 베팅 UI 생성
    createBettingEmbed(pool) {
        const gameTypeNames = {
            chosung: '초성게임',
            wordchain: '끝말잇기',
            pvp: 'PVP 대전'
        };
        
        const embed = new EmbedBuilder()
            .setTitle(`🎰 관전자 베팅 - ${gameTypeNames[pool.gameType] || pool.gameType}`)
            .setColor(pool.status === 'open' ? '#00ff00' : '#ff0000')
            .setDescription(`💰 현재 팟: **${pool.totalPot.toLocaleString()}** 골드\n👥 베팅 참여자: **${pool.bets.size}**명`)
            .setTimestamp();
        
        // 베팅 옵션 표시
        if (pool.status === 'open') {
            const optionGroups = {};
            pool.betOptions.forEach(opt => {
                if (!optionGroups[opt.type]) optionGroups[opt.type] = [];
                optionGroups[opt.type].push(opt);
            });
            
            for (const [type, options] of Object.entries(optionGroups)) {
                const typeNames = {
                    winner: '🏆 승자 예측',
                    perfect: '💯 퍼펙트 게임',
                    rounds: '🔢 라운드 수',
                    totalWords: '📝 총 단어 수',
                    duration: '⏱️ 게임 시간'
                };
                
                const optionText = options.map(opt => 
                    `${opt.label} (배당 x${opt.odds})`
                ).join('\n');
                
                embed.addFields({
                    name: typeNames[type] || type,
                    value: optionText,
                    inline: true
                });
            }
        } else if (pool.status === 'closed') {
            embed.addFields({
                name: '🔒 베팅 마감',
                value: '게임이 진행 중입니다. 결과를 기다려주세요!',
                inline: false
            });
        }
        
        return embed;
    }
    
    // 베팅 버튼 생성
    createBettingButtons(gameId) {
        const pool = this.bettingPools.get(gameId);
        if (!pool || pool.status !== 'open') return [];
        
        const rows = [];
        
        // 베팅 금액 선택 버튼 (PVP는 승자만 선택하므로 금액 버튼만 표시)
        const amountRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`betting_${gameId}_10000`)
                .setLabel('1만')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💰'),
            new ButtonBuilder()
                .setCustomId(`betting_${gameId}_50000`)
                .setLabel('5만')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💎'),
            new ButtonBuilder()
                .setCustomId(`betting_${gameId}_100000`)
                .setLabel('10만')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💎'),
            new ButtonBuilder()
                .setCustomId(`betting_${gameId}_500000`)
                .setLabel('50만')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔥'),
            new ButtonBuilder()
                .setCustomId(`betting_${gameId}_1000000`)
                .setLabel('100만')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('👑')
        );
        
        rows.push(amountRow);
        
        // PVP의 경우 승자 선택 버튼 추가
        if (pool.gameType === 'pvp') {
            const winnerRow = new ActionRowBuilder();
            pool.betOptions.forEach(opt => {
                winnerRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`betting_winner_${gameId}_${opt.id}`)
                        .setLabel(`${opt.label} (x${opt.odds})`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🏆')
                );
            });
            rows.push(winnerRow);
        } else {
            // 다른 게임은 기존 메뉴 사용
            const optionMenu = new StringSelectMenuBuilder()
                .setCustomId(`betting_option_${gameId}`)
                .setPlaceholder('베팅 옵션을 선택하세요')
                .setMinValues(1)
                .setMaxValues(1);
            
            pool.betOptions.forEach(opt => {
                optionMenu.addOptions({
                    label: opt.label,
                    description: `배당률 x${opt.odds}`,
                    value: opt.id,
                    emoji: this.getOptionEmoji(opt.type)
                });
            });
            
            rows.push(new ActionRowBuilder().addComponents(optionMenu));
        }
        
        return rows;
    }
    
    // 옵션별 이모지
    getOptionEmoji(type) {
        const emojis = {
            winner: '🏆',
            perfect: '💯',
            rounds: '🔢',
            totalWords: '📝',
            duration: '⏱️'
        };
        return emojis[type] || '🎲';
    }
    
    // 결과 발표 임베드
    createResultEmbed(gameId) {
        const pool = this.bettingPools.get(gameId);
        if (!pool || pool.status !== 'resolved') return null;
        
        const embed = new EmbedBuilder()
            .setTitle('🎊 베팅 결과 발표!')
            .setColor('#ffd700')
            .setTimestamp();
        
        // 게임 결과
        let resultText = '';
        if (pool.results.winner) {
            resultText += `🏆 승자: **${pool.results.winner.username}**\n`;
        }
        if (pool.results.totalRounds !== undefined) {
            resultText += `🔢 총 라운드: **${pool.results.totalRounds}**\n`;
        }
        if (pool.results.totalWords !== undefined) {
            resultText += `📝 총 단어 수: **${pool.results.totalWords}**\n`;
        }
        if (pool.results.duration !== undefined) {
            const minutes = Math.floor(pool.results.duration / 60000);
            const seconds = Math.floor((pool.results.duration % 60000) / 1000);
            resultText += `⏱️ 게임 시간: **${minutes}분 ${seconds}초**\n`;
        }
        
        embed.addFields({
            name: '📊 게임 결과',
            value: resultText || '결과 없음',
            inline: false
        });
        
        // 당첨자 정보
        if (pool.winners.length > 0) {
            const winnerText = pool.winners.slice(0, 10).map(w => 
                `<@${w.userId}> - ${w.payout.toLocaleString()} 골드`
            ).join('\n');
            
            embed.addFields({
                name: `🎉 당첨자 (${pool.winners.length}명)`,
                value: winnerText,
                inline: false
            });
        } else {
            embed.addFields({
                name: '😢 당첨자 없음',
                value: '아무도 맞추지 못했습니다.',
                inline: false
            });
        }
        
        // 통계
        embed.addFields({
            name: '💰 베팅 통계',
            value: `총 베팅 금액: ${pool.totalPot.toLocaleString()} 골드\n` +
                   `참여자 수: ${pool.bets.size}명\n` +
                   `하우스 수수료: ${Math.floor(pool.totalPot * this.settings.houseCut).toLocaleString()} 골드`,
            inline: false
        });
        
        return embed;
    }
    
    // 개인 베팅 정보 조회
    getUserBet(gameId, userId) {
        const pool = this.bettingPools.get(gameId);
        if (!pool) return null;
        
        return pool.bets.get(userId);
    }
    
    // 활성 베팅 풀 조회
    getActivePools() {
        const active = [];
        for (const [gameId, pool] of this.bettingPools) {
            if (pool.status === 'open' || pool.status === 'closed') {
                active.push(pool);
            }
        }
        return active;
    }
}

// 싱글톤 인스턴스
const spectatorBetting = new SpectatorBettingSystem();

module.exports = spectatorBetting;