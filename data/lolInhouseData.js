// LOL 내전 게임 데이터 및 설정
const LOL_INHOUSE_DATA = {
    // 배팅 금액 옵션
    betAmounts: [
        { value: 50000, label: '5만 골드', emoji: '💰' },
        { value: 100000, label: '10만 골드', emoji: '💎' },
        { value: 300000, label: '30만 골드', emoji: '💸' },
        { value: 500000, label: '50만 골드', emoji: '💵' },
        { value: 1000000, label: '100만 골드', emoji: '🏆' }
    ],

    // 티어 점수 (밸런싱용)
    tierPoints: {
        'CHALLENGER': 10,
        'GRANDMASTER': 9,
        'MASTER': 8,
        'DIAMOND': 7,
        'EMERALD': 6,
        'PLATINUM': 5,
        'GOLD': 4,
        'SILVER': 3,
        'BRONZE': 2,
        'IRON': 1,
        'UNRANKED': 0
    },

    // 티어 목록 (선택용)
    tiers: [
        { value: 'CHALLENGER', label: '챌린저', emoji: '⚔️' },
        { value: 'GRANDMASTER', label: '그랜드마스터', emoji: '🏆' },
        { value: 'MASTER', label: '마스터', emoji: '👑' },
        { value: 'DIAMOND', label: '다이아몬드', emoji: '💎' },
        { value: 'EMERALD', label: '에메랄드', emoji: '💚' },
        { value: 'PLATINUM', label: '플래티넘', emoji: '🔷' },
        { value: 'GOLD', label: '골드', emoji: '🥇' },
        { value: 'SILVER', label: '실버', emoji: '🥈' },
        { value: 'BRONZE', label: '브론즈', emoji: '🥉' },
        { value: 'IRON', label: '아이언', emoji: '🔧' },
        { value: 'UNRANKED', label: '언랭', emoji: '❓' }
    ],

    // 게임 설정
    settings: {
        minPlayers: 2,      // 최소 인원 (1:1 가능)
        maxPlayers: 10,     // 최대 인원 (5:5)
        waitingTime: 300000, // 대기 시간 (5분)
        roundTime: 3600000, // 라운드 시간 (1시간)
        maxRounds: 10      // 최대 라운드
    },

    // 메시지 템플릿
    messages: {
        lobbyCreated: '🎮 **LOL 내전 방이 생성되었습니다!**',
        lobbyFull: '❌ 방이 가득 찼습니다!',
        alreadyJoined: '⚠️ 이미 참가한 방입니다.',
        insufficientGold: '💸 골드가 부족합니다!',
        gameStarted: '🚀 게임이 시작되었습니다!',
        roundComplete: '✅ 라운드가 완료되었습니다!',
        gameEnded: '🏆 게임이 종료되었습니다!',
        teamBalanced: '⚖️ 팀이 균형있게 배정되었습니다!',
        teamRandomized: '🎲 팀이 랜덤으로 배정되었습니다!'
    },

    // 색상 설정
    colors: {
        primary: '#5865F2',    // 디스코드 블루
        success: '#57F287',    // 성공 초록
        warning: '#FEE75C',    // 경고 노랑
        danger: '#ED4245',     // 위험 빨강
        blueTeam: '#3498db',   // 블루팀
        redTeam: '#e74c3c'     // 레드팀
    }
};

// 티어 기반 팀 밸런싱 알고리즘
function balanceTeams(participants) {
    // 참가자를 티어 점수로 정렬
    const sortedParticipants = [...participants].sort((a, b) => 
        (LOL_INHOUSE_DATA.tierPoints[b.tier] || 0) - (LOL_INHOUSE_DATA.tierPoints[a.tier] || 0)
    );

    const blueTeam = [];
    const redTeam = [];
    let blueScore = 0;
    let redScore = 0;

    // 지그재그 방식으로 팀 배정
    sortedParticipants.forEach((participant, index) => {
        const tierScore = LOL_INHOUSE_DATA.tierPoints[participant.tier] || 0;
        
        if (index % 2 === 0) {
            // 점수가 낮은 팀에 우선 배정
            if (blueScore <= redScore) {
                blueTeam.push(participant);
                blueScore += tierScore;
            } else {
                redTeam.push(participant);
                redScore += tierScore;
            }
        } else {
            // 반대 팀에 배정
            if (redScore <= blueScore) {
                redTeam.push(participant);
                redScore += tierScore;
            } else {
                blueTeam.push(participant);
                blueScore += tierScore;
            }
        }
    });

    return {
        blueTeam,
        redTeam,
        blueScore,
        redScore,
        scoreDiff: Math.abs(blueScore - redScore)
    };
}

// 완전 랜덤 팀 배정
function randomizeTeams(participants) {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    
    return {
        blueTeam: shuffled.slice(0, mid),
        redTeam: shuffled.slice(mid)
    };
}

// 승자 계산 (최다 승리자들)
function calculateWinners(participants) {
    const maxWins = Math.max(...participants.map(p => p.wins || 0));
    return participants.filter(p => p.wins === maxWins);
}

// 보상 분배
function distributeRewards(winners, totalPot) {
    const rewardPerWinner = Math.floor(totalPot / winners.length);
    return winners.map(winner => ({
        userId: winner.userId,
        reward: rewardPerWinner
    }));
}

module.exports = {
    LOL_INHOUSE_DATA,
    balanceTeams,
    randomizeTeams,
    calculateWinners,
    distributeRewards
};