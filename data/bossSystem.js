// 보스 시스템 데이터
const BOSS_SYSTEM = {
    // 보스 목록
    bosses: [
        // 초급 보스 (레벨 10-30)
        {
            id: 'goblin_chief',
            name: '고블린 족장',
            emoji: '👺',
            level: 20,
            hp: 60000,
            requiredLevel: 10,
            attack: 300,
            defense: 160,
            rewards: {
                exp: 10000,
                gold: 100000,
                items: [
                    { id: 'goblin_axe', chance: 0.2 },
                    { id: 'chief_necklace', chance: 0.1 },
                    { id: 'goblin_tooth', chance: 0.5 }
                ]
            },
            skills: [
                { name: '난폭한 휘두르기', damage: 300, chance: 0.4 },
                { name: '고블린 부대 소환', damage: 200, chance: 0.3 },
                { name: '족장의 분노', damage: 400, chance: 0.1 }
            ]
        },
        {
            id: 'skeleton_king',
            name: '해골 왕',
            emoji: '💀',
            level: 30,
            hp: 100000,
            requiredLevel: 20,
            attack: 500,
            defense: 240,
            rewards: {
                exp: 20000,
                gold: 200000,
                items: [
                    { id: 'bone_crown', chance: 0.15 },
                    { id: 'undead_essence', chance: 0.2 },
                    { id: 'skeleton_bone', chance: 0.4 }
                ]
            },
            skills: [
                { name: '망자의 저주', damage: 400, chance: 0.4 },
                { name: '해골 부대 소환', damage: 350, chance: 0.3 },
                { name: '죽음의 파동', damage: 600, chance: 0.15 }
            ]
        },
        // 중급 보스 (레벨 40-60)
        {
            id: 'shadow_assassin',
            name: '그림자 암살자',
            emoji: '🗡️',
            level: 50,
            hp: 200000,
            requiredLevel: 40,
            attack: 800,
            defense: 400,
            rewards: {
                exp: 200000,
                gold: 2500000,
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
            level: 60,
            hp: 300000,
            requiredLevel: 50,
            attack: 700,
            defense: 800,
            rewards: {
                exp: 300000,
                gold: 3000000,
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
        // 상급 보스 (레벨 70-90)
        {
            id: 'frost_dragon',
            name: '서리 드래곤',
            emoji: '🐉',
            level: 80,
            hp: 500000,
            requiredLevel: 70,
            attack: 1400,
            defense: 600,
            rewards: {
                exp: 500000,
                gold: 5000000,
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
        },
        {
            id: 'fire_elemental',
            name: '화염 엘리멘탈',
            emoji: '🔥',
            level: 90,
            hp: 600000,
            requiredLevel: 80,
            attack: 1800,
            defense: 560,
            rewards: {
                exp: 750000,
                gold: 7500000,
                items: [
                    { id: 'fire_core', chance: 0.1 },
                    { id: 'flame_armor', chance: 0.08 },
                    { id: 'burning_essence', chance: 0.3 }
                ]
            },
            skills: [
                { name: '화염 폭발', damage: 1300, chance: 0.35 },
                { name: '불길 편', damage: 1500, chance: 0.2 },
                { name: '용암 폭풍', damage: 2000, chance: 0.08 }
            ]
        },
        // 최상급 보스 (레벨 100)
        {
            id: 'demon_lord',
            name: '데몬 로드',
            emoji: '👹',
            level: 100,
            hp: 1000000,
            requiredLevel: 100,
            attack: 2400,
            defense: 900,
            rewards: {
                exp: 1000000,
                gold: 10000000,
                items: [
                    { id: 'demon_sword', chance: 0.05 },
                    { id: 'hell_armor', chance: 0.08 },
                    { id: 'demon_horn', chance: 0.2 }
                ]
            },
            skills: [
                { name: '지옥불', damage: 1800, chance: 0.3 },
                { name: '악마의 저주', damage: 1000, effect: 'debuff', chance: 0.35 },
                { name: '최후의 심판', damage: 3000, chance: 0.05 }
            ]
        }
    ],

    // 보스 아이템
    bossItems: {
        // 고블린 족장 드롭
        goblin_axe: {
            name: '고블린 도끼',
            type: 'weapon',
            rarity: 'rare',
            level: 20,
            stats: { attack: 50 }
        },
        chief_necklace: {
            name: '족장의 목걸이',
            type: 'accessory',
            rarity: 'rare',
            level: 20,
            stats: { luck: 20 }
        },
        goblin_tooth: {
            name: '고블린 이빨',
            type: 'material',
            rarity: 'common'
        },
        
        // 해골 왕 드롭
        bone_crown: {
            name: '해골 왕관',
            type: 'helmet',
            rarity: 'epic',
            level: 30,
            stats: { defense: 80, attack: 30 }
        },
        undead_essence: {
            name: '언데드 정수',
            type: 'material',
            rarity: 'rare'
        },
        skeleton_bone: {
            name: '해골 뼈',
            type: 'material',
            rarity: 'common'
        },
        
        // 그림자 암살자 드롭
        shadow_blade: {
            name: '그림자 검',
            type: 'weapon',
            rarity: 'epic',
            level: 50,
            stats: { attack: 200, dodge: 40 }
        },
        assassin_cloak: {
            name: '암살자의 망토',
            type: 'armor',
            rarity: 'rare',
            level: 50,
            stats: { defense: 100, dodge: 60 }
        },
        dark_essence: {
            name: '어둠의 정수',
            type: 'material',
            rarity: 'rare'
        },
        
        // 고대 골렘 드롭
        golem_core: {
            name: '골렘의 핵',
            type: 'material',
            rarity: 'epic'
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
        
        // 화염 엘리멘탈 드롭
        fire_core: {
            name: '화염의 핵',
            type: 'material',
            rarity: 'legendary'
        },
        flame_armor: {
            name: '화염 갑옷',
            type: 'armor',
            rarity: 'legendary',
            level: 90,
            stats: { defense: 350, attack: 80 }
        },
        burning_essence: {
            name: '타오르는 정수',
            type: 'material',
            rarity: 'epic'
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
        }
    },

    // 보스 스폰 설정
    spawnSettings: {
        minInterval: 2 * 60 * 60 * 1000, // 최소 2시간
        maxInterval: 4 * 60 * 60 * 1000, // 최대 4시간
        duration: 30 * 60 * 1000, // 30분 동안 유지
        maxParticipants: 20, // 최대 참가자 수
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