// 🍄 독버섯 게임 향상된 멀티플레이 기능
const MUSHROOM_GAME = require('./mushroomGame');

// 특수 아이템 시스템
class MushroomItemSystem {
    constructor() {
        this.playerItems = new Map(); // playerId -> [items]
    }

    // 아이템 획득
    grantRandomItem(playerId) {
        const items = Object.keys(MUSHROOM_GAME.specialItems);
        const randomItem = items[Math.floor(Math.random() * items.length)];
        
        if (!this.playerItems.has(playerId)) {
            this.playerItems.set(playerId, []);
        }
        
        this.playerItems.get(playerId).push(randomItem);
        return MUSHROOM_GAME.specialItems[randomItem];
    }

    // 아이템 사용
    useItem(playerId, itemType, targetId = null) {
        const items = this.playerItems.get(playerId);
        if (!items || !items.includes(itemType)) {
            return { success: false, message: '아이템이 없습니다.' };
        }

        const item = MUSHROOM_GAME.specialItems[itemType];
        const itemIndex = items.indexOf(itemType);
        items.splice(itemIndex, 1);

        return {
            success: true,
            item: item,
            target: targetId
        };
    }

    // 플레이어 아이템 목록
    getPlayerItems(playerId) {
        return this.playerItems.get(playerId) || [];
    }

    // 세션 정리
    clearSession(lobbyId) {
        // 해당 로비의 모든 플레이어 아이템 제거
        this.playerItems.clear();
    }
}

// 이모티콘 반응 시스템
class ReactionSystem {
    constructor() {
        this.reactions = new Map(); // playerId -> reaction
        this.reactionHistory = new Map(); // lobbyId -> [reactions]
    }

    // 반응 추가
    addReaction(lobbyId, playerId, reactionType) {
        const reactions = MUSHROOM_GAME.reactions[reactionType];
        if (!reactions) return null;

        const reaction = reactions[Math.floor(Math.random() * reactions.length)];
        
        if (!this.reactionHistory.has(lobbyId)) {
            this.reactionHistory.set(lobbyId, []);
        }

        this.reactionHistory.get(lobbyId).push({
            playerId,
            reaction,
            timestamp: Date.now()
        });

        return reaction;
    }

    // 최근 반응 가져오기
    getRecentReactions(lobbyId, limit = 5) {
        const history = this.reactionHistory.get(lobbyId) || [];
        return history.slice(-limit);
    }

    // 세션 정리
    clearSession(lobbyId) {
        this.reactionHistory.delete(lobbyId);
    }
}

// 토너먼트 시스템
class TournamentSystem {
    constructor() {
        this.tournaments = new Map(); // tournamentId -> tournament data
        this.playerTournaments = new Map(); // playerId -> tournamentId
    }

    // 토너먼트 생성
    createTournament(hostId) {
        const tournamentId = `tournament_${Date.now()}`;
        const tournament = {
            id: tournamentId,
            hostId: hostId,
            players: [],
            currentRound: 0,
            brackets: [],
            prizePool: 0,
            status: 'recruiting',
            startTime: null
        };

        this.tournaments.set(tournamentId, tournament);
        return tournament;
    }

    // 플레이어 참가
    joinTournament(tournamentId, playerId, playerName) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament || tournament.status !== 'recruiting') {
            return { success: false, message: '참가할 수 없는 토너먼트입니다.' };
        }

        if (tournament.players.length >= 8) {
            return { success: false, message: '토너먼트가 가득 찼습니다.' };
        }

        tournament.players.push({
            id: playerId,
            name: playerName,
            eliminated: false,
            roundsSurvived: 0
        });

        this.playerTournaments.set(playerId, tournamentId);
        tournament.prizePool += MUSHROOM_GAME.tournamentSettings.entryFee;

        return { success: true, tournament };
    }

    // 토너먼트 시작
    startTournament(tournamentId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament || tournament.players.length < 4) {
            return { success: false, message: '최소 4명이 필요합니다.' };
        }

        tournament.status = 'in_progress';
        tournament.startTime = Date.now();
        
        // 첫 라운드 대진표 생성
        this.createBrackets(tournament, 0);
        
        return { success: true, tournament };
    }

    // 대진표 생성
    createBrackets(tournament, roundIndex) {
        const round = MUSHROOM_GAME.tournamentSettings.rounds[roundIndex];
        const activePlayers = tournament.players.filter(p => !p.eliminated);
        
        // 랜덤 매칭
        const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
        const brackets = [];
        
        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                brackets.push({
                    player1: shuffled[i],
                    player2: shuffled[i + 1],
                    winner: null
                });
            }
        }
        
        tournament.brackets = brackets;
        tournament.currentRound = roundIndex;
    }

    // 라운드 결과 처리
    processRoundResult(tournamentId, winnerId) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament) return;

        // 승자 기록
        for (const bracket of tournament.brackets) {
            if (bracket.player1.id === winnerId || bracket.player2.id === winnerId) {
                bracket.winner = winnerId;
                
                // 패자 제거
                const loser = bracket.player1.id === winnerId ? bracket.player2 : bracket.player1;
                const playerIndex = tournament.players.findIndex(p => p.id === loser.id);
                if (playerIndex !== -1) {
                    tournament.players[playerIndex].eliminated = true;
                }
            }
        }

        // 다음 라운드 확인
        const remainingPlayers = tournament.players.filter(p => !p.eliminated).length;
        
        if (remainingPlayers === 1) {
            // 토너먼트 종료
            tournament.status = 'completed';
            return this.distributePrizes(tournament);
        } else if (tournament.currentRound < MUSHROOM_GAME.tournamentSettings.rounds.length - 1) {
            // 다음 라운드 진행
            this.createBrackets(tournament, tournament.currentRound + 1);
        }
    }

    // 상금 분배
    distributePrizes(tournament) {
        const rankings = [];
        const eliminated = tournament.players.filter(p => p.eliminated)
            .sort((a, b) => b.roundsSurvived - a.roundsSurvived);
        
        // 우승자
        const winner = tournament.players.find(p => !p.eliminated);
        rankings.push(winner);
        
        // 나머지 순위
        rankings.push(...eliminated);
        
        const prizes = [];
        const prizeDistribution = MUSHROOM_GAME.tournamentSettings.prizePool;
        
        for (let i = 0; i < Math.min(3, rankings.length); i++) {
            const prizePercent = prizeDistribution[i + 1] || 0;
            const prize = Math.floor(tournament.prizePool * prizePercent);
            prizes.push({
                player: rankings[i],
                rank: i + 1,
                prize: prize
            });
        }
        
        return prizes;
    }
}


// 연승 및 업적 시스템
class AchievementSystem {
    constructor() {
        this.playerAchievements = new Map(); // playerId -> achievements
        this.streaks = new Map(); // playerId -> current streak
    }

    // 업적 확인 및 보상
    checkAchievements(playerId, gameResult) {
        if (!this.playerAchievements.has(playerId)) {
            this.playerAchievements.set(playerId, new Set());
        }

        const achievements = this.playerAchievements.get(playerId);
        const newAchievements = [];
        let totalBonus = 0;

        // 첫 생존
        if (gameResult.survived && !achievements.has('firstBlood')) {
            achievements.add('firstBlood');
            newAchievements.push(MUSHROOM_GAME.achievements.firstBlood);
            totalBonus += MUSHROOM_GAME.achievements.firstBlood.bonus;
        }

        // 무피해 클리어
        if (gameResult.perfectRun && !achievements.has('perfectRun')) {
            achievements.add('perfectRun');
            newAchievements.push(MUSHROOM_GAME.achievements.perfectRun);
            totalBonus += MUSHROOM_GAME.achievements.perfectRun.bonus;
        }

        // 대역전 (마지막 라운드에서 1위)
        if (gameResult.comeback && !achievements.has('comeback')) {
            achievements.add('comeback');
            newAchievements.push(MUSHROOM_GAME.achievements.comeback);
            totalBonus += MUSHROOM_GAME.achievements.comeback.bonus;
        }

        // 연승 체크
        if (gameResult.won) {
            const currentStreak = (this.streaks.get(playerId) || 0) + 1;
            this.streaks.set(playerId, currentStreak);
            
            if (currentStreak >= 3) {
                totalBonus += MUSHROOM_GAME.gameSettings.streakBonus * (currentStreak - 2);
            }
        } else {
            this.streaks.set(playerId, 0);
        }

        return { newAchievements, totalBonus };
    }
}

// 시스템 인스턴스 생성
const mushroomItemSystem = new MushroomItemSystem();
const reactionSystem = new ReactionSystem();
const tournamentSystem = new TournamentSystem();
const achievementSystem = new AchievementSystem();

module.exports = {
    mushroomItemSystem,
    reactionSystem,
    tournamentSystem,
    achievementSystem
};