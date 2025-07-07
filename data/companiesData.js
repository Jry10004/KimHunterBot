// 🏢 기업 데이터 (30개)

const COMPANIES = {
    // 엔터테인먼트 업종 (5개)
    KHE: {
        id: 'KHE',
        name: '김헌터 엔터테인먼트',
        sector: 'entertainment',
        emoji: '🎮',
        basePrice: 152400,
        currentPrice: 152400,
        shares: 1000000,
        description: '김헌터 세계관의 게임과 미디어 콘텐츠를 제작하는 대표 엔터테인먼트 기업 (참고: 대형 게임사)',
        sensitivity: {
            weather: { 
                RAINY: 1.1,      // 비 오는 날 +10%
                SNOWY: 1.15      // 눈 오는 날 +15%
            },
            time: {
                EVENING: 1.15    // 저녁 시간 +15%
            },
            news: {
                'new_game': 1.5,     // 신작 발표 +50%
                'entertainment': 1.2  // 엔터 뉴스 +20%
            }
        }
    },
    DRP: {
        id: 'DRP',
        name: '드래곤 픽처스',
        sector: 'entertainment',
        emoji: '🎬',
        basePrice: 84200,
        currentPrice: 84200,
        shares: 800000,
        description: '판타지 영화와 드라마를 제작하는 영상 제작사 (참고: 대형 미디어 그룹)',
        sensitivity: {
            weather: { RAINY: 1.08, SNOWY: 1.12 },
            time: { EVENING: 1.2, DAWN: 1.1 },
            news: { 'movie_release': 1.4, 'entertainment': 1.15 }
        }
    },
    PXG: {
        id: 'PXG',
        name: '픽셀 게임즈',
        sector: 'entertainment',
        emoji: '🕹️',
        basePrice: 45800,
        currentPrice: 45800,
        shares: 1500000,
        description: '모바일 게임 전문 개발사 (참고: 모바일 게임 대기업)',
        sensitivity: {
            weather: { RAINY: 1.12 },
            time: { AFTERNOON: 1.1, EVENING: 1.2 },
            news: { 'mobile_game': 1.6, 'app_ranking': 1.3 }
        }
    },
    MGS: {
        id: 'MGS',
        name: '매직 스튜디오',
        sector: 'entertainment',
        emoji: '🎭',
        basePrice: 67400,
        currentPrice: 67400,
        shares: 600000,
        description: 'VR/AR 콘텐츠 및 마법 체험관 운영 (참고: VR 콘텐츠 제작사)',
        sensitivity: {
            weather: { MANA_STORM: 1.5, AURORA: 1.3 },
            time: { EVENING: 1.1 },
            news: { 'new_tech': 1.4, 'vr_ar': 1.5 }
        }
    },
    HBC: {
        id: 'HBC',
        name: '헌터 방송국',
        sector: 'entertainment',
        emoji: '📺',
        basePrice: 112300,
        currentPrice: 112300,
        shares: 500000,
        description: '김헌터 월드의 공식 방송국 (참고: 주요 방송국)',
        sensitivity: {
            weather: { ECLIPSE: 1.3, AURORA: 1.2 },
            time: { MORNING: 1.1, EVENING: 1.2 },
            news: { 'breaking_news': 1.5, 'special_event': 1.3 }
        }
    },

    // 기술/제조 업종 (5개)
    HTK: {
        id: 'HTK',
        name: '헌터 테크놀로지',
        sector: 'technology',
        emoji: '💻',
        basePrice: 238000,
        currentPrice: 238000,
        shares: 400000,
        description: 'AI와 마법 기술을 융합한 첨단 기술 기업 (참고: 대형 전자기업)',
        sensitivity: {
            weather: { MANA_STORM: 1.3 },
            time: { DAWN: 1.1 },
            news: { 'tech_innovation': 1.5, 'ai_breakthrough': 1.6 }
        }
    },
    CRS: {
        id: 'CRS',
        name: '크리스탈 반도체',
        sector: 'technology',
        emoji: '💎',
        basePrice: 195000,
        currentPrice: 195000,
        shares: 300000,
        description: '마법 에너지 저장 크리스탈 제조 (참고: 배터리 제조 대기업)',
        sensitivity: {
            weather: { SUNNY: 1.05, MANA_STORM: 1.4 },
            time: { MORNING: 1.05 },
            news: { 'crystal_demand': 1.4, 'tech_innovation': 1.2 }
        }
    },
    MSE: {
        id: 'MSE',
        name: '매직스톤 에너지',
        sector: 'technology',
        emoji: '⚡',
        basePrice: 156000,
        currentPrice: 156000,
        shares: 450000,
        description: '마법 에너지 개발 및 공급 (참고: 국가 전력공사)',
        sensitivity: {
            weather: { MANA_STORM: 1.6, HEAT_WAVE: 0.9 },
            time: { DAWN: 1.15 },
            news: { 'energy_crisis': 1.5, 'mana_discovery': 1.7 }
        }
    },
    STF: {
        id: 'STF',
        name: '강철 단조소',
        sector: 'manufacturing',
        emoji: '⚔️',
        basePrice: 87500,
        currentPrice: 87500,
        shares: 700000,
        description: '무기와 방어구 전문 제조업체 (참고: 대형 철강기업)',
        sensitivity: {
            weather: { HEAT_WAVE: 1.2 },
            time: { MORNING: 1.1 },
            news: { 'boss_spawn': 1.5, 'war_news': 1.4 }
        }
    },
    PTL: {
        id: 'PTL',
        name: '포션 연구소',
        sector: 'manufacturing',
        emoji: '🧪',
        basePrice: 52300,
        currentPrice: 52300,
        shares: 1000000,
        description: '각종 물약과 회복 아이템 제조 (참고: 바이오 제약회사)',
        sensitivity: {
            weather: { SNOWY: 1.15, FOG: 1.1 },
            time: { MORNING: 1.05 },
            news: { 'epidemic': 1.6, 'dungeon_discovery': 1.3 }
        }
    },

    // 금융 업종 (5개)
    HBK: {
        id: 'HBK',
        name: '헌터 은행',
        sector: 'finance',
        emoji: '🏦',
        basePrice: 178000,
        currentPrice: 178000,
        shares: 600000,
        description: '김헌터 월드 최대 은행 (참고: 대형 은행)',
        sensitivity: {
            weather: { AURORA: 1.1 },
            time: { MORNING: 1.1, AFTERNOON: 1.05 },
            news: { 'economy': 1.3, 'interest_rate': 1.5 }
        }
    },
    ADI: {
        id: 'ADI',
        name: '모험가 보험',
        sector: 'finance',
        emoji: '🛡️',
        basePrice: 92000,
        currentPrice: 92000,
        shares: 500000,
        description: '던전 탐험 및 생명 보험 전문 (참고: 대형 생명보험사)',
        sensitivity: {
            weather: { ECLIPSE: 1.3, FOG: 1.2 },
            time: { DAWN: 1.15 },
            news: { 'dungeon_accident': 1.4, 'boss_spawn': 1.2 }
        }
    },
    GIS: {
        id: 'GIS',
        name: '골드 투자증권',
        sector: 'finance',
        emoji: '📈',
        basePrice: 134000,
        currentPrice: 134000,
        shares: 400000,
        description: '주식 중개 및 자산 관리 (참고: 대형 증권사)',
        sensitivity: {
            weather: { SUNNY: 1.05 },
            time: { MORNING: 1.2, AFTERNOON: 1.1 },
            news: { 'market_boom': 1.4, 'ipo': 1.3 }
        }
    },
    CRC: {
        id: 'CRC',
        name: '크리스탈 캐피탈',
        sector: 'finance',
        emoji: '💸',
        basePrice: 105000,
        currentPrice: 105000,
        shares: 350000,
        description: '벤처 투자 및 스타트업 지원 (참고: 글로벌 벤처캐피탈)',
        sensitivity: {
            weather: { AURORA: 1.2 },
            time: { AFTERNOON: 1.1 },
            news: { 'startup_success': 1.5, 'new_tech': 1.3 }
        }
    },
    GDF: {
        id: 'GDF',
        name: '길드 금융',
        sector: 'finance',
        emoji: '🏛️',
        basePrice: 76000,
        currentPrice: 76000,
        shares: 800000,
        description: '길드 전용 금융 서비스 (참고: 인터넷 전문은행)',
        sensitivity: {
            weather: { SUNNY: 1.05 },
            time: { EVENING: 1.1 },
            news: { 'guild_war': 1.4, 'guild_ranking': 1.2 }
        }
    },

    // 유통/서비스 업종 (5개)
    HMT: {
        id: 'HMT',
        name: '헌터 마트',
        sector: 'retail',
        emoji: '🛒',
        basePrice: 64000,
        currentPrice: 64000,
        shares: 1200000,
        description: '일용품과 장비를 판매하는 대형 마트 (참고: 대형 할인점)',
        sensitivity: {
            weather: { RAINY: 1.1, SNOWY: 1.15 },
            time: { MORNING: 1.2, AFTERNOON: 1.1 },
            news: { 'sale_event': 1.3, 'new_product': 1.2 }
        }
    },
    DRD: {
        id: 'DRD',
        name: '드래곤 배송',
        sector: 'service',
        emoji: '📦',
        basePrice: 89000,
        currentPrice: 89000,
        shares: 700000,
        description: '드래곤을 이용한 초고속 배송 서비스 (참고: 이커머스 대기업)',
        sensitivity: {
            weather: { SUNNY: 1.1, FOG: 0.8, HEAT_WAVE: 0.9 },
            time: { MORNING: 1.15, AFTERNOON: 1.2 },
            news: { 'delivery_record': 1.3, 'expansion': 1.2 }
        }
    },
    MGF: {
        id: 'MGF',
        name: '매직 푸드',
        sector: 'service',
        emoji: '🍖',
        basePrice: 48000,
        currentPrice: 48000,
        shares: 1500000,
        description: '마법 요리 프랜차이즈 (참고: 패스트푸드 체인)',
        sensitivity: {
            weather: { RAINY: 1.05, SNOWY: 1.1 },
            time: { AFTERNOON: 1.3, EVENING: 1.35 },
            news: { 'new_menu': 1.2, 'food_trend': 1.15 }
        }
    },
    ADL: {
        id: 'ADL',
        name: '모험가 숙소',
        sector: 'service',
        emoji: '🏨',
        basePrice: 56000,
        currentPrice: 56000,
        shares: 900000,
        description: '모험가 전용 숙박 체인 (참고: 고급 호텔 체인)',
        sensitivity: {
            weather: { RAINY: 1.2, SNOWY: 1.25, FOG: 1.15 },
            time: { EVENING: 1.2, DAWN: 1.3 },
            news: { 'tourism_boom': 1.3, 'event_hosting': 1.2 }
        }
    },
    PRT: {
        id: 'PRT',
        name: '포털 운송',
        sector: 'service',
        emoji: '🌀',
        basePrice: 123000,
        currentPrice: 123000,
        shares: 400000,
        description: '순간이동 포털 네트워크 운영 (참고: 대형 항공사)',
        sensitivity: {
            weather: { MANA_STORM: 1.4, ECLIPSE: 0.7 },
            time: { MORNING: 1.1, AFTERNOON: 1.1 },
            news: { 'portal_expansion': 1.4, 'major_event': 1.5 }
        }
    },

    // 자원/에너지 업종 (5개)
    CRM: {
        id: 'CRM',
        name: '크리스탈 광산',
        sector: 'resources',
        emoji: '⛏️',
        basePrice: 167000,
        currentPrice: 167000,
        shares: 500000,
        description: '마법 크리스탈 채굴 기업 (참고: 광업 공기업)',
        sensitivity: {
            weather: { SUNNY: 1.05, ECLIPSE: 1.3 },
            time: { MORNING: 1.1 },
            news: { 'crystal_vein': 1.6, 'mining_accident': 0.7 }
        }
    },
    MNP: {
        id: 'MNP',
        name: '마나 발전소',
        sector: 'energy',
        emoji: '🔮',
        basePrice: 198000,
        currentPrice: 198000,
        shares: 350000,
        description: '마법 에너지 생산 및 공급 (참고: 에너지 대기업)',
        sensitivity: {
            weather: { MANA_STORM: 1.8, AURORA: 1.3 },
            time: { DAWN: 1.2, EVENING: 1.1 },
            news: { 'mana_shortage': 1.5, 'energy_tech': 1.3 }
        }
    },
    FML: {
        id: 'FML',
        name: '숲의 제재소',
        sector: 'resources',
        emoji: '🌳',
        basePrice: 43000,
        currentPrice: 43000,
        shares: 1100000,
        description: '마법 나무 벌목 및 가공 (참고: 제지 기업)',
        sensitivity: {
            weather: { SUNNY: 1.1, RAINY: 0.9 },
            time: { MORNING: 1.15 },
            news: { 'construction_boom': 1.4, 'forest_fire': 0.6 }
        }
    },
    DSW: {
        id: 'DSW',
        name: '깊은샘 정수',
        sector: 'resources',
        emoji: '💧',
        basePrice: 38000,
        currentPrice: 38000,
        shares: 1300000,
        description: '마법수 채취 및 정제 (참고: 생수 브랜드)',
        sensitivity: {
            weather: { RAINY: 1.3, AURORA: 1.2 },
            time: { MORNING: 1.05 },
            news: { 'water_quality': 1.3, 'drought': 0.7 }
        }
    },
    LVI: {
        id: 'LVI',
        name: '용암 제철소',
        sector: 'resources',
        emoji: '🌋',
        basePrice: 142000,
        currentPrice: 142000,
        shares: 400000,
        description: '용암을 이용한 특수 금속 제련 (참고: 철강 제조사)',
        sensitivity: {
            weather: { HEAT_WAVE: 1.3, RAINY: 0.8 },
            time: { AFTERNOON: 1.1 },
            news: { 'volcano_active': 1.7, 'metal_demand': 1.3 }
        }
    },

    // 특수 업종 (5개)
    PRG: {
        id: 'PRG',
        name: '예언자 길드',
        sector: 'special',
        emoji: '🔮',
        basePrice: 210000,
        currentPrice: 210000,
        shares: 200000,
        description: '미래 예측과 점술 서비스 (참고: 온라인 증권사)',
        sensitivity: {
            weather: { AURORA: 1.5, ECLIPSE: 1.4, MANA_STORM: 1.3 },
            time: { DAWN: 1.3 },
            news: { 'prophecy': 2.0, 'major_event': 1.5 }
        }
    },
    DMR: {
        id: 'DMR',
        name: '차원 연구원',
        sector: 'special',
        emoji: '🌌',
        basePrice: 285000,
        currentPrice: 285000,
        shares: 150000,
        description: '차원 이동과 공간 마법 연구 (참고: 항공우주 연구기관)',
        sensitivity: {
            weather: { ECLIPSE: 1.6, MANA_STORM: 1.4 },
            time: { DAWN: 1.2 },
            news: { 'dimension_rift': 2.5, 'research_breakthrough': 1.6 }
        }
    },
    ANT: {
        id: 'ANT',
        name: '고대 유물상',
        sector: 'special',
        emoji: '🏺',
        basePrice: 176000,
        currentPrice: 176000,
        shares: 250000,
        description: '고대 유물 발굴과 거래 (참고: 문화재 관련 기관)',
        sensitivity: {
            weather: { FOG: 1.2, AURORA: 1.3 },
            time: { EVENING: 1.1 },
            news: { 'artifact_discovery': 2.0, 'dungeon_clear': 1.4 }
        }
    },
    MBF: {
        id: 'MBF',
        name: '몬스터 사육장',
        sector: 'special',
        emoji: '🐲',
        basePrice: 98000,
        currentPrice: 98000,
        shares: 600000,
        description: '펫 몬스터 사육과 훈련 (참고: 펫 관련 기업)',
        sensitivity: {
            weather: { SUNNY: 1.1, ECLIPSE: 0.8 },
            time: { MORNING: 1.15 },
            news: { 'pet_trend': 1.5, 'monster_escape': 0.6 }
        }
    },
    HRA: {
        id: 'HRA',
        name: '영웅 아카데미',
        sector: 'special',
        emoji: '🎓',
        basePrice: 134000,
        currentPrice: 134000,
        shares: 400000,
        description: '차세대 영웅 육성 교육기관 (참고: 교육 기업)',
        sensitivity: {
            weather: { SUNNY: 1.05, AURORA: 1.2 },
            time: { MORNING: 1.2, AFTERNOON: 1.1 },
            news: { 'graduation': 1.3, 'hero_achievement': 1.4 }
        }
    },

    // 실제 기업 매핑 추가 (실시간 주식 동기화용)
    SSE: {
        id: 'SSE',
        name: '김헌터전자',
        sector: 'technology',
        emoji: '📱',
        basePrice: 350000,
        currentPrice: 350000,
        shares: 5000000,
        description: '김헌터 월드 최대 전자기업 (참고: 글로벌 전자기업)',
        realCompany: '삼성전자',
        sensitivity: {
            weather: { LIGHTNING_STORM: 1.1 },
            time: { MORNING: 1.05 },
            news: { 'tech_innovation': 1.5, 'chip_shortage': 0.7 }
        }
    },
    HHX: {
        id: 'HHX',
        name: '헌터하이닉스',
        sector: 'technology',
        emoji: '💾',
        basePrice: 180000,
        currentPrice: 180000,
        shares: 3000000,
        description: '메모리 반도체 전문 기업 (참고: 반도체 대기업)',
        realCompany: 'SK하이닉스',
        sensitivity: {
            weather: { MANA_STORM: 1.1 },
            time: { AFTERNOON: 1.05 },
            news: { 'semiconductor': 1.6, 'tech_downturn': 0.8 }
        }
    },
    KKO: {
        id: 'KKO',
        name: '김헌터톡',
        sector: 'technology',
        emoji: '💬',
        basePrice: 95000,
        currentPrice: 95000,
        shares: 2000000,
        description: '메신저 및 플랫폼 기업 (참고: IT 플랫폼 기업)',
        realCompany: '카카오',
        sensitivity: {
            weather: { SUNNY: 1.02 },
            time: { EVENING: 1.1 },
            news: { 'platform_update': 1.3, 'privacy_issue': 0.7 }
        }
    },
    NVR: {
        id: 'NVR',
        name: '헌터포털',
        sector: 'technology',
        emoji: '🔍',
        basePrice: 250000,
        currentPrice: 250000,
        shares: 1500000,
        description: '검색 포털 및 AI 서비스 (참고: 포털 서비스 기업)',
        realCompany: '네이버',
        sensitivity: {
            weather: { CLOUDY: 1.01 },
            time: { MORNING: 1.08 },
            news: { 'ai_breakthrough': 1.4, 'search_competition': 0.85 }
        }
    },
    HMC: {
        id: 'HMC',
        name: '헌터모터스',
        sector: 'automotive',
        emoji: '🚗',
        basePrice: 220000,
        currentPrice: 220000,
        shares: 4000000,
        description: '자동차 제조 대기업 (참고: 글로벌 자동차 기업)',
        realCompany: '현대차',
        sensitivity: {
            weather: { SUNNY: 1.03 },
            time: { MORNING: 1.06 },
            news: { 'ev_sales': 1.4, 'recall': 0.7 }
        }
    },
    KBF: {
        id: 'KBF',
        name: '헌터금융',
        sector: 'finance',
        emoji: '🏦',
        basePrice: 120000,
        currentPrice: 120000,
        shares: 3500000,
        description: '종합 금융 그룹 (참고: 금융 지주회사)',
        realCompany: 'KB금융',
        sensitivity: {
            weather: { RAINY: 0.98 },
            time: { MORNING: 1.03 },
            news: { 'interest_rate': 1.5, 'bad_loan': 0.6 }
        }
    },
    HYB: {
        id: 'HYB',
        name: '하이브헌터',
        sector: 'entertainment',
        emoji: '🎵',
        basePrice: 185000,
        currentPrice: 185000,
        shares: 800000,
        description: '글로벌 엔터테인먼트 (참고: K-POP 엔터테인먼트)',
        realCompany: 'HYBE',
        sensitivity: {
            weather: { SUNNY: 1.05 },
            time: { EVENING: 1.15 },
            news: { 'new_album': 1.8, 'scandal': 0.5 }
        }
    },
    BTC: {
        id: 'BTC',
        name: '헌터코인',
        sector: 'crypto',
        emoji: '🪙',
        basePrice: 50000,
        currentPrice: 50000,
        shares: 1000000,
        description: '대표 가상화폐 (참고: 주요 암호화폐)',
        realCompany: '비트코인',
        sensitivity: {
            weather: { MANA_STORM: 1.2, ECLIPSE: 1.3 },
            time: { DAWN: 1.1 },
            news: { 'crypto_adoption': 2.0, 'regulation': 0.4 }
        }
    },
    TSL: {
        id: 'TSL',
        name: '헌터카',
        sector: 'automotive',
        emoji: '⚡',
        basePrice: 300000,
        currentPrice: 300000,
        shares: 1200000,
        description: '전기차 혁신 기업 (참고: 글로벌 전기차 기업)',
        realCompany: '테슬라',
        sensitivity: {
            weather: { LIGHTNING_STORM: 1.15 },
            time: { AFTERNOON: 1.05 },
            news: { 'ev_innovation': 1.7, 'production_issue': 0.6 }
        }
    }
};

// 섹터별 분류
const SECTORS = {
    entertainment: {
        name: '엔터테인먼트',
        companies: ['KHE', 'DRP', 'PXG', 'MGS', 'HBC', 'HYB'],
        description: '게임, 미디어, 방송 관련 기업'
    },
    technology: {
        name: '기술',
        companies: ['HTK', 'CRS', 'MSE', 'SSE', 'HHX', 'KKO', 'NVR'],
        description: '첨단 기술 및 마법 기술 기업'
    },
    manufacturing: {
        name: '제조',
        companies: ['STF', 'PTL'],
        description: '무기, 물약 등 제조업'
    },
    finance: {
        name: '금융',
        companies: ['HBK', 'ADI', 'GIS', 'CRC', 'GDF', 'KBF'],
        description: '은행, 보험, 투자 기업'
    },
    retail: {
        name: '유통',
        companies: ['HMT'],
        description: '소매 유통업'
    },
    service: {
        name: '서비스',
        companies: ['DRD', 'MGF', 'ADL', 'PRT'],
        description: '배송, 요식, 숙박 서비스'
    },
    resources: {
        name: '자원',
        companies: ['CRM', 'FML', 'DSW'],
        description: '광산, 벌목, 채취업'
    },
    energy: {
        name: '에너지',
        companies: ['MNP', 'LVI'],
        description: '에너지 생산 및 공급'
    },
    special: {
        name: '특수',
        companies: ['PRG', 'DMR', 'ANT', 'MBF', 'HRA'],
        description: '특수 서비스 및 연구'
    },
    automotive: {
        name: '자동차',
        companies: ['HMC', 'TSL'],
        description: '자동차 및 전기차 제조업'
    },
    crypto: {
        name: '가상화폐',
        companies: ['BTC'],
        description: '가상화폐 및 블록체인'
    }
};

// 기업 관련 유틸리티 함수
function getCompanyById(id) {
    return COMPANIES[id] || null;
}

function getCompaniesBySector(sector) {
    return SECTORS[sector]?.companies.map(id => COMPANIES[id]) || [];
}

function getAllCompanies() {
    return Object.values(COMPANIES);
}

function updateCompanyPrice(companyId, priceChange) {
    const company = COMPANIES[companyId];
    if (company) {
        company.currentPrice = Math.max(100, Math.floor(company.currentPrice * (1 + priceChange)));
        return company.currentPrice;
    }
    return null;
}

module.exports = {
    COMPANIES,
    SECTORS,
    getCompanyById,
    getCompaniesBySector,
    getAllCompanies,
    updateCompanyPrice
};