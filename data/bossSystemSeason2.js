// 보스 시스템 데이터 (레벨 1-300)
const BOSS_SYSTEM_SEASON2 = {
    // 보스 목록
    bosses: [
        // ========== 초급 보스 (레벨 1-100) - 현재 유저 수준 ==========
        // 입문자 보스 (Lv.1-30)
        {
            id: 'slime_king',
            name: '슬라임 킹',
            emoji: '🟢',
            level: 10,
            hp: 35000,
            requiredLevel: 1,
            attack: 150,
            defense: 80,
            spawnMessage: '끈적끈적한 거대 슬라임이 나타났습니다!\n조심하세요! 온몸이 끈적해질 수 있습니다!',
            rewards: {
                exp: 5000,
                gold: 50000,
                items: [
                    { id: 'slime_core', chance: 0.3 },
                    { id: 'sticky_essence', chance: 0.5 }
                ]
            },
            skills: [
                { name: '끈적한 포옹', damage: 200, chance: 0.4 },
                { name: '슬라임 분열', damage: 150, chance: 0.3 },
                { name: '산성 폭발', damage: 300, chance: 0.2 }
            ]
        },
        {
            id: 'mad_wolf',
            name: '광포한 늑대',
            emoji: '🐺',
            level: 15,
            hp: 55000,
            requiredLevel: 5,
            attack: 200,
            defense: 95,
            spawnMessage: '사나운 울부짖음이 들려옵니다!\n광포한 늑대가 사냥감을 찾고 있습니다!',
            rewards: {
                exp: 8000,
                gold: 75000,
                items: [
                    { id: 'wolf_fang', chance: 0.4 },
                    { id: 'wolf_pelt', chance: 0.3 }
                ]
            },
            skills: [
                { name: '날카로운 이빨', damage: 250, chance: 0.4 },
                { name: '늑대의 울부짖음', damage: 200, effect: 'fear', chance: 0.3 },
                { name: '광란의 습격', damage: 350, chance: 0.2 }
            ]
        },
        {
            id: 'goblin_chief',
            name: '고블린 족장',
            emoji: '👺',
            level: 20,
            hp: 75000,
            requiredLevel: 10,
            attack: 240,
            defense: 130,
            spawnMessage: '고블린 무리를 이끄는 족장이 나타났습니다!\n부하들과 함께 습격해 옵니다!',
            rewards: {
                exp: 12000,
                gold: 100000,
                items: [
                    { id: 'goblin_axe', chance: 0.2 },
                    { id: 'chief_necklace', chance: 0.1 }
                ]
            },
            skills: [
                { name: '난폭한 휘두르기', damage: 300, chance: 0.4 },
                { name: '고블린 부대 소환', damage: 200, chance: 0.3 },
                { name: '족장의 분노', damage: 400, chance: 0.1 }
            ]
        },
        {
            id: 'orc_warrior',
            name: '오크 전사',
            emoji: '🗿',
            level: 25,
            hp: 110000,
            requiredLevel: 15,
            attack: 320,
            defense: 160,
            spawnMessage: '전쟁의 포효가 울려 퍼집니다!\n강력한 오크 전사가 나타났습니다!',
            rewards: {
                exp: 18000,
                gold: 150000,
                items: [
                    { id: 'orc_hammer', chance: 0.15 },
                    { id: 'warrior_badge', chance: 0.2 }
                ]
            },
            skills: [
                { name: '전사의 함성', damage: 350, effect: 'buff', chance: 0.3 },
                { name: '대지 강타', damage: 450, chance: 0.4 },
                { name: '광전사 모드', damage: 600, chance: 0.15 }
            ]
        },
        {
            id: 'skeleton_king',
            name: '해골 왕',
            emoji: '💀',
            level: 30,
            hp: 150000,
            requiredLevel: 20,
            attack: 400,
            defense: 190,
            spawnMessage: '죽음의 기운이 감돕니다...\n언데드의 왕이 무덤에서 일어났습니다!',
            rewards: {
                exp: 25000,
                gold: 200000,
                items: [
                    { id: 'bone_crown', chance: 0.15 },
                    { id: 'undead_essence', chance: 0.2 }
                ]
            },
            skills: [
                { name: '망자의 저주', damage: 400, chance: 0.4 },
                { name: '해골 부대 소환', damage: 350, chance: 0.3 },
                { name: '죽음의 파동', damage: 600, chance: 0.15 }
            ]
        },

        // 초보자 보스 (Lv.30-80)
        {
            id: 'corrupted_treant',
            name: '타락한 나무정령',
            emoji: '🌳',
            level: 40,
            hp: 175000,
            requiredLevel: 30,
            attack: 400,
            defense: 240,
            spawnMessage: '숲이 슬피 울고 있습니다...\n타락한 나무정령이 분노하며 일어났습니다!',
            rewards: {
                exp: 40000,
                gold: 350000,
                items: [
                    { id: 'nature_core', chance: 0.1 },
                    { id: 'corrupted_bark', chance: 0.25 }
                ]
            },
            skills: [
                { name: '뿌리 얽기', damage: 600, effect: 'root', chance: 0.4 },
                { name: '자연의 분노', damage: 800, chance: 0.3 },
                { name: '타락한 포자', damage: 1000, chance: 0.2 }
            ]
        },
        {
            id: 'ice_giant',
            name: '얼음 거인',
            emoji: '❄️',
            level: 50,
            hp: 250000,
            requiredLevel: 40,
            attack: 500,
            defense: 300,
            spawnMessage: '차가운 바람이 몰아칩니다!\n거대한 얼음 거인이 깨어났습니다!',
            rewards: {
                exp: 60000,
                gold: 500000,
                items: [
                    { id: 'frozen_heart', chance: 0.08 },
                    { id: 'ice_crystal', chance: 0.3 }
                ]
            },
            skills: [
                { name: '빙하 강타', damage: 800, chance: 0.4 },
                { name: '눈보라', damage: 700, effect: 'slow', chance: 0.3 },
                { name: '절대 영도', damage: 1200, chance: 0.15 }
            ]
        },
        {
            id: 'shadow_assassin',
            name: '그림자 암살자',
            emoji: '🗡️',
            level: 60,
            hp: 350000,
            requiredLevel: 50,
            attack: 650,
            defense: 360,
            spawnMessage: '그림자가 움직이기 시작합니다...\n치명적인 암살자가 모습을 드러냈습니다!',
            rewards: {
                exp: 90000,
                gold: 750000,
                items: [
                    { id: 'shadow_blade', chance: 0.06 },
                    { id: 'assassin_cloak', chance: 0.1 }
                ]
            },
            skills: [
                { name: '그림자 습격', damage: 1000, chance: 0.4 },
                { name: '독칼날', damage: 800, effect: 'poison', chance: 0.3 },
                { name: '암살', damage: 1500, chance: 0.1 }
            ]
        },
        {
            id: 'rock_golem',
            name: '바위 골렘',
            emoji: '🪨',
            level: 70,
            hp: 400000,
            requiredLevel: 60,
            attack: 700,
            defense: 480,
            spawnMessage: '대지가 움직이기 시작합니다!\n거대한 바위 골렘이 일어났습니다!',
            rewards: {
                exp: 120000,
                gold: 1000000,
                items: [
                    { id: 'golem_core', chance: 0.1 },
                    { id: 'ancient_stone', chance: 0.3 }
                ]
            },
            skills: [
                { name: '바위 주먹', damage: 1200, chance: 0.4 },
                { name: '돌 방패', effect: 'shield', chance: 0.3 },
                { name: '지진', damage: 1800, chance: 0.15 }
            ]
        },
        {
            id: 'storm_elemental',
            name: '폭풍의 정령',
            emoji: '⚡',
            level: 80,
            hp: 600000,
            requiredLevel: 70,
            attack: 850,
            defense: 420,
            spawnMessage: '거세게 바람이 불어옵니다!\n폭풍의 정령이 나타났습니다!',
            rewards: {
                exp: 160000,
                gold: 1500000,
                items: [
                    { id: 'storm_essence', chance: 0.08 },
                    { id: 'lightning_gem', chance: 0.15 }
                ]
            },
            skills: [
                { name: '번개 강타', damage: 1500, chance: 0.4 },
                { name: '폭풍우', damage: 1300, effect: 'shock', chance: 0.3 },
                { name: '천둥번개', damage: 2200, chance: 0.1 }
            ]
        },

        // 숙련자 보스 (Lv.80-100)
        {
            id: 'flame_drake',
            name: '화염 드레이크',
            emoji: '🔥',
            level: 85,
            hp: 600000,
            requiredLevel: 75,
            attack: 700,
            defense: 450,
            spawnMessage: '하늘이 붉게 물들었습니다!\n화염을 뿜으며 드레이크가 날아옵니다!',
            rewards: {
                exp: 200000,
                gold: 2000000,
                items: [
                    { id: 'drake_scale', chance: 0.1 },
                    { id: 'flame_orb', chance: 0.15 }
                ]
            },
            skills: [
                { name: '화염 숨결', damage: 1800, chance: 0.4 },
                { name: '용암 폭발', damage: 2000, chance: 0.3 },
                { name: '불의 폭풍', damage: 2500, chance: 0.15 }
            ]
        },
        {
            id: 'abyss_creature',
            name: '심연의 괴물',
            emoji: '👾',
            level: 90,
            hp: 750000,
            requiredLevel: 80,
            attack: 800,
            defense: 500,
            spawnMessage: '깊은 어둠에서 무언가 기어 나옵니다...\n심연의 괴물이 모습을 드러냈습니다!',
            rewards: {
                exp: 250000,
                gold: 2500000,
                items: [
                    { id: 'abyss_gem', chance: 0.08 },
                    { id: 'void_essence', chance: 0.12 }
                ]
            },
            skills: [
                { name: '심연의 손길', damage: 2000, effect: 'curse', chance: 0.4 },
                { name: '공허 폭발', damage: 2300, chance: 0.3 },
                { name: '차원 균열', damage: 3000, chance: 0.1 }
            ]
        },
        {
            id: 'ancient_golem',
            name: '고대 골렘',
            emoji: '🗿',
            level: 95,
            hp: 900000,
            requiredLevel: 85,
            attack: 900,
            defense: 600,
            spawnMessage: '오랜 세월이 깨어납니다!\n고대의 수호자가 부활했습니다!',
            rewards: {
                exp: 300000,
                gold: 3000000,
                items: [
                    { id: 'ancient_core', chance: 0.06 },
                    { id: 'eternal_stone', chance: 0.1 }
                ]
            },
            skills: [
                { name: '천년의 주먹', damage: 2300, chance: 0.4 },
                { name: '불멸의 방패', effect: 'super_shield', chance: 0.3 },
                { name: '대지 붕괴', damage: 3500, chance: 0.1 }
            ]
        },
        {
            id: 'demon_lord',
            name: '데몬 로드',
            emoji: '👹',
            level: 100,
            hp: 1200000,
            requiredLevel: 90,
            attack: 1000,
            defense: 650,
            spawnMessage: '지옥의 문이 열렸습니다!\n악마의 군주가 강림했습니다!',
            rewards: {
                exp: 400000,
                gold: 4000000,
                items: [
                    { id: 'demon_horn', chance: 0.05 },
                    { id: 'hell_essence', chance: 0.08 }
                ]
            },
            skills: [
                { name: '지옥불', damage: 2500, chance: 0.4 },
                { name: '악마의 저주', damage: 2000, effect: 'debuff', chance: 0.3 },
                { name: '최후의 심판', damage: 4000, chance: 0.08 }
            ]
        },
        {
            id: 'dragon_guardian',
            name: '용의 수호자',
            emoji: '🐲',
            level: 100,
            hp: 1500000,
            requiredLevel: 95,
            attack: 1200,
            defense: 750,
            spawnMessage: '고대의 용이 날개를 펼쳤습니다!\n전설의 수호자가 깨어났습니다!',
            rewards: {
                exp: 500000,
                gold: 5000000,
                items: [
                    { id: 'dragon_heart', chance: 0.03 },
                    { id: 'guardian_seal', chance: 0.05 }
                ]
            },
            skills: [
                { name: '용의 숨결', damage: 3000, chance: 0.4 },
                { name: '수호의 방패', effect: 'team_shield', chance: 0.3 },
                { name: '천공의 심판', damage: 5000, chance: 0.05 }
            ]
        },

        // ========== 중급 보스 (레벨 101-200) ==========
        // 전사 보스 (Lv.100-150)
        {
            id: 'frost_dragon',
            name: '서리 드래곤',
            emoji: '🐉',
            level: 110,
            hp: 7500000,
            requiredLevel: 100,
            attack: 4500,
            defense: 2000,
            spawnMessage: '얼어붙은 호수가 깨지고 있습니다!\n서리 드래곤이 깨어나 하늘로 날아오릅니다!',
            rewards: {
                exp: 750000,
                gold: 7500000,
                items: [
                    { id: 'frost_scale', chance: 0.04 },
                    { id: 'ice_dragon_heart', chance: 0.02 }
                ]
            },
            skills: [
                { name: '빙결의 숨결', damage: 4000, effect: 'freeze', chance: 0.4 },
                { name: '얼음 폭풍', damage: 3500, chance: 0.3 },
                { name: '절대 빙하', damage: 6000, chance: 0.08 }
            ]
        },
        {
            id: 'fire_elemental_lord',
            name: '화염 엘리멘탈',
            emoji: '🔥',
            level: 120,
            hp: 10000000,
            requiredLevel: 110,
            attack: 5500,
            defense: 2200,
            spawnMessage: '모든 것이 불타기 시작합니다!\n원초의 화염 정령이 강림했습니다!',
            rewards: {
                exp: 1000000,
                gold: 10000000,
                items: [
                    { id: 'eternal_flame', chance: 0.03 },
                    { id: 'elemental_core', chance: 0.05 }
                ]
            },
            skills: [
                { name: '화염 폭발', damage: 5000, chance: 0.4 },
                { name: '불길 편', damage: 4500, effect: 'burn', chance: 0.3 },
                { name: '용암 지옥', damage: 7500, chance: 0.06 }
            ]
        },
        {
            id: 'lightning_titan',
            name: '번개 타이탄',
            emoji: '⚡',
            level: 130,
            hp: 15000000,
            requiredLevel: 120,
            attack: 7000,
            defense: 2500,
            spawnMessage: '천둥번개가 내리치고 있습니다!\n거대한 타이탄이 번개를 품고 나타났습니다!',
            rewards: {
                exp: 1500000,
                gold: 15000000,
                items: [
                    { id: 'titan_core', chance: 0.03 },
                    { id: 'thunder_stone', chance: 0.04 }
                ]
            },
            skills: [
                { name: '천둥 강타', damage: 6000, chance: 0.4 },
                { name: '번개 사슬', damage: 5500, effect: 'paralyze', chance: 0.3 },
                { name: '천벌', damage: 9000, chance: 0.05 }
            ]
        },
        {
            id: 'earth_destroyer',
            name: '대지의 파괴자',
            emoji: '🌍',
            level: 140,
            hp: 20000000,
            requiredLevel: 130,
            attack: 8500,
            defense: 3000,
            spawnMessage: '대륙이 기자기 시작합니다!\n모든 것을 파괴하는 자가 깨어났습니다!',
            rewards: {
                exp: 2000000,
                gold: 20000000,
                items: [
                    { id: 'destroyer_hammer', chance: 0.02 },
                    { id: 'earth_crystal', chance: 0.04 }
                ]
            },
            skills: [
                { name: '대륙 분쇄', damage: 7000, chance: 0.4 },
                { name: '지각 변동', damage: 8000, effect: 'stun', chance: 0.3 },
                { name: '종말의 지진', damage: 12000, chance: 0.04 }
            ]
        },
        {
            id: 'dark_knight_commander',
            name: '암흑 기사단장',
            emoji: '⚔️',
            level: 150,
            hp: 30000000,
            requiredLevel: 140,
            attack: 10000,
            defense: 3500,
            spawnMessage: '어둠의 기사단이 진격해옵니다!\n무자비한 단장이 칼을 뽑았습니다!',
            rewards: {
                exp: 3000000,
                gold: 30000000,
                items: [
                    { id: 'dark_blade', chance: 0.02 },
                    { id: 'knight_emblem', chance: 0.03 }
                ]
            },
            skills: [
                { name: '암흑 참격', damage: 8500, chance: 0.4 },
                { name: '절망의 오라', damage: 7000, effect: 'fear', chance: 0.3 },
                { name: '흑염룡파참', damage: 15000, chance: 0.03 }
            ]
        },

        // 영웅 보스 (Lv.150-200)
        {
            id: 'sky_ruler',
            name: '천공의 지배자',
            emoji: '☁️',
            level: 160,
            hp: 40000000,
            requiredLevel: 150,
            attack: 12000,
            defense: 4000,
            spawnMessage: '하늘이 어두워집니다!\n천공의 지배자가 강림했습니다!',
            rewards: {
                exp: 4000000,
                gold: 40000000,
                items: [
                    { id: 'sky_crown', chance: 0.015 },
                    { id: 'cloud_essence', chance: 0.03 }
                ]
            },
            skills: [
                { name: '천공의 심판', damage: 10000, chance: 0.4 },
                { name: '구름 폭풍', damage: 9000, effect: 'blind', chance: 0.3 },
                { name: '신의 분노', damage: 18000, chance: 0.02 }
            ]
        },
        {
            id: 'deep_sea_leviathan',
            name: '심해의 리바이어던',
            emoji: '🌊',
            level: 170,
            hp: 55000000,
            requiredLevel: 160,
            attack: 14000,
            defense: 4500,
            spawnMessage: '바다가 요동치기 시작합니다!\n전설의 해수가 깨어났습니다!',
            rewards: {
                exp: 5500000,
                gold: 55000000,
                items: [
                    { id: 'leviathan_scale', chance: 0.01 },
                    { id: 'ocean_pearl', chance: 0.02 }
                ]
            },
            skills: [
                { name: '대해일', damage: 12000, chance: 0.4 },
                { name: '심해의 압력', damage: 10000, effect: 'crush', chance: 0.3 },
                { name: '포세이돈의 분노', damage: 22000, chance: 0.015 }
            ]
        },
        {
            id: 'immortal_phoenix',
            name: '불멸의 피닉스',
            emoji: '🦅',
            level: 180,
            hp: 70000000,
            requiredLevel: 170,
            attack: 16000,
            defense: 5000,
            spawnMessage: '불꽃이 하늘을 뒤덮습니다!\n불사조가 화염 속에서 부활했습니다!',
            rewards: {
                exp: 7000000,
                gold: 70000000,
                items: [
                    { id: 'phoenix_feather', chance: 0.01 },
                    { id: 'rebirth_flame', chance: 0.015 }
                ]
            },
            skills: [
                { name: '불사조의 날개', damage: 14000, chance: 0.4 },
                { name: '재생의 불꽃', effect: 'heal_boss', chance: 0.3 },
                { name: '부활의 화염', damage: 25000, chance: 0.01 }
            ]
        },
        {
            id: 'hell_cerberus',
            name: '지옥의 케르베로스',
            emoji: '🐕',
            level: 190,
            hp: 90000000,
            requiredLevel: 180,
            attack: 18000,
            defense: 5500,
            spawnMessage: '지옥의 문지기가 풀려났습니다!\n세 개의 머리를 가진 지옥견이 포효합니다!',
            rewards: {
                exp: 9000000,
                gold: 90000000,
                items: [
                    { id: 'cerberus_fang', chance: 0.008 },
                    { id: 'hell_gate_key', chance: 0.01 }
                ]
            },
            skills: [
                { name: '삼두의 포효', damage: 16000, effect: 'triple_attack', chance: 0.4 },
                { name: '지옥의 화염', damage: 15000, chance: 0.3 },
                { name: '명계의 심판', damage: 30000, chance: 0.008 }
            ]
        },
        {
            id: 'time_keeper',
            name: '시간의 파수꾼',
            emoji: '⏰',
            level: 200,
            hp: 120000000,
            requiredLevel: 190,
            attack: 20000,
            defense: 6000,
            spawnMessage: '시간이 왜곡되기 시작합니다!\n시간의 파수꾼이 나타났습니다!',
            rewards: {
                exp: 12000000,
                gold: 120000000,
                items: [
                    { id: 'time_crystal', chance: 0.005 },
                    { id: 'chrono_gear', chance: 0.008 }
                ]
            },
            skills: [
                { name: '시간 정지', damage: 0, effect: 'time_stop', chance: 0.3 },
                { name: '시간 역행', damage: 18000, effect: 'rewind', chance: 0.3 },
                { name: '영원의 종말', damage: 35000, chance: 0.005 }
            ]
        },

        // ========== 상급 보스 (레벨 201-250) ==========
        // 전설 보스 (Lv.200-250)
        {
            id: 'ancient_dragon_king',
            name: '고대 용왕',
            emoji: '🐉',
            level: 210,
            hp: 150000000,
            requiredLevel: 200,
            attack: 25000,
            defense: 7000,
            spawnMessage: '하늘이 갈라지고 대지가 흔들립니다!\n전설 속의 용왕이 깨어났습니다!',
            rewards: {
                exp: 15000000,
                gold: 150000000,
                items: [
                    { id: 'dragon_king_heart', chance: 0.004 },
                    { id: 'ancient_dragon_scale', chance: 0.006 }
                ]
            },
            skills: [
                { name: '용왕의 숨결', damage: 22000, chance: 0.4 },
                { name: '천지개벽', damage: 25000, effect: 'massive_aoe', chance: 0.3 },
                { name: '드래곤 로어', damage: 40000, chance: 0.004 }
            ]
        },
        {
            id: 'celestial_judge',
            name: '천계의 심판관',
            emoji: '⚖️',
            level: 220,
            hp: 200000000,
            requiredLevel: 210,
            attack: 30000,
            defense: 8000,
            spawnMessage: '천상의 법정이 열립니다!\n신성한 심판관이 강림했습니다!',
            rewards: {
                exp: 20000000,
                gold: 200000000,
                items: [
                    { id: 'judgement_scale', chance: 0.003 },
                    { id: 'celestial_orb', chance: 0.005 }
                ]
            },
            skills: [
                { name: '신성한 심판', damage: 26000, chance: 0.4 },
                { name: '천벌의 빛', damage: 28000, effect: 'holy_damage', chance: 0.3 },
                { name: '최후의 판결', damage: 50000, chance: 0.003 }
            ]
        },
        {
            id: 'nightmare_lord',
            name: '악몽의 군주',
            emoji: '💀',
            level: 230,
            hp: 250000000,
            requiredLevel: 220,
            attack: 35000,
            defense: 9000,
            spawnMessage: '두려움이 현실이 됩니다!\n악몽의 군주가 깨어났습니다!',
            rewards: {
                exp: 25000000,
                gold: 250000000,
                items: [
                    { id: 'nightmare_crown', chance: 0.002 },
                    { id: 'dream_eater', chance: 0.004 }
                ]
            },
            skills: [
                { name: '악몽 침식', damage: 30000, effect: 'nightmare', chance: 0.4 },
                { name: '공포의 환영', damage: 32000, chance: 0.3 },
                { name: '절망의 종말', damage: 60000, chance: 0.002 }
            ]
        },
        {
            id: 'elemental_overlord',
            name: '원소의 대정령',
            emoji: '💫',
            level: 240,
            hp: 350000000,
            requiredLevel: 230,
            attack: 40000,
            defense: 10000,
            spawnMessage: '모든 원소가 공명하기 시작합니다!\n원소의 대정령이 각성했습니다!',
            rewards: {
                exp: 35000000,
                gold: 350000000,
                items: [
                    { id: 'elemental_heart', chance: 0.002 },
                    { id: 'primal_essence', chance: 0.003 }
                ]
            },
            skills: [
                { name: '원소 폭발', damage: 35000, effect: 'random_element', chance: 0.4 },
                { name: '정령왕의 분노', damage: 38000, chance: 0.3 },
                { name: '원시의 힘', damage: 75000, chance: 0.0015 }
            ]
        },
        {
            id: 'chaos_incarnate',
            name: '혼돈의 화신',
            emoji: '🌀',
            level: 250,
            hp: 500000000,
            requiredLevel: 240,
            attack: 45000,
            defense: 12000,
            spawnMessage: '현실이 왜곡되기 시작합니다!\n혼돈 그 자체가 형상화되어 나타났습니다!',
            rewards: {
                exp: 50000000,
                gold: 500000000,
                items: [
                    { id: 'chaos_core', chance: 0.001 },
                    { id: 'void_crystal', chance: 0.002 }
                ]
            },
            skills: [
                { name: '혼돈의 폭풍', damage: 40000, effect: 'chaos', chance: 0.4 },
                { name: '무질서의 파동', damage: 45000, chance: 0.3 },
                { name: '엔트로피', damage: 90000, chance: 0.001 }
            ]
        },

        // ========== 최상급 보스 (레벨 251-300) ==========
        // 신화 보스 (Lv.250-300)
        {
            id: 'fallen_archangel',
            name: '타락한 천사장',
            emoji: '😇',
            level: 260,
            hp: 750000000,
            requiredLevel: 250,
            attack: 55000,
            defense: 15000,
            spawnMessage: '천상에서 검은 깃털이 떨어집니다...\n타락한 천사장이 강림했습니다!',
            rewards: {
                exp: 75000000,
                gold: 750000000,
                items: [
                    { id: 'fallen_wing', chance: 0.0008 },
                    { id: 'corrupted_halo', chance: 0.001 }
                ]
            },
            skills: [
                { name: '타락한 빛', damage: 48000, effect: 'corrupt', chance: 0.4 },
                { name: '천사의 나팔', damage: 52000, chance: 0.3 },
                { name: '신성모독', damage: 120000, chance: 0.0008 }
            ]
        },
        {
            id: 'ancient_god_avatar',
            name: '고대 신의 화신',
            emoji: '🗿',
            level: 270,
            hp: 1000000000,
            requiredLevel: 260,
            attack: 65000,
            defense: 18000,
            spawnMessage: '잊혀진 신전이 움직입니다!\n고대 신의 화신이 깨어났습니다!',
            rewards: {
                exp: 100000000,
                gold: 1000000000,
                items: [
                    { id: 'god_fragment', chance: 0.0005 },
                    { id: 'divine_essence', chance: 0.0008 }
                ]
            },
            skills: [
                { name: '신의 권능', damage: 58000, chance: 0.4 },
                { name: '창조의 빛', damage: 62000, effect: 'creation', chance: 0.3 },
                { name: '신벌', damage: 150000, chance: 0.0005 }
            ]
        },
        {
            id: 'dimension_destroyer',
            name: '차원의 파괴자',
            emoji: '🌌',
            level: 280,
            hp: 1500000000,
            requiredLevel: 270,
            attack: 75000,
            defense: 20000,
            spawnMessage: '공간이 찢어지기 시작합니다!\n차원의 틈에서 파괴자가 나타났습니다!',
            rewards: {
                exp: 150000000,
                gold: 1500000000,
                items: [
                    { id: 'dimension_shard', chance: 0.0003 },
                    { id: 'void_breaker', chance: 0.0005 }
                ]
            },
            skills: [
                { name: '차원 절단', damage: 68000, effect: 'dimension_rift', chance: 0.4 },
                { name: '공간 붕괴', damage: 72000, chance: 0.3 },
                { name: '무한의 종말', damage: 200000, chance: 0.0003 }
            ]
        },
        {
            id: 'apocalypse_prophet',
            name: '종말의 예언자',
            emoji: '☄️',
            level: 290,
            hp: 2000000000,
            requiredLevel: 280,
            attack: 85000,
            defense: 25000,
            spawnMessage: '운명의 별이 떨어지기 시작합니다!\n종말의 예언자가 나타났습니다!',
            rewards: {
                exp: 200000000,
                gold: 2000000000,
                items: [
                    { id: 'prophecy_scroll', chance: 0.0002 },
                    { id: 'doomsday_clock', chance: 0.0003 }
                ]
            },
            skills: [
                { name: '종말의 예언', damage: 78000, effect: 'doom', chance: 0.4 },
                { name: '재앙의 운석', damage: 82000, chance: 0.3 },
                { name: '아마겟돈', damage: 250000, chance: 0.0002 }
            ]
        },
        {
            id: 'creation_destruction_god',
            name: '창조와 파괴의 신',
            emoji: '⚡',
            level: 300,
            hp: 3000000000,
            requiredLevel: 290,
            attack: 100000,
            defense: 30000,
            spawnMessage: '우주의 균형이 무너지고 있습니다!\n창조와 파괴의 신이 강림했습니다!',
            rewards: {
                exp: 300000000,
                gold: 3000000000,
                items: [
                    { id: 'god_core', chance: 0.0001 },
                    { id: 'eternal_crown', chance: 0.0002 }
                ]
            },
            skills: [
                { name: '창조', damage: 90000, effect: 'creation_destruction', chance: 0.4 },
                { name: '파괴', damage: 95000, chance: 0.3 },
                { name: '라그나로크', damage: 300000, chance: 0.0001 }
            ]
        }
    ],
    
    // 보스 소환 설정
    settings: {
        spawnInterval: 3600000, // 1시간
        minParticipants: 2,
        maxParticipants: 20,
        bossDuration: 1800000, // 30분
        channelId: '1391112529828384870'
    },
    
    // 랭킹 보상 (기존과 동일)
    rankingRewards: {
        1: { emblemFragments: 3, expMultiplier: 1.5, goldMultiplier: 2.0 },
        2: { emblemFragments: 2, expMultiplier: 1.3, goldMultiplier: 1.5 },
        3: { emblemFragments: 1, expMultiplier: 1.2, goldMultiplier: 1.3 },
        4: { emblemFragments: 0.5, expMultiplier: 1.1, goldMultiplier: 1.1 },
        5: { emblemFragments: 0.5, expMultiplier: 1.0, goldMultiplier: 1.0 }
    }
};

module.exports = BOSS_SYSTEM_SEASON2;