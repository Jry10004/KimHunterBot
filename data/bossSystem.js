// 보스 시스템 데이터
const BOSS_SYSTEM = {
    // 보스 목록
    bosses: [
        {
            id: 'shadow_assassin',
            name: '그림자 암살자',
            emoji: '🗡️',
            level: 60,
            hp: 120000,
            requiredLevel: 40,
            attack: 500,
            defense: 300,
            rewards: {
                exp: 50000,
                gold: 100000,
                items: [
                    { id: 'shadow_blade', chance: 0.1 },
                    { id: 'assassin_cloak', chance: 0.15 },
                    { id: 'dark_essence', chance: 0.3 }
                ]
            },
            skills: [
                { name: '그림자 베기', damage: 800, chance: 0.3 },
                { name: '암살', damage: 1500, chance: 0.1 },
                { name: '은신', effect: 'dodge', chance: 0.2 }
            ]
        },
        {
            id: 'frost_dragon',
            name: '서리 드래곤',
            emoji: '🐉',
            level: 80,
            hp: 200000,
            requiredLevel: 60,
            attack: 700,
            defense: 400,
            rewards: {
                exp: 100000,
                gold: 200000,
                items: [
                    { id: 'dragon_scale', chance: 0.15 },
                    { id: 'frost_heart', chance: 0.1 },
                    { id: 'ice_crystal', chance: 0.4 }
                ]
            },
            skills: [
                { name: '서리 숨결', damage: 1000, chance: 0.4 },
                { name: '얼음 폭풍', damage: 1200, chance: 0.2 },
                { name: '용의 분노', damage: 2000, chance: 0.05 }
            ]
        },
        {
            id: 'demon_lord',
            name: '데몬 로드',
            emoji: '👹',
            level: 100,
            hp: 300000,
            requiredLevel: 80,
            attack: 1000,
            defense: 500,
            rewards: {
                exp: 200000,
                gold: 500000,
                items: [
                    { id: 'demon_sword', chance: 0.05 },
                    { id: 'hell_armor', chance: 0.08 },
                    { id: 'demon_horn', chance: 0.2 }
                ]
            },
            skills: [
                { name: '지옥불', damage: 1500, chance: 0.3 },
                { name: '악마의 저주', damage: 800, effect: 'debuff', chance: 0.4 },
                { name: '최후의 심판', damage: 3000, chance: 0.02 }
            ]
        },
        {
            id: 'ancient_golem',
            name: '고대 골렘',
            emoji: '🗿',
            level: 70,
            hp: 250000,
            requiredLevel: 50,
            attack: 400,
            defense: 800,
            rewards: {
                exp: 80000,
                gold: 150000,
                items: [
                    { id: 'golem_core', chance: 0.1 },
                    { id: 'ancient_stone', chance: 0.3 },
                    { id: 'earth_essence', chance: 0.25 }
                ]
            },
            skills: [
                { name: '대지 강타', damage: 900, chance: 0.4 },
                { name: '돌 방패', effect: 'shield', chance: 0.3 },
                { name: '지진', damage: 1300, chance: 0.15 }
            ]
        },
        {
            id: 'void_emperor',
            name: '공허의 황제',
            emoji: '👑',
            level: 120,
            hp: 500000,
            requiredLevel: 100,
            attack: 1500,
            defense: 700,
            rewards: {
                exp: 500000,
                gold: 1000000,
                items: [
                    { id: 'void_crown', chance: 0.02 },
                    { id: 'emperor_robe', chance: 0.05 },
                    { id: 'void_fragment', chance: 0.15 }
                ]
            },
            skills: [
                { name: '공허 폭발', damage: 2000, chance: 0.25 },
                { name: '차원 균열', damage: 2500, chance: 0.1 },
                { name: '황제의 진노', damage: 5000, chance: 0.01 }
            ]
        }
    ],

    // 보스 아이템
    bossItems: {
        // 그림자 암살자 드롭
        shadow_blade: {
            name: '그림자 검',
            type: 'weapon',
            rarity: 'legendary',
            level: 60,
            stats: { attack: 300, dodge: 50 }
        },
        assassin_cloak: {
            name: '암살자의 망토',
            type: 'armor',
            rarity: 'epic',
            level: 60,
            stats: { defense: 150, dodge: 80 }
        },
        dark_essence: {
            name: '어둠의 정수',
            type: 'material',
            rarity: 'rare'
        },
        
        // 서리 드래곤 드롭
        dragon_scale: {
            name: '용의 비늘',
            type: 'material',
            rarity: 'legendary'
        },
        frost_heart: {
            name: '서리 심장',
            type: 'accessory',
            rarity: 'legendary',
            level: 80,
            stats: { attack: 100, defense: 200 }
        },
        ice_crystal: {
            name: '얼음 결정',
            type: 'material',
            rarity: 'rare'
        },
        
        // 데몬 로드 드롭
        demon_sword: {
            name: '마검 데모니아',
            type: 'weapon',
            rarity: 'mythic',
            level: 100,
            stats: { attack: 500, luck: -20 }
        },
        hell_armor: {
            name: '지옥의 갑옷',
            type: 'armor',
            rarity: 'legendary',
            level: 100,
            stats: { defense: 400, attack: 100 }
        },
        demon_horn: {
            name: '악마의 뿔',
            type: 'material',
            rarity: 'epic'
        },
        
        // 고대 골렘 드롭
        golem_core: {
            name: '골렘의 핵',
            type: 'material',
            rarity: 'legendary'
        },
        ancient_stone: {
            name: '고대의 돌',
            type: 'material',
            rarity: 'rare'
        },
        earth_essence: {
            name: '대지의 정수',
            type: 'material',
            rarity: 'rare'
        },
        
        // 공허의 황제 드롭
        void_crown: {
            name: '공허의 왕관',
            type: 'helmet',
            rarity: 'mythic',
            level: 120,
            stats: { attack: 200, defense: 300, luck: 100 }
        },
        emperor_robe: {
            name: '황제의 로브',
            type: 'armor',
            rarity: 'mythic',
            level: 120,
            stats: { defense: 500, dodge: 50 }
        },
        void_fragment: {
            name: '공허의 파편',
            type: 'material',
            rarity: 'legendary'
        }
    },

    // 보스 스폰 설정
    spawnSettings: {
        minInterval: 2 * 60 * 60 * 1000, // 최소 2시간
        maxInterval: 4 * 60 * 60 * 1000, // 최대 4시간
        duration: 30 * 60 * 1000, // 30분 동안 유지
        maxParticipants: 10, // 최대 참가자 수
        minParticipants: 2 // 최소 참가자 수
    },

    // 현재 활성 보스
    activeBoss: null,
    participants: new Set(),
    damageDealt: new Map(),
    
    // 보스 전투 상태
    battleState: {
        isActive: false,
        currentHp: 0,
        startTime: null,
        endTime: null
    }
};

module.exports = BOSS_SYSTEM;