// 보스 조각 시스템 데이터
const BOSS_FRAGMENTS = {
    // 조각 종류 (보스별)
    fragmentTypes: {
        goblin: {
            id: 'goblin_fragment',
            name: '고블린 조각',
            emoji: '👺',
            boss: 'goblin_chief'
        },
        skeleton: {
            id: 'skeleton_fragment',
            name: '해골 조각',
            emoji: '💀',
            boss: 'skeleton_king'
        },
        shadow: {
            id: 'shadow_fragment',
            name: '그림자 조각',
            emoji: '🌑',
            boss: 'shadow_assassin'
        },
        earth: {
            id: 'earth_fragment',
            name: '대지 조각',
            emoji: '🪨',
            boss: 'ancient_golem'
        },
        frost: {
            id: 'frost_fragment',
            name: '서리 조각',
            emoji: '❄️',
            boss: 'frost_dragon'
        },
        fire: {
            id: 'fire_fragment',
            name: '화염 조각',
            emoji: '🔥',
            boss: 'fire_elemental'
        },
        demon: {
            id: 'demon_fragment',
            name: '악마 조각',
            emoji: '👹',
            boss: 'demon_lord'
        },
        void: {
            id: 'void_fragment',
            name: '공허 조각',
            emoji: '🌌',
            boss: 'void_emperor'
        }
    },

    // 조각 등급
    rarities: {
        common: {
            id: 'common',
            name: '일반',
            emoji: '🟦',
            color: '#5865F2',
            dropRate: 0.5,
            dropAmount: { min: 1, max: 3 }
        },
        rare: {
            id: 'rare',
            name: '레어',
            emoji: '🟩',
            color: '#57F287',
            dropRate: 0.3,
            dropAmount: { min: 1, max: 2 }
        },
        epic: {
            id: 'epic',
            name: '에픽',
            emoji: '🟪',
            color: '#9B59B6',
            dropRate: 0.15,
            dropAmount: { min: 1, max: 1 }
        },
        unique: {
            id: 'unique',
            name: '유니크',
            emoji: '🟧',
            color: '#F39C12',
            dropRate: 0.04,
            dropAmount: { min: 1, max: 1 }
        },
        legendary: {
            id: 'legendary',
            name: '레전드리',
            emoji: '🟨',
            color: '#F1C40F',
            dropRate: 0.01,
            dropAmount: { min: 1, max: 1 }
        }
    },

    // 목걸이 아이템
    necklaces: {
        common: {
            id: 'guardian_necklace',
            name: '수호자의 목걸이',
            rarity: 'common',
            emoji: '📿',
            stats: {
                attack: 50,
                defense: 50
            },
            requirements: {
                shadow_fragment_common: 5,
                frost_fragment_common: 5,
                demon_fragment_common: 5,
                earth_fragment_common: 5,
                void_fragment_common: 5
            },
            description: '기본적인 보호를 제공하는 목걸이'
        },
        rare: {
            id: 'warrior_necklace',
            name: '전사의 목걸이',
            rarity: 'rare',
            emoji: '📿',
            stats: {
                attack: 100,
                defense: 100,
                hp: 500
            },
            requirements: {
                shadow_fragment_rare: 5,
                frost_fragment_rare: 5,
                demon_fragment_rare: 5,
                earth_fragment_rare: 5,
                void_fragment_rare: 5
            },
            description: '전투에 특화된 강력한 목걸이'
        },
        epic: {
            id: 'hero_necklace',
            name: '영웅의 목걸이',
            rarity: 'epic',
            emoji: '📿',
            stats: {
                attack: 200,
                defense: 150,
                hp: 1000,
                criticalChance: 5
            },
            requirements: {
                shadow_fragment_epic: 5,
                frost_fragment_epic: 5,
                demon_fragment_epic: 5,
                earth_fragment_epic: 5,
                void_fragment_epic: 5
            },
            description: '영웅의 힘이 깃든 목걸이'
        },
        unique: {
            id: 'conqueror_necklace',
            name: '정복자의 목걸이',
            rarity: 'unique',
            emoji: '📿',
            stats: {
                attack: 300,
                defense: 200,
                hp: 2000,
                criticalChance: 10,
                goldBonus: 10
            },
            requirements: {
                shadow_fragment_unique: 5,
                frost_fragment_unique: 5,
                demon_fragment_unique: 5,
                earth_fragment_unique: 5,
                void_fragment_unique: 5
            },
            description: '정복자의 위엄이 담긴 목걸이'
        },
        legendary: {
            id: 'divine_necklace',
            name: '신의 목걸이',
            rarity: 'legendary',
            emoji: '📿',
            stats: {
                attack: 500,
                defense: 300,
                hp: 5000,
                criticalChance: 15,
                goldBonus: 20,
                expBonus: 20
            },
            requirements: {
                shadow_fragment_legendary: 5,
                frost_fragment_legendary: 5,
                demon_fragment_legendary: 5,
                earth_fragment_legendary: 5,
                void_fragment_legendary: 5
            },
            description: '신의 축복이 깃든 전설의 목걸이'
        }
    },

    // 조각 합성 설정
    synthesis: {
        ratio: 10, // 하위 등급 10개 → 상위 등급 1개
        successRate: 1.0 // 100% 성공률
    },

    // 조각 드롭 계산 함수
    calculateFragmentDrops(bossId) {
        const drops = [];
        const fragmentType = Object.values(this.fragmentTypes).find(f => f.boss === bossId);
        
        if (!fragmentType) return drops;

        // 각 등급별 드롭 확률 계산
        for (const [rarityId, rarity] of Object.entries(this.rarities)) {
            if (Math.random() < rarity.dropRate) {
                const amount = Math.floor(Math.random() * (rarity.dropAmount.max - rarity.dropAmount.min + 1)) + rarity.dropAmount.min;
                drops.push({
                    id: `${fragmentType.id}_${rarityId}`,
                    type: fragmentType.id,
                    rarity: rarityId,
                    amount: amount,
                    name: `${rarity.emoji} ${fragmentType.name} (${rarity.name})`,
                    emoji: fragmentType.emoji
                });
            }
        }

        return drops;
    },

    // 조각 ID 생성 함수
    getFragmentId(type, rarity) {
        return `${type}_fragment_${rarity}`;
    },

    // 목걸이 교환 가능 여부 확인
    canExchangeNecklace(userFragments, necklaceId) {
        const necklace = this.necklaces[necklaceId];
        if (!necklace) return false;

        for (const [fragmentId, requiredAmount] of Object.entries(necklace.requirements)) {
            const userAmount = userFragments[fragmentId] || 0;
            if (userAmount < requiredAmount) {
                return false;
            }
        }

        return true;
    }
};

module.exports = BOSS_FRAGMENTS;