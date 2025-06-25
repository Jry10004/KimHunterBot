// 🎮 초성게임 & 끝말잇기 향상된 멀티플레이 기능

// 특수 아이템 시스템
class WordGameItemSystem {
    constructor() {
        this.playerItems = new Map(); // playerId -> [items]
    }

    // 아이템 목록
    items = {
        hint: {
            name: '힌트',
            emoji: '💡',
            description: '첫 글자 힌트를 제공합니다',
            effect: 'show_hint',
            uses: 1
        },
        skip: {
            name: '패스권',
            emoji: '⏭️',
            description: '현재 문제를 건너뜁니다',
            effect: 'skip_turn',
            uses: 1
        },
        freeze: {
            name: '시간 정지',
            emoji: '⏸️',
            description: '상대방의 시간을 5초 멈춥니다',
            effect: 'freeze_time',
            duration: 5000
        },
        doubleTime: {
            name: '시간 연장',
            emoji: '⏰',
            description: '제한 시간을 2배로 늘립니다',
            effect: 'double_time',
            multiplier: 2
        },
        shield: {
            name: '실드',
            emoji: '🛡️',
            description: '한 번의 오답을 방어합니다',
            effect: 'block_wrong',
            uses: 1
        }
    };

    // 아이템 획득
    grantRandomItem(playerId) {
        const itemKeys = Object.keys(this.items);
        const randomItem = itemKeys[Math.floor(Math.random() * itemKeys.length)];
        
        if (!this.playerItems.has(playerId)) {
            this.playerItems.set(playerId, []);
        }
        
        this.playerItems.get(playerId).push(randomItem);
        return this.items[randomItem];
    }

    // 아이템 사용
    useItem(playerId, itemType) {
        const items = this.playerItems.get(playerId);
        if (!items || !items.includes(itemType)) {
            return { success: false, message: '아이템이 없습니다.' };
        }

        const item = this.items[itemType];
        const itemIndex = items.indexOf(itemType);
        items.splice(itemIndex, 1);

        return {
            success: true,
            item: item
        };
    }
}

// 파워업 시스템
class PowerUpSystem {
    constructor() {
        this.activePowerUps = new Map(); // sessionId -> [powerups]
    }

    powerUps = {
        speedBoost: {
            name: '스피드 부스트',
            emoji: '⚡',
            description: '다음 3턴 동안 답변 시간 +5초',
            duration: 3,
            effect: { timeBonus: 5000 }
        },
        scoreMultiplier: {
            name: '점수 2배',
            emoji: '✨',
            description: '다음 정답의 점수가 2배',
            duration: 1,
            effect: { scoreMultiplier: 2 }
        },
        errorShield: {
            name: '오답 보호막',
            emoji: '🔰',
            description: '다음 오답 1회 무효',
            duration: 1,
            effect: { protectWrong: true }
        },
        wordStealer: {
            name: '단어 도둑',
            emoji: '🦝',
            description: '다른 플레이어가 사용한 단어 재사용 가능',
            duration: 1,
            effect: { canReuse: true }
        }
    };

    // 파워업 생성
    spawnPowerUp(sessionId) {
        const powerUpKeys = Object.keys(this.powerUps);
        const randomPowerUp = powerUpKeys[Math.floor(Math.random() * powerUpKeys.length)];
        
        if (!this.activePowerUps.has(sessionId)) {
            this.activePowerUps.set(sessionId, []);
        }
        
        this.activePowerUps.get(sessionId).push({
            type: randomPowerUp,
            ...this.powerUps[randomPowerUp],
            spawnTime: Date.now()
        });
        
        return this.powerUps[randomPowerUp];
    }

    // 파워업 획득
    collectPowerUp(sessionId, playerId, powerUpType) {
        const sessionPowerUps = this.activePowerUps.get(sessionId);
        if (!sessionPowerUps) return null;
        
        const powerUpIndex = sessionPowerUps.findIndex(p => p.type === powerUpType);
        if (powerUpIndex === -1) return null;
        
        const powerUp = sessionPowerUps.splice(powerUpIndex, 1)[0];
        return powerUp;
    }
}

// 토너먼트 시스템
class WordGameTournament {
    constructor() {
        this.tournaments = new Map();
    }

    // 토너먼트 생성
    createTournament(gameType, hostId) {
        const tournamentId = `tournament_${gameType}_${Date.now()}`;
        const tournament = {
            id: tournamentId,
            gameType: gameType, // 'chosung' or 'wordchain'
            hostId: hostId,
            players: [],
            currentRound: 0,
            brackets: [],
            prizePool: 0,
            status: 'recruiting',
            settings: {
                entryFee: 500,
                minPlayers: 4,
                maxPlayers: 8,
                rounds: [
                    { name: '예선', advance: 4 },
                    { name: '준결승', advance: 2 },
                    { name: '결승', advance: 1 }
                ]
            }
        };

        this.tournaments.set(tournamentId, tournament);
        return tournament;
    }

    // 참가
    joinTournament(tournamentId, playerId, playerName) {
        const tournament = this.tournaments.get(tournamentId);
        if (!tournament || tournament.status !== 'recruiting') {
            return { success: false, message: '참가할 수 없는 토너먼트입니다.' };
        }

        if (tournament.players.length >= tournament.settings.maxPlayers) {
            return { success: false, message: '토너먼트가 가득 찼습니다.' };
        }

        tournament.players.push({
            id: playerId,
            name: playerName,
            wins: 0,
            losses: 0
        });

        tournament.prizePool += tournament.settings.entryFee;
        return { success: true, tournament };
    }
}

// 실시간 랭킹 시스템
class LiveRankingSystem {
    constructor() {
        this.sessionRankings = new Map(); // sessionId -> rankings
    }

    // 랭킹 업데이트
    updateRanking(sessionId, playerId, score, correctAnswers = 0) {
        if (!this.sessionRankings.has(sessionId)) {
            this.sessionRankings.set(sessionId, new Map());
        }
        
        const rankings = this.sessionRankings.get(sessionId);
        
        if (!rankings.has(playerId)) {
            rankings.set(playerId, {
                score: 0,
                correctAnswers: 0,
                streak: 0,
                lastUpdate: Date.now()
            });
        }
        
        const playerRank = rankings.get(playerId);
        playerRank.score = score;
        playerRank.correctAnswers += correctAnswers;
        if (correctAnswers > 0) {
            playerRank.streak++;
        } else {
            playerRank.streak = 0;
        }
        playerRank.lastUpdate = Date.now();
    }

    // 현재 순위 가져오기
    getCurrentRankings(sessionId) {
        const rankings = this.sessionRankings.get(sessionId);
        if (!rankings) return [];
        
        return Array.from(rankings.entries())
            .map(([playerId, data]) => ({ playerId, ...data }))
            .sort((a, b) => b.score - a.score);
    }

    // 연승 보너스 계산
    getStreakBonus(streak) {
        if (streak < 3) return 0;
        if (streak < 5) return 50;
        if (streak < 10) return 100;
        return 200;
    }
}

// 관전 모드
class SpectatorSystem {
    constructor() {
        this.spectators = new Map(); // sessionId -> [spectatorIds]
        this.betSystem = new Map(); // sessionId -> { playerId -> betData }
    }

    // 관전자 추가
    addSpectator(sessionId, spectatorId) {
        if (!this.spectators.has(sessionId)) {
            this.spectators.set(sessionId, new Set());
        }
        this.spectators.get(sessionId).add(spectatorId);
    }

    // 베팅 시스템
    placeBet(sessionId, spectatorId, targetPlayerId, amount) {
        if (!this.betSystem.has(sessionId)) {
            this.betSystem.set(sessionId, new Map());
        }
        
        const sessionBets = this.betSystem.get(sessionId);
        sessionBets.set(spectatorId, {
            targetPlayer: targetPlayerId,
            amount: amount,
            timestamp: Date.now()
        });
        
        return { success: true };
    }

    // 베팅 정산
    settleBets(sessionId, winnerId) {
        const sessionBets = this.betSystem.get(sessionId);
        if (!sessionBets) return [];
        
        const results = [];
        for (const [spectatorId, bet] of sessionBets.entries()) {
            if (bet.targetPlayer === winnerId) {
                results.push({
                    spectatorId,
                    won: true,
                    payout: bet.amount * 2
                });
            } else {
                results.push({
                    spectatorId,
                    won: false,
                    payout: 0
                });
            }
        }
        
        this.betSystem.delete(sessionId);
        return results;
    }
}

// 게임 모드
const GAME_MODES = {
    classic: {
        name: '클래식',
        description: '기본 규칙으로 진행',
        settings: {}
    },
    speed: {
        name: '스피드전',
        description: '제한 시간 절반!',
        settings: { timeLimit: 0.5 }
    },
    survival: {
        name: '서바이벌',
        description: '틀리면 즉시 탈락',
        settings: { lives: 1 }
    },
    reverse: {
        name: '거꾸로 모드',
        description: '끝말잇기를 거꾸로! (끝 글자로 시작)',
        settings: { reverse: true }
    },
    theme: {
        name: '주제 모드',
        description: '특정 주제의 단어만 사용 가능',
        settings: { themed: true }
    }
};

// 시스템 인스턴스 생성
const wordGameItemSystem = new WordGameItemSystem();
const powerUpSystem = new PowerUpSystem();
const wordGameTournament = new WordGameTournament();
const liveRankingSystem = new LiveRankingSystem();
const spectatorSystem = new SpectatorSystem();

module.exports = {
    wordGameItemSystem,
    powerUpSystem,
    wordGameTournament,
    liveRankingSystem,
    spectatorSystem,
    GAME_MODES
};