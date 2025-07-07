// 유물 탐사 시스템 데이터
const artifactExploration = {
    // 탐사 회사 정보 (15개 회사)
    companies: [
        { id: 'ARC', name: '아크 탐사단', basePrice: 1000, specialty: 'ancient', multiplier: 1.2 },
        { id: 'TRH', name: '트레저 헌터스', basePrice: 1500, specialty: 'treasure', multiplier: 1.15 },
        { id: 'EXP', name: '익스플로러 길드', basePrice: 2000, specialty: 'rare', multiplier: 1.25 },
        { id: 'DIG', name: '딥 디거스', basePrice: 1200, specialty: 'deep', multiplier: 1.18 },
        { id: 'RLC', name: '렐릭 컴퍼니', basePrice: 1800, specialty: 'relic', multiplier: 1.22 },
        { id: 'ART', name: '아티팩트 코퍼레이션', basePrice: 2500, specialty: 'artifact', multiplier: 1.3 },
        { id: 'GLD', name: '골든 픽', basePrice: 3000, specialty: 'gold', multiplier: 1.35 },
        { id: 'ANT', name: '앤티크 마스터즈', basePrice: 1700, specialty: 'antique', multiplier: 1.2 },
        { id: 'CRY', name: '크리스탈 시커스', basePrice: 2200, specialty: 'crystal', multiplier: 1.28 },
        { id: 'MYS', name: '미스틱 파인더스', basePrice: 2800, specialty: 'mystic', multiplier: 1.32 },
        { id: 'LEG', name: '레전드 헌터스', basePrice: 3500, specialty: 'legendary', multiplier: 1.4 },
        { id: 'FOR', name: '포춘 디거스', basePrice: 1600, specialty: 'fortune', multiplier: 1.19 },
        { id: 'SCH', name: '스칼라 익스카베이터', basePrice: 2100, specialty: 'scholar', multiplier: 1.24 },
        { id: 'VAL', name: '밸류 마이너스', basePrice: 1900, specialty: 'valuable', multiplier: 1.21 },
        { id: 'HIS', name: '히스토리 시커스', basePrice: 2400, specialty: 'historical', multiplier: 1.26 }
    ],

    // 곡괭이 시스템
    pickaxes: {
        bronze: {
            name: '동 곡괭이',
            baseEfficiency: 1,
            maxLevel: 100,
            upgradeCost: (level) => Math.floor(100 * Math.pow(1.15, level)),
            findChance: (level) => 0.1 + (level * 0.002), // 10% ~ 30%
            qualityBonus: (level) => 1 + (level * 0.01) // 1x ~ 2x
        },
        silver: {
            name: '은 곡괭이',
            baseEfficiency: 2,
            maxLevel: 100,
            upgradeCost: (level) => Math.floor(500 * Math.pow(1.18, level)),
            findChance: (level) => 0.15 + (level * 0.003), // 15% ~ 45%
            qualityBonus: (level) => 1.5 + (level * 0.015) // 1.5x ~ 3x
        },
        gold: {
            name: '금 곡괭이',
            baseEfficiency: 3,
            maxLevel: 100,
            upgradeCost: (level) => Math.floor(2000 * Math.pow(1.2, level)),
            findChance: (level) => 0.2 + (level * 0.004), // 20% ~ 60%
            qualityBonus: (level) => 2 + (level * 0.02) // 2x ~ 4x
        }
    },

    // 유물 등급 시스템
    rarities: {
        common: {
            name: '일반',
            color: '#808080',
            basePrice: 500,        // 100 → 500
            findWeight: 50,
            priceMultiplier: 1
        },
        uncommon: {
            name: '고급',
            color: '#00FF00',
            basePrice: 2500,       // 500 → 2,500
            findWeight: 30,
            priceMultiplier: 1.5
        },
        rare: {
            name: '희귀',
            color: '#0080FF',
            basePrice: 10000,      // 2,000 → 10,000
            findWeight: 15,
            priceMultiplier: 2
        },
        epic: {
            name: '영웅',
            color: '#800080',
            basePrice: 50000,      // 10,000 → 50,000
            findWeight: 4,
            priceMultiplier: 3
        },
        legendary: {
            name: '전설',
            color: '#FFA500',
            basePrice: 250000,     // 50,000 → 250,000
            findWeight: 0.9,
            priceMultiplier: 5
        },
        mythic: {
            name: '신화',
            color: '#FF0000',
            basePrice: 1000000,    // 200,000 → 1,000,000
            findWeight: 0.1,
            priceMultiplier: 10
        }
    },

    // 형용사 시스템
    adjectives: {
        common: ['낡은', '오래된', '먼지 쌓인', '녹슨', '작은', '부서진', '변색된', '흠집난', '희미한', '더러운'],
        uncommon: ['빛나는', '매끄러운', '보존된', '무거운', '독특한', '아름다운', '정교한', '견고한', '순수한', '깨끗한'],
        rare: ['빛을 발하는', '완벽한', '희귀한', '진귀한', '특별한', '환상적인', '놀라운', '뛰어난', '우아한', '신비로운'],
        epic: ['찬란한', '전설적인', '위대한', '경이로운', '황홀한', '장엄한', '영광스러운', '초월적인', '불멸의', '신성한'],
        legendary: ['태고의', '신화적인', '우주의', '창조의', '운명의', '영원한', '절대적인', '궁극의', '천상의', '신들의'],
        mythic: ['창세기의', '차원을 넘는', '시공을 초월한', '만물의 근원인', '존재 자체인', '우주를 품은', '신을 능가하는', '무한한', '절대 불멸의', '모든 것의 시작인']
    },

    // 접두사 시스템
    prefixes: {
        common: ['고대', '중세', '동방', '서방', '북방', '남방', '해양', '대륙', '섬나라', '산악'],
        uncommon: ['왕실', '귀족', '기사단', '마법사', '현자', '전사', '사제', '연금술사', '탐험가', '수호자'],
        rare: ['드래곤', '피닉스', '유니콘', '그리핀', '히드라', '키메라', '바실리스크', '켄타우로스', '미노타우로스', '스핑크스'],
        epic: ['천계', '마계', '정령계', '용족', '신족', '악마족', '천사족', '거인족', '고대신', '원소왕'],
        legendary: ['창조신', '파괴신', '시간신', '공간신', '운명신', '죽음신', '생명신', '전쟁신', '지혜신', '태양신'],
        mythic: ['원초', '근원', '알파', '오메가', '무한', '영원', '절대', '초월', '만물', '우주']
    },

    // 아이템 목록 (등급별 50개)
    items: {
        common: [
            '동전', '단추', '열쇠', '반지', '목걸이', '팔찌', '브로치', '귀걸이', '빗', '거울',
            '잔', '접시', '숟가락', '포크', '나이프', '촛대', '향로', '종', '나팔', '북',
            '깃털펜', '잉크병', '편지', '인장', '두루마리', '책', '지도', '나침반', '망원경', '시계',
            '단검', '화살촉', '투구조각', '갑옷조각', '방패조각', '창날', '검자루', '활시위', '화살통', '갑옷단추',
            '도자기조각', '타일', '벽돌', '기와', '못', '경첩', '자물쇠', '열쇠고리', '문고리', '손잡이'
        ],
        uncommon: [
            '보석함', '향수병', '화장거울', '빗장식', '브로치세트', '목걸이세트', '반지세트', '팔찌세트', '왕관장식', '홀장식',
            '은잔', '금잔', '수정잔', '옥잔', '진주잔', '보석잔', '성배', '제기', '향단지', '봉헌함',
            '마법서', '주문서', '봉인서', '계약서', '예언서', '연대기', '비전서', '금서', '현자의서', '마도서',
            '명검', '마검', '성검', '룬소드', '크리스탈소드', '미스릴검', '아다만트검', '드래곤슬레이어', '데몬슬레이어', '소울이터',
            '수정구', '마법구', '예언구', '점술도구', '타로카드', '룬스톤', '마나석', '정령석', '원소석', '현자의돌'
        ],
        rare: [
            '왕관', '티아라', '왕홀', '옥새', '왕좌장식', '왕실문장', '황금홀', '제왕의반지', '여왕의목걸이', '왕자의브로치',
            '드래곤의비늘', '피닉스의깃털', '유니콘의뿔', '그리핀의발톱', '히드라의독니', '키메라의심장', '바실리스크의눈', '켄타우로스의화살', '미노타우로스의도끼', '스핑크스의수수께끼',
            '엘릭서', '만병통치약', '불로초', '생명수', '부활의물약', '힘의물약', '지혜의물약', '속도의물약', '투명물약', '변신물약',
            '시공의열쇠', '차원의문', '공간이동석', '시간정지구', '운명의실', '인과의사슬', '평행우주구', '왜곡의거울', '절대의방패', '무한의검',
            '별자리석', '혜성의조각', '운석', '달의조각', '태양의조각', '행성의핵', '은하의먼지', '블랙홀의파편', '초신성의잔재', '우주의종자'
        ],
        epic: [
            '신의왕관', '천사의날개', '악마의뿔', '거인의심장', '용왕의보주', '불사조의알', '세계수의잎', '운명의수레바퀴', '시간의모래시계', '영혼의저울',
            '창조의해머', '파괴의낫', '균형의저울', '심판의검', '자비의지팡이', '지혜의두루마리', '용기의방패', '희망의등불', '신앙의십자가', '사랑의하프',
            '아카샤기록', '운명의서', '예언의석판', '창세기', '묵시록', '영생의책', '죽음의책', '부활의책', '윤회의책', '인과의책',
            '엑스칼리버', '묠니르', '궁니르', '듀란달', '그람', '티르빙', '발뭉', '레바테인', '호프눙', '다인슬라이프',
            '성배', '판도라의상자', '아르크', '황금양털', '불사의사과', '미다스의손', '필로소퍼스톤', '오딘의눈', '토르의벨트', '프레이야의목걸이'
        ],
        legendary: [
            '창조신의왕관', '파괴신의가면', '시간신의시계', '공간신의구', '운명신의실', '죽음신의낫', '생명신의씨앗', '전쟁신의검', '지혜신의서', '태양신의원반',
            '우주의알', '카오스의핵', '질서의기둥', '빅뱅의잔재', '엔트로피의결정', '다크매터', '다크에너지', '반물질', '특이점', '사건의지평선',
            '아카식레코드원본', '운명의룬', '창조의설계도', '멸망의예언서', '윤회의수레', '인과율조작기', '시공간조작기', '차원이동기', '평행우주열쇠', '절대영역',
            '신살의검', '창조의망치', '파멸의창', '절대방어구', '전지전능의눈', '무한의보석', '영원의불꽃', '시초의물', '종말의가루', '중립의저울',
            '우로보로스', '이그드라실', '아틀라스의구', '프로메테우스의불', '판도라의희망', '이카루스의날개', '시지프스의바위', '탄탈로스의잔', '미다스의왕좌', '다모클레스의검'
        ],
        mythic: [
            '만물의근원', '존재의시작', '무의종말', '알파와오메가', '태초의빛', '최후의어둠', '영원의순환', '무한의나선', '절대의점', '초월의문',
            '신을만든자의유물', '우주를낳은어머니의품', '시공을짜는자의베틀', '운명을쓰는자의펜', '죽음을거두는자의낫', '생명을뿌리는자의씨앗', '모든것을아는자의눈', '모든것을할수있는자의손', '모든곳에있는자의발', '영원히사는자의심장',
            '창세의노래', '종말의침묵', '균형의춤', '혼돈의웃음', '질서의눈물', '빛의탄생', '어둠의죽음', '시간의강', '공간의바다', '차원의나무',
            '첫번째별', '마지막달', '중심의태양', '가장자리의혜성', '안쪽의행성', '바깥쪽의은하', '위의천국', '아래의지옥', '사이의연옥', '너머의공허',
            '전지의서', '전능의검', '편재의망토', '영생의잔', '불멸의갑옷', '무적의방패', '절대의왕좌', '궁극의왕관', '초월의홀', '완전의반지'
        ]
    },

    // 탐사 비용 및 보상
    exploration: {
        baseCost: 1000,
        costMultiplier: 1.5, // 레벨당 비용 증가율
        baseReward: 100,
        rewardMultiplier: 2, // 레벨당 보상 증가율
        cooldown: 60000, // 1분 쿨다운
        specialEventChance: 0.05, // 5% 특별 이벤트 확률
        doubleRewardChance: 0.1, // 10% 더블 보상 확률
        companyBonusChance: 0.15 // 15% 회사 보너스 확률
    },

    // 특별 이벤트
    specialEvents: {
        treasureRoom: {
            name: '보물방 발견',
            description: '숨겨진 보물방을 발견했습니다!',
            rewardMultiplier: 3
        },
        ancientTomb: {
            name: '고대 무덤 발견',
            description: '봉인된 고대 무덤을 발견했습니다!',
            rarityBonus: 2 // 등급 2단계 상승
        },
        dragonHoard: {
            name: '용의 보물창고',
            description: '전설의 용이 모아둔 보물창고를 발견했습니다!',
            guaranteedRarity: 'epic' // 최소 에픽 등급 보장
        },
        divineBlessing: {
            name: '신의 축복',
            description: '탐사의 신이 당신을 축복합니다!',
            multiFind: 5 // 5개 동시 발견
        }
    },

    // 업적 시스템
    achievements: {
        firstFind: { name: '첫 발견', description: '첫 유물을 발견하세요', reward: 1000 },
        collector10: { name: '수집가', description: '10개의 유물을 수집하세요', reward: 5000 },
        collector100: { name: '대수집가', description: '100개의 유물을 수집하세요', reward: 50000 },
        rareFinder: { name: '희귀품 수집가', description: '희귀 등급 이상의 유물을 발견하세요', reward: 10000 },
        epicFinder: { name: '영웅의 발견', description: '영웅 등급 이상의 유물을 발견하세요', reward: 50000 },
        legendaryFinder: { name: '전설의 탐사가', description: '전설 등급 이상의 유물을 발견하세요', reward: 200000 },
        mythicFinder: { name: '신화를 쓰는 자', description: '신화 등급의 유물을 발견하세요', reward: 1000000 },
        millionaire: { name: '백만장자', description: '유물 판매로 100만 골드를 벌어보세요', reward: 100000 },
        companyMaster: { name: '회사 마스터', description: '모든 탐사 회사와 거래해보세요', reward: 150000 },
        pickaxeMaster: { name: '곡괭이 마스터', description: '곡괭이를 최고 레벨까지 강화하세요', reward: 300000 }
    },

    // 유틸리티 함수들
    generateArtifactName(rarity, item) {
        const adjective = this.adjectives[rarity][Math.floor(Math.random() * this.adjectives[rarity].length)];
        const prefix = this.prefixes[rarity][Math.floor(Math.random() * this.prefixes[rarity].length)];
        return `${adjective} ${prefix} ${item}`;
    },

    calculateFindChance(pickaxeType, pickaxeLevel, companyBonus = 1) {
        const pickaxe = this.pickaxes[pickaxeType];
        const baseChance = pickaxe.findChance(pickaxeLevel);
        return Math.min(baseChance * companyBonus, 0.95); // 최대 95%
    },

    calculateRarity(pickaxeType, pickaxeLevel, companySpecialty) {
        const weights = { ...this.rarities };
        const qualityBonus = this.pickaxes[pickaxeType].qualityBonus(pickaxeLevel);
        
        // 품질 보너스 적용
        Object.keys(weights).forEach(rarity => {
            weights[rarity].findWeight *= qualityBonus;
        });

        // 회사 특성 보너스
        if (companySpecialty === 'legendary') {
            weights.legendary.findWeight *= 2;
            weights.mythic.findWeight *= 1.5;
        }

        return this.weightedRandom(weights);
    },

    weightedRandom(weights) {
        const entries = Object.entries(weights);
        const totalWeight = entries.reduce((sum, [_, data]) => sum + data.findWeight, 0);
        let random = Math.random() * totalWeight;
        
        for (const [key, data] of entries) {
            random -= data.findWeight;
            if (random <= 0) return key;
        }
        
        return 'common';
    },

    calculateArtifactPrice(rarity, companyMultiplier, stockPrice) {
        const basePrice = this.rarities[rarity].basePrice;
        const rarityMultiplier = this.rarities[rarity].priceMultiplier;
        const stockMultiplier = stockPrice / 1000; // 주식 가격을 1000으로 나눈 값을 배수로 사용
        
        return Math.floor(basePrice * rarityMultiplier * companyMultiplier * stockMultiplier);
    }
};

module.exports = artifactExploration;