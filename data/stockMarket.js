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
    }
};

module.exports = STOCK_MARKET;