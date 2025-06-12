// 🏺 유물탐사 & 항아리 시스템
const ARTIFACT_SYSTEM = {
    // 유물탐사회사들
    companies: {
        desert_explorers: {
            id: 'desert_explorers',
            name: '사막 탐험대',
            emoji: '🏜️',
            basePrice: 800,
            description: '고대 사막 유적을 전문으로 탐사하는 회사',
            specialty: 'desert',
            successRate: 0.35,
            region: '🏜️ 사하라 사막'
        },
        ocean_hunters: {
            id: 'ocean_hunters',
            name: '심해 보물단',
            emoji: '🌊',
            basePrice: 1200,
            description: '침몰한 해적선과 고대 도시를 찾는 전문가들',
            specialty: 'ocean',
            successRate: 0.25,
            region: '🌊 태평양 심해'
        },
        mountain_seekers: {
            id: 'mountain_seekers',
            name: '설산 유적단',
            emoji: '⛰️',
            basePrice: 1000,
            description: '험준한 산맥의 숨겨진 보물을 찾는 모험가들',
            specialty: 'mountain',
            successRate: 0.30,
            region: '⛰️ 히말라야 산맥'
        },
        jungle_raiders: {
            id: 'jungle_raiders',
            name: '정글 탐사대',
            emoji: '🌴',
            basePrice: 900,
            description: '아마존 깊숙한 곳의 고대 문명 유적 전문',
            specialty: 'jungle',
            successRate: 0.40,
            region: '🌴 아마존 정글'
        },
        space_archaeologists: {
            id: 'space_archaeologists',
            name: '우주 고고학회',
            emoji: '🚀',
            basePrice: 2000,
            description: '외계 문명의 흔적을 찾는 최첨단 탐사팀',
            specialty: 'space',
            successRate: 0.15,
            region: '🚀 화성 기지'
        }
    },

    // 유물 등급별 데이터
    artifacts: {
        // 일반 유물 (70% 확률)
        common: [
            { name: '고대 동전', value: [100, 300], emoji: '🪙', description: '녹슨 고대 동전. 골동품 수집가들이 좋아한다.' },
            { name: '토기 조각', value: [80, 250], emoji: '🏺', description: '부서진 토기의 일부. 고고학적 가치가 있다.' },
            { name: '돌 조각상', value: [150, 400], emoji: '🗿', description: '작은 석상. 고대 신을 형상화한 듯하다.' },
            { name: '청동 팔찌', value: [200, 500], emoji: '💫', description: '고대 청동으로 만든 장신구.' },
            { name: '화석 조개', value: [120, 350], emoji: '🐚', description: '수백만 년 전의 조개 화석.' }
        ],
        
        // 고급 유물 (20% 확률)
        rare: [
            { name: '황금 목걸이', value: [800, 1500], emoji: '💎', description: '순금으로 제작된 고대 목걸이. 눈부시게 빛난다.' },
            { name: '보석 단검', value: [1000, 2000], emoji: '🗡️', description: '보석이 박힌 의식용 단검. 날카롭고 아름답다.' },
            { name: '고대 두루마리', value: [600, 1200], emoji: '📜', description: '고대 문자로 쓰인 신비한 두루마리.' },
            { name: '수정 구슬', value: [900, 1800], emoji: '🔮', description: '마법의 힘이 깃든 투명한 수정구.' },
            { name: '은 잔', value: [700, 1300], emoji: '🏆', description: '왕족이 사용했던 것으로 추정되는 은잔.' }
        ],
        
        // 에픽 유물 (8% 확률)
        epic: [
            { name: '왕관의 조각', value: [3000, 5000], emoji: '👑', description: '전설의 왕이 착용했던 황금 왕관의 일부.' },
            { name: '용의 비늘', value: [4000, 6000], emoji: '🐉', description: '고대 용족의 비늘. 마법적 기운이 느껴진다.' },
            { name: '신의 성물', value: [3500, 5500], emoji: '✨', description: '신에게 바쳐진 성스러운 제단의 일부.' },
            { name: '시간의 모래시계', value: [5000, 7000], emoji: '⏳', description: '시간을 조작할 수 있다는 전설의 모래시계.' },
            { name: '불멸의 약초', value: [4500, 6500], emoji: '🌿', description: '영생을 약속하는 신비한 약초. 아직도 생생하다.' }
        ],
        
        // 레전드리 유물 (2% 확률)
        legendary: [
            { name: '창조의 서판', value: [15000, 25000], emoji: '📋', description: '세상을 창조한 신의 설계도가 새겨진 금속판.' },
            { name: '무한의 보석', value: [20000, 30000], emoji: '💎', description: '우주의 힘이 응축된 전설의 보석. 무지개빛으로 빛난다.' },
            { name: '시공간 열쇠', value: [18000, 28000], emoji: '🗝️', description: '차원을 여는 열쇠. 다른 세계로의 문을 열 수 있다.' },
            { name: '생명의 나무 가지', value: [22000, 32000], emoji: '🌳', description: '모든 생명의 근원인 세계수의 가지.' },
            { name: '별의 눈물', value: [25000, 35000], emoji: '⭐', description: '죽어가는 별이 흘린 눈물이 굳어서 만들어진 보석.' }
        ]
    },

    // 탐사 지역별 특화 유물
    specialArtifacts: {
        desert: [
            { name: '파라오의 황금 마스크', value: [10000, 15000], emoji: '👺', rarity: 'legendary' },
            { name: '미라의 붕대', value: [2000, 3000], emoji: '🏺', rarity: 'epic' }
        ],
        ocean: [
            { name: '해적왕의 보물상자', value: [12000, 18000], emoji: '💰', rarity: 'legendary' },
            { name: '인어의 진주', value: [3000, 4000], emoji: '🦪', rarity: 'epic' }
        ],
        mountain: [
            { name: '설인의 발자국 화석', value: [8000, 12000], emoji: '👣', rarity: 'legendary' },
            { name: '얼음 수정', value: [2500, 3500], emoji: '❄️', rarity: 'epic' }
        ],
        jungle: [
            { name: '잃어버린 도시의 열쇠', value: [11000, 16000], emoji: '🗝️', rarity: 'legendary' },
            { name: '아즈텍 황금 조각상', value: [2800, 3800], emoji: '🗿', rarity: 'epic' }
        ],
        space: [
            { name: '외계 문명의 데이터 코어', value: [30000, 50000], emoji: '🛸', rarity: 'legendary' },
            { name: '운석 조각', value: [5000, 7000], emoji: '☄️', rarity: 'epic' }
        ]
    },

    // 실패 시 나오는 꽝 아이템들
    failures: [
        { name: '깨진 항아리 조각', description: '별 가치 없는 항아리 조각이다...', emoji: '💔' },
        { name: '평범한 돌멩이', description: '그냥 돌멩이였다. 실망...', emoji: '🪨' },
        { name: '녹슨 못', description: '오래된 못이다. 파상풍에 조심하자.', emoji: '🔩' },
        { name: '빈 유리병', description: '안에 모래만 가득한 병이다.', emoji: '🍶' },
        { name: '찢어진 천조각', description: '너무 오래되어 부스러지는 천이다.', emoji: '🧽' }
    ],

    // 탐사 비용 (지역별)
    explorationCosts: {
        desert: { min: 500, max: 2000 },
        ocean: { min: 1000, max: 3000 },
        mountain: { min: 800, max: 2500 },
        jungle: { min: 600, max: 2200 },
        space: { min: 2000, max: 5000 }
    },

    // 스토리 텍스트
    stories: {
        success: {
            common: [
                "🔍 얕은 모래 속에서 무언가 반짝이는 것을 발견했습니다!",
                "⛏️ 조심스럽게 흙을 파내자 유물이 모습을 드러냅니다!",
                "🌟 운이 좋네요! 가치 있는 유물을 찾았습니다!",
                "📿 고대인들이 남긴 소중한 유산을 발견했습니다!"
            ],
            rare: [
                "✨ 놀랍게도 빛나는 보물이 당신을 기다리고 있었습니다!",
                "💎 이것은... 정말 귀중한 유물입니다! 대발견이에요!",
                "🏆 전문가들도 놀랄 만한 희귀 유물을 발견했습니다!",
                "⚡ 마법적인 기운이 느껴지는 신비로운 유물입니다!"
            ],
            epic: [
                "🌈 전설에서나 들었던 유물이 실제로 존재했습니다!",
                "👑 역사책에 기록될 만한 엄청난 발견입니다!",
                "🔥 이 유물은 박물관에서도 보기 힘든 귀중한 것입니다!",
                "💫 고대 문명의 최고 걸작을 발견했습니다!"
            ],
            legendary: [
                "🌟✨ 신화 속에서만 존재한다던 전설의 유물입니다! ✨🌟",
                "👑💎 세상을 뒤흔들 역사적 대발견입니다! 💎👑",
                "🔥⚡ 신들이 남긴 성물을 발견했습니다! ⚡🔥",
                "🌈🎆 이 발견으로 당신은 역사에 이름을 남길 것입니다! 🎆🌈"
            ]
        },
        failure: [
            "😞 아쉽게도 이번엔 별다른 것을 찾지 못했습니다...",
            "💸 투자한 만큼의 가치를 찾지 못했습니다. 다음엔 더 운이 좋기를!",
            "⛈️ 갑작스러운 폭풍으로 탐사를 중단해야 했습니다.",
            "🕳️ 예상했던 곳은 이미 다른 탐사대가 먼저 다녀간 후였습니다.",
            "🐍 위험한 동물들 때문에 안전상 탐사를 포기해야 했습니다.",
            "📉 이번 투자는 실패했습니다. 유물 탐사는 언제나 위험이 따르죠...",
            "🌪️ 모래폭풍으로 인해 장비를 잃고 빈손으로 돌아왔습니다.",
            "💔 기대했던 유적은 이미 약탈당한 후였습니다."
        ]
    },

    // 회사별 특별 이벤트
    companyEvents: [
        {
            company: 'desert_explorers',
            event: '파라오의 무덤 발견!',
            effect: { priceChange: 15, successBonus: 0.1 },
            duration: 24 * 60 * 60 * 1000 // 24시간
        },
        {
            company: 'ocean_hunters',
            event: '타이타닉급 침몰선 발견!',
            effect: { priceChange: 20, successBonus: 0.15 },
            duration: 24 * 60 * 60 * 1000
        },
        {
            company: 'space_archaeologists',
            event: '외계 신호 수신!',
            effect: { priceChange: 25, successBonus: 0.2 },
            duration: 24 * 60 * 60 * 1000
        }
    ]
};

module.exports = ARTIFACT_SYSTEM;