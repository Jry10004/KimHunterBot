// 🎣 확장된 낚시 시스템 데이터 (50종)
const FISHING_SYSTEM = {
    // 물고기 기본 종류 (50종) - 크기와 가격 정보 포함
    fishTypes: {
        // 민물고기 (25종)
        freshwater: {
            '붕어': { minSize: 10, maxSize: 35, megaSize: 50, basePrice: 3000 },
            '잉어': { minSize: 30, maxSize: 80, megaSize: 120, basePrice: 5000 },
            '송어': { minSize: 20, maxSize: 50, megaSize: 70, basePrice: 8000 },
            '메기': { minSize: 20, maxSize: 60, megaSize: 100, basePrice: 6000 },
            '가물치': { minSize: 40, maxSize: 100, megaSize: 150, basePrice: 12000 },
            '빙어': { minSize: 5, maxSize: 12, megaSize: 15, basePrice: 2000 },
            '은어': { minSize: 10, maxSize: 25, megaSize: 30, basePrice: 4000 },
            '피라미': { minSize: 5, maxSize: 15, megaSize: 20, basePrice: 1500 },
            '누치': { minSize: 15, maxSize: 40, megaSize: 60, basePrice: 3500 },
            '쏘가리': { minSize: 15, maxSize: 35, megaSize: 50, basePrice: 7000 },
            '배스': { minSize: 20, maxSize: 50, megaSize: 70, basePrice: 9000 },
            '블루길': { minSize: 10, maxSize: 25, megaSize: 35, basePrice: 2500 },
            '향어': { minSize: 30, maxSize: 70, megaSize: 100, basePrice: 6500 },
            '틸라피아': { minSize: 15, maxSize: 35, megaSize: 45, basePrice: 4500 },
            '무지개송어': { minSize: 25, maxSize: 60, megaSize: 80, basePrice: 10000 },
            '산천어': { minSize: 15, maxSize: 30, megaSize: 40, basePrice: 8500 },
            '열목어': { minSize: 20, maxSize: 40, megaSize: 55, basePrice: 9500 },
            '버들치': { minSize: 5, maxSize: 10, megaSize: 15, basePrice: 1000 },
            '갈겨니': { minSize: 8, maxSize: 18, megaSize: 25, basePrice: 1800 },
            '돌고기': { minSize: 10, maxSize: 20, megaSize: 30, basePrice: 2200 },
            '미꾸리': { minSize: 8, maxSize: 20, megaSize: 25, basePrice: 2800 },
            '뱀장어': { minSize: 40, maxSize: 100, megaSize: 150, basePrice: 15000 },
            '동자개': { minSize: 10, maxSize: 25, megaSize: 35, basePrice: 3200 },
            '퉁가리': { minSize: 12, maxSize: 28, megaSize: 40, basePrice: 3800 },
            '꺽지': { minSize: 10, maxSize: 22, megaSize: 30, basePrice: 4200 }
        },
        // 바닷물고기 (25종)
        saltwater: {
            '고등어': { minSize: 20, maxSize: 40, megaSize: 50, basePrice: 5000 },
            '갈치': { minSize: 60, maxSize: 120, megaSize: 150, basePrice: 8000 },
            '조기': { minSize: 15, maxSize: 35, megaSize: 45, basePrice: 6000 },
            '민어': { minSize: 30, maxSize: 80, megaSize: 120, basePrice: 12000 },
            '농어': { minSize: 40, maxSize: 90, megaSize: 130, basePrice: 14000 },
            '우럭': { minSize: 20, maxSize: 40, megaSize: 55, basePrice: 7000 },
            '광어': { minSize: 30, maxSize: 80, megaSize: 100, basePrice: 11000 },
            '도다리': { minSize: 20, maxSize: 40, megaSize: 50, basePrice: 9000 },
            '가자미': { minSize: 15, maxSize: 35, megaSize: 45, basePrice: 6500 },
            '넙치': { minSize: 40, maxSize: 100, megaSize: 150, basePrice: 13000 },
            '돔': { minSize: 25, maxSize: 50, megaSize: 70, basePrice: 10000 },
            '숭어': { minSize: 30, maxSize: 60, megaSize: 80, basePrice: 5500 },
            '전어': { minSize: 10, maxSize: 20, megaSize: 25, basePrice: 3500 },
            '멸치': { minSize: 3, maxSize: 10, megaSize: 15, basePrice: 1000 },
            '정어리': { minSize: 8, maxSize: 18, megaSize: 25, basePrice: 2000 },
            '삼치': { minSize: 50, maxSize: 100, megaSize: 130, basePrice: 9500 },
            '방어': { minSize: 60, maxSize: 120, megaSize: 150, basePrice: 16000 },
            '참치': { minSize: 100, maxSize: 250, megaSize: 350, basePrice: 20000 },
            '가오리': { minSize: 50, maxSize: 150, megaSize: 200, basePrice: 11000 },
            '상어': { minSize: 150, maxSize: 400, megaSize: 600, basePrice: 25000 },
            '복어': { minSize: 15, maxSize: 30, megaSize: 40, basePrice: 15000 },
            '아귀': { minSize: 40, maxSize: 100, megaSize: 150, basePrice: 13000 },
            '대구': { minSize: 40, maxSize: 90, megaSize: 120, basePrice: 8500 },
            '명태': { minSize: 30, maxSize: 60, megaSize: 80, basePrice: 7500 },
            '오징어': { minSize: 20, maxSize: 50, megaSize: 80, basePrice: 10000 }
        }
    },

    // 형용사 시스템 (등급별) - 가격 보너스와 크기 영향 포함
    adjectives: {
        common: {
            positive: {
                '평범한': { priceBonus: 500, sizeMulti: 1.0 },
                '작은': { priceBonus: -500, sizeMulti: 0.6 },
                '귀여운': { priceBonus: 1000, sizeMulti: 0.7 },
                '둥근': { priceBonus: 800, sizeMulti: 0.9 },
                '날씬한': { priceBonus: 600, sizeMulti: 0.8 },
                '통통한': { priceBonus: 700, sizeMulti: 1.2 },
                '길쭉한': { priceBonus: 400, sizeMulti: 1.1 },
                '짧은': { priceBonus: -300, sizeMulti: 0.7 },
                '가벼운': { priceBonus: -200, sizeMulti: 0.8 },
                '부드러운': { priceBonus: 900, sizeMulti: 1.0 }
            },
            negative: {
                '못생긴': { priceBonus: -1000, sizeMulti: 1.0 },
                '이상한': { priceBonus: -800, sizeMulti: 1.0 },
                '삐뚤어진': { priceBonus: -600, sizeMulti: 0.9 },
                '찌그러진': { priceBonus: -700, sizeMulti: 0.8 },
                '볼품없는': { priceBonus: -500, sizeMulti: 0.9 },
                '초라한': { priceBonus: -400, sizeMulti: 0.8 },
                '지저분한': { priceBonus: -900, sizeMulti: 1.0 },
                '누추한': { priceBonus: -300, sizeMulti: 0.9 },
                '허름한': { priceBonus: -600, sizeMulti: 0.9 },
                '남루한': { priceBonus: -700, sizeMulti: 0.8 }
            }
        },
        uncommon: {
            positive: {
                '예쁜': { priceBonus: 3000, sizeMulti: 1.0 },
                '멋진': { priceBonus: 3500, sizeMulti: 1.1 },
                '윤기나는': { priceBonus: 4000, sizeMulti: 1.0 },
                '건강한': { priceBonus: 4500, sizeMulti: 1.2 },
                '튼튼한': { priceBonus: 4000, sizeMulti: 1.3 },
                '활발한': { priceBonus: 3500, sizeMulti: 1.0 },
                '깨끗한': { priceBonus: 3800, sizeMulti: 1.0 },
                '싱싱한': { priceBonus: 5000, sizeMulti: 1.1 },
                '탱탱한': { priceBonus: 4200, sizeMulti: 1.2 },
                '매끈한': { priceBonus: 3700, sizeMulti: 1.0 }
            },
            negative: {
                '거친': { priceBonus: -2000, sizeMulti: 1.1 },
                '딱딱한': { priceBonus: -1800, sizeMulti: 1.0 },
                '거무튀튀한': { priceBonus: -2200, sizeMulti: 1.0 },
                '얼룩덜룩한': { priceBonus: -1500, sizeMulti: 1.0 },
                '울퉁불퉁한': { priceBonus: -1700, sizeMulti: 1.1 }
            }
        },
        rare: {
            positive: {
                '아름다운': { priceBonus: 8000, sizeMulti: 1.1 },
                '화려한': { priceBonus: 9000, sizeMulti: 1.0 },
                '빛나는': { priceBonus: 10000, sizeMulti: 1.0 },
                '영롱한': { priceBonus: 9500, sizeMulti: 1.0 },
                '신비로운': { priceBonus: 11000, sizeMulti: 1.1 },
                '우아한': { priceBonus: 8500, sizeMulti: 1.0 },
                '고급스러운': { priceBonus: 12000, sizeMulti: 1.1 },
                '품격있는': { priceBonus: 10500, sizeMulti: 1.2 },
                '당당한': { priceBonus: 9000, sizeMulti: 1.3 },
                '위풍당당한': { priceBonus: 11500, sizeMulti: 1.4 }
            },
            negative: {
                '무시무시한': { priceBonus: 6000, sizeMulti: 1.5 },
                '섬뜩한': { priceBonus: 5500, sizeMulti: 1.2 },
                '괴기한': { priceBonus: 7000, sizeMulti: 1.3 },
                '기괴한': { priceBonus: 6500, sizeMulti: 1.4 },
                '음산한': { priceBonus: 5000, sizeMulti: 1.1 }
            }
        },
        epic: {
            positive: {
                '장엄한': { priceBonus: 25000, sizeMulti: 1.5 },
                '위대한': { priceBonus: 28000, sizeMulti: 1.6 },
                '고귀한': { priceBonus: 26000, sizeMulti: 1.3 },
                '성스러운': { priceBonus: 30000, sizeMulti: 1.4 },
                '눈부신': { priceBonus: 32000, sizeMulti: 1.2 },
                '찬란한': { priceBonus: 29000, sizeMulti: 1.3 },
                '황홀한': { priceBonus: 27000, sizeMulti: 1.2 },
                '경이로운': { priceBonus: 31000, sizeMulti: 1.5 },
                '장대한': { priceBonus: 26500, sizeMulti: 1.7 },
                '웅장한': { priceBonus: 28500, sizeMulti: 1.8 }
            },
            negative: {
                '파괴적인': { priceBonus: 20000, sizeMulti: 1.6 },
                '맹렬한': { priceBonus: 22000, sizeMulti: 1.5 },
                '격렬한': { priceBonus: 21000, sizeMulti: 1.4 },
                '흉포한': { priceBonus: 23000, sizeMulti: 1.7 },
                '잔혹한': { priceBonus: 24000, sizeMulti: 1.8 }
            }
        },
        legendary: {
            positive: {
                '전설의': { priceBonus: 80000, sizeMulti: 2.0 },
                '신화의': { priceBonus: 90000, sizeMulti: 2.2 },
                '불멸의': { priceBonus: 100000, sizeMulti: 1.8 },
                '영원한': { priceBonus: 85000, sizeMulti: 1.9 },
                '절대적인': { priceBonus: 95000, sizeMulti: 2.1 },
                '궁극의': { priceBonus: 110000, sizeMulti: 2.3 },
                '초월적인': { priceBonus: 105000, sizeMulti: 2.0 },
                '신성한': { priceBonus: 92000, sizeMulti: 1.9 },
                '천상의': { priceBonus: 88000, sizeMulti: 1.8 },
                '완벽한': { priceBonus: 115000, sizeMulti: 2.0 }
            },
            negative: {
                '저주받은': { priceBonus: 60000, sizeMulti: 1.6 },
                '금지된': { priceBonus: 70000, sizeMulti: 1.7 },
                '봉인된': { priceBonus: 75000, sizeMulti: 1.8 },
                '타락한': { priceBonus: 65000, sizeMulti: 1.9 },
                '어둠의': { priceBonus: 68000, sizeMulti: 2.0 }
            }
        },
        mythic: {
            positive: {
                '창조의': { priceBonus: 200000, sizeMulti: 2.5 },
                '태초의': { priceBonus: 220000, sizeMulti: 2.8 },
                '원시의': { priceBonus: 180000, sizeMulti: 2.6 },
                '근원의': { priceBonus: 210000, sizeMulti: 2.7 },
                '우주의': { priceBonus: 250000, sizeMulti: 3.0 },
                '차원의': { priceBonus: 230000, sizeMulti: 2.9 },
                '시공을': { priceBonus: 240000, sizeMulti: 2.8 },
                '운명의': { priceBonus: 190000, sizeMulti: 2.4 },
                '인과의': { priceBonus: 205000, sizeMulti: 2.5 },
                '존재의': { priceBonus: 215000, sizeMulti: 2.6 }
            },
            negative: {
                '종말의': { priceBonus: 150000, sizeMulti: 2.2 },
                '파멸의': { priceBonus: 160000, sizeMulti: 2.3 },
                '혼돈의': { priceBonus: 170000, sizeMulti: 2.4 },
                '무의': { priceBonus: 140000, sizeMulti: 2.1 },
                '공허의': { priceBonus: 155000, sizeMulti: 2.5 }
            }
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

    // 크기 등급별 가격 배율
    sizeGrades: {
        'tiny': {
            name: '초미니',
            description: '한입 크기',
            percentRange: [0, 10],
            priceMultiplier: 0.5,
            emoji: '🐟'
        },
        'mini': {
            name: '미니',
            description: '손바닥 크기',
            percentRange: [10, 25],
            priceMultiplier: 0.7,
            emoji: '🐠'
        },
        'small': {
            name: '소형',
            description: '팔뚝 크기',
            percentRange: [25, 40],
            priceMultiplier: 0.9,
            emoji: '🐡'
        },
        'medium': {
            name: '중형',
            description: '표준 크기',
            percentRange: [40, 60],
            priceMultiplier: 1.0,
            emoji: '🐟'
        },
        'large': {
            name: '대형',
            description: '한아름 크기',
            percentRange: [60, 80],
            priceMultiplier: 1.5,
            emoji: '🐠'
        },
        'extra': {
            name: '특대',
            description: '양손 크기',
            percentRange: [80, 95],
            priceMultiplier: 2.5,
            emoji: '🦈'
        },
        'legendary': {
            name: '전설',
            description: '기록급 크기',
            percentRange: [95, 100],
            priceMultiplier: 5.0,
            emoji: '🐋'
        },
        'mythic': {
            name: '신화',
            description: '믿기 힘든 크기',
            percentRange: [100, 999],  // 100% 이상 (특수 접두사로만 가능)
            priceMultiplier: 10.0,
            emoji: '🌟'
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

    // 특수 물고기 (특별 낚시터 전용) - 크기와 가격 정보 포함
    specialFishTypes: {
        // 공허의 바다 물고기
        '시공어': { minSize: 500, maxSize: 2000, megaSize: 3000, basePrice: 100000 },
        '차원어': { minSize: 600, maxSize: 2500, megaSize: 4000, basePrice: 120000 },
        '무한어': { minSize: 800, maxSize: 3000, megaSize: 5000, basePrice: 150000 },
        '영겁어': { minSize: 700, maxSize: 2800, megaSize: 4500, basePrice: 140000 },
        '혼돈어': { minSize: 900, maxSize: 3500, megaSize: 6000, basePrice: 180000 },
        '질서어': { minSize: 750, maxSize: 3000, megaSize: 5000, basePrice: 160000 },
        '창조어': { minSize: 1000, maxSize: 4000, megaSize: 7000, basePrice: 200000 },
        '파멸어': { minSize: 950, maxSize: 3800, megaSize: 6500, basePrice: 190000 },
        '윤회어': { minSize: 850, maxSize: 3200, megaSize: 5500, basePrice: 170000 },
        '인과어': { minSize: 800, maxSize: 3000, megaSize: 5000, basePrice: 165000 },
        // 용의 바다 특수 물고기
        '용왕어': { minSize: 1000, maxSize: 5000, megaSize: 8000, basePrice: 250000 },
        '드래곤피시': { minSize: 800, maxSize: 4000, megaSize: 6000, basePrice: 220000 },
        '화룡어': { minSize: 700, maxSize: 3500, megaSize: 5500, basePrice: 200000 },
        '빙룡어': { minSize: 750, maxSize: 3800, megaSize: 6000, basePrice: 210000 },
        '암룡어': { minSize: 900, maxSize: 4500, megaSize: 7000, basePrice: 230000 },
        // 천상의 호수 특수 물고기
        '별빛송어': { minSize: 100, maxSize: 500, megaSize: 800, basePrice: 80000 },
        '은하잉어': { minSize: 150, maxSize: 600, megaSize: 1000, basePrice: 90000 },
        '천사어': { minSize: 200, maxSize: 800, megaSize: 1200, basePrice: 110000 },
        '신성어': { minSize: 250, maxSize: 1000, megaSize: 1500, basePrice: 130000 },
        '성좌어': { minSize: 300, maxSize: 1200, megaSize: 2000, basePrice: 150000 },
        // 영원의 심해 특수 물고기
        '영원어': { minSize: 1500, maxSize: 6000, megaSize: 10000, basePrice: 300000 },
        '불멸어': { minSize: 1200, maxSize: 5000, megaSize: 8000, basePrice: 280000 },
        '태초어': { minSize: 2000, maxSize: 8000, megaSize: 12000, basePrice: 350000 },
        '종말어': { minSize: 1800, maxSize: 7000, megaSize: 11000, basePrice: 320000 },
        '순환어': { minSize: 1600, maxSize: 6500, megaSize: 10000, basePrice: 310000 }
    },

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
            price: 1000000
        },
        steel: {
            id: 'steel',
            name: '⚔️ 강철 낚싯대',
            description: '튼튼한 금속 낚싯대',
            sizeBonus: 1.2,
            rarityBonus: 1.1,
            price: 5000000
        },
        titanium: {
            id: 'titanium',
            name: '🔧 티타늄 낚싯대',
            description: '가볍고 강한 티타늄 합금 낚싯대',
            sizeBonus: 1.25,
            rarityBonus: 1.12,
            price: 10000000
        },
        carbon: {
            id: 'carbon',
            name: '⚫ 카본 낚싯대',
            description: '최신 기술의 낚싯대',
            sizeBonus: 1.3,
            rarityBonus: 1.15,
            price: 20000000
        },
        mithril: {
            id: 'mithril',
            name: '✨ 미스릴 낚싯대',
            description: '마법의 금속으로 만든 낚싯대',
            sizeBonus: 1.5,
            rarityBonus: 1.3,
            price: 50000000
        },
        dragon: {
            id: 'dragon',
            name: '🐲 용골 낚싯대',
            description: '용의 뼈로 만든 전설의 낚싯대',
            sizeBonus: 1.8,
            rarityBonus: 1.5,
            price: 100000000
        },
        divine: {
            id: 'divine',
            name: '🌟 신의 낚싯대',
            description: '신이 사용했다는 낚슯대',
            sizeBonus: 2.5,
            rarityBonus: 2.0,
            price: 500000000
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
            price: 60000  // 평균 물고기 가격 ~7500G의 80% x10
        },
        shrimp: {
            id: 'shrimp',
            name: '🦐 새우',
            description: '바닷물고기가 좋아하는 미끼',
            effect: '바닷물고기 확률 +20%',
            bonus: { saltwater: 1.2 },
            price: 100000  // 바닷물고기 평균이 더 높음 x10
        },
        bread: {
            id: 'bread',
            name: '🍞 빵조각',
            description: '민물고기가 좋아하는 미끼',
            effect: '민물고기 확률 +20%',
            bonus: { freshwater: 1.2 },
            price: 50000  // 민물고기 평균이 더 낮음 x10
        },
        lure: {
            id: 'lure',
            name: '🎣 루어',
            description: '큰 물고기를 유혹하는 미끼',
            effect: '크기 +30%',
            bonus: { size: 1.3 },
            price: 120000  // 크기 보너스로 가격 1.5배 기대 x10
        },
        glowing: {
            id: 'glowing',
            name: '✨ 발광 미끼',
            description: '희귀 물고기를 유혹하는 미끼',
            effect: '희귀도 +30%',
            bonus: { rarity: 1.3 },
            price: 200000  // 레어 확률 증가 x10
        },
        golden: {
            id: 'golden',
            name: '🌟 황금 미끼',
            description: '모든 확률이 증가하는 특별한 미끼',
            effect: '모든 확률 +50%',
            bonus: { all: 1.5 },
            price: 500000  // 전체적인 보너스 x10
        },
        legendary: {
            id: 'legendary',
            name: '💎 전설의 미끼',
            description: '엄청난 효과를 가진 미끼',
            effect: '전설/신화 확률 대폭 증가',
            bonus: { legendary: 3.0, mythic: 5.0 },
            price: 2000000  // 최고급 미끼 x10
        }
    },

    // 게임 설정
    settings: {
        maxInventory: 100,
        fishingCooldown: 5000,
        baitConsumption: true,
        autoSellCommon: false
    },

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