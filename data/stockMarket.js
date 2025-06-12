// 🚀 혁신적인 차원 주식 거래소 시스템
const STOCK_MARKET = {
    // 12개 환상 지역의 기업들
    regions: {
        crystal_cave: {
            name: '💎 크리스탈 동굴',
            companies: [
                { id: 'crystal_mining', name: '크리스탈 채굴공사', price: 1000, change: 0, volume: 0, sector: 'mining' },
                { id: 'crystal_processing', name: '수정 가공업체', price: 850, change: 0, volume: 0, sector: 'manufacturing' }
            ]
        },
        cloud_castle: {
            name: '☁️ 솜사탕 구름성',
            companies: [
                { id: 'cotton_candy', name: '솜사탕 제과회사', price: 750, change: 0, volume: 0, sector: 'food' },
                { id: 'cloud_transport', name: '구름 운송업', price: 920, change: 0, volume: 0, sector: 'logistics' }
            ]
        },
        starlight_lake: {
            name: '⭐ 별빛 호수',
            companies: [
                { id: 'starlight_research', name: '별빛 연구소', price: 1200, change: 0, volume: 0, sector: 'research' },
                { id: 'moonlight_fishing', name: '달빛 어업', price: 680, change: 0, volume: 0, sector: 'fishing' }
            ]
        },
        magic_library: {
            name: '📚 마법 도서관',
            companies: [
                { id: 'wisdom_publishing', name: '지혜 출판사', price: 800, change: 0, volume: 0, sector: 'publishing' },
                { id: 'magic_research', name: '마법 연구원', price: 1100, change: 0, volume: 0, sector: 'research' }
            ]
        },
        dragon_village: {
            name: '🐲 용용이 마을',
            companies: [
                { id: 'dragon_weapons', name: '드래곤 무기점', price: 1350, change: 0, volume: 0, sector: 'weapons' },
                { id: 'dragon_armor', name: '용린 방어구', price: 1180, change: 0, volume: 0, sector: 'armor' }
            ]
        },
        time_garden: {
            name: '⏰ 시간의 정원',
            companies: [
                { id: 'time_management', name: '시공 관리공사', price: 1500, change: 0, volume: 0, sector: 'technology' },
                { id: 'garden_agriculture', name: '정원 농업', price: 550, change: 0, volume: 0, sector: 'agriculture' }
            ]
        }
    },
    
    // 전 지역 체인 기업들
    chains: [
        { id: 'potion_shop', name: '만능 포션샵', price: 900, change: 0, volume: 0, sector: 'retail' },
        { id: 'weapon_store', name: '범용 무기고', price: 1000, change: 0, volume: 0, sector: 'retail' },
        { id: 'adventure_tailor', name: '모험가 의상실', price: 750, change: 0, volume: 0, sector: 'retail' },
        { id: 'general_store', name: '만물상 마트', price: 600, change: 0, volume: 0, sector: 'retail' },
        { id: 'traveler_inn', name: '여행자 여관', price: 800, change: 0, volume: 0, sector: 'hospitality' }
    ],

    // 유물탐사회사들 (새로운 섹터)
    exploration_companies: [
        { id: 'desert_explorers', name: '사막 탐험대', price: 800, change: 0, volume: 0, sector: 'exploration' },
        { id: 'ocean_hunters', name: '심해 보물단', price: 1200, change: 0, volume: 0, sector: 'exploration' },
        { id: 'mountain_seekers', name: '설산 유적단', price: 1000, change: 0, volume: 0, sector: 'exploration' },
        { id: 'jungle_raiders', name: '정글 탐사대', price: 900, change: 0, volume: 0, sector: 'exploration' },
        { id: 'space_archaeologists', name: '우주 고고학회', price: 2000, change: 0, volume: 0, sector: 'exploration' }
    ],

    // NPC 감정 상태
    npc_emotions: {
        villagers: { happiness: 50, stress: 30, excitement: 40 },
        merchants: { greed: 60, satisfaction: 45, anxiety: 35 },
        scammers: { confidence: 70, suspicion: 20, desperation: 40 },
        travelers: { wanderlust: 80, homesickness: 25, curiosity: 90 }
    },

    // 글로벌 시장 상태
    market_state: {
        overall_trend: 0, // -100 to +100
        volatility: 30, // 0 to 100
        player_actions: {
            total_enhancement_attempts: 0,
            successful_enhancements: 0,
            legendary_crafts: 0,
            shop_purchases: 0,
            hunt_sessions: 0
        }
    },
    
    // 실시간 차트 데이터 (최대 50개 데이터포인트)
    chart_history: {
        timestamps: [],
        market_index: [], // 전체 시장 지수
        top_companies: {} // 주요 기업별 가격 히스토리
    },
    
    // 유물 시장 시스템
    artifact_market: {
        // 유물별 현재 시장 가치 배율 (기본값 1.0 = 100%)
        value_multipliers: {
            // 일반 유물들
            '고대 동전': 1.0,
            '토기 조각': 1.0,
            '돌 조각상': 1.0,
            '청동 팔찌': 1.0,
            '화석 조개': 1.0,
            // 희귀 유물들
            '황금 목걸이': 1.0,
            '보석 단검': 1.0,
            '고대 두루마리': 1.0,
            '수정 구슬': 1.0,
            '은 잔': 1.0,
            // 에픽 유물들
            '왕관의 조각': 1.0,
            '용의 비늘': 1.0,
            '신의 성물': 1.0,
            '시간의 모래시계': 1.0,
            '불멸의 약초': 1.0,
            // 레전드리 유물들
            '창조의 서판': 1.0,
            '무한의 보석': 1.0,
            '시공간 열쇠': 1.0,
            '생명의 나무 가지': 1.0,
            '별의 눈물': 1.0,
            // 특화 유물들
            '파라오의 황금 마스크': 1.0,
            '미라의 붕대': 1.0,
            '해적왕의 보물상자': 1.0,
            '인어의 진주': 1.0,
            '설인의 발자국 화석': 1.0,
            '얼음 수정': 1.0,
            '잃어버린 도시의 열쇠': 1.0,
            '아즈텍 황금 조각상': 1.0,
            '외계 문명의 데이터 코어': 1.0,
            '운석 조각': 1.0
        },
        
        // 유물 차트 데이터
        chart_history: {
            timestamps: [],
            artifact_index: [], // 전체 유물 시장 지수
            individual_artifacts: {} // 개별 유물 가격 히스토리
        },
        
        // 시장 이벤트들
        market_events: [
            {
                name: '고고학 박물관 특별전',
                effect: { rarity: 'common', multiplier: 1.15 },
                duration: 2 * 60 * 60 * 1000, // 2시간
                probability: 0.05
            },
            {
                name: '수집가 경매 대회',
                effect: { rarity: 'rare', multiplier: 1.25 },
                duration: 3 * 60 * 60 * 1000, // 3시간
                probability: 0.03
            },
            {
                name: '국제 보물 전시회',
                effect: { rarity: 'epic', multiplier: 1.35 },
                duration: 4 * 60 * 60 * 1000, // 4시간
                probability: 0.02
            },
            {
                name: '전설의 유물 발견 소식',
                effect: { rarity: 'legendary', multiplier: 1.5 },
                duration: 6 * 60 * 60 * 1000, // 6시간
                probability: 0.01
            }
        ],
        
        active_events: [], // 현재 활성 이벤트들
        last_update: Date.now(),
        volatility: 15 // 유물 시장 변동성 (주식보다 낮음)
    }
};

module.exports = STOCK_MARKET;