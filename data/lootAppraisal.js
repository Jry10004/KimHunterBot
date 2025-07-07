// 전리품 감정 시스템
const LOOT_APPRAISAL = {
    // 미확인 아이템 등급별 설정
    grades: {
        common: {
            name: "미확인 물품",
            emoji: "📦",
            color: "#888888",
            baseCost: 100,              // 감정 비용
            outcomes: {
                trash: 40,              // 쓰레기 40%
                common: 35,             // 일반 35%
                uncommon: 20,           // 고급 20%
                rare: 4,                // 레어 4%
                epic: 0.9,              // 에픽 0.9%
                legendary: 0.1          // 레전드 0.1%
            }
        },
        mysterious: {
            name: "수상한 상자",
            emoji: "🎁",
            color: "#4499ff",
            baseCost: 500,
            outcomes: {
                trash: 20,
                common: 30,
                uncommon: 30,
                rare: 15,
                epic: 4.5,
                legendary: 0.5
            }
        },
        ancient: {
            name: "고대의 유물",
            emoji: "🏺",
            color: "#ff9944",
            baseCost: 2000,
            outcomes: {
                trash: 5,
                common: 15,
                uncommon: 30,
                rare: 35,
                epic: 13,
                legendary: 2
            }
        },
        divine: {
            name: "신비한 보물",
            emoji: "💎",
            color: "#ff44ff",
            baseCost: 10000,
            outcomes: {
                trash: 1,
                common: 4,
                uncommon: 15,
                rare: 40,
                epic: 35,
                legendary: 5
            }
        }
    },
    
    // 감정 결과 아이템 풀
    outcomes: {
        trash: {
            items: [
                { name: "썩은 나무조각", emoji: "🪵", value: 1, description: "아무 쓸모없는 나무조각" },
                { name: "녹슨 못", emoji: "🔩", value: 2, description: "완전히 녹슬어버린 못" },
                { name: "찢어진 천", emoji: "🧻", value: 3, description: "너덜너덜한 천 조각" },
                { name: "깨진 병", emoji: "🍾", value: 5, description: "산산조각난 유리병" },
                { name: "썩은 음식", emoji: "🍄", value: 1, description: "먹을 수 없는 음식 찌꺼기" }
            ],
            message: "😭 앗! 쓰레기였습니다...",
            color: "#666666"
        },
        common: {
            items: [
                { name: "일반 포션", emoji: "🧪", value: 100, description: "체력을 소량 회복하는 포션" },
                { name: "거친 가죽", emoji: "🟫", value: 150, description: "품질이 낮은 가죽" },
                { name: "둔한 칼날", emoji: "🗡️", value: 200, description: "날이 무딘 칼날" },
                { name: "작은 보석", emoji: "💠", value: 300, description: "별로 빛나지 않는 보석" },
                { name: "낡은 지도", emoji: "🗺️", value: 250, description: "오래된 지도 조각" }
            ],
            message: "🙂 일반 아이템입니다.",
            color: "#aaaaaa"
        },
        uncommon: {
            items: [
                { name: "고급 포션", emoji: "🧪", value: 500, description: "체력을 중간 회복하는 포션" },
                { name: "마법 가루", emoji: "✨", value: 800, description: "약간의 마력이 담긴 가루" },
                { name: "은 장신구", emoji: "💍", value: 1000, description: "은으로 만든 반지" },
                { name: "강화석", emoji: "🔷", value: 1200, description: "장비 강화에 쓰이는 돌" },
                { name: "룬 조각", emoji: "🔣", value: 1500, description: "고대 룬의 일부" }
            ],
            message: "😊 고급 아이템입니다!",
            color: "#44ff44"
        },
        rare: {
            items: [
                { name: "마나 크리스탈", emoji: "💎", value: 3000, description: "순수한 마나가 응축된 크리스탈" },
                { name: "용의 비늘", emoji: "🐉", value: 5000, description: "작은 용의 비늘" },
                { name: "엘프의 활시위", emoji: "🏹", value: 4000, description: "엘프가 만든 특별한 활시위" },
                { name: "마법서 페이지", emoji: "📜", value: 4500, description: "고대 마법서의 한 페이지" },
                { name: "영혼석", emoji: "🔮", value: 6000, description: "영혼이 깃든 신비한 돌" }
            ],
            message: "🤩 레어 아이템입니다!",
            color: "#4444ff"
        },
        epic: {
            items: [
                { name: "불사조의 깃털", emoji: "🪶", value: 15000, description: "불사조의 타오르는 깃털" },
                { name: "시간의 모래", emoji: "⏳", value: 20000, description: "시간을 조작하는 신비한 모래" },
                { name: "현자의 돌", emoji: "🪨", value: 25000, description: "모든 것을 황금으로 바꾸는 돌" },
                { name: "신의 눈물", emoji: "💧", value: 30000, description: "신이 흘린 눈물이 굳은 보석" },
                { name: "용왕의 보주", emoji: "🐲", value: 35000, description: "용왕이 아끼던 보물" }
            ],
            message: "🎉 에픽 아이템입니다!!",
            color: "#ff44ff"
        },
        legendary: {
            items: [
                { name: "운명의 주사위", emoji: "🎲", value: 100000, description: "운명을 바꿀 수 있는 주사위" },
                { name: "신성한 성배", emoji: "🏆", value: 150000, description: "모든 소원을 들어주는 성배" },
                { name: "영원의 꽃", emoji: "🌺", value: 200000, description: "절대 시들지 않는 신비한 꽃" },
                { name: "창조의 파편", emoji: "💫", value: 300000, description: "세계 창조 때 남은 파편" },
                { name: "절대반지", emoji: "💍", value: 500000, description: "모든 힘을 지배하는 반지" }
            ],
            message: "🌟🎊 전설 아이템입니다!!!",
            color: "#ffdd44"
        }
    },
    
    // 감정 애니메이션 GIF
    appraisalGifs: [
        "https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723788/appraisal1.gif",
        "https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723789/appraisal2.gif"
    ],
    
    // 대박 애니메이션 GIF
    jackpotGifs: [
        "https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723790/jackpot1.gif",
        "https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723791/jackpot2.gif"
    ]
};

// 감정 결과 결정 함수
function appraiseLoot(grade) {
    const gradeData = LOOT_APPRAISAL.grades[grade];
    if (!gradeData) return null;
    
    // 가중치 기반 랜덤 선택
    const random = Math.random() * 100;
    let accumulated = 0;
    
    for (const [outcome, weight] of Object.entries(gradeData.outcomes)) {
        accumulated += weight;
        if (random <= accumulated) {
            const outcomeData = LOOT_APPRAISAL.outcomes[outcome];
            const item = outcomeData.items[Math.floor(Math.random() * outcomeData.items.length)];
            
            return {
                outcome,
                item,
                message: outcomeData.message,
                color: outcomeData.color,
                cost: gradeData.baseCost
            };
        }
    }
    
    // 기본값 (발생하면 안됨)
    return {
        outcome: 'common',
        item: LOOT_APPRAISAL.outcomes.common.items[0],
        message: LOOT_APPRAISAL.outcomes.common.message,
        color: LOOT_APPRAISAL.outcomes.common.color,
        cost: gradeData.baseCost
    };
}

module.exports = {
    LOOT_APPRAISAL,
    appraiseLoot
};