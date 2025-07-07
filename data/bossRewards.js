// 보스 레이드 보상 시스템
const BOSS_REWARDS = {
    // 보스 토큰 (보스별로 드롭)
    tokens: {
        goblin: {
            id: 'goblin_token',
            name: '고블린 토큰',
            emoji: '🪙',
            boss: 'goblin_chief',
            tier: 1
        },
        skeleton: {
            id: 'skeleton_token',
            name: '해골 토큰',
            emoji: '💀',
            boss: 'skeleton_king',
            tier: 1
        },
        shadow: {
            id: 'shadow_token',
            name: '그림자 토큰',
            emoji: '🌑',
            boss: 'shadow_assassin',
            tier: 2
        },
        earth: {
            id: 'earth_token',
            name: '대지 토큰',
            emoji: '🪨',
            boss: 'ancient_golem',
            tier: 2
        },
        frost: {
            id: 'frost_token',
            name: '서리 토큰',
            emoji: '❄️',
            boss: 'frost_dragon',
            tier: 3
        },
        fire: {
            id: 'fire_token',
            name: '화염 토큰',
            emoji: '🔥',
            boss: 'fire_elemental',
            tier: 3
        },
        demon: {
            id: 'demon_token',
            name: '악마 토큰',
            emoji: '👹',
            boss: 'demon_lord',
            tier: 4
        }
    },

    // 보스 상점 아이템
    shopItems: {
        // 무기류
        weapons: [
            {
                id: 'boss_sword_t1',
                name: '레이드 검',
                emoji: '⚔️',
                type: 'weapon',
                tier: 1,
                stats: { attack: 150 },
                cost: { token_type: 'any', amount: 10, tier: 1 },
                description: '보스 레이드에서 얻은 토큰으로 교환 가능한 검'
            },
            {
                id: 'boss_sword_t2',
                name: '정예 레이드 검',
                emoji: '🗡️',
                type: 'weapon',
                tier: 2,
                stats: { attack: 300, critical: 10 },
                cost: { token_type: 'any', amount: 20, tier: 2 },
                description: '강력한 보스를 처치하고 얻은 검'
            },
            {
                id: 'boss_sword_t3',
                name: '영웅 레이드 검',
                emoji: '⚔️',
                type: 'weapon',
                tier: 3,
                stats: { attack: 500, critical: 20, speed: 10 },
                cost: { token_type: 'any', amount: 30, tier: 3 },
                description: '영웅만이 다룰 수 있는 전설의 검'
            }
        ],

        // 방어구류
        armors: [
            {
                id: 'boss_armor_t1',
                name: '레이드 갑옷',
                emoji: '🛡️',
                type: 'armor',
                tier: 1,
                stats: { defense: 100, hp: 500 },
                cost: { token_type: 'any', amount: 10, tier: 1 },
                description: '보스의 공격을 견딜 수 있는 갑옷'
            },
            {
                id: 'boss_armor_t2',
                name: '정예 레이드 갑옷',
                emoji: '🛡️',
                type: 'armor',
                tier: 2,
                stats: { defense: 200, hp: 1000, dodge: 5 },
                cost: { token_type: 'any', amount: 20, tier: 2 },
                description: '강화된 보호막이 있는 갑옷'
            },
            {
                id: 'boss_armor_t3',
                name: '영웅 레이드 갑옷',
                emoji: '🛡️',
                type: 'armor',
                tier: 3,
                stats: { defense: 350, hp: 2000, dodge: 10, regen: 5 },
                cost: { token_type: 'any', amount: 30, tier: 3 },
                description: '불멸의 힘이 깃든 갑옷'
            }
        ],

        // 악세서리류
        accessories: [
            {
                id: 'raid_ring',
                name: '레이드 반지',
                emoji: '💍',
                type: 'accessory',
                tier: 1,
                stats: { luck: 20 },
                cost: { token_type: 'any', amount: 5, tier: 1 },
                description: '행운을 가져다주는 반지'
            },
            {
                id: 'raid_necklace',
                name: '레이드 목걸이',
                emoji: '📿',
                type: 'accessory',
                tier: 2,
                stats: { attack: 50, defense: 50 },
                cost: { token_type: 'any', amount: 15, tier: 2 },
                description: '균형잡힌 능력치를 제공하는 목걸이'
            },
            {
                id: 'raid_crown',
                name: '레이드 왕관',
                emoji: '👑',
                type: 'accessory',
                tier: 3,
                stats: { all_stats: 30 },
                cost: { token_type: 'any', amount: 25, tier: 3 },
                description: '모든 능력치를 향상시키는 왕관'
            }
        ],

        // 소모품류
        consumables: [
            {
                id: 'boss_potion_hp',
                name: '보스 체력 물약',
                emoji: '🧪',
                type: 'consumable',
                tier: 1,
                effect: { hp_restore: 5000 },
                cost: { token_type: 'any', amount: 3, tier: 1 },
                description: '체력을 즉시 회복시키는 물약'
            },
            {
                id: 'boss_elixir',
                name: '보스 엘릭서',
                emoji: '⚗️',
                type: 'consumable',
                tier: 2,
                effect: { buff_duration: 3600, attack_boost: 50, defense_boost: 50 },
                cost: { token_type: 'any', amount: 10, tier: 2 },
                description: '1시간 동안 능력치를 향상시키는 엘릭서'
            },
            {
                id: 'boss_blessing',
                name: '보스의 축복',
                emoji: '✨',
                type: 'consumable',
                tier: 3,
                effect: { exp_boost: 100, gold_boost: 100, duration: 86400 },
                cost: { token_type: 'any', amount: 20, tier: 3 },
                description: '24시간 동안 경험치와 골드 획득량 2배'
            }
        ],

        // 특수 아이템
        special: [
            {
                id: 'boss_title_slayer',
                name: '보스 슬레이어',
                emoji: '🏅',
                type: 'title',
                tier: 2,
                effect: { title: '보스 슬레이어', boss_damage: 10 },
                cost: { token_type: 'specific', tokens: [
                    { id: 'shadow_token', amount: 10 },
                    { id: 'earth_token', amount: 10 }
                ]},
                description: '보스에게 추가 데미지를 입히는 칭호'
            },
            {
                id: 'boss_mount',
                name: '레이드 탈것',
                emoji: '🐎',
                type: 'mount',
                tier: 3,
                effect: { speed: 50, style: 'epic' },
                cost: { token_type: 'specific', tokens: [
                    { id: 'frost_token', amount: 15 },
                    { id: 'fire_token', amount: 15 }
                ]},
                description: '빠른 이동이 가능한 특별한 탈것'
            },
            {
                id: 'boss_pet',
                name: '미니 보스',
                emoji: '🐲',
                type: 'pet',
                tier: 4,
                effect: { companion: true, stats_boost: 20 },
                cost: { token_type: 'specific', tokens: [
                    { id: 'demon_token', amount: 50 }
                ]},
                description: '함께 싸워주는 미니 보스 펫'
            }
        ]
    },

    // 토큰 드롭률 (레이드 난이도별)
    dropRates: {
        easy: { min: 1, max: 3 },
        normal: { min: 2, max: 5 },
        hard: { min: 3, max: 8 },
        extreme: { min: 5, max: 12 }
    },

    // 보스별 드롭 토큰 계산
    calculateTokenDrop(bossId, participants = 1) {
        const tokenType = Object.values(this.tokens).find(t => t.boss === bossId);
        if (!tokenType) return null;

        // 난이도는 보스 티어로 결정
        const difficulty = tokenType.tier <= 1 ? 'easy' : 
                          tokenType.tier <= 2 ? 'normal' : 
                          tokenType.tier <= 3 ? 'hard' : 'extreme';
        
        const dropRate = this.dropRates[difficulty];
        const baseAmount = Math.floor(Math.random() * (dropRate.max - dropRate.min + 1)) + dropRate.min;
        
        // 참가자 수에 따른 보너스 (최대 50%)
        const participantBonus = Math.min(participants * 0.1, 0.5);
        const finalAmount = Math.floor(baseAmount * (1 + participantBonus));

        return {
            token: tokenType,
            amount: finalAmount
        };
    },

    // 아이템 구매 가능 여부 확인
    canPurchase(userTokens, item) {
        if (item.cost.token_type === 'any') {
            // 해당 티어의 토큰 총합 확인
            const tierTokens = Object.entries(userTokens)
                .filter(([tokenId, amount]) => {
                    const token = Object.values(this.tokens).find(t => t.id === tokenId);
                    return token && token.tier >= item.cost.tier;
                })
                .reduce((sum, [_, amount]) => sum + amount, 0);
            
            return tierTokens >= item.cost.amount;
        } else if (item.cost.token_type === 'specific') {
            // 특정 토큰 조합 확인
            return item.cost.tokens.every(req => 
                (userTokens[req.id] || 0) >= req.amount
            );
        }
        return false;
    }
};

module.exports = BOSS_REWARDS;