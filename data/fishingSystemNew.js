// 🎣 확장된 낚시 시스템 데이터 (50종)
const FISHING_SYSTEM = {
    // 물고기 기본 종류 (50종)
    fishTypes: {
        // 민물고기 (25종)
        freshwater: [
            '붕어', '잉어', '송어', '메기', '가물치',
            '빙어', '은어', '피라미', '누치', '쏘가리',
            '배스', '블루길', '향어', '틸라피아', '무지개송어',
            '산천어', '열목어', '버들치', '갈겨니', '돌고기',
            '미꾸리', '뱀장어', '동자개', '퉁가리', '꺽지'
        ],
        // 바닷물고기 (25종)
        saltwater: [
            '고등어', '갈치', '조기', '민어', '농어',
            '우럭', '광어', '도다리', '가자미', '넙치',
            '돔', '숭어', '전어', '멸치', '정어리',
            '삼치', '방어', '참치', '가오리', '상어',
            '복어', '아귀', '대구', '명태', '오징어'
        ]
    },

    // 형용사 시스템 (등급별)
    adjectives: {
        common: {
            positive: ['평범한', '작은', '귀여운', '둥근', '날씬한', '통통한', '길쭉한', '짧은', '가벼운', '부드러운'],
            negative: ['못생긴', '이상한', '삐뚤어진', '찌그러진', '볼품없는', '초라한', '지저분한', '누추한', '허름한', '남루한']
        },
        uncommon: {
            positive: ['예쁜', '멋진', '윤기나는', '건강한', '튼튼한', '활발한', '깨끗한', '싱싱한', '탱탱한', '매끈한'],
            negative: ['거친', '딱딱한', '거무튀튀한', '얼룩덜룩한', '울퉁불퉁한']
        },
        rare: {
            positive: ['아름다운', '화려한', '빛나는', '영롱한', '신비로운', '우아한', '고급스러운', '품격있는', '당당한', '위풍당당한'],
            negative: ['무시무시한', '섬뜩한', '괴기한', '기괴한', '음산한']
        },
        epic: {
            positive: ['장엄한', '위대한', '고귀한', '성스러운', '눈부신', '찬란한', '황홀한', '경이로운', '장대한', '웅장한'],
            negative: ['파괴적인', '맹렬한', '격렬한', '흉포한', '잔혹한']
        },
        legendary: {
            positive: ['전설의', '신화의', '불멸의', '영원한', '절대적인', '궁극의', '초월적인', '신성한', '천상의', '완벽한'],
            negative: ['저주받은', '금지된', '봉인된', '타락한', '어둠의']
        },
        mythic: {
            positive: ['창조의', '태초의', '원시의', '근원의', '우주의', '차원의', '시공을', '운명의', '인과의', '존재의'],
            negative: ['종말의', '파멸의', '혼돈의', '무의', '공허의']
        }
    },

    // 특수 접두사 (희귀 확률)
    specialPrefixes: {
        common: {
            chance: 0.1,
            prefixes: ['튀김용', '회뜨기좋은', '구이용', '찜하기좋은', '초밥용']
        },
        rare: {
            chance: 0.05,
            prefixes: ['왕의', '여왕의', '장군의', '제사장의', '현자의']
        },
        epic: {
            chance: 0.01,
            prefixes: ['고대의', '봉인된', '전설의', '신비의', '마법의']
        },
        legendary: {
            chance: 0.0005,
            prefixes: ['신이내린', '천년묵은', '용왕의', '포세이돈의', '심해의제왕']
        }
    },

    // 물고기 등급별 설정
    rarities: {
        common: {
            name: '일반',
            color: '#95a5a6',
            basePrice: { min: 6500, max: 10400 },
            weight: 60,
            emoji: '⬜'
        },
        uncommon: {
            name: '고급',
            color: '#3498db',
            basePrice: { min: 27500, max: 44000 },
            weight: 25,
            emoji: '🔵'
        },
        rare: {
            name: '레어',
            color: '#9b59b6',
            basePrice: { min: 110000, max: 176000 },
            weight: 10,
            emoji: '🟣'
        },
        epic: {
            name: '에픽',
            color: '#e74c3c',
            basePrice: { min: 575000, max: 920000 },
            weight: 4,
            emoji: '🔴'
        },
        legendary: {
            name: '레전드리',
            color: '#f39c12',
            basePrice: { min: 2875000, max: 4600000 },
            weight: 0.9,
            emoji: '🟠'
        },
        mythic: {
            name: '신화',
            color: '#ff00ff',
            basePrice: { min: 11000000, max: 17600000 },
            weight: 0.1,
            emoji: '✨'
        }
    },

    // 크기 등급 (디테일한 설정)
    sizeGrades: {
        tiny: {
            name: '🐟 미니급',
            description: '한입 거리',
            sizeRange: [0, 0.15],
            priceMultiplier: 0.5,
            sizeByType: {
                freshwater: { min: 3, max: 15 },    // 3~15cm
                saltwater: { min: 5, max: 20 },     // 5~20cm
                special: { min: 10, max: 30 }       // 10~30cm
            }
        },
        small: {
            name: '🐠 소형급',
            description: '손바닥 크기',
            sizeRange: [0.15, 0.35],
            priceMultiplier: 0.8,
            sizeByType: {
                freshwater: { min: 10, max: 30 },   // 10~30cm
                saltwater: { min: 15, max: 40 },    // 15~40cm
                special: { min: 20, max: 50 }       // 20~50cm
            }
        },
        medium: {
            name: '🐡 일반급',
            description: '적당한 크기',
            sizeRange: [0.35, 0.55],
            priceMultiplier: 1.0,
            sizeByType: {
                freshwater: { min: 25, max: 50 },   // 25~50cm
                saltwater: { min: 35, max: 70 },    // 35~70cm
                special: { min: 40, max: 100 }      // 40~100cm
            }
        },
        large: {
            name: '🦈 대형급',
            description: '꽤 큰 녀석',
            sizeRange: [0.55, 0.75],
            priceMultiplier: 1.5,
            sizeByType: {
                freshwater: { min: 45, max: 80 },   // 45~80cm
                saltwater: { min: 60, max: 120 },   // 60~120cm
                special: { min: 80, max: 200 }      // 80~200cm
            }
        },
        huge: {
            name: '🐋 거물급',
            description: '어마어마한 크기',
            sizeRange: [0.75, 0.9],
            priceMultiplier: 3.0,
            sizeByType: {
                freshwater: { min: 70, max: 120 },  // 70~120cm
                saltwater: { min: 100, max: 250 },  // 100~250cm
                special: { min: 150, max: 400 }     // 150~400cm
            }
        },
        giant: {
            name: '🦕 거인급',
            description: '믿기 힘든 크기',
            sizeRange: [0.9, 0.98],
            priceMultiplier: 5.0,
            sizeByType: {
                freshwater: { min: 100, max: 200 }, // 100~200cm
                saltwater: { min: 200, max: 500 },  // 200~500cm
                special: { min: 300, max: 800 }     // 300~800cm
            }
        },
        mythic: {
            name: '🌟 전설급',
            description: '역대 최고 기록',
            sizeRange: [0.98, 1.0],
            priceMultiplier: 10.0,
            sizeByType: {
                freshwater: { min: 150, max: 300 }, // 150~300cm
                saltwater: { min: 400, max: 1000 }, // 400~1000cm
                special: { min: 600, max: 2000 }    // 600~2000cm
            }
        }
    },

    // 낚시터 설정
    fishingSpots: {
        pond: {
            id: 'pond',
            name: '🏞️ 마을 연못',
            description: '평화로운 마을의 작은 연못',
            requiredLevel: 1,
            fishTypes: 'freshwater',
            rarityBonus: {
                common: 1.2,
                uncommon: 0.9,
                rare: 0.7
            },
            sizeModifier: 0.7,
            specialFish: ['금붕어', '비단잉어']
        },
        river: {
            id: 'river',
            name: '🌊 맑은 강',
            description: '물살이 센 깨끗한 강',
            requiredLevel: 10,
            fishTypes: 'freshwater',
            rarityBonus: {
                uncommon: 1.1,
                rare: 1.0
            },
            sizeModifier: 0.9,
            specialFish: ['무지개송어', '산천어', '쏘가리']
        },
        lake: {
            id: 'lake',
            name: '🏔️ 호수',
            description: '깊고 넓은 호수',
            requiredLevel: 20,
            fishTypes: 'freshwater',
            rarityBonus: {
                rare: 1.2,
                epic: 1.1
            },
            sizeModifier: 1.2,
            specialFish: ['가물치', '대형배스', '철갑상어']
        },
        coast: {
            id: 'coast',
            name: '🏖️ 해안가',
            description: '파도가 치는 해변',
            requiredLevel: 30,
            fishTypes: 'saltwater',
            rarityBonus: {
                uncommon: 1.1,
                rare: 1.1,
                epic: 1.0
            },
            sizeModifier: 1.0,
            specialFish: ['넙치', '농어', '돔']
        },
        deepsea: {
            id: 'deepsea',
            name: '🌑 심해',
            description: '빛이 닿지 않는 깊은 바다',
            requiredLevel: 50,
            fishTypes: 'saltwater',
            rarityBonus: {
                epic: 1.3,
                legendary: 1.5
            },
            sizeModifier: 1.5,
            specialFish: ['참치', '상어', '대왕오징어']
        },
        abyss: {
            id: 'abyss',
            name: '🌌 심연',
            description: '미지의 심해 구역',
            requiredLevel: 70,
            fishTypes: 'saltwater',
            rarityBonus: {
                legendary: 2.0,
                mythic: 3.0
            },
            sizeModifier: 2.0,
            specialFish: ['크라켄', '레비아탄', '포세이돈의사자']
        },
        void: {
            id: 'void',
            name: '🕳️ 공허의 바다',
            description: '차원의 틈새에 있는 바다',
            requiredLevel: 100,
            fishTypes: 'special',
            rarityBonus: {
                legendary: 3.0,
                mythic: 5.0
            },
            sizeModifier: 3.0,
            specialFish: ['시공어', '차원어', '무한어', '영겁어']
        },
        dragon_ocean: {
            id: 'dragon_ocean',
            name: '🐲 용의 바다',
            description: '고대 용들이 지배하는 신비한 바다',
            requiredLevel: 130,
            fishTypes: 'saltwater',
            rarityBonus: {
                epic: 1.5,
                legendary: 3.5,
                mythic: 6.0
            },
            sizeModifier: 3.5,
            specialFish: ['용왕어', '드래곤피시', '화룡어', '빙룡어']
        },
        celestial_lake: {
            id: 'celestial_lake',
            name: '🌟 천상의 호수',
            description: '별빛이 내리는 하늘의 호수',
            requiredLevel: 180,
            fishTypes: 'freshwater',
            rarityBonus: {
                legendary: 4.0,
                mythic: 8.0
            },
            sizeModifier: 4.0,
            specialFish: ['별빛송어', '은하잉어', '천사어', '신성어']
        },
        eternal_depths: {
            id: 'eternal_depths',
            name: '♾️ 영원의 심해',
            description: '시간이 멈춘 최심부 바다',
            requiredLevel: 250,
            fishTypes: 'special',
            rarityBonus: {
                legendary: 5.0,
                mythic: 10.0
            },
            sizeModifier: 5.0,
            specialFish: ['영원어', '불멸어', '태초어', '종말어', '윤회어']
        }
    },

    // 특수 물고기 (특별 낚시터 전용)
    specialFishTypes: [
        // 기존 공허의 바다 물고기
        '시공어', '차원어', '무한어', '영겁어', '혼돈어',
        '질서어', '창조어', '파멸어', '윤회어', '인과어',
        // 용의 바다 특수 물고기
        '용왕어', '드래곤피시', '화룡어', '빙룡어', '암룡어',
        // 천상의 호수 특수 물고기
        '별빛송어', '은하잉어', '천사어', '신성어', '성좌어',
        // 영원의 심해 특수 물고기
        '영원어', '불멸어', '태초어', '종말어', '순환어'
    ],

    // 낚싯대 등급
    fishingRods: {
        wooden: {
            id: 'wooden',
            name: '🎣 나무 낚싯대',
            description: '기본 낚싯대',
            sizeBonus: 1.0,
            rarityBonus: 1.0,
            price: 0
        },
        bamboo: {
            id: 'bamboo',
            name: '🎋 대나무 낚싯대',
            description: '가볍고 유연한 낚싯대',
            sizeBonus: 1.1,
            rarityBonus: 1.05,
            price: 50000
        },
        steel: {
            id: 'steel',
            name: '⚔️ 강철 낚싯대',
            description: '튼튼한 금속 낚싯대',
            sizeBonus: 1.2,
            rarityBonus: 1.1,
            price: 200000
        },
        carbon: {
            id: 'carbon',
            name: '⚫ 카본 낚싯대',
            description: '최신 기술의 낚싯대',
            sizeBonus: 1.3,
            rarityBonus: 1.15,
            price: 500000
        },
        mithril: {
            id: 'mithril',
            name: '✨ 미스릴 낚싯대',
            description: '마법의 금속으로 만든 낚싯대',
            sizeBonus: 1.5,
            rarityBonus: 1.3,
            price: 1000000
        },
        dragon: {
            id: 'dragon',
            name: '🐲 용골 낚싯대',
            description: '용의 뼈로 만든 전설의 낚싯대',
            sizeBonus: 1.8,
            rarityBonus: 1.5,
            price: 5000000
        },
        divine: {
            id: 'divine',
            name: '🌟 신의 낚싯대',
            description: '신이 사용했다는 낚싯대',
            sizeBonus: 2.5,
            rarityBonus: 2.0,
            price: 20000000
        }
    },

    // 미끼 종류
    baits: {
        worm: {
            id: 'worm',
            name: '🪱 지렁이',
            description: '가장 기본적인 미끼',
            effect: '효과 없음',
            bonus: {},
            price: 100
        },
        shrimp: {
            id: 'shrimp',
            name: '🦐 새우',
            description: '바닷물고기가 좋아하는 미끼',
            effect: '바닷물고기 확률 +20%',
            bonus: { saltwater: 1.2 },
            price: 500
        },
        bread: {
            id: 'bread',
            name: '🍞 빵조각',
            description: '민물고기가 좋아하는 미끼',
            effect: '민물고기 확률 +20%',
            bonus: { freshwater: 1.2 },
            price: 500
        },
        lure: {
            id: 'lure',
            name: '🎣 루어',
            description: '큰 물고기를 유혹하는 미끼',
            effect: '크기 +30%',
            bonus: { size: 1.3 },
            price: 2000
        },
        glowing: {
            id: 'glowing',
            name: '✨ 발광 미끼',
            description: '희귀 물고기를 유혹하는 미끼',
            effect: '희귀도 +30%',
            bonus: { rarity: 1.3 },
            price: 5000
        },
        golden: {
            id: 'golden',
            name: '🌟 황금 미끼',
            description: '모든 확률이 증가하는 특별한 미끼',
            effect: '모든 확률 +50%',
            bonus: { all: 1.5 },
            price: 20000
        },
        legendary: {
            id: 'legendary',
            name: '💎 전설의 미끼',
            description: '엄청난 효과를 가진 미끼',
            effect: '전설/신화 확률 대폭 증가',
            bonus: { legendary: 3.0, mythic: 5.0 },
            price: 100000
        }
    },

    // 게임 설정
    settings: {
        maxInventory: 100,
        fishingCooldown: 5000,
        baitConsumption: true,
        autoSellCommon: false
    },

    // 물고기 이름 생성 함수
    generateFishName: function(rarity, fishType, size) {
        const rarityData = this.rarities[rarity];
        const adjectiveList = this.adjectives[rarity];
        
        // 긍정/부정 형용사 선택 (레어 이상은 긍정적 형용사가 더 많이 나옴)
        const usePositive = rarity === 'common' || rarity === 'uncommon' 
            ? Math.random() > 0.5 
            : Math.random() > 0.2;
        
        const adjectives = usePositive ? adjectiveList.positive : adjectiveList.negative;
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        
        // 특수 접두사 확률 체크
        let prefix = '';
        for (const [tier, data] of Object.entries(this.specialPrefixes)) {
            if (Math.random() < data.chance) {
                prefix = data.prefixes[Math.floor(Math.random() * data.prefixes.length)] + ' ';
                break;
            }
        }
        
        // 크기 접미사 (거물급 이상)
        let sizeSuffix = '';
        if (size === 'huge') sizeSuffix = ' (대물)';
        else if (size === 'giant') sizeSuffix = ' (초대물)';
        else if (size === 'mythic') sizeSuffix = ' (전설급)';
        
        return `${prefix}${adjective} ${fishType}${sizeSuffix}`;
    }
};

// 물고기 리스트 예시
const FISH_NAME_EXAMPLES = [
    // 일반 등급
    "평범한 붕어",
    "못생긴 메기",
    "작은 피라미",
    "튀김용 작은 고등어",
    
    // 고급 등급
    "예쁜 무지개송어",
    "싱싱한 광어",
    "회뜨기좋은 윤기나는 도미",
    
    // 레어 등급
    "아름다운 열목어",
    "빛나는 은어",
    "왕의 화려한 잉어",
    
    // 에픽 등급
    "장엄한 참치 (대물)",
    "눈부신 황금잉어",
    "고대의 위대한 철갑상어",
    
    // 레전드리 등급
    "전설의 대왕오징어 (초대물)",
    "불멸의 상어",
    "용왕의 신성한 용궁어",
    
    // 신화 등급
    "창조의 시공어 (전설급)",
    "태초의 레비아탄",
    "신이내린 우주의 차원어"
];

// 시스템 상태 관리
let fishingState = {
    currentMerchant: null,
    merchantArrivalTime: null,
    merchantLeaveTime: null,
    nextMerchantTime: null,
    currentPrices: new Map(),
    sizeRecords: new Map(), // 물고기별 최고 기록
    globalRecords: new Map() // 전체 최고 기록
};

module.exports = { FISHING_SYSTEM, FISH_NAME_EXAMPLES, fishingState };