require('dotenv').config();
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
const connectDB = require('./database/connection');
const User = require('./models/User');
const { generateVerificationCode, sendVerificationEmail } = require('./services/emailService');
const huntingAreas = require('./data/huntingAreas');

// 상점 아이템 데이터 (레벨 시스템 포함)
const shopItems = [
    {
        id: 'basic_sword',
        name: '기본 검',
        type: 'weapon',
        rarity: '노멀',
        level: 1,
        price: 500,
        stats: { attack: 10, defense: 0, hp: 0, mp: 0 },
        description: '모험가를 위한 기본적인 검입니다.'
    },
    {
        id: 'basic_armor',
        name: '기본 갑옷',
        type: 'armor',
        rarity: '노멀',
        level: 1,
        price: 800,
        stats: { attack: 0, defense: 15, hp: 50, mp: 0 },
        description: '기본적인 방어력을 제공하는 갑옷입니다.'
    },
    {
        id: 'steel_sword',
        name: '강철 검',
        type: 'weapon',
        rarity: '레어',
        level: 10,
        price: 2000,
        stats: { attack: 25, defense: 0, hp: 0, mp: 0 },
        description: '단단한 강철로 만든 검입니다.'
    },
    {
        id: 'health_potion',
        name: '체력 포션',
        type: 'consumable',
        rarity: '노멀',
        level: 1,
        price: 100,
        stats: { attack: 0, defense: 0, hp: 100, mp: 0 },
        description: '체력을 회복시켜주는 포션입니다.'
    },
    {
        id: 'mana_potion',
        name: '마나 포션',
        type: 'consumable',
        rarity: '노멀',
        level: 1,
        price: 100,
        stats: { attack: 0, defense: 0, hp: 0, mp: 50 },
        description: '마나를 회복시켜주는 포션입니다.'
    }
];

// 상점 카테고리 데이터 정의 (전역으로 사용)
const SHOP_CATEGORIES = {
    weapon: {
        name: '무기',
        emoji: '⚔️',
        gif: 'kim_shop_weapon.png',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃잎 칼', 
                rarity: '일반', 
                price: 500, 
                type: 'weapon',
                setName: '꽃잎 세트',
                level: 1,
                description: '꽃의 힘이 깃든 기본 무기입니다.',
                stats: { 
                    attack: [15, 25], 
                    defense: [5, 10], 
                    dodge: [0, 0], 
                    luck: [0, 0] 
                }
            },
            { 
                name: '꽃다발 도끼', 
                rarity: '일반', 
                price: 600, 
                type: 'weapon',
                setName: '꽃잎 세트',
                level: 1,
                description: '꽃다발처럼 아름답지만 강력한 도끼입니다.',
                stats: { 
                    attack: [25, 35], 
                    defense: [3, 8], 
                    dodge: [-2, -2], 
                    luck: [0, 0] 
                }
            },
            { 
                name: '꽃향기 활', 
                rarity: '일반', 
                price: 550, 
                type: 'weapon',
                setName: '꽃잎 세트',
                level: 1,
                description: '꽃향기가 퍼지며 행운을 부르는 활입니다.',
                stats: { 
                    attack: [18, 28], 
                    defense: [0, 0], 
                    dodge: [0, 0], 
                    luck: [5, 10] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별빛 칼', 
                rarity: '고급', 
                price: 2500, 
                type: 'weapon',
                setName: '별빛 세트',
                level: 20,
                description: '별의 힘이 깃든 무기입니다.',
                stats: { 
                    attack: [50, 70], 
                    defense: [15, 25], 
                    dodge: [3, 3], 
                    luck: [0, 0] 
                }
            },
            { 
                name: '유성 도끼', 
                rarity: '고급', 
                price: 2800, 
                type: 'weapon',
                setName: '별빛 세트',
                level: 20,
                description: '유성의 파괴력이 담긴 강력한 도끼입니다.',
                stats: { 
                    attack: [70, 95], 
                    defense: [10, 20], 
                    dodge: [-3, -3], 
                    luck: [5, 5] 
                }
            },
            { 
                name: '은하 활', 
                rarity: '고급', 
                price: 2600, 
                type: 'weapon',
                setName: '별빛 세트',
                level: 20,
                description: '은하의 신비로운 힘을 담은 활입니다.',
                stats: { 
                    attack: [55, 75], 
                    defense: [0, 0], 
                    dodge: [8, 8], 
                    luck: [12, 20] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '드래곤 킬러', 
                rarity: '레어', 
                price: 12000, 
                type: 'weapon',
                setName: '드래곤 세트',
                level: 40,
                description: '용을 처치할 수 있는 강력한 무기입니다.',
                stats: { 
                    attack: [120, 180], 
                    defense: [40, 60], 
                    dodge: [0, 0], 
                    luck: [8, 8] 
                }
            },
            { 
                name: '용의 분노 도끼', 
                rarity: '레어', 
                price: 15000, 
                type: 'weapon',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 분노가 담긴 파괴적인 도끼입니다.',
                stats: { 
                    attack: [180, 250], 
                    defense: [25, 45], 
                    dodge: [-5, -5], 
                    luck: [10, 10] 
                }
            },
            { 
                name: '드래곤브레스 활', 
                rarity: '레어', 
                price: 13000, 
                type: 'weapon',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 브레스를 사용하는 신비한 활입니다.',
                stats: { 
                    attack: [140, 200], 
                    defense: [0, 0], 
                    dodge: [15, 15], 
                    luck: [20, 35] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시간의 칼', 
                rarity: '에픽', 
                price: 50000, 
                type: 'weapon',
                setName: '시공 세트',
                level: 60,
                description: '시간을 조작할 수 있는 신비한 능력이 담긴 칼입니다.',
                stats: { 
                    attack: [300, 450], 
                    defense: [100, 150], 
                    dodge: [20, 20], 
                    luck: [15, 15] 
                }
            },
            { 
                name: '공간 절단 도끼', 
                rarity: '에픽', 
                price: 60000, 
                type: 'weapon',
                setName: '시공 세트',
                level: 60,
                description: '공간을 절단할 수 있는 차원 조작 도끼입니다.',
                stats: { 
                    attack: [450, 650], 
                    defense: [80, 120], 
                    dodge: [-8, -8], 
                    luck: [20, 20] 
                }
            },
            { 
                name: '차원 활', 
                rarity: '에픽', 
                price: 55000, 
                type: 'weapon',
                setName: '시공 세트',
                level: 60,
                description: '다른 차원에서 화살을 소환하는 신비한 활입니다.',
                stats: { 
                    attack: [350, 500], 
                    defense: [0, 0], 
                    dodge: [30, 30], 
                    luck: [40, 60] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕의 칼', 
                rarity: '레전드리', 
                price: 200000, 
                type: 'weapon',
                setName: '강화왕 세트',
                level: 80,
                description: '강화의 왜이 되어 전설이 된 최강의 칼입니다.',
                stats: { 
                    attack: [600, 900], 
                    defense: [200, 300], 
                    dodge: [30, 30], 
                    luck: [25, 25] 
                }
            },
            { 
                name: '절대 파괴 도끼', 
                rarity: '레전드리', 
                price: 250000, 
                type: 'weapon',
                setName: '강화왕 세트',
                level: 80,
                description: '모든 것을 파괴할 수 있는 절대적인 힘의 도끼입니다.',
                stats: { 
                    attack: [900, 1300], 
                    defense: [150, 250], 
                    dodge: [-10, -10], 
                    luck: [35, 35] 
                }
            },
            { 
                name: '운명 지배 활', 
                rarity: '레전드리', 
                price: 220000, 
                type: 'weapon',
                setName: '강화왕 세트',
                level: 80,
                description: '운명을 지배하여 절대적인 사격을 보장하는 전설의 활입니다.',
                stats: { 
                    attack: [700, 1000], 
                    defense: [0, 0], 
                    dodge: [50, 50], 
                    luck: [60, 90] 
                }
            }
        ]
    },
    helmet: {
        name: '헬멧',
        emoji: '⛑️',
        gif: 'kim_shop_hood.png',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃 화관', 
                rarity: '일반', 
                price: 400, 
                type: 'helmet',
                setName: '꽃잎 세트',
                level: 1,
                description: '꽃잎으로 만든 아름다운 머리 장식입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [8, 15], 
                    dodge: [3, 6], 
                    luck: [0, 0] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별자리 관', 
                rarity: '고급', 
                price: 2000, 
                type: 'helmet',
                setName: '별빛 세트',
                level: 20,
                description: '별자리의 축복이 담긴 신비한 관입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [20, 35], 
                    dodge: [8, 15], 
                    luck: [5, 5] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '용 투구', 
                rarity: '레어', 
                price: 10000, 
                type: 'helmet',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 비늘로 만든 강력한 방어력의 투구입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [50, 80], 
                    dodge: [15, 25], 
                    luck: [10, 10] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시공간 관', 
                rarity: '에픽', 
                price: 40000, 
                type: 'helmet',
                setName: '시공 세트',
                level: 60,
                description: '시공간을 조작할 수 있는 신비한 힘이 담긴 관입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [120, 180], 
                    dodge: [25, 40], 
                    luck: [20, 20] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕 관', 
                rarity: '레전드리', 
                price: 180000, 
                type: 'helmet',
                setName: '강화왕 세트',
                level: 80,
                description: '강화의 왕이 착용하는 최고급 대마법사의 관입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [250, 380], 
                    dodge: [40, 60], 
                    luck: [35, 35] 
                }
            }
        ]
    },
    armor: {
        name: '갑옷',
        emoji: '🛡️',
        gif: 'kim_shop_armor.png',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃잎 옷', 
                rarity: '일반', 
                price: 450, 
                type: 'armor',
                setName: '꽃잎 세트',
                level: 1,
                description: '꽃잎으로 만든 가벼운 방어구입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [10, 20], 
                    dodge: [2, 4], 
                    luck: [0, 0] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별빛 갑옷', 
                rarity: '고급', 
                price: 2200, 
                type: 'armor',
                setName: '별빛 세트',
                level: 20,
                description: '별빛이 반짝이는 신비로운 갑옷입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [30, 50], 
                    dodge: [5, 10], 
                    luck: [3, 3] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '드래곤 스케일 갑옷', 
                rarity: '레어', 
                price: 11000, 
                type: 'armor',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 비늘로 만든 단단한 갑옷입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [80, 120], 
                    dodge: [10, 18], 
                    luck: [8, 8] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시공간 갑옷', 
                rarity: '에픽', 
                price: 45000, 
                type: 'armor',
                setName: '시공 세트',
                level: 60,
                description: '시공간의 왜곡으로 공격을 방어하는 갑옷입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [150, 230], 
                    dodge: [20, 35], 
                    luck: [15, 15] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕의 갑옷', 
                rarity: '레전드리', 
                price: 190000, 
                type: 'armor',
                setName: '강화왕 세트',
                level: 80,
                description: '강화의 절대자가 착용하는 최강의 갑옷입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [300, 450], 
                    dodge: [35, 55], 
                    luck: [30, 30] 
                }
            }
        ]
    },
    gloves: {
        name: '장갑',
        emoji: '🧤',
        gif: 'kim_shop_gloves.png',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃잎 장갑', 
                rarity: '일반', 
                price: 350, 
                type: 'gloves',
                setName: '꽃잎 세트',
                level: 1,
                description: '부드러운 꽃잎으로 만든 장갑입니다.',
                stats: { 
                    attack: [3, 8], 
                    defense: [5, 10], 
                    dodge: [5, 8], 
                    luck: [2, 2] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별빛 장갑', 
                rarity: '고급', 
                price: 1800, 
                type: 'gloves',
                setName: '별빛 세트',
                level: 20,
                description: '별의 힘이 깃든 민첩한 장갑입니다.',
                stats: { 
                    attack: [10, 20], 
                    defense: [15, 25], 
                    dodge: [12, 20], 
                    luck: [8, 8] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '드래곤 클로', 
                rarity: '레어', 
                price: 9000, 
                type: 'gloves',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 발톱을 모방한 공격적인 장갑입니다.',
                stats: { 
                    attack: [30, 50], 
                    defense: [30, 50], 
                    dodge: [20, 30], 
                    luck: [15, 15] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시공간 장갑', 
                rarity: '에픽', 
                price: 38000, 
                type: 'gloves',
                setName: '시공 세트',
                level: 60,
                description: '시공간을 조작하는 능력이 담긴 장갑입니다.',
                stats: { 
                    attack: [60, 100], 
                    defense: [60, 100], 
                    dodge: [35, 50], 
                    luck: [25, 25] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕의 장갑', 
                rarity: '레전드리', 
                price: 170000, 
                type: 'gloves',
                setName: '강화왕 세트',
                level: 80,
                description: '강화의 힘을 극대화시키는 전설의 장갑입니다.',
                stats: { 
                    attack: [120, 200], 
                    defense: [120, 200], 
                    dodge: [50, 70], 
                    luck: [40, 40] 
                }
            }
        ]
    },
    boots: {
        name: '부츠',
        emoji: '👢',
        gif: 'kim_shop_boots.png',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃잎 신발', 
                rarity: '일반', 
                price: 380, 
                type: 'boots',
                setName: '꽃잎 세트',
                level: 1,
                description: '가볍고 편안한 꽃잎 신발입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [6, 12], 
                    dodge: [8, 12], 
                    luck: [1, 1] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별빛 부츠', 
                rarity: '고급', 
                price: 1900, 
                type: 'boots',
                setName: '별빛 세트',
                level: 20,
                description: '별처럼 빠른 속도를 자랑하는 부츠입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [18, 30], 
                    dodge: [18, 28], 
                    luck: [6, 6] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '드래곤 워커', 
                rarity: '레어', 
                price: 9500, 
                type: 'boots',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 발걸음처럼 묵직한 부츠입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [40, 70], 
                    dodge: [30, 45], 
                    luck: [12, 12] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시공간 부츠', 
                rarity: '에픽', 
                price: 42000, 
                type: 'boots',
                setName: '시공 세트',
                level: 60,
                description: '순간이동이 가능한 신비한 부츠입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [80, 130], 
                    dodge: [60, 85], 
                    luck: [22, 22] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕의 부츠', 
                rarity: '레전드리', 
                price: 175000, 
                type: 'boots',
                setName: '강화왕 세트',
                level: 80,
                description: '절대적인 속도와 회피를 보장하는 전설의 부츠입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [160, 260], 
                    dodge: [100, 140], 
                    luck: [38, 38] 
                }
            }
        ]
    },
    accessory: {
        name: '액세서리',
        emoji: '💎',
        gif: 'kim_equipment_acce.gif',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃잎 목걸이', 
                rarity: '일반', 
                price: 420, 
                type: 'accessory',
                setName: '꽃잎 세트',
                level: 1,
                description: '행운을 부르는 꽃잎 목걸이입니다.',
                stats: { 
                    attack: [2, 5], 
                    defense: [2, 5], 
                    dodge: [2, 2], 
                    luck: [8, 12] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별빛 반지', 
                rarity: '고급', 
                price: 2100, 
                type: 'accessory',
                setName: '별빛 세트',
                level: 20,
                description: '별의 축복이 담긴 신비한 반지입니다.',
                stats: { 
                    attack: [8, 15], 
                    defense: [8, 15], 
                    dodge: [5, 5], 
                    luck: [20, 30] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '드래곤 하트', 
                rarity: '레어', 
                price: 10500, 
                type: 'accessory',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 심장이 담긴 강력한 액세서리입니다.',
                stats: { 
                    attack: [20, 35], 
                    defense: [20, 35], 
                    dodge: [8, 8], 
                    luck: [40, 60] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시공간 크리스탈', 
                rarity: '에픽', 
                price: 48000, 
                type: 'accessory',
                setName: '시공 세트',
                level: 60,
                description: '시공간의 힘이 응축된 크리스탈입니다.',
                stats: { 
                    attack: [40, 70], 
                    defense: [40, 70], 
                    dodge: [15, 15], 
                    luck: [80, 120] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕의 증표', 
                rarity: '레전드리', 
                price: 195000, 
                type: 'accessory',
                setName: '강화왕 세트',
                level: 80,
                description: '강화의 절대자임을 증명하는 최고의 액세서리입니다.',
                stats: { 
                    attack: [80, 140], 
                    defense: [80, 140], 
                    dodge: [25, 25], 
                    luck: [150, 220] 
                }
            }
        ]
    },
    consumable: {
        name: '소비',
        emoji: '💊',
        gif: 'kim_shop_con.gif',
        items: [
            // 소비 아이템 추가 예정
        ]
    },
    enhancement: {
        name: '주문서',
        emoji: '⚒️',
        gif: 'kim_shop_examples.gif',
        items: [
            // 주문서 아이템 추가 예정
        ]
    },
    coin: {
        name: '코인',
        emoji: '🪙',
        gif: 'kim_shop_coin.gif',
        items: [
            // 코인 아이템 추가 예정
        ]
    }
};

// 의뢰 시스템 데이터
const QUEST_CLIENTS = {
    // 💰 의뢰주화를 얻는 의뢰 (20가지)
    villagers: [
        {
            id: 1,
            name: '마을 주민 김봉순',
            type: 'reward',
            title: '고양이 구출 작전',
            description: '아, 당신! 혹시 시간 있으세요? 우리 집 고양이가 또 나무에 올라가서 내려오질 못하고 있어요. 도와주시면 작은 보답을 드릴게요!',
            emoji: '🐱'
        },
        {
            id: 2,
            name: '마을 주민 박철수',
            type: 'reward',
            title: '우물 소음 조사',
            description: '어머, 모험가님! 마침 잘 오셨네요. 마을 우물에서 이상한 소리가 나는데... 혹시 한 번 봐주실 수 있나요? 물론 수고비는 드릴게요.',
            emoji: '🏺'
        },
        {
            id: 3,
            name: '마을 주민 이영희',
            type: 'reward',
            title: '할머니의 약초 수집',
            description: '저기요, 모험가님! 우리 할머니가 약초를 구해달라고 하시는데... 마을 근처에서 쉽게 찾을 수 있는 거라고 하네요. 부탁드려도 될까요?',
            emoji: '🌿'
        },
        {
            id: 4,
            name: '마을 주민 최민수',
            type: 'reward',
            title: '창고 쥐 퇴치',
            description: '아! 당신이 그 유명한 모험가군요! 우리 마을 창고에 쥐들이 너무 많아졌어요. 좀 쫓아내 주실 수 있나요? 감사의 마음을 담아 보상을 드릴게요.',
            emoji: '🐭'
        },
        {
            id: 5,
            name: '마을 주민 정수연',
            type: 'reward',
            title: '마을 간판 복구',
            description: '모험가님, 잠깐만요! 마을 입구 간판이 바람에 넘어졌는데 혼자서는 다시 세우기 힘들어요. 도와주시면 고맙겠어요!',
            emoji: '📋'
        },
        {
            id: 6,
            name: '마을 주민 강지훈',
            type: 'reward',
            title: '편지 전달 부탁',
            description: '어라, 모험가님! 마침 잘 만났네요. 이웃집에 편지 좀 전해주실 수 있나요? 다리가 아파서 직접 가기가 힘들어서요...',
            emoji: '💌'
        },
        {
            id: 7,
            name: '마을 주민 윤미나',
            type: 'reward',
            title: '광장 청소 도움',
            description: '저기, 혹시 바쁘지 않으시다면... 마을 광장에 떨어진 낙엽들을 좀 치워주실 수 있나요? 마을 축제 준비 때문에 급해서요.',
            emoji: '🍂'
        },
        {
            id: 8,
            name: '마을 주민 임현우',
            type: 'reward',
            title: '지붕 위 공 회수',
            description: '모험가님! 우리 아이가 공을 지붕 위에 올려버렸어요. 사다리가 있긴 한데 혼자서는 위험해서... 도와주실 수 있나요?',
            emoji: '⚽'
        },
        {
            id: 9,
            name: '마을 주민 송다은',
            type: 'reward',
            title: '멧돼지 퇴치',
            description: '아, 당신! 마을 뒤편 텃밭에 멧돼지가 나타나서 농작물을 망가뜨리고 있어요. 쫓아내 주시면 정말 감사하겠어요!',
            emoji: '🐗'
        },
        {
            id: 10,
            name: '마을 주민 한지우',
            type: 'reward',
            title: '우물 이물질 제거',
            description: '모험가님, 잠시만요! 마을 우물물이 탁해졌는데 밑에 뭔가 떨어진 것 같아요. 건져내 주실 수 있나요? 보상은 당연히 드릴게요.',
            emoji: '🪣'
        }
    ],
    merchants: [
        {
            id: 11,
            name: '잡화상 돈복이',
            type: 'reward',
            title: '창고 정리 알바',
            description: '어어, 모험가님! 마침 잘 오셨어요. 제가 물건을 너무 많이 주문해서 창고가 꽉 찼어요. 정리 좀 도와주시면 수고비를 드릴게요!',
            emoji: '📦'
        },
        {
            id: 12,
            name: '잡화상 장사꾼',
            type: 'reward',
            title: '간판 청소 작업',
            description: '오, 모험가님! 혹시 시간 되시면 제 가게 간판 좀 닦아주실 수 있나요? 높은 곳이라 제가 하기엔 위험해서요. 물론 품삯은 드릴게요.',
            emoji: '🪧'
        },
        {
            id: 13,
            name: '잡화상 심술맨',
            type: 'reward',
            title: '야간 경비 업무',
            description: '아! 당신이 그 실력자군요! 제 상점에 도둑이 들어올까 봐 걱정인데... 오늘 밤 한 번만 지켜봐 주실 수 있나요? 사례는 충분히 드릴게요.',
            emoji: '🌙'
        },
        {
            id: 14,
            name: '잡화상 택배왕',
            type: 'reward',
            title: '물건 배달 서비스',
            description: '모험가님, 잠깐만요! 다른 마을에서 주문한 물건이 있는데 직접 배달해 주실 수 있나요? 저는 가게를 비울 수가 없어서요.',
            emoji: '📮'
        },
        {
            id: 15,
            name: '잡화상 코막힘',
            type: 'reward',
            title: '지하창고 냄새 조사',
            description: '어머, 모험가님! 제 가게 지하창고에 이상한 냄새가 나는데... 혹시 한 번 확인해 주실 수 있나요? 뭔가 썩은 것 같아서 걱정이에요.',
            emoji: '🤢'
        },
        {
            id: 16,
            name: '잡화상 겁쟁이',
            type: 'reward',
            title: '물건 수송 호위',
            description: '오, 잘 오셨어요! 제가 팔 물건들을 다른 마을에서 가져와야 하는데 길이 위험해서요. 호위해 주시면 넉넉히 보상해 드릴게요.',
            emoji: '🛡️'
        },
        {
            id: 17,
            name: '잡화상 정보통',
            type: 'reward',
            title: '특별 주문 수집',
            description: '모험가님! 마침 좋은 타이밍이네요. 제 단골손님이 특별한 물건을 찾고 있는데 구해다 주실 수 있나요? 수수료는 충분히 드릴게요.',
            emoji: '🔍'
        },
        {
            id: 18,
            name: '잡화상 스파이',
            type: 'reward',
            title: '경쟁업체 정찰',
            description: '어라, 모험가님! 제 경쟁업체가 자꾸 제 손님들을 빼앗아 가는데... 그쪽 가격이나 알아봐 주실 수 있나요? 정보비는 드릴게요.',
            emoji: '🕵️'
        },
        {
            id: 19,
            name: '잡화상 굴착맨',
            type: 'reward',
            title: '미스터리 구멍 조사',
            description: '아, 당신! 제 가게 뒤편에 이상한 구멍이 생겼는데 뭔지 확인해 주실 수 있나요? 혹시 지하에 뭔가 있을지도 몰라서요.',
            emoji: '🕳️'
        },
        {
            id: 20,
            name: '잡화상 손놈이',
            type: 'reward',
            title: '열쇠 찾기 대작전',
            description: '모험가님, 부탁이 있어요! 제가 실수로 중요한 열쇠를 연못에 빠뜨렸는데... 찾아주시면 정말 감사하겠어요. 보상은 확실히 드릴게요!',
            emoji: '🗝️'
        }
    ],
    scammers: [
        {
            id: 21,
            name: '수상한상인 약장수',
            type: 'scam',
            title: '특별 물약 시음회',
            description: '오오, 모험가님! 특별한 기회를 드릴게요! 이 마법 물약을 미리 맛보기로 드시면 효과를 보장해 드려요. 단돈 3만 골드면 되고요... 어떠세요?',
            emoji: '🧪',
            scamAmount: 30000
        },
        {
            id: 22,
            name: '수상한상인 정보꾼',
            type: 'scam',
            title: '보물 위치 정보 판매',
            description: '어어, 실력자시네요! 제가 특별한 정보를 하나 알고 있는데... 근처 동굴에 보물이 숨겨져 있어요. 위치를 알려드릴 테니 2만 골드만 주세요!',
            emoji: '🗺️',
            scamAmount: 20000
        },
        {
            id: 23,
            name: '수상한상인 마법사',
            type: 'scam',
            title: '행운의 마법 반지',
            description: '모험가님! 이 반지 보세요. 마법이 걸려있어서 운이 엄청 좋아진다고 해요! 원래 10만 골드인데 당신에게만 특가 4만 골드에 드릴게요!',
            emoji: '💍',
            scamAmount: 40000
        },
        {
            id: 24,
            name: '수상한상인 빚쟁이',
            type: 'scam',
            title: '급한 돈 대여 부탁',
            description: '아, 당신! 혹시 여기 근처에서 수상한 놈들을 본 적 있나요? 제가 물어보는 이유가... 아니, 일단 5만 골드부터 빌려주시면 설명해 드릴게요.',
            emoji: '💸',
            scamAmount: 50000
        },
        {
            id: 25,
            name: '수상한상인 사기꾼',
            type: 'scam',
            title: '친구 응급 치료비',
            description: '모험가님, 긴급상황이에요! 제 친구가 다른 마을에서 사고를 당했는데 치료비가 필요해요. 1만 골드만 빌려주시면 내일 두 배로 갚을게요!',
            emoji: '🚑',
            scamAmount: 10000
        },
        {
            id: 26,
            name: '수상한상인 보관꾼',
            type: 'scam',
            title: '귀중품 보관 서비스',
            description: '어머, 모험가님! 제가 귀중한 물건을 맡아드릴게요. 보관료로 3만 골드만 주시면... 아, 미안해요! 지금 급한 일이 생겨서 가봐야겠어요!',
            emoji: '🏃',
            scamAmount: 30000
        }
    ],
    travelers: [
        {
            id: 27,
            name: '수상한여행자 도박꾼',
            type: 'scam',
            title: '특별한 주사위 게임',
            description: '저기요! 혹시 도박 한 판 어떠세요? 이 주사위는 특별해서 거의 이길 수 있어요! 판돈 2만 골드만 걸어보시면... 분명 재미있을 거예요!',
            emoji: '🎲',
            scamAmount: 20000
        },
        {
            id: 28,
            name: '수상한여행자 모험가',
            type: 'scam',
            title: '보물찾기 동업 제안',
            description: '모험가님! 저와 함께 보물찾기를 하시겠어요? 지도도 있고 장비도 준비했는데... 참가비로 4만 골드만 내시면 절반씩 나눠가져요!',
            emoji: '🏴‍☠️',
            scamAmount: 40000
        },
        {
            id: 29,
            name: '수상한여행자 피해자',
            type: 'scam',
            title: '귀중품 수색 의뢰',
            description: '아! 당신 같은 실력자를 찾고 있었어요! 제가 몬스터에게 습격당해서 귀중품을 뺏겼는데... 찾아주시면 5만 골드를 드릴게요. 단, 수색비로 1만 골드가 필요해요.',
            emoji: '👹',
            scamAmount: 10000
        },
        {
            id: 30,
            name: '수상한여행자 거지',
            type: 'scam',
            title: '강도 피해 도움 요청',
            description: '모험가님, 급해요! 제가 마을 입구에서 강도를 당했는데 지갑을 다 털렸어요. 숙박비 1만5천 골드만 빌려주시면 고향에 가서 꼭 갚을게요!',
            emoji: '🥺',
            scamAmount: 15000
        }
    ]
};

// 의뢰 시스템 함수들
function getRandomQuest() {
    const allClients = [
        ...QUEST_CLIENTS.villagers,
        ...QUEST_CLIENTS.merchants,
        ...QUEST_CLIENTS.scammers,
        ...QUEST_CLIENTS.travelers
    ];
    return allClients[Math.floor(Math.random() * allClients.length)];
}

function calculateQuestReward(userLevel, questType) {
    if (questType === 'scam') {
        return null; // 사기 의뢰는 보상 없음
    }
    
    // 레벨에 비례한 보상 (100레벨을 기준으로 100~1000 골드)
    const baseReward = Math.floor(Math.random() * 900) + 100; // 100~1000 골드
    const levelMultiplier = userLevel / 100; // 레벨 배율
    const finalReward = Math.floor(baseReward * (0.5 + levelMultiplier)); // 최소 50% 보장
    
    return {
        gold: finalReward,
        exp: Math.floor(finalReward / 10) // 골드의 10% 경험치
    };
}

function addQuestCooldown(userId) {
    if (!global.questCooldowns) {
        global.questCooldowns = new Map();
    }
    global.questCooldowns.set(userId, Date.now() + (30 * 60 * 1000)); // 30분 쿨타임
}

function checkQuestCooldown(userId) {
    if (!global.questCooldowns) {
        global.questCooldowns = new Map();
    }
    const cooldownEnd = global.questCooldowns.get(userId);
    if (!cooldownEnd) return false;
    
    const timeLeft = cooldownEnd - Date.now();
    return timeLeft > 0 ? Math.ceil(timeLeft / (60 * 1000)) : false; // 남은 분 수 반환
}

// 엠블럼 시스템 데이터
const EMBLEMS = {
    warrior: {
        name: '전사',
        emoji: '⚔️',
        emblems: [
            { name: '초보전사', price: 10000, level: 20, roleName: '초보전사' },
            { name: '튼튼한 기사', price: 50000, level: 35, roleName: '튼튼한 기사' },
            { name: '용맹한 검사', price: 150000, level: 50, roleName: '용맹한 검사' },
            { name: '맹령한 전사', price: 400000, level: 65, roleName: '맹령한 전사' },
            { name: '전설의 기사', price: 1000000, level: 80, roleName: '전설의 기사' }
        ]
    },
    archer: {
        name: '궁수',
        emoji: '🏹',
        emblems: [
            { name: '마을사냥꾼', price: 10000, level: 20, roleName: '마을사냥꾼' },
            { name: '숲의 궁수', price: 50000, level: 35, roleName: '숲의 궁수' },
            { name: '바람 사수', price: 150000, level: 50, roleName: '바람 사수' },
            { name: '정확한 사격수', price: 400000, level: 65, roleName: '정확한 사격수' },
            { name: '전설의 명궁', price: 1000000, level: 80, roleName: '전설의 명궁' }
        ]
    },
    spellsword: {
        name: '마검사',
        emoji: '🔮',
        emblems: [
            { name: '마법 학도', price: 10000, level: 20, roleName: '마법 학도' },
            { name: '마법 검사', price: 50000, level: 35, roleName: '마법 검사' },
            { name: '현명한 기사', price: 150000, level: 50, roleName: '현명한 기사' },
            { name: '마도 검사', price: 400000, level: 65, roleName: '마도 검사' },
            { name: '전설의 마검사', price: 1000000, level: 80, roleName: '전설의 마검사' }
        ]
    },
    rogue: {
        name: '도적',
        emoji: '🗡️',
        emblems: [
            { name: '떠돌이 도적', price: 10000, level: 20, roleName: '떠돌이 도적' },
            { name: '운 좋은 도둑', price: 50000, level: 35, roleName: '운 좋은 도둑' },
            { name: '행운의 닌자', price: 150000, level: 50, roleName: '행운의 닌자' },
            { name: '복 많은 도적', price: 400000, level: 65, roleName: '복 많은 도적' },
            { name: '전설의 행운아', price: 1000000, level: 80, roleName: '전설의 행운아' }
        ]
    }
};

// 엠블럼 채널 ID
const EMBLEM_CHANNEL_ID = '1381614153399140412';

// 유저 칭호 가져오기 함수
function getUserTitle(user) {
    if (user.emblem) {
        return user.emblem; // 엠블럼이 있으면 엠블럼을 칭호로 사용
    }
    return '모험가'; // 엠블럼이 없으면 기본 칭호
}

// 장비 카테고리 이름 가져오기 함수
function getCategoryName(category) {
    const names = {
        weapon: '무기',
        armor: '갑옷',
        helmet: '헬멧',
        gloves: '장갑',
        boots: '부츠',
        accessory: '액세서리'
    };
    return names[category] || category;
}

// 장비 카테고리 이모지 가져오기 함수
function getCategoryEmoji(category) {
    const emojis = {
        weapon: '⚔️',
        armor: '🛡️',
        helmet: '⛑️',
        gloves: '🧤',
        boots: '👢',
        accessory: '💎'
    };
    return emojis[category] || '⚙️';
}

// 봇 설정
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// 봇 토큰 (환경변수에서 가져오거나 직접 입력)
const TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CLIENT_ID = process.env.CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
const DEV_CHANNEL_IDS = process.env.DEV_CHANNEL_IDS ? process.env.DEV_CHANNEL_IDS.split(',').map(id => id.trim()) : [];
const GAME_CHANNEL_ID = process.env.GAME_CHANNEL_ID;
const DEV_MODE = process.env.DEV_MODE === 'true';
const DEVELOPER_ID = process.env.DEVELOPER_ID;
const POPULAR_KING_ROLE_NAME = '👑 인기왕';

// 개발자 체크 함수
function isDeveloper(userId) {
    return DEVELOPER_ID && userId === DEVELOPER_ID;
}

// 경험치 바 생성 함수
function generateExpBar(currentExp, maxExp, barLength = 20) {
    const percentage = Math.min(currentExp / maxExp, 1);
    const filledLength = Math.floor(percentage * barLength);
    const emptyLength = barLength - filledLength;
    
    const filledChar = '█';
    const emptyChar = '░';
    
    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    const percentText = (percentage * 100).toFixed(1);
    
    return `└ \`${bar}\` ${percentText}%`;
}

// 랜덤 아이템 능력치 생성 함수
function generateRandomStats(statRanges) {
    const randomStats = {};
    for (const [statName, range] of Object.entries(statRanges)) {
        if (range[0] === range[1]) {
            // 고정값인 경우
            randomStats[statName] = range[0];
        } else {
            // 범위에서 랜덤 생성
            randomStats[statName] = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
        }
    }
    return randomStats;
}

// 메이플스토리 정확한 스타포스 강화 확률표 (0-30성)
const STARFORCE_RATES = {
    0: { success: 95, fail: 5, destroy: 0 },
    1: { success: 90, fail: 10, destroy: 0 },
    2: { success: 85, fail: 15, destroy: 0 },
    3: { success: 85, fail: 15, destroy: 0 },
    4: { success: 80, fail: 20, destroy: 0 },
    5: { success: 75, fail: 25, destroy: 0 },
    6: { success: 70, fail: 30, destroy: 0 },
    7: { success: 65, fail: 35, destroy: 0 },
    8: { success: 60, fail: 40, destroy: 0 },
    9: { success: 55, fail: 45, destroy: 0 },
    10: { success: 50, fail: 50, destroy: 0 },
    11: { success: 45, fail: 55, destroy: 0 },
    12: { success: 40, fail: 60, destroy: 0 },
    13: { success: 35, fail: 65, destroy: 0 },
    14: { success: 30, fail: 70, destroy: 0 },
    15: { success: 30, fail: 67.9, destroy: 2.1 },
    16: { success: 30, fail: 67.9, destroy: 2.1 },
    17: { success: 15, fail: 78.2, destroy: 6.8 },
    18: { success: 15, fail: 78.2, destroy: 6.8 },
    19: { success: 15, fail: 76.5, destroy: 8.5 },
    20: { success: 30, fail: 59.5, destroy: 10.5 },
    21: { success: 15, fail: 72.25, destroy: 12.75 },
    22: { success: 15, fail: 68, destroy: 17 },
    23: { success: 10, fail: 72, destroy: 18 },
    24: { success: 10, fail: 72, destroy: 18 },
    25: { success: 10, fail: 72, destroy: 18 },
    26: { success: 7, fail: 74.4, destroy: 18.6 },
    27: { success: 5, fail: 76, destroy: 19 },
    28: { success: 3, fail: 77.6, destroy: 19.4 },
    29: { success: 1, fail: 79.2, destroy: 19.8 },
    30: { success: 0, fail: 0, destroy: 0 } // 30성은 최대
};

// 메이플스토리 정확한 강화 비용 계수표
const COST_COEFFICIENTS = {
    0: 36, 1: 36, 2: 36, 3: 36, 4: 36, 5: 36, 6: 36, 7: 36, 8: 36, 9: 36, 10: 36,
    11: 571, 12: 314, 13: 157, 14: 107, 15: 200, 16: 200, 17: 150, 18: 70, 19: 45,
    20: 200, 21: 125, 22: 200, 23: 200, 24: 200, 25: 200, 26: 200, 27: 200, 28: 200, 29: 200
};

// 아이템 레벨별 설정 (모든 상점 아이템 포함)
const ITEM_LEVELS = {
    '기본 검': 1,
    '기본 갑옷': 1,
    '체력 포션': 1,
    '마나 포션': 1,
    '강철 검': 10,
    '꽃잎 세트': 1,
    '별빛 세트': 20,
    '드래곤 세트': 40,
    '시공 세트': 60,
    '강화왕 세트': 80
};

// 강화 비용 계산 함수 (Discord 봇에 맞게 조정된 골드 경제)
function calculateEnhanceCost(itemLevel, currentStar) {
    if (currentStar >= 30) return 0; // 30성은 최대
    
    const L = itemLevel;
    const S = currentStar;
    const coefficient = COST_COEFFICIENTS[S] || 200;
    
    // 기본 공식: 100 + L × 3^(S+1) × 계수
    // Discord 봇 경제에 맞게 1/10000 스케일로 조정
    const baseCost = 100 + L * Math.pow(3, S + 1) * coefficient;
    const adjustedCost = Math.floor(baseCost / 10000);
    
    // 최소 비용 보장 및 십의 자리 반올림
    const finalCost = Math.max(100, adjustedCost);
    return Math.round(finalCost / 10) * 10;
}

// 스타포스 스탯 보너스 계산 함수
function calculateStarforceBonus(itemLevel, starLevel) {
    if (starLevel <= 0) return { attack: 0, defense: 0 };
    
    // 메이플스토리 공식: 레벨/20 + 스타당 고정 보너스
    const baseBonus = Math.floor(itemLevel / 20) + 1;
    
    let attack = 0;
    let defense = 0;
    
    // 1-5성: 기본 보너스
    for (let i = 1; i <= Math.min(starLevel, 5); i++) {
        attack += baseBonus;
        defense += baseBonus;
    }
    
    // 6-10성: 보너스 증가
    for (let i = 6; i <= Math.min(starLevel, 10); i++) {
        attack += baseBonus + 1;
        defense += baseBonus + 1;
    }
    
    // 11-15성: 더 큰 보너스
    for (let i = 11; i <= Math.min(starLevel, 15); i++) {
        attack += baseBonus + 2;
        defense += baseBonus + 2;
    }
    
    // 16-25성: 최고 보너스
    for (let i = 16; i <= Math.min(starLevel, 25); i++) {
        attack += baseBonus + 3;
        defense += baseBonus + 3;
    }
    
    // 26-30성: 극한 보너스
    for (let i = 26; i <= Math.min(starLevel, 30); i++) {
        attack += baseBonus + 5;
        defense += baseBonus + 5;
    }
    
    return { attack, defense };
}

// 스타캐치 확률 조정 함수
function applyStarCatch(rates) {
    const newSuccess = Math.min(100, rates.success * 1.05);
    const remaining = 100 - newSuccess;
    const failRatio = rates.fail / (rates.fail + rates.destroy);
    
    return {
        success: newSuccess,
        fail: remaining * failRatio,
        destroy: remaining * (1 - failRatio)
    };
}

// 축복받은날 확률 조정 함수 (15~22성만)
function applySundayMaple(rates, starLevel) {
    if (starLevel < 15 || starLevel > 22) return rates;
    
    const newDestroy = rates.destroy * 0.7;
    const newFail = rates.fail + (rates.destroy - newDestroy);
    
    return {
        success: rates.success,
        fail: newFail,
        destroy: newDestroy
    };
}

// 강화 시도 함수
function attemptEnhance(rates, isStarCatch = false, isSunday = false, starLevel = 0) {
    let finalRates = { ...rates };
    
    if (isStarCatch) {
        finalRates = applyStarCatch(finalRates);
    }
    
    if (isSunday) {
        finalRates = applySundayMaple(finalRates, starLevel);
    }
    
    const random = Math.random() * 100;
    
    if (random <= finalRates.success) {
        return 'success';
    } else if (random <= finalRates.success + finalRates.fail) {
        return 'fail';
    } else {
        return 'destroy';
    }
}

// 최고 강화 장비 찾기 함수
async function getTopEnhancedUser() {
    try {
        const users = await User.find({ registered: true });
        let topUser = null;
        let maxEnhance = -1;
        let topItem = null;

        for (const user of users) {
            // 착용 장비 확인
            for (const [slot, equipment] of Object.entries(user.equipment)) {
                if (equipment && equipment.enhanceLevel > maxEnhance) {
                    maxEnhance = equipment.enhanceLevel;
                    topUser = user;
                    topItem = equipment;
                }
            }
        }

        return { user: topUser, item: topItem, enhanceLevel: maxEnhance };
    } catch (error) {
        console.error('최고 강화 유저 조회 오류:', error);
        return null;
    }
}

// 강화왕 역할 업데이트 함수
async function updateEnhanceKingRole(guild) {
    try {
        const ENHANCE_KING_ROLE_NAME = '강화왕';
        
        // 강화왕 역할 찾기 또는 생성
        let enhanceKingRole = guild.roles.cache.find(role => role.name === ENHANCE_KING_ROLE_NAME);
        
        if (!enhanceKingRole) {
            enhanceKingRole = await guild.roles.create({
                name: ENHANCE_KING_ROLE_NAME,
                color: '#FF6B00', // 주황색
                hoist: true,
                reason: '강화왕 시스템 자동 생성'
            });
        }
        
        // 현재 강화왕 찾기
        const currentKing = guild.members.cache.find(member => 
            member.roles.cache.has(enhanceKingRole.id)
        );
        
        // 최고 강화 유저 찾기
        const topData = await getTopEnhancedUser();
        
        if (!topData || !topData.user) return;
        
        const newKing = guild.members.cache.get(topData.user.discordId);
        
        if (!newKing) return;
        
        // 현재 왕이 새로운 왕과 다르면 역할 변경
        if (!currentKing || currentKing.id !== newKing.id) {
            // 기존 왕에서 역할 제거
            if (currentKing) {
                await currentKing.roles.remove(enhanceKingRole);
            }
            
            // 새로운 왕에게 역할 부여
            await newKing.roles.add(enhanceKingRole);
        }
        
    } catch (error) {
        console.error('강화왕 역할 업데이트 오류:', error);
    }
}

// 전투력 계산 함수
function calculateCombatPower(user) {
    let basePower = 0;
    
    // 엠블럼에 따른 스탯 계산
    if (user.emblem) {
        // 엠블럼 단계 확인
        const emblemLevel = getEmblemLevel(user.emblem);
        const emblemMultiplier = 1 + (emblemLevel * 0.25); // 1단계: 1.25, 2단계: 1.5, ...
        
        // 엠블럼 계열에 따른 주스탯만 적용
        const emblemType = getEmblemType(user.emblem);
        
        switch(emblemType) {
            case 'warrior':
                basePower = user.stats.strength * emblemMultiplier * 3; // 전사는 힘만, 높은 배율
                break;
            case 'archer':
                basePower = user.stats.agility * emblemMultiplier * 3; // 궁수는 민첩만
                break;
            case 'spellsword':
                basePower = user.stats.intelligence * emblemMultiplier * 3; // 마검사는 지능만
                break;
            case 'rogue':
                basePower = user.stats.luck * emblemMultiplier * 3; // 도적은 행운만
                break;
        }
        
        // 체력은 생존력으로 모든 직업에 적용 (낮은 배율)
        basePower += user.stats.vitality * 0.5;
    } else {
        // 엠블럼이 없으면 기존 방식 (모든 스탯 반영)
        basePower = user.stats.strength * 2 + user.stats.agility + user.stats.intelligence * 0.5 + user.stats.vitality * 1.5 + user.stats.luck;
    }
    
    // 장비 보너스 및 스타포스 보너스
    let equipmentBonus = 0;
    let starforceBonus = 0;
    
    // 각 장비슬롯별 계산
    Object.entries(user.equipment).forEach(([slot, equipment]) => {
        if (equipment) {
            // 기본 장비 스탯
            const attack = equipment.stats.attack || 0;
            const defense = equipment.stats.defense || 0;
            equipmentBonus += attack + defense;
            
            // 스타포스 보너스 계산
            if (equipment.enhanceLevel > 0) {
                const itemLevel = ITEM_LEVELS[equipment.setName] || ITEM_LEVELS[equipment.name] || equipment.level || 1;
                const bonus = calculateStarforceBonus(itemLevel, equipment.enhanceLevel);
                starforceBonus += bonus.attack + bonus.defense;
            }
        }
    });
    
    // 레벨 보너스
    let levelBonus = user.level * 5;
    
    return Math.floor(basePower + equipmentBonus + starforceBonus + levelBonus);
}

// 엠블럼 단계 확인 함수
function getEmblemLevel(emblemName) {
    for (const [categoryKey, categoryData] of Object.entries(EMBLEMS)) {
        const emblemIndex = categoryData.emblems.findIndex(emblem => emblem.name === emblemName);
        if (emblemIndex !== -1) {
            return emblemIndex + 1; // 1단계부터 시작
        }
    }
    return 1; // 기본값
}

// 엠블럼 계열 확인 함수
function getEmblemType(emblemName) {
    for (const [categoryKey, categoryData] of Object.entries(EMBLEMS)) {
        const hasEmblem = categoryData.emblems.some(emblem => emblem.name === emblemName);
        if (hasEmblem) {
            return categoryKey;
        }
    }
    return null;
}

// 몬스터 전투력 계산 함수
function calculateMonsterPower(monster, level) {
    return Math.floor(monster.stats.atk + monster.stats.def + (level * 3));
}

// 유저 초기화/조회 함수
async function getUser(discordId) {
    try {
        let user = await User.findOne({ discordId });
        if (!user) {
            user = new User({ discordId });
            await user.save();
            console.log(`새 유저 생성: ${discordId}`);
        }
        return user;
    } catch (error) {
        console.error('유저 조회/생성 오류:', error);
        return null;
    }
}

// 레벨업 처리 함수
function processLevelUp(user) {
    let leveledUp = false;
    let levelsGained = 0;
    const oldLevel = user.level;
    
    while (user.exp >= user.level * 100) {
        user.exp -= user.level * 100;
        user.level += 1;
        levelsGained += 1;
        leveledUp = true;
        
        // 레벨업 시 스탯포인트 지급 (레벨당 5포인트)
        user.statPoints += 5;

        // 새로운 사냥터 해금 체크
        const newUnlockArea = huntingAreas.find(area => 
            area.unlockLevel === user.level && !user.unlockedAreas.includes(area.id)
        );
        if (newUnlockArea) {
            user.unlockedAreas.push(newUnlockArea.id);
        }
    }
    
    return { leveledUp, levelsGained, oldLevel };
}

// 인기도 업데이트 함수
async function updatePopularity(messageAuthorId, emoji, value, messageId, guild) {
    try {
        const user = await getUser(messageAuthorId);
        if (!user || !user.registered) return { success: false, message: '등록되지 않은 사용자입니다.' };
        
        // 같은 메시지에 대한 이전 반응 확인
        const existingReaction = user.popularityHistory.find(h => h.messageId === messageId && h.emoji === emoji);
        if (existingReaction) {
            return { success: false, message: '이미 반응한 메시지입니다.' };
        }
        
        // 일일 제한 리셋 확인
        const today = new Date().toDateString();
        if (user.lastPopularityReset !== today) {
            user.dailyPopularityGain = 0;
            user.dailyPopularityLoss = 0;
            user.lastPopularityReset = today;
        }
        
        // 일일 제한 확인
        if (value > 0 && user.dailyPopularityGain >= 10) {
            return { success: false, message: '오늘 받을 수 있는 인기도 상승치를 모두 받았습니다. (+10)' };
        }
        if (value < 0 && user.dailyPopularityLoss <= -10) {
            return { success: false, message: '오늘 받을 수 있는 인기도 하락치를 모두 받았습니다. (-10)' };
        }
        
        // 실제로 적용할 값 계산
        let actualChange = value;
        if (value > 0) {
            actualChange = Math.min(value, 10 - user.dailyPopularityGain);
            user.dailyPopularityGain += actualChange;
        } else {
            actualChange = Math.max(value, -10 - user.dailyPopularityLoss);
            user.dailyPopularityLoss += actualChange;
        }
        
        if (actualChange === 0) {
            return { success: false, message: `오늘의 인기도 ${value > 0 ? '상승' : '하락'} 한도에 도달했습니다.` };
        }
        
        // 인기도 업데이트
        user.popularity += actualChange;
        user.lastPopularityUpdate = new Date();
        user.popularityHistory.push({
            messageId,
            emoji,
            value: actualChange,
            date: new Date()
        });
        
        await user.save();
        
        // 인기왕 역할 업데이트
        await updatePopularKingRole(guild);
        
        const dailyStatus = value > 0 
            ? `(오늘 +${user.dailyPopularityGain}/10)`
            : `(오늘 ${user.dailyPopularityLoss}/10)`;
        
        return { 
            success: true, 
            newPopularity: user.popularity,
            change: actualChange,
            message: `인기도가 ${actualChange > 0 ? '+' : ''}${actualChange}되어 ${user.popularity}가 되었습니다. ${dailyStatus}`
        };
    } catch (error) {
        console.error('인기도 업데이트 오류:', error);
        return { success: false, message: '인기도 업데이트 중 오류가 발생했습니다.' };
    }
}

// 인기왕 역할 업데이트 함수
async function updatePopularKingRole(guild) {
    try {
        // 인기왕 역할 찾기 또는 생성
        let popularKingRole = guild.roles.cache.find(role => role.name === POPULAR_KING_ROLE_NAME);
        
        if (!popularKingRole) {
            popularKingRole = await guild.roles.create({
                name: POPULAR_KING_ROLE_NAME,
                color: '#FFD700',
                hoist: true,
                reason: '인기왕 시스템 자동 생성'
            });
        }
        
        // 현재 인기왕 찾기
        const currentKing = guild.members.cache.find(member => 
            member.roles.cache.has(popularKingRole.id)
        );
        
        // 가장 높은 인기도를 가진 유저 찾기
        const topUser = await User.findOne({ registered: true })
            .sort({ popularity: -1 })
            .limit(1);
        
        if (!topUser || topUser.popularity <= 0) {
            // 인기도가 양수인 사람이 없으면 역할 회수
            if (currentKing) {
                await currentKing.roles.remove(popularKingRole);
            }
            return;
        }
        
        // 새로운 인기왕이 필요한 경우
        if (!currentKing || currentKing.id !== topUser.discordId) {
            // 기존 인기왕 역할 회수
            if (currentKing) {
                await currentKing.roles.remove(popularKingRole);
            }
            
            // 새로운 인기왕에게 역할 부여
            const newKing = await guild.members.fetch(topUser.discordId);
            if (newKing) {
                await newKing.roles.add(popularKingRole);
                
                // 채널에 알림 (선택사항)
                const channel = guild.channels.cache.get(GAME_CHANNEL_ID);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('👑 새로운 인기왕 탄생!')
                        .setDescription(`**${topUser.nickname}**님이 인기도 ${topUser.popularity}점으로 새로운 인기왕이 되었습니다!`)
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                }
            }
        }
    } catch (error) {
        console.error('인기왕 역할 업데이트 오류:', error);
    }
}

// 슬래시 명령어 정의
const commands = [
    new SlashCommandBuilder()
        .setName('게임')
        .setDescription('강화왕 김헌터 게임 메뉴'),
    
    new SlashCommandBuilder()
        .setName('핑')
        .setDescription('봇의 응답 속도를 확인합니다'),
    
    new SlashCommandBuilder()
        .setName('회원가입')
        .setDescription('강화왕 김헌터 회원가입'),
    
    new SlashCommandBuilder()
        .setName('db테스트')
        .setDescription('데이터베이스 연결 테스트'),
    
    new SlashCommandBuilder()
        .setName('이메일테스트')
        .setDescription('이메일 전송 테스트'),
    
    new SlashCommandBuilder()
        .setName('회원가입채널설정')
        .setDescription('회원가입 채널에 안내 메시지를 게시합니다'),
    
    new SlashCommandBuilder()
        .setName('인기도테스트')
        .setDescription('테스트용 인기도 조작 명령어')
        .addStringOption(option =>
            option.setName('행동')
                .setDescription('수행할 행동')
                .setRequired(true)
                .addChoices(
                    { name: '인기도 증가 (+5)', value: 'add' },
                    { name: '인기도 감소 (-5)', value: 'subtract' },
                    { name: '일일 한도 리셋', value: 'reset' },
                    { name: '인기도 확인', value: 'check' }
                )),
    
    new SlashCommandBuilder()
        .setName('전투력수정')
        .setDescription('관리자 전용: 전투력 수정 명령어')
        .addStringOption(option =>
            option.setName('타입')
                .setDescription('수정할 능력치')
                .setRequired(true)
                .addChoices(
                    { name: '힘 (+10)', value: 'strength' },
                    { name: '민첩 (+10)', value: 'agility' },
                    { name: '지능 (+10)', value: 'intelligence' },
                    { name: '체력 (+10)', value: 'vitality' },
                    { name: '행운 (+10)', value: 'luck' },
                    { name: '전투력 확인', value: 'check' }
                )),

    new SlashCommandBuilder()
        .setName('강화')
        .setDescription('장비를 강화합니다 (스타포스 0-30성)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기 (weapon)', value: 'weapon' },
                    { name: '갑옷 (armor)', value: 'armor' },
                    { name: '투구 (helmet)', value: 'helmet' },
                    { name: '장갑 (gloves)', value: 'gloves' },
                    { name: '신발 (boots)', value: 'boots' },
                    { name: '액세서리 (accessory)', value: 'accessory' }
                )),

    new SlashCommandBuilder()
        .setName('집중력')
        .setDescription('김헌터의 집중력 축복으로 장비를 강화합니다 (성공률 5% 증가)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기 (weapon)', value: 'weapon' },
                    { name: '갑옷 (armor)', value: 'armor' },
                    { name: '투구 (helmet)', value: 'helmet' },
                    { name: '장갑 (gloves)', value: 'gloves' },
                    { name: '신발 (boots)', value: 'boots' },
                    { name: '액세서리 (accessory)', value: 'accessory' }
                )),

    new SlashCommandBuilder()
        .setName('축복받은날')
        .setDescription('김헌터의 축복받은 날로 강화합니다 (15-22성 파괴율 30% 감소)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기 (weapon)', value: 'weapon' },
                    { name: '갑옷 (armor)', value: 'armor' },
                    { name: '투구 (helmet)', value: 'helmet' },
                    { name: '장갑 (gloves)', value: 'gloves' },
                    { name: '신발 (boots)', value: 'boots' },
                    { name: '액세서리 (accessory)', value: 'accessory' }
                )),

    new SlashCommandBuilder()
        .setName('강화랭킹')
        .setDescription('강화 랭킹을 확인합니다'),

    new SlashCommandBuilder()
        .setName('강화통계')
        .setDescription('나의 강화 통계를 확인합니다'),

    new SlashCommandBuilder()
        .setName('의뢰')
        .setDescription('마을 의뢰를 수행합니다')
];

// 봇이 준비되었을 때
client.once('ready', async () => {
    console.log(`${client.user.tag} 봇이 온라인 상태입니다! - 자동 재시작 테스트`);
    console.log(`개발 모드: ${DEV_MODE ? '활성화' : '비활성화'}`);
    if (DEV_MODE && DEV_CHANNEL_IDS.length > 0) {
        console.log(`개발 채널들: ${DEV_CHANNEL_IDS.join(', ')}`);
    }
    
    // MongoDB 연결
    await connectDB();
    
    // 슬래시 명령어 등록
    try {
        const rest = new REST().setToken(TOKEN);
        console.log('슬래시 명령어 등록 중...');
        
        // 개발 모드에서는 길드(서버) 명령어 사용 (즉시 적용)
        const guildId = DEV_MODE ? '1371885859649097849' : null; // 개발 서버 ID
        
        const data = await rest.put(
            guildId ? Routes.applicationGuildCommands(CLIENT_ID, guildId) : Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log(`슬래시 명령어 ${data.length}개가 등록되었습니다!`);
        console.log('등록된 명령어:', data.map(cmd => cmd.name).join(', '));
    } catch (error) {
        console.error('명령어 등록 실패:', error);
    }
    
    // 엠블럼 시스템 초기화
    await initializeEmblemSystem();
});

// 엠블럼 시스템 초기화 함수
async function initializeEmblemSystem() {
    try {
        const channel = await client.channels.fetch(EMBLEM_CHANNEL_ID);
        if (!channel) {
            console.log('엠블럼 채널을 찾을 수 없습니다.');
            return;
        }

        // 엠블럼 상점 임베드 생성
        const emblemEmbed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🏆 엠블럼 상점')
            .setDescription('**레벨 20 이상**부터 엠블럼을 구매할 수 있습니다!\n\n엠블럼을 구매하면 특별한 칭호 역할을 받게 됩니다.\n**⚠️ 엠블럼은 한 번 구매하면 변경할 수 없습니다!**')
            .addFields(
                { name: '⚔️ 전사 계열', value: '초보전사 → 튼튼한 기사 → 용맹한 검사 → 맹령한 전사 → 전설의 기사', inline: false },
                { name: '🏹 궁수 계열', value: '마을사냥꾼 → 숲의 궁수 → 바람 사수 → 정확한 사격수 → 전설의 명궁', inline: false },
                { name: '🔮 마검사 계열', value: '마법 학도 → 마법 검사 → 현명한 기사 → 마도 검사 → 전설의 마검사', inline: false },
                { name: '🗡️ 도적 계열', value: '떠돌이 도적 → 운 좋은 도둑 → 행운의 닌자 → 복 많은 도적 → 전설의 행운아', inline: false }
            )
            .setFooter({ text: '원하는 계열을 선택하여 엠블럼을 구매하세요!' });

        // 엠블럼 계열 선택 드롭다운
        const emblemSelect = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('emblem_category')
                    .setPlaceholder('엠블럼 계열을 선택하세요')
                    .addOptions([
                        {
                            label: '전사 계열',
                            description: '초보전사부터 전설의 기사까지',
                            value: 'warrior',
                            emoji: '⚔️'
                        },
                        {
                            label: '궁수 계열',
                            description: '마을사냥꾼부터 전설의 명궁까지',
                            value: 'archer',
                            emoji: '🏹'
                        },
                        {
                            label: '마검사 계열',
                            description: '마법 학도부터 전설의 마검사까지',
                            value: 'spellsword',
                            emoji: '🔮'
                        },
                        {
                            label: '도적 계열',
                            description: '떠돌이 도적부터 전설의 행운아까지',
                            value: 'rogue',
                            emoji: '🗡️'
                        }
                    ])
            );

        // 기존 메시지 삭제 후 새로 전송
        const messages = await channel.messages.fetch({ limit: 10 });
        const botMessages = messages.filter(msg => msg.author.id === client.user.id);
        if (botMessages.size > 0) {
            await channel.bulkDelete(botMessages);
        }

        await channel.send({
            embeds: [emblemEmbed],
            components: [emblemSelect]
        });

        console.log('엠블럼 시스템이 초기화되었습니다.');
    } catch (error) {
        console.error('엠블럼 시스템 초기화 오류:', error);
    }
}

// 슬래시 명령어 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    console.log(`명령어 실행 - 채널: ${interaction.channelId}, 개발 채널들: ${DEV_CHANNEL_IDS.join(', ')}, 개발 모드: ${DEV_MODE}`);
    
    // 개발 모드에서 채널 제한
    if (DEV_MODE && DEV_CHANNEL_IDS.length > 0 && !DEV_CHANNEL_IDS.includes(interaction.channelId)) {
        console.log(`채널 불일치 - 현재: ${interaction.channelId}, 허용된 개발 채널들: ${DEV_CHANNEL_IDS.join(', ')}`);
        await interaction.reply({ content: '개발 모드에서는 지정된 채널에서만 사용 가능합니다!', ephemeral: true });
        return;
    }

    const { commandName } = interaction;

    try {
        if (commandName === '핑') {
            const ping = Date.now() - interaction.createdTimestamp;
            await interaction.reply(`퐁! 지연시간: ${ping}ms`);
        }
        
        else if (commandName === '게임') {
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.reply({ content: '유저 데이터를 불러올 수 없습니다!', ephemeral: true });
                return;
            }
            
            // 시간대별 이미지 및 인사말 설정
            const now = new Date();
            const hour = now.getHours();
            
            let timeImage = '';
            let timeColor = '';
            
            if (hour >= 6 && hour < 12) {
                // 아침 시간대 (6:00 - 11:59)
                timeImage = 'kim_main_morning.png';
                timeColor = '#ffeb3b'; // 노란색
            } else if (hour >= 12 && hour < 18) {
                // 점심 시간대 (12:00 - 17:59)
                timeImage = 'kim_main_lunch.png';
                timeColor = '#ff9800'; // 주황색
            } else {
                // 저녁/밤 시간대 (18:00 - 5:59)
                timeImage = 'kim_main_night.png';
                timeColor = '#3f51b5'; // 남색
            }

            // 상태창 (RPG 스타일)
            const greetings = [
                '오늘도 힘차게 모험을 떠나볼까요?',
                '새로운 하루가 시작되었네요!',
                '모험가님, 준비는 되셨나요?',
                '오늘은 어떤 재미있는 일이 있을까요?',
                '강화왕의 세계에 오신 것을 환영합니다!',
                '레벨업을 향해 달려가볼까요?',
                '오늘도 좋은 하루 되세요!',
                '모험이 여러분을 기다리고 있어요!',
                '행운이 함께하길 바랍니다!',
                '새로운 도전이 시작됩니다!'
            ];
            
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            
            // 경험치 계산 수정 (레벨업 시 필요 경험치 = 레벨 * 100)
            const maxExp = user.level * 100;
            
            // 출석 현황 계산 (오늘 출석체크 여부)
            const today = new Date().toDateString();
            const attendanceStatus = user.lastDaily === today ? '출석' : '결석';
            
            const statusEmbed = new EmbedBuilder()
                .setColor(timeColor)
                .setTitle(`${getUserTitle(user)} ${user.nickname}님, ${randomGreeting}`)
                .addFields(
                    { name: '⭐ 레벨', value: `\`\`\`Lv.${user.level}\`\`\``, inline: true },
                    { name: '✨ 경험치', value: `\`\`\`${user.exp}/${maxExp}\`\`\``, inline: true },
                    { name: '<:currency_emoji:1377404064316522778> 골드', value: `\`\`\`${user.gold.toLocaleString()}\`\`\``, inline: true },
                    { name: '📅 출석현황', value: `\`\`\`${attendanceStatus}\`\`\``, inline: true },
                    { name: '🏆 종합순위', value: `\`\`\`준비중\`\`\``, inline: true },
                    { name: '💖 인기도', value: `\`\`\`${user.popularity}\`\`\``, inline: true }
                )
                .setImage(`attachment://${timeImage}`)
                .setFooter({ text: '게임 메뉴에 오신 것을 환영합니다!' });

            // 페이지별 버튼 정의
            const pages = [
                // 페이지 1: 일일 활동
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('daily')
                            .setLabel('🎁 출석체크')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('work')
                            .setLabel('⚒️ 일하기')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('quest')
                            .setLabel('📜 의뢰')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                // 페이지 2: 전투
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('hunting')
                            .setLabel('⚔️ 사냥하기')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('pvp')
                            .setLabel('🛡️ PvP')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true) // 준비중
                    ]
                },
                // 페이지 3: 능력치/스킬
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('stats')
                            .setLabel('💪 능력치')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('skills')
                            .setLabel('🔮 스킬')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                // 페이지 4: 상점/인벤토리
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('shop')
                            .setLabel('🛒 상점')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🎒 인벤토리')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                },
                // 페이지 5: 장비/강화
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('⚔️ 장비')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('enhancement')
                            .setLabel('⚡ 강화')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(user.level < 10), // 레벨 10 이상만 사용 가능
                        new ButtonBuilder()
                            .setCustomId('ranking')
                            .setLabel('🏆 랭킹')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('info')
                            .setLabel('👤 내정보')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                }
            ];

            // 페이지 네비게이션 버튼
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true), // 첫 페이지에서는 비활성화
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel('1/5')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                );

            // 첫 페이지 버튼 row
            const contentRow = new ActionRowBuilder()
                .addComponents(pages[0].buttons);

            // 시간대별 이미지 첨부파일
            const timeAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', timeImage), { name: timeImage });
            
            await interaction.reply({ 
                embeds: [statusEmbed], 
                components: [contentRow, navigationRow], 
                files: [timeAttachment],
                ephemeral: true 
            });
        }
        
        else if (commandName === '회원가입') {
            const attachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_join.png'), { name: 'kim_join.png' });
            
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('강화왕 김헌터 회원가입')
                .setDescription('환영합니다! 강화왕 김헌터의 세계로 오신 것을 환영합니다.\n\n게임을 시작하기 위해 회원가입을 진행해주세요.')
                .setImage('attachment://kim_join.png')
                .addFields(
                    { name: '이메일 문의', value: 'support@kimhunter.com', inline: true },
                    { name: '디스코드 문의', value: '김헌터#0001', inline: true },
                    { name: '기타 문의', value: '티켓 시스템 이용', inline: true }
                )
                .setFooter({ text: '아래 버튼을 눌러 회원가입을 진행하세요!' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('register')
                        .setLabel('회원가입')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [embed], components: [row], files: [attachment] });
        }
        
        else if (commandName === 'db테스트') {
            try {
                const user = await getUser(interaction.user.id);
                const totalUsers = await User.countDocuments();
                
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('데이터베이스 테스트')
                    .setDescription('MongoDB 연결 상태를 확인합니다.')
                    .addFields(
                        { name: '연결 상태', value: 'MongoDB 연결 성공', inline: true },
                        { name: '총 유저 수', value: `${totalUsers}명`, inline: true },
                        { name: '내 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                        { name: '내 레벨', value: `Lv.${user.level}`, inline: true },
                        { name: 'Discord ID', value: user.discordId, inline: true },
                        { name: '가입일', value: user.createdAt.toLocaleDateString('ko-KR'), inline: true }
                    );
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('DB 테스트 오류:', error);
                await interaction.reply({ content: '데이터베이스 연결 실패!', ephemeral: true });
            }
        }
        
        else if (commandName === '인기도테스트') {
            const action = interaction.options.getString('행동');
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', ephemeral: true });
                return;
            }
            
            let message = '';
            
            switch(action) {
                case 'add':
                    user.popularity += 5;
                    await user.save();
                    await updatePopularKingRole(interaction.guild);
                    message = `인기도가 5 증가하여 ${user.popularity}점이 되었습니다.`;
                    break;
                    
                case 'subtract':
                    user.popularity -= 5;
                    await user.save();
                    await updatePopularKingRole(interaction.guild);
                    message = `인기도가 5 감소하여 ${user.popularity}점이 되었습니다.`;
                    break;
                    
                case 'reset':
                    user.dailyPopularityGain = 0;
                    user.dailyPopularityLoss = 0;
                    user.lastPopularityReset = new Date().toDateString();
                    await user.save();
                    message = '일일 인기도 한도가 리셋되었습니다.';
                    break;
                    
                case 'check':
                    const today = new Date().toDateString();
                    const isToday = user.lastPopularityReset === today;
                    message = `현재 인기도: ${user.popularity}점\n` +
                             `오늘 받은 인기도: +${isToday ? user.dailyPopularityGain : 0}/10\n` +
                             `오늘 잃은 인기도: ${isToday ? user.dailyPopularityLoss : 0}/10`;
                    break;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('인기도 테스트')
                .setDescription(message)
                .setTimestamp();
                
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (commandName === '전투력수정') {
            if (!isDeveloper(interaction.user.id)) {
                await interaction.reply({ content: '관리자만 사용할 수 있는 명령어입니다!', ephemeral: true });
                return;
            }
            
            const user = await getUser(interaction.user.id);
            const statType = interaction.options.getString('타입');
            
            if (statType === 'check') {
                const combatPower = calculateCombatPower(user);
                const embed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('⚔️ 전투력 정보')
                    .setDescription(`**${user.nickname}**님의 전투력 정보`)
                    .addFields(
                        { name: '총 전투력', value: `${combatPower}`, inline: true },
                        { name: '💪 힘', value: `${user.stats.strength}`, inline: true },
                        { name: '🏃 민첩', value: `${user.stats.agility}`, inline: true },
                        { name: '🧠 지능', value: `${user.stats.intelligence}`, inline: true },
                        { name: '❤️ 체력', value: `${user.stats.vitality}`, inline: true },
                        { name: '🍀 행운', value: `${user.stats.luck}`, inline: true }
                    );
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                user.stats[statType] += 10;
                await user.save();
                
                const statNames = {
                    strength: '💪 힘',
                    agility: '🏃 민첩',
                    intelligence: '🧠 지능',
                    vitality: '❤️ 체력',
                    luck: '🍀 행운'
                };
                
                const newCombatPower = calculateCombatPower(user);
                await interaction.reply({ 
                    content: `${statNames[statType]}이 10 증가했습니다! 전투력: ${newCombatPower}`, 
                    ephemeral: true 
                });
            }
        }
        
        else if (commandName === '이메일테스트') {
            try {
                // 먼저 응답을 지연시켜 시간 제한 문제 해결
                await interaction.deferReply({ ephemeral: true });
                
                const testCode = generateVerificationCode();
                const emailSent = await sendVerificationEmail('sup.kimhunter@gmail.com', testCode);
                
                if (emailSent) {
                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('이메일 테스트 성공!')
                        .setDescription('테스트 이메일이 성공적으로 전송되었습니다.')
                        .addFields(
                            { name: '수신 이메일', value: 'sup.kimhunter@gmail.com', inline: true },
                            { name: '테스트 코드', value: testCode, inline: true },
                            { name: '전송 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
                        );
                    
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({ content: '이메일 전송에 실패했습니다!' });
                }
            } catch (error) {
                console.error('이메일 테스트 오류:', error);
                if (interaction.deferred) {
                    await interaction.editReply({ content: '이메일 테스트 중 오류가 발생했습니다!' });
                } else {
                    await interaction.reply({ content: '이메일 테스트 중 오류가 발생했습니다!', ephemeral: true });
                }
            }
        }
        
        else if (commandName === '회원가입채널설정') {
            try {
                await interaction.deferReply({ ephemeral: true });
                
                const SIGNUP_CHANNEL_ID = '1380684353998426122';
                const signupChannel = await client.channels.fetch(SIGNUP_CHANNEL_ID);
                
                if (signupChannel) {
                    const signupAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_join.png'), { name: 'kim_join.png' });
                    
                    const signupEmbed = new EmbedBuilder()
                        .setColor('#ff6b6b')
                        .setTitle('강화왕 김헌터 회원가입')
                        .setDescription('환영합니다! 강화왕 김헌터의 세계로 오신 것을 환영합니다.\n\n게임을 시작하기 위해 회원가입을 진행해주세요.\n\n**회원가입 혜택:**\n• 가입 즉시 1,000G 지급\n• 경험치 부스터 및 초보자 무기 제공\n• 일일보상 및 다양한 게임 컨텐츠 이용 가능')
                        .setImage('attachment://kim_join.png')
                        .addFields(
                            { name: '📧 이메일 문의', value: 'sup.kimhunter@gmail.com', inline: true },
                            { name: '💬 디스코드 문의', value: 'JRY_10004', inline: true },
                            { name: '🎫 티켓 문의', value: '추후 버튼링크 생성 예정', inline: true }
                        )
                        .setFooter({ text: '아래 버튼을 눌러 회원가입을 진행하세요!' });

                    const signupRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('register')
                                .setLabel('회원가입')
                                .setStyle(ButtonStyle.Primary)
                        );

                    await signupChannel.send({ embeds: [signupEmbed], components: [signupRow], files: [signupAttachment] });
                    
                    await interaction.editReply({ content: '회원가입 채널에 안내 메시지를 성공적으로 게시했습니다!' });
                } else {
                    await interaction.editReply({ content: '회원가입 채널을 찾을 수 없습니다!' });
                }
            } catch (error) {
                console.error('회원가입 채널 설정 오류:', error);
                if (interaction.deferred) {
                    await interaction.editReply({ content: '회원가입 채널 설정 중 오류가 발생했습니다!' });
                } else {
                    await interaction.reply({ content: '회원가입 채널 설정 중 오류가 발생했습니다!', ephemeral: true });
                }
            }
        }
        
        // 강화 명령어 처리
        else if (commandName === '강화' || commandName === '집중력' || commandName === '축복받은날') {
            const slotName = interaction.options.getString('장비슬롯');
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', ephemeral: true });
                return;
            }
            
            const equipment = user.equipment[slotName];
            if (!equipment) {
                await interaction.reply({ content: `${slotName} 슬롯에 장착된 장비가 없습니다!`, ephemeral: true });
                return;
            }
            
            if (equipment.enhanceLevel >= 30) {
                await interaction.reply({ content: '이미 최대 강화 단계(30성)입니다!', ephemeral: true });
                return;
            }
            
            // 아이템 레벨 가져오기
            const itemLevel = ITEM_LEVELS[equipment.setName] || ITEM_LEVELS[equipment.name] || 1;
            const currentStar = equipment.enhanceLevel || 0;
            const cost = calculateEnhanceCost(itemLevel, currentStar);
            
            if (user.gold < cost) {
                await interaction.reply({ 
                    content: `골드가 부족합니다! 필요: ${cost}G, 보유: ${user.gold}G`, 
                    ephemeral: true 
                });
                return;
            }
            
            // 강화 시도
            const rates = STARFORCE_RATES[currentStar];
            const isStarCatch = commandName === '집중력';
            const isSunday = commandName === '축복받은날';
            
            const result = attemptEnhance(rates, isStarCatch, isSunday, currentStar);
            user.gold -= cost;
            
            // 강화 통계 업데이트
            user.enhanceStats.totalAttempts += 1;
            user.enhanceStats.totalCost += cost;
            
            let resultEmbed;
            
            if (result === 'success') {
                equipment.enhanceLevel += 1;
                user.enhanceStats.successCount += 1;
                user.enhanceStats.maxEnhanceLevel = Math.max(user.enhanceStats.maxEnhanceLevel, equipment.enhanceLevel);
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎉 강화 성공!')
                    .setDescription(`**${equipment.name}**이(가) 강화되었습니다!`)
                    .addFields(
                        { name: '강화 결과', value: `+${currentStar} → **+${equipment.enhanceLevel}**⭐`, inline: true },
                        { name: '사용 골드', value: `${cost}G`, inline: true },
                        { name: '잔여 골드', value: `${user.gold}G`, inline: true }
                    );
                    
                // 강화왕 업데이트 (10성 이상일 때)
                if (equipment.enhanceLevel >= 10) {
                    await updateEnhanceKingRole(interaction.guild);
                }
                
            } else if (result === 'fail') {
                resultEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('💫 강화 실패')
                    .setDescription(`**${equipment.name}** 강화에 실패했습니다.`)
                    .addFields(
                        { name: '강화 결과', value: `+${currentStar} (변화없음)`, inline: true },
                        { name: '사용 골드', value: `${cost}G`, inline: true },
                        { name: '잔여 골드', value: `${user.gold}G`, inline: true }
                    );
                    
            } else { // destroy
                const oldLevel = equipment.enhanceLevel;
                equipment.enhanceLevel = Math.max(0, equipment.enhanceLevel - 1);
                user.enhanceStats.destroyCount += 1;
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('💥 강화 파괴!')
                    .setDescription(`**${equipment.name}**이(가) 파괴되어 강화 단계가 감소했습니다!`)
                    .addFields(
                        { name: '강화 결과', value: `+${oldLevel} → **+${equipment.enhanceLevel}**💀`, inline: true },
                        { name: '사용 골드', value: `${cost}G`, inline: true },
                        { name: '잔여 골드', value: `${user.gold}G`, inline: true }
                    );
            }
            
            // 이벤트 효과 표시
            if (isStarCatch) {
                resultEmbed.setFooter({ text: '🌟 집중력 이벤트 적용 (성공률 +5%)' });
            } else if (isSunday && currentStar >= 15 && currentStar <= 22) {
                resultEmbed.setFooter({ text: '🍁 축복받은날 이벤트 적용 (파괴율 -30%)' });
            }
            
            await user.save();
            await interaction.reply({ embeds: [resultEmbed] });
        }
        
        else if (commandName === '강화랭킹') {
            await interaction.deferReply();
            
            try {
                const users = await User.find({ registered: true });
                const rankingData = [];
                
                for (const user of users) {
                    let maxEnhance = 0;
                    let topItem = null;
                    
                    // 착용 장비에서 최고 강화 찾기
                    for (const [slot, equipment] of Object.entries(user.equipment)) {
                        if (equipment && equipment.enhanceLevel > maxEnhance) {
                            maxEnhance = equipment.enhanceLevel;
                            topItem = equipment;
                        }
                    }
                    
                    if (maxEnhance > 0) {
                        rankingData.push({
                            nickname: user.nickname,
                            enhanceLevel: maxEnhance,
                            itemName: topItem.name,
                            totalAttempts: user.enhanceStats.totalAttempts || 0
                        });
                    }
                }
                
                // 강화 레벨순으로 정렬
                rankingData.sort((a, b) => b.enhanceLevel - a.enhanceLevel);
                
                const embed = new EmbedBuilder()
                    .setColor('#ffd700')
                    .setTitle('⚔️ 강화 랭킹 TOP 10')
                    .setDescription('최고 강화 장비 기준 랭킹');
                
                let rankText = '';
                for (let i = 0; i < Math.min(10, rankingData.length); i++) {
                    const data = rankingData[i];
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}위`;
                    rankText += `${medal} **${data.nickname}** - ${data.itemName} +${data.enhanceLevel}⭐\n`;
                }
                
                if (rankText === '') {
                    rankText = '아직 강화한 사용자가 없습니다.';
                }
                
                embed.addFields({ name: '랭킹', value: rankText, inline: false });
                
                await interaction.editReply({ embeds: [embed] });
                
            } catch (error) {
                console.error('강화랭킹 조회 오류:', error);
                await interaction.editReply({ content: '랭킹 조회 중 오류가 발생했습니다!' });
            }
        }
        
        else if (commandName === '의뢰') {
            // 쿨타임 체크
            const cooldownMinutes = checkQuestCooldown(interaction.user.id);
            if (cooldownMinutes) {
                await interaction.reply({ 
                    content: `⏰ 의뢰 쿨타임이 **${cooldownMinutes}분** 남았습니다!`, 
                    ephemeral: true 
                });
                return;
            }

            // 랜덤 의뢰 선택
            const quest = getRandomQuest();
            
            const questEmbed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle(`${quest.emoji} ${quest.title}`)
                .setDescription(`**${quest.name}**\n\n"${quest.description}"`)
                .setFooter({ text: '의뢰를 수락하시겠습니까?' });

            if (quest.type === 'scam') {
                questEmbed.setColor('#e74c3c');
            }

            const questButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_quest_${quest.id}`)
                        .setLabel('✅ 수락')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('decline_quest')
                        .setLabel('❌ 거절')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.reply({ 
                embeds: [questEmbed], 
                components: [questButtons], 
                ephemeral: true 
            });
        }
        
        else if (commandName === '강화통계') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', ephemeral: true });
                return;
            }
            
            const stats = user.enhanceStats;
            const successRate = stats.totalAttempts > 0 ? ((stats.successCount / stats.totalAttempts) * 100).toFixed(1) : 0;
            const destroyRate = stats.totalAttempts > 0 ? ((stats.destroyCount / stats.totalAttempts) * 100).toFixed(1) : 0;
            
            const embed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle(`📊 ${user.nickname}님의 강화 통계`)
                .addFields(
                    { name: '🎯 총 시도 횟수', value: `${stats.totalAttempts}회`, inline: true },
                    { name: '✅ 성공 횟수', value: `${stats.successCount}회`, inline: true },
                    { name: '💥 파괴 횟수', value: `${stats.destroyCount}회`, inline: true },
                    { name: '📈 성공률', value: `${successRate}%`, inline: true },
                    { name: '💀 파괴율', value: `${destroyRate}%`, inline: true },
                    { name: '⭐ 최고 강화', value: `+${stats.maxEnhanceLevel}성`, inline: true },
                    { name: '💰 총 사용 골드', value: `${stats.totalCost.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: false }
                );
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
    } catch (error) {
        console.error('명령어 처리 오류:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: '오류가 발생했습니다!', ephemeral: true });
        }
    }
});

// 버튼 클릭 및 선택 메뉴 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    // 개발 모드에서 채널 제한
    if (DEV_MODE && DEV_CHANNEL_IDS.length > 0 && !DEV_CHANNEL_IDS.includes(interaction.channelId)) {
        console.log(`채널 불일치 - 현재: ${interaction.channelId}, 허용된 개발 채널들: ${DEV_CHANNEL_IDS.join(', ')}`);
        await interaction.reply({ content: '개발 모드에서는 지정된 채널에서만 사용 가능합니다!', ephemeral: true });
        return;
    }

    const user = await getUser(interaction.user.id);
    if (!user) {
        await interaction.reply({ content: '유저 데이터를 불러올 수 없습니다!', ephemeral: true });
        return;
    }
    const now = Date.now();

    try {
        // 메인화면의 게임하기 버튼 처리
        if (interaction.customId === 'game_start') {
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.reply({ content: '유저 데이터를 불러올 수 없습니다!', ephemeral: true });
                return;
            }
            
            // 게임 채널 안내 메시지
            const gameGuideEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('게임 시작!')
                .setDescription(`**${user.nickname || interaction.user.username}**님, 게임을 시작합니다!\n\n게임 채널에서 \`/게임\` 명령어를 사용하여 게임을 플레이하세요.\n\n**게임 채널로 이동하여 본격적인 모험을 시작해보세요!**`)
                .addFields(
                    { name: '명령어 안내', value: '`/게임` - 게임 메뉴 열기', inline: true },
                    { name: '현재 상태', value: `골드: ${user.gold.toLocaleString()}${goldEmoji}\n레벨: Lv.${user.level}`, inline: true }
                )
                .setFooter({ text: '게임 채널에서 더 많은 기능을 이용할 수 있습니다!' });

            await interaction.reply({ embeds: [gameGuideEmbed], ephemeral: true });
        }
        
        else if (interaction.customId === 'support_info') {
            // 후원 안내 (추후 구현)
            const supportEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('후원 안내')
                .setDescription('후원 기능은 준비 중입니다.\n\n개발자를 응원해주시는 마음에 감사드립니다!')
                .setFooter({ text: '곧 후원 시스템이 추가될 예정입니다.' });
                
            await interaction.reply({ embeds: [supportEmbed], ephemeral: true });
        }
        
        else if (interaction.customId === 'hunting') {
            // 개발자는 모든 사냥터 접근 가능, 일반 유저는 언락된 사냥터만
            const availableAreas = isDeveloper(interaction.user.id) ? 
                huntingAreas : 
                huntingAreas.filter(area => user.unlockedAreas.includes(area.id));

            if (availableAreas.length === 0) {
                await interaction.reply({ content: '사용 가능한 사냥터가 없습니다!', ephemeral: true });
                return;
            }

            // 사냥터 페이지네이션 (한 페이지에 3개씩)
            const areasPerPage = 3;
            const totalPages = Math.ceil(availableAreas.length / areasPerPage);
            const currentPage = 0; // 첫 페이지부터 시작

            const startIndex = currentPage * areasPerPage;
            const endIndex = startIndex + areasPerPage;
            const currentAreas = availableAreas.slice(startIndex, endIndex);

            // 사냥터 선택 임베드
            const huntingEmbed = new EmbedBuilder()
                .setColor('#8b0000')
                .setTitle('⚔️ 사냥터 선택')
                .setDescription(`**${user.nickname}**님의 사냥터 목록\n\n현재 레벨: **Lv.${user.level}**`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 사냥터를 선택하세요!` });

            // 사냥터별 필드 추가
            currentAreas.forEach(area => {
                const monsterNames = area.monsters.map(m => m.name).join(', ');
                huntingEmbed.addFields({
                    name: `${area.name} ${area.levelRange}`,
                    value: `출현몬스터: ${monsterNames}`,
                    inline: true
                });
            });

            // 사냥터 버튼들
            const huntingButtons = new ActionRowBuilder();
            currentAreas.forEach(area => {
                huntingButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hunt_area_${area.id}`)
                        .setLabel(area.name)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            // 네비게이션 버튼
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('hunt_prev_page')
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('hunt_page_info')
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('hunt_next_page')
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴')
                        .setStyle(ButtonStyle.Success)
                );

            const components = [huntingButtons];
            if (totalPages > 1) components.push(navButtons);
            else {
                // 페이지가 1개면 게임 메뉴 버튼만 추가
                const backOnly = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('back_to_game_menu')
                            .setLabel('🎮 게임 메뉴로 돌아가기')
                            .setStyle(ButtonStyle.Success)
                    );
                components.push(backOnly);
            }

            await interaction.reply({ embeds: [huntingEmbed], components, ephemeral: true });
        }
        
        else if (interaction.customId === 'ranking') {
            try {
                // 각 랭킹별 데이터 가져오기
                const [levelRanking, goldRanking, popularityRanking] = await Promise.all([
                    User.find({ registered: true }).sort({ level: -1, exp: -1 }).limit(5),
                    User.find({ registered: true }).sort({ gold: -1 }).limit(5),
                    User.find({ registered: true, popularity: { $gt: 0 } }).sort({ popularity: -1 }).limit(5)
                ]);
                
                // 레벨 랭킹 포맷
                let levelText = '';
                levelRanking.forEach((user, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    levelText += `${medal} **${user.nickname}** - Lv.${user.level} (${user.exp}/${user.level * 100})\n`;
                });
                
                // 골드 랭킹 포맷
                let goldText = '';
                goldRanking.forEach((user, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    goldText += `${medal} **${user.nickname}** - ${user.gold.toLocaleString()}${goldEmoji}\n`;
                });
                
                // 인기도 랭킹 포맷
                let popularityText = '';
                if (popularityRanking.length === 0) {
                    popularityText = '아직 인기도를 가진 사용자가 없습니다.';
                } else {
                    popularityRanking.forEach((user, index) => {
                        const medal = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                        const crown = index === 0 ? ' (인기왕)' : '';
                        popularityText += `${medal} **${user.nickname}** - 인기도 ${user.popularity}${crown}\n`;
                    });
                }
                
                const rankingEmbed = new EmbedBuilder()
                    .setColor('#daa520')
                    .setTitle('🏆 전체 랭킹')
                    .setDescription('각 분야의 최강자들을 확인해보세요!')
                    .addFields(
                        { name: '⭐ 레벨 랭킹 TOP 5', value: levelText || '등록된 사용자가 없습니다.', inline: false },
                        { name: '💰 골드 랭킹 TOP 5', value: goldText || '등록된 사용자가 없습니다.', inline: false },
                        { name: '❤️ 인기도 랭킹 TOP 5', value: popularityText, inline: false }
                    )
                    .setFooter({ text: '랭킹은 실시간으로 업데이트됩니다!' })
                    .setTimestamp();
                    
                await interaction.reply({ embeds: [rankingEmbed], ephemeral: true });
            } catch (error) {
                console.error('랭킹 조회 오류:', error);
                await interaction.reply({ content: '랭킹을 불러오는 중 오류가 발생했습니다.', ephemeral: true });
            }
        }
        
        else if (interaction.customId === 'daily') {
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            
            // 테스트용: 쿨타임 제거
            // if (user.lastDaily === today) {
            //     await interaction.reply({ content: '오늘은 이미 출석체크를 했습니다!', ephemeral: true });
            //     return;
            // }

            // 연속 출석 체크
            if (user.lastDaily === yesterday) {
                user.attendanceStreak += 1;
            } else {
                user.attendanceStreak = 1;
            }

            // 주간 출석 체크 (주 시작 체크)
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay()); // 일요일 시작
            weekStart.setHours(0, 0, 0, 0);
            
            if (!user.weekStart || user.weekStart < weekStart) {
                user.weeklyAttendance = [false, false, false, false, false, false, false];
                user.weekStart = weekStart;
            }
            
            user.weeklyAttendance[now.getDay()] = true;

            // 이미지 첨부
            const dailyAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_daily.gif'), { name: 'kim_daily.gif' });

            // 보상 옵션들
            const rewards = [
                { name: '💰 500G', gold: 500, exp: 0, item: null },
                { name: '💰 1000G', gold: 1000, exp: 0, item: null },
                { name: '💰 2000G', gold: 2000, exp: 0, item: null },
                { name: '✨ 경험치 부스터', gold: 0, exp: 500, item: null },
                { name: '🎁 미스터리 박스', gold: 1500, exp: 100, item: 'mystery_box' }
            ];

            // 초기 룰렛 표시
            const rouletteEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🎡 출석 체크 보상 돌려돌려 돌림판!')
                .setDescription(`**${user.nickname || interaction.user.username}**님의 출석 체크!\\n\\n연속 출석: **${user.attendanceStreak}일** 🔥`)
                .addFields(
                    { name: '주간 출석 현황', value: `${user.weeklyAttendance.map((attended, i) => {
                        const days = ['일', '월', '화', '수', '목', '금', '토'];
                        return attended ? `${days[i]}✅` : `${days[i]}❌`;
                    }).join(' ')} (${user.weeklyAttendance.filter(x => x).length}/7)`, inline: false },
                )
                .setImage('attachment://kim_daily.gif')
                .setFooter({ text: '아래 버튼을 눌러 돌림판을 돌리세요!' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('spin_roulette')
                        .setLabel('🎡 돌림판 돌리기!')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [rouletteEmbed], components: [row], files: [dailyAttachment], ephemeral: true });
        }
        
        else if (interaction.customId === 'spin_roulette') {
            // 먼저 응답 지연 처리
            await interaction.deferUpdate();
            
            // 돌림판 애니메이션
            const rewards = [
                { name: '💰 500G + ✨ 100EXP', gold: 500, exp: 100 },
                { name: '💰 1000G + ✨ 200EXP', gold: 1000, exp: 200 },
                { name: '💰 1500G + ✨ 300EXP', gold: 1500, exp: 300 },
                { name: '💰 2000G + ✨ 400EXP', gold: 2000, exp: 400 },
                { name: '💰 2500G + ✨ 500EXP', gold: 2500, exp: 500 }
            ];

            const selectedReward = rewards[Math.floor(Math.random() * rewards.length)];
            const rewardIndex = rewards.indexOf(selectedReward);

            // 애니메이션 프레임들
            const frames = [
                '❓ 🎁 ❓ ❓ ❓',
                '❓ ❓ 🎁 ❓ ❓',
                '❓ ❓ ❓ 🎁 ❓',
                '❓ ❓ ❓ ❓ 🎁',
                '🎁 ❓ ❓ ❓ ❓'
            ];

            // 최종 결과 프레임
            const finalFrame = rewards.map((r, i) => i === rewardIndex ? '🎉' : '❌').join(' ');

            // 1단계: 돌리는 중 GIF
            const turntableAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_turntable.gif'), { name: 'kim_turntable.gif' });

            // GIF와 함께 돌림판 시작 표시
            const gifEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🎡 돌림판 돌리는 중...')
                .setDescription(`연속 출석: **${user.attendanceStreak}일** 🔥`)
                .setImage('attachment://kim_turntable.gif');

            await interaction.editReply({ embeds: [gifEmbed], components: [], files: [turntableAttachment] });
            
            // GIF 재생 시간 (4초)
            await new Promise(resolve => setTimeout(resolve, 4000));

            // 최종 결과 표시
            user.gold += selectedReward.gold;
            user.exp += selectedReward.exp;
            user.lastDaily = new Date().toDateString();
            
            // 레벨업 체크
            const { leveledUp, levelsGained, oldLevel } = processLevelUp(user);
            
            // 연속 출석 보너스
            let streakBonus = '';
            if (user.attendanceStreak >= 7) {
                const bonusGold = 1000;
                user.gold += bonusGold;
                streakBonus = `\\n🔥 **7일 연속 출석 보너스**: +${bonusGold}G`;
            }
            
            // 주간 미션 완료 체크
            let weeklyBonus = '';
            if (user.weeklyAttendance.filter(x => x).length === 7) {
                const weeklyGold = 5000;
                user.gold += weeklyGold;
                weeklyBonus = `\\n🏆 **주간 미션 완료**: +${weeklyGold}G`;
            }
            
            await user.save();

            // 3단계: 보상 강도에 따른 감정 멘트와 결과 표시
            const resultAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_turntable2.gif'), { name: 'kim_turntable2.gif' });
            
            // 보상 강도별 감정 멘트 설정
            let emotionTitle = '';
            let emotionDescription = '';
            let embedColor = '';
            
            // 레벨업 메시지 추가
            const levelUpMessage = leveledUp ? `\n\n🎉 **레벨업!** Lv.${oldLevel} → Lv.${user.level}` : '';
            
            if (selectedReward.gold >= 2000) {
                // 최고 보상
                emotionTitle = '🚀 대박!! 최고의 운이군요!';
                emotionDescription = `와! **${selectedReward.name}**을 당첨시키다니! 정말 대단해요! 오늘은 분명 좋은 일이 가득할 거예요! ✨${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#ffd700'; // 금색
            } else if (selectedReward.gold >= 1500) {
                // 높은 보상
                emotionTitle = '🎉 훌륭해요! 좋은 보상이네요!';
                emotionDescription = `**${selectedReward.name}** 당첨! 오늘 운이 좋으시네요! 계속 이런 행운이 이어지길 바라요! 😊${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#ff6b6b'; // 빨간색
            } else if (selectedReward.gold >= 1000) {
                // 중간 보상
                emotionTitle = '⭐ 좋은 결과예요!';
                emotionDescription = `**${selectedReward.name}** 당첨! 꾸준한 성장과 골드 획득이네요! 💪${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#9b59b6'; // 보라색
            } else {
                // 일반 보상
                emotionTitle = '😊 좋은 시작이에요!';
                emotionDescription = `**${selectedReward.name}** 당첨! 꾸준히 모으면 큰 힘이 될 거예요! 매일매일 출석해서 더 큰 보상을 노려봐요! 🎯${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#3498db'; // 파란색
            }
            
            const resultEmbed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(emotionTitle)
                .setDescription(emotionDescription)
                .addFields(
                    { name: '💰 획득 내역', value: `골드: +${selectedReward.gold.toLocaleString()}<:currency_emoji:1377404064316522778>\n경험치: +${selectedReward.exp} EXP`, inline: true },
                    { name: '<:currency_emoji:1377404064316522778> 현재 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '🔥 연속 출석', value: `${user.attendanceStreak}일`, inline: true }
                )
                .setImage('attachment://kim_turntable2.gif')
                .setFooter({ text: '내일도 잊지 말고 출석체크 해주세요!' });

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴로 돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({ embeds: [resultEmbed], components: [backButton], files: [resultAttachment] });
        }
        
        // 사냥터 선택 처리
        else if (interaction.customId.startsWith('hunt_area_')) {
            const areaId = parseInt(interaction.customId.split('_')[2]);
            const selectedArea = huntingAreas.find(area => area.id === areaId);
            
            if (!selectedArea) {
                await interaction.reply({ content: '존재하지 않는 사냥터입니다!', ephemeral: true });
                return;
            }
            
            // 사냥 시작 - 3단계 프로세스
            // 사냥터별 GIF 설정
            const huntingGifName = selectedArea.huntingGif || 'kim_hunting.gif'; // 기본값 설정
            const huntGifAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', huntingGifName), { name: huntingGifName });

            // 1단계: 사냥중 GIF (2초)
            const huntingMessages = [
                `**${selectedArea.name}**에서 열심히 사냥중입니다...`,
                `**${selectedArea.name}**에서 힘겹게 전투중입니다...`,
                `**${selectedArea.name}**의 몬스터들과 격투중입니다...`,
                `**${selectedArea.name}**를 탐험하며 사냥중입니다...`,
                `**${selectedArea.name}**에서 치열한 전투를 벌이고 있습니다...`
            ];
            
            const randomMessage = huntingMessages[Math.floor(Math.random() * huntingMessages.length)];
            
            const huntGifEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('⚔️ 사냥중...')
                .setDescription(`${randomMessage}\n\n현재 레벨: **Lv.${user.level}**`)
                .setImage(`attachment://${huntingGifName}`);
            
            await interaction.update({ embeds: [huntGifEmbed], components: [], files: [huntGifAttachment] });
            
            // 2초 대기 후 바로 결과로
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 랜덤 몬스터 선택 (사냥터에 접근할 수 있다면 모든 몬스터 사냥 가능)
            const availableMonsters = selectedArea.monsters;

            const selectedMonster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
            const monsterLevel = Math.floor(Math.random() * (selectedMonster.level[1] - selectedMonster.level[0] + 1)) + selectedMonster.level[0];

            // 전투력 계산
            const userPower = calculateCombatPower(user);
            const monsterPower = calculateMonsterPower(selectedMonster, monsterLevel);
            
            // 승리 확률 계산 (전투력 차이에 따라)
            const powerDiff = userPower - monsterPower;
            let winRate = 50; // 기본 50%
            
            if (powerDiff > 0) {
                winRate = Math.min(95, 50 + (powerDiff / 10)); // 최대 95%
            } else {
                winRate = Math.max(5, 50 + (powerDiff / 15)); // 최소 5%
            }
            
            const battleResult = Math.random() * 100 <= winRate;

            // 전투 결과 계산
            const baseExp = Math.floor(Math.random() * (selectedMonster.exp[1] - selectedMonster.exp[0] + 1)) + selectedMonster.exp[0];
            const baseGold = Math.floor(Math.random() * (selectedMonster.gold[1] - selectedMonster.gold[0] + 1)) + selectedMonster.gold[0];
            
            // 레벨 차이에 따른 보상 조정
            const levelDiff = user.level - monsterLevel;
            let expMultiplier = 1;
            let goldMultiplier = 1;
            
            if (levelDiff > 5) {
                expMultiplier = 0.5; // 너무 쉬운 몬스터
                goldMultiplier = 0.7;
            } else if (levelDiff < -5) {
                expMultiplier = 1.5; // 어려운 몬스터
                goldMultiplier = 1.3;
            }

            const finalExp = Math.floor(baseExp * expMultiplier);
            const finalGold = Math.floor(baseGold * goldMultiplier);

            // 레어도에 따른 보너스
            let rarityBonus = 1;
            let rarityEmoji = '';
            switch (selectedMonster.rarity) {
                case '레어':
                    rarityBonus = 1.2;
                    rarityEmoji = '✨';
                    break;
                case '에픽':
                    rarityBonus = 1.5;
                    rarityEmoji = '🌟';
                    break;
                case '유니크':
                    rarityBonus = 2.0;
                    rarityEmoji = '💎';
                    break;
                case '레전드':
                    rarityBonus = 3.0;
                    rarityEmoji = '👑';
                    break;
                default:
                    rarityEmoji = '⚔️';
            }

            user.lastHunt = Date.now();
            
            // GIF 파일 준비
            const winGifAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_hunting_win.gif'), { name: 'kim_hunting_win.gif' });
            const loseGifAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_hunting_lose.gif'), { name: 'kim_hunting_lose.gif' });
            
            let resultEmbed;
            
            if (battleResult) {
                // 승리 시
                const bonusExp = Math.floor(finalExp * (rarityBonus - 1));
                const bonusGold = Math.floor(finalGold * (rarityBonus - 1));

                // 유저 데이터 업데이트
                user.exp += finalExp + bonusExp;
                user.gold += finalGold + bonusGold;

                // 레벨업 체크
                const { leveledUp, levelsGained, oldLevel } = processLevelUp(user);

                await user.save();

                // 결과 임베드 (승리 GIF와 함께)
                const expBar = generateExpBar(user.exp, user.level * 100, 20);
                const powerDiffText = userPower > monsterPower ? 
                    `🔥 **우세** (+${userPower - monsterPower})` : 
                    userPower < monsterPower ? 
                        `⚠️ **열세** (-${monsterPower - userPower})` : 
                        `⚖️ **동등**`;
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#00d4aa')
                    .setTitle(`${rarityEmoji} ⚔️ 전투 승리! ⚔️`)
                    .setDescription(`🎯 **${selectedMonster.name}** Lv.${monsterLevel} 처치 완료!${leveledUp ? `\n\n🎉 **레벨업!** Lv.${oldLevel} → Lv.${user.level} 🎉` : ''}`)
                    .addFields(
                        { 
                            name: '⚔️ 전투 결과', 
                            value: `🛡️ 나의 전투력: **${userPower.toLocaleString()}** | ⚔️ 적의 전투력: **${monsterPower.toLocaleString()}** | 📊 승리 확률: **${winRate.toFixed(1)}%**\n\n${powerDiffText}`, 
                            inline: false 
                        },
                        { 
                            name: '💎 보상', 
                            value: `✨ 경험치: \`+${finalExp.toLocaleString()} EXP\`${bonusExp > 0 ? ` \`보너스 +${bonusExp.toLocaleString()}\`` : ''} | 💰 골드: \`+${finalGold.toLocaleString()}<:currency_emoji:1377404064316522778>\`${bonusGold > 0 ? ` \`보너스 +${bonusGold.toLocaleString()}<:currency_emoji:1377404064316522778>\`` : ''}`, 
                            inline: false 
                        },
                        { 
                            name: '📊 현재 상태', 
                            value: `🏆 레벨: \`Lv.${user.level}\` | ✨ 경험치: \`${user.exp}/${user.level * 100} EXP\` | 💰 골드: \`${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>\``, 
                            inline: false 
                        }
                    )
                    .setImage('attachment://kim_hunting_win.gif')
            } else {
                // 패배 시
                const defeatMessages = [
                    "아이템을 강화해서 이기자!",
                    "더 강해져서 다시 도전하자!",
                    "장비를 업그레이드하고 복수하자!",
                    "레벨업을 하고 다시 싸우자!",
                    "능력치를 올리고 재도전하자!",
                    "더 좋은 무기가 필요해 보인다!",
                    "방어구를 강화하고 다시 오자!",
                    "전투력을 키워서 복수하자!",
                    "스킬을 배워서 다시 도전하자!",
                    "더 많은 경험이 필요해 보인다!"
                ];
                
                const randomDefeatMessage = defeatMessages[Math.floor(Math.random() * defeatMessages.length)];
                
                // 벌금 계산 (몬스터 드랍 골드의 1~10배)
                const penalty = Math.floor(Math.random() * 10 + 1) * baseGold;
                const actualPenalty = Math.min(penalty, user.gold); // 보유 골드를 초과할 수 없음
                
                user.gold = Math.max(0, user.gold - actualPenalty);
                await user.save();

                // 결과 임베드 (패배 GIF와 함께)
                const expBarDefeat = generateExpBar(user.exp, user.level * 100, 20);
                const powerDiffTextDefeat = userPower > monsterPower ? 
                    `🔥 **우세였지만** (+${userPower - monsterPower})` : 
                    userPower < monsterPower ? 
                        `⚠️ **열세** (-${monsterPower - userPower})` : 
                        `⚖️ **동등했지만**`;
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle(`💥 ⚔️ 전투 패배... ⚔️`)
                    .setDescription(`😞 **${selectedMonster.name}** Lv.${monsterLevel} 에게 패배...\n\n💭 **"${randomDefeatMessage}"**`)
                    .addFields(
                        { 
                            name: '⚔️ 전투 결과', 
                            value: `🛡️ 나의 전투력: **${userPower.toLocaleString()}** | ⚔️ 적의 전투력: **${monsterPower.toLocaleString()}** | 📊 승리 확률: **${winRate.toFixed(1)}%**\n\n${powerDiffTextDefeat}`, 
                            inline: false 
                        },
                        { 
                            name: '💸 손실', 
                            value: `💰 벌금: \`-${actualPenalty.toLocaleString()}<:currency_emoji:1377404064316522778>\` | ❌ 몬스터 드랍 골드의 **${Math.floor(actualPenalty/baseGold)}배** 손실`, 
                            inline: false 
                        },
                        { 
                            name: '📊 현재 상태', 
                            value: `🏆 레벨: \`Lv.${user.level}\` | ✨ 경험치: \`${user.exp}/${user.level * 100} EXP\` | 💰 골드: \`${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>\``, 
                            inline: false 
                        },
                        { 
                            name: '💡 다음 도전을 위한 조언', 
                            value: `🎯 ${randomDefeatMessage}\n\n🔧 **추천 강화 방법**\n📈 능력치 포인트 투자\n⚔️ 장비 강화 및 교체\n🆙 레벨업으로 기본 능력치 증가`, 
                            inline: false 
                        }
                    )
                    .setImage('attachment://kim_hunting_lose.gif')
            }

            const continueButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hunt_area_${areaId}`)
                        .setLabel('🔄 계속 사냥')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('hunting')
                        .setLabel('🗺️ 사냥터 변경')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴')
                        .setStyle(ButtonStyle.Success)
                );

            await interaction.editReply({ 
                embeds: [resultEmbed], 
                components: [continueButtons], 
                files: battleResult ? [winGifAttachment] : [loseGifAttachment]
            });
        }
        
        else if (interaction.customId === 'work') {
            const cooldown = 30 * 60 * 1000; // 30분 쿨타임
            
            if (now - user.lastWork < cooldown) {
                const remaining = Math.ceil((cooldown - (now - user.lastWork)) / 60000);
                await interaction.reply({ content: `쿨타임 ${remaining}분 남았습니다!`, ephemeral: true });
                return;
            }

            const goldReward = Math.floor(Math.random() * 300) + 200; // 200-500골드
            const expReward = Math.floor(Math.random() * 50) + 25; // 25-75경험치
            
            user.gold += goldReward;
            user.exp += expReward;
            user.lastWork = now;
            
            // 레벨업 체크
            const { leveledUp, levelsGained, oldLevel } = processLevelUp(user);
            
            await user.save();

            const levelUpMessage = leveledUp ? `\n\n🎉 **레벨업!** Lv.${oldLevel} → Lv.${user.level}` : '';

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('일하기 완료!')
                .setDescription(`열심히 일해서 골드와 경험치를 얻었습니다!${levelUpMessage}`)
                .addFields(
                    { name: '획득 골드', value: `+${goldReward.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '획득 경험치', value: `+${expReward} EXP`, inline: true },
                    { name: '현재 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.customId === 'info') {
            const maxExp = user.level * 100;
            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('내 정보')
                .setDescription(`**${user.nickname}**님의 게임 정보`)
                .addFields(
                    { name: '레벨', value: `Lv.${user.level}`, inline: true },
                    { name: '경험치', value: `${user.exp}/${maxExp} EXP`, inline: true },
                    { name: '골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '인기도', value: `${user.popularity} ${user.popularity > 0 ? '❤️' : user.popularity < 0 ? '💔' : ''}`, inline: true },
                    { name: '출석체크', value: user.lastDaily === new Date().toDateString() ? '완료' : '미완료', inline: true },
                    { name: '일하기', value: now - user.lastWork < 30 * 60 * 1000 ? '쿨타임' : '가능', inline: true },
                    { name: '연속 출석', value: `${user.attendanceStreak || 0}일 🔥`, inline: true },
                    { name: '주간 출석', value: `${user.weeklyAttendance ? user.weeklyAttendance.filter(x => x).length : 0}/7일`, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.customId === 'stats') {
            const totalStats = user.stats.strength + user.stats.agility + user.stats.intelligence + user.stats.vitality + user.stats.luck;
            
            const statsEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('💪 능력치')
                .setDescription(`**${user.nickname}**님의 능력치 정보`)
                .addFields(
                    { name: '💪 힘', value: `${user.stats.strength}`, inline: true },
                    { name: '🏃 민첩', value: `${user.stats.agility}`, inline: true },
                    { name: '🧠 지능', value: `${user.stats.intelligence}`, inline: true },
                    { name: '❤️ 체력', value: `${user.stats.vitality}`, inline: true },
                    { name: '🍀 행운', value: `${user.stats.luck}`, inline: true },
                    { name: '📊 총합', value: `${totalStats}`, inline: true },
                    { name: '⭐ 보유 스탯포인트', value: `${user.statPoints}점`, inline: false }
                )
                .setFooter({ text: '레벨업 시 스탯포인트가 지급됩니다!' });

            const statButtons = new ActionRowBuilder();
            
            if (user.statPoints > 0) {
                statButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId('add_strength')
                        .setLabel('💪 힘 +1')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('add_agility')
                        .setLabel('🏃 민첩 +1')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('add_intelligence')
                        .setLabel('🧠 지능 +1')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('add_vitality')
                        .setLabel('❤️ 체력 +1')
                        .setStyle(ButtonStyle.Primary)
                );
            } else {
                statButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId('stats_info')
                        .setLabel('스탯포인트가 없습니다')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            }

            await interaction.reply({ 
                embeds: [statsEmbed], 
                components: user.statPoints > 0 ? [statButtons] : [statButtons],
                ephemeral: true 
            });
        }
        
        else if (interaction.customId === 'skills') {
            const skillsEmbed = new EmbedBuilder()
                .setColor('#4ecdc4')
                .setTitle('🔮 스킬')
                .setDescription(`**${user.nickname}**님의 스킬 정보`)
                .addFields(
                    { name: '📚 보유 스킬', value: user.skills.length > 0 ? user.skills.map(skill => `**${skill.name}** Lv.${skill.level}`).join('\n') : '보유한 스킬이 없습니다.', inline: false },
                    { name: '💡 스킬 획득', value: '특정 조건을 만족하면 새로운 스킬을 습득할 수 있습니다!', inline: false }
                )
                .setFooter({ text: '스킬은 전투와 활동에서 도움을 줍니다!' });

            await interaction.reply({ embeds: [skillsEmbed], ephemeral: true });
        }
        
        else if (interaction.customId.startsWith('add_')) {
            const statType = interaction.customId.replace('add_', '');
            
            if (user.statPoints <= 0) {
                await interaction.reply({ content: '스탯포인트가 부족합니다!', ephemeral: true });
                return;
            }
            
            user.stats[statType] += 1;
            user.statPoints -= 1;
            await user.save();
            
            const statNames = {
                strength: '💪 힘',
                agility: '🏃 민첩', 
                intelligence: '🧠 지능',
                vitality: '❤️ 체력',
                luck: '🍀 행운'
            };
            
            await interaction.reply({ 
                content: `${statNames[statType]}이 1 증가했습니다! (${user.stats[statType]-1} → ${user.stats[statType]})`, 
                ephemeral: true 
            });
        }
        
        else if (interaction.customId === 'shop') {
            const shopMainAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_shop_main.gif'), { name: 'kim_shop_main.gif' });
            
            const shopEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🛒 김헌터 상점')
                .setDescription(`**${user.nickname}** 모험가님, 총 보유금액은 **${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>**입니다.\n\n원하는 카테고리를 선택하여 아이템을 구매하세요!`)
                .setImage('attachment://kim_shop_main.gif');

            const categorySelect = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('shop_category')
                        .setPlaceholder('카테고리를 선택하세요')
                        .addOptions([
                            {
                                label: '무기',
                                description: '검, 도끼, 활, 지팡이 등',
                                value: 'weapon',
                                emoji: '⚔️'
                            },
                            {
                                label: '헬멧',
                                description: '투구, 모자, 머리띠 등',
                                value: 'helmet',
                                emoji: '⛑️'
                            },
                            {
                                label: '갑옷',
                                description: '갑옷, 로브, 의복 등',
                                value: 'armor',
                                emoji: '🛡️'
                            },
                            {
                                label: '장갑',
                                description: '장갑, 팔찌, 손목보호대 등',
                                value: 'gloves',
                                emoji: '🧤'
                            },
                            {
                                label: '신발',
                                description: '부츠, 신발, 발목보호대 등',
                                value: 'boots',
                                emoji: '👢'
                            },
                            {
                                label: '소비',
                                description: '포션, 스크롤, 버프아이템 등',
                                value: 'consumable',
                                emoji: '💊'
                            },
                            {
                                label: '주문서',
                                description: '강화석, 강화 재료 등',
                                value: 'enhancement',
                                emoji: '⚒️'
                            },
                            {
                                label: '코인',
                                description: '특별한 코인과 재화',
                                value: 'coin',
                                emoji: '🪙'
                            }
                        ])
                );

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴로 돌아가기')
                        .setStyle(ButtonStyle.Success)
                );

            await interaction.reply({ 
                embeds: [shopEmbed], 
                components: [categorySelect, backButton], 
                files: [shopMainAttachment],
                flags: [64] // InteractionResponseFlags.Ephemeral
            });
        }
        
        else if (interaction.customId === 'shop_category') {
            const selectedCategory = interaction.values[0];
            
            // 전역 상점 카테고리 데이터 사용
            const categoryData = SHOP_CATEGORIES[selectedCategory];
            if (!categoryData) {
                await interaction.update({ content: '해당 카테고리는 아직 준비 중입니다!', embeds: [], components: [] });
                return;
            }
            
            // 카테고리 이미지 첨부파일 생성
            const categoryAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', categoryData.gif), { name: categoryData.gif });
            
            // 등급별 커스텀 이모지
            const rarityEmojis = {
                '일반': '<:common_emoji:1381597953072037909>',
                '고급': '<:uncomon_emoji:1381598058327838752>',
                '레어': '<:rare_emoji:1381598053974278154>',
                '에픽': '<:epic_emoji:1381598051046658048>',
                '레전드리': '<:legendary_emoji:1381598048446189589>'
            };
            
            // 골드 커스텀 이모지
            const goldEmoji = '<:currency_emoji:1377404064316522778>';
            
            // Use the global category data
            const category = categoryData;
            if (!category) {
                await interaction.update({ content: '해당 카테고리는 아직 준비 중입니다!', embeds: [], components: [] });
                return;
            }
            
            // 페이지별 등급 정의
            const pageRarities = {
                0: ['일반', '고급', '레어'],        // 1페이지
                1: ['에픽', '레전드리']           // 2페이지
            };
            
            const totalPages = 2; // 고정 2페이지
            const currentPage = 0; // 첫 페이지부터 시작

            // 현재 페이지에 해당하는 등급들의 아이템만 필터링
            const currentPageRarities = pageRarities[currentPage];
            const currentItems = category.items.filter(item => 
                currentPageRarities.includes(item.rarity)
            );

            // 등급별로 아이템 그룹화
            const itemsByRarity = {};
            currentItems.forEach(item => {
                if (!itemsByRarity[item.rarity]) {
                    itemsByRarity[item.rarity] = [];
                }
                itemsByRarity[item.rarity].push(item);
            });

            // 등급 순서 정의
            const rarityOrder = ['노멀', '레어', '에픽', '레전드리', '유니크'];
            
            // 현재 페이지의 등급들만 표시
            let itemList = '';
            currentPageRarities.forEach(rarity => {
                if (itemsByRarity[rarity] && itemsByRarity[rarity].length > 0) {
                    itemList += `${rarityEmojis[rarity]} **${rarity}**\n`;
                    itemsByRarity[rarity].forEach(item => {
                        itemList += `\`${item.name}\` - ${item.price.toLocaleString()}${goldEmoji}\n`;
                    });
                    itemList += '\n'; // 등급 간 구분을 위한 빈 줄
                }
            });
            
            const categoryEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle(`${category.emoji} ${category.name} 상점`)
                .setDescription(`${category.name} 카테고리의 아이템들입니다.\n\n${itemList}`)
                .setThumbnail(`attachment://${categoryData.gif}`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 아이템을 클릭하여 구매하세요!` });
            
            // 등급별 버튼 스타일 설정
            const getRarityButtonStyle = (rarity) => {
                switch(rarity) {
                    case '일반': return ButtonStyle.Secondary; // 회색
                    case '고급': return ButtonStyle.Primary;   // 파란색
                    case '레어': return ButtonStyle.Danger;    // 빨간색
                    case '에픽': return ButtonStyle.Success; // 초록색
                    case '레전드리': return ButtonStyle.Danger; // 빨간색
                    default: return ButtonStyle.Secondary;
                }
            };

            // 아이템 구매 버튼들 (3개씩 3줄)
            const itemButtons = [];
            for (let i = 0; i < currentItems.length; i += 3) {
                const row = new ActionRowBuilder();
                const rowItems = currentItems.slice(i, i + 3);
                
                rowItems.forEach((item, index) => {
                    // 전체 아이템 배열에서의 실제 인덱스 찾기
                    const actualIndex = category.items.findIndex(categoryItem => 
                        categoryItem.name === item.name && categoryItem.rarity === item.rarity
                    );
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`buy_${selectedCategory}_${actualIndex}`)
                            .setLabel(`${item.name}`)
                            .setStyle(getRarityButtonStyle(item.rarity))
                            .setDisabled(user.gold < item.price)
                    );
                });
                
                itemButtons.push(row);
            }

            // 네비게이션 버튼 (사냥터와 동일한 방식)
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop_${selectedCategory}_prev_page`)
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`shop_${selectedCategory}_page_info`)
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`shop_${selectedCategory}_next_page`)
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('shop')
                        .setLabel('🔙 상점 메인')
                        .setStyle(ButtonStyle.Primary)
                );

            // 모든 버튼 합치기
            const allComponents = [...itemButtons, navButtons];

            await interaction.update({
                embeds: [categoryEmbed],
                components: allComponents,
                files: [categoryAttachment]
            });
        }
        
        else if (interaction.customId.includes('_prev_page') || interaction.customId.includes('_next_page')) {
            // 상점 페이지네이션 처리
            const parts = interaction.customId.split('_');
            const category = parts[1];
            const direction = parts[2]; // 'prev' 또는 'next'
            
            // 현재 페이지 정보 추출 (임베드의 footer에서)
            const currentEmbed = interaction.message.embeds[0];
            const footerText = currentEmbed.footer?.text || '';
            const pageMatch = footerText.match(/페이지 (\d+)\/(\d+)/);
            
            if (!pageMatch) {
                await interaction.reply({ content: '페이지 정보를 찾을 수 없습니다!', ephemeral: true });
                return;
            }
            
            const currentPage = parseInt(pageMatch[1]) - 1; // 0-based index
            const totalPages = parseInt(pageMatch[2]);
            
            let newPage = currentPage;
            if (direction === 'prev' && currentPage > 0) {
                newPage = currentPage - 1;
            } else if (direction === 'next' && currentPage < totalPages - 1) {
                newPage = currentPage + 1;
            }
            
            // 전역 상점 카테고리 데이터 사용
            const categoryData = SHOP_CATEGORIES[category];
            if (!categoryData) {
                await interaction.reply({ content: '카테고리를 찾을 수 없습니다!', ephemeral: true });
                return;
            }
            
            // 카테고리 이미지 첨부파일 생성
            const categoryAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', categoryData.gif), { name: categoryData.gif });
            
            // 페이지 재구성 - 등급별 필터링 사용
            const rarityEmojis = {
                '일반': '<:common_emoji:1381597953072037909>',
                '고급': '<:uncomon_emoji:1381598058327838752>',
                '레어': '<:rare_emoji:1381598053974278154>',
                '에픽': '<:epic_emoji:1381598051046658048>',
                '레전드리': '<:legendary_emoji:1381598048446189589>'
            };
            
            // 골드 커스텀 이모지
            const goldEmoji = '<:currency_emoji:1377404064316522778>';
            
            // 페이지별 등급 정의 (카테고리 표시와 동일한 로직)
            const pageRarities = {
                0: ['일반', '고급', '레어'],        // 1페이지
                1: ['에픽', '레전드리']           // 2페이지
            };
            
            // 현재 페이지에 해당하는 등급들의 아이템만 필터링
            const currentPageRarities = pageRarities[newPage];
            const currentItems = categoryData.items.filter(item => 
                currentPageRarities.includes(item.rarity)
            );
            
            // 등급별로 아이템 그룹화
            const itemsByRarity = {};
            currentItems.forEach(item => {
                if (!itemsByRarity[item.rarity]) {
                    itemsByRarity[item.rarity] = [];
                }
                itemsByRarity[item.rarity].push(item);
            });
            
            // 현재 페이지의 등급들만 표시
            let itemList = '';
            currentPageRarities.forEach(rarity => {
                if (itemsByRarity[rarity] && itemsByRarity[rarity].length > 0) {
                    itemList += `${rarityEmojis[rarity]} **${rarity}**\n`;
                    itemsByRarity[rarity].forEach(item => {
                        itemList += `\`${item.name}\` - ${item.price.toLocaleString()}${goldEmoji}\n`;
                    });
                    itemList += '\n'; // 등급 간 구분을 위한 빈 줄
                }
            });
            
            const updatedEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle(`${categoryData.emoji} ${categoryData.name} 상점`)
                .setDescription(`${categoryData.name} 카테고리의 아이템들입니다.\n\n${itemList}`)
                .setThumbnail(`attachment://${categoryData.gif}`)
                .setFooter({ text: `페이지 ${newPage + 1}/${totalPages} | 아이템을 클릭하여 구매하세요!` });
            
            // 버튼 재구성
            const getRarityButtonStyle = (rarity) => {
                switch(rarity) {
                    case '노멀': return ButtonStyle.Secondary;
                    case '레어': return ButtonStyle.Primary;
                    case '에픽': return ButtonStyle.Danger;
                    case '유니크': return ButtonStyle.Success;
                    case '레전드리': return ButtonStyle.Danger;
                    default: return ButtonStyle.Secondary;
                }
            };
            
            const itemButtons = [];
            for (let i = 0; i < currentItems.length; i += 3) {
                const row = new ActionRowBuilder();
                const rowItems = currentItems.slice(i, i + 3);
                
                rowItems.forEach((item, index) => {
                    // 전체 아이템 배열에서의 실제 인덱스 찾기
                    const actualIndex = categoryData.items.findIndex(categoryItem => 
                        categoryItem.name === item.name && categoryItem.rarity === item.rarity
                    );
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`buy_${category}_${actualIndex}`)
                            .setLabel(`${item.name}`)
                            .setStyle(getRarityButtonStyle(item.rarity))
                            .setDisabled(user.gold < item.price)
                    );
                });
                
                itemButtons.push(row);
            }
            
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop_${category}_prev_page`)
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`shop_${category}_page_info`)
                        .setLabel(`${newPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`shop_${category}_next_page`)
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('shop')
                        .setLabel('🔙 상점 메인')
                        .setStyle(ButtonStyle.Primary)
                );

            const allComponents = [...itemButtons, navButtons];

            await interaction.update({
                embeds: [updatedEmbed],
                components: allComponents,
                files: [categoryAttachment]
            });
        }
        
        else if (interaction.customId.startsWith('buy_')) {
            const parts = interaction.customId.split('_');
            if (parts.length < 3) {
                await interaction.reply({ content: '잘못된 아이템 선택입니다!', ephemeral: true });
                return;
            }
            
            const category = parts[1];
            const itemIndex = parseInt(parts[2]);
            
            // 전역 상점 카테고리 데이터 사용
            const categoryData = SHOP_CATEGORIES[category];
            if (!categoryData || !categoryData.items[itemIndex]) {
                await interaction.reply({ content: '존재하지 않는 아이템입니다!', ephemeral: true });
                return;
            }
            
            const item = categoryData.items[itemIndex];
            
            if (user.gold < item.price) {
                await interaction.reply({ content: '골드가 부족합니다!', ephemeral: true });
                return;
            }
            
            // 랜덤 능력치 생성
            const randomStats = generateRandomStats(item.stats);
            
            // 능력치 퀄리티 계산 (1~100%)
            let totalQuality = 0;
            let statCount = 0;
            
            for (const [statName, value] of Object.entries(randomStats)) {
                const [min, max] = item.stats[statName];
                if (min !== max) {
                    const quality = ((value - min) / (max - min)) * 100;
                    totalQuality += quality;
                    statCount++;
                }
            }
            
            const averageQuality = statCount > 0 ? totalQuality / statCount : 100;
            
            // 퀄리티에 따른 GIF 및 메시지 선택
            let purchaseGif;
            let qualityMessage;
            let embedColor;
            
            if (averageQuality <= 80) {
                // 하위 80% - 2 버전 GIF
                switch(item.type) {
                    case 'weapon':
                        purchaseGif = 'kim_shop_buy_waepon2.gif';
                        break;
                    case 'armor':
                        purchaseGif = 'kim_shop_buy_robe2.gif';
                        break;
                    case 'helmet':
                        purchaseGif = 'kim_shop_buy_hood2.gif';
                        break;
                    case 'gloves':
                        purchaseGif = 'kim_shop_buy_gloves2.gif';
                        break;
                    case 'boots':
                        purchaseGif = 'kim_shop_buy_boots2.gif';
                        break;
                    default:
                        purchaseGif = null;
                }
                
                if (averageQuality <= 20) {
                    qualityMessage = '😢 최하급 옵션';
                    embedColor = '#7f8c8d'; // 회색
                } else if (averageQuality <= 40) {
                    qualityMessage = '😐 하급 옵션';
                    embedColor = '#95a5a6'; // 연한 회색
                } else if (averageQuality <= 60) {
                    qualityMessage = '🙂 평균 옵션';
                    embedColor = '#3498db'; // 파란색
                } else {
                    qualityMessage = '😊 준수한 옵션';
                    embedColor = '#2ecc71'; // 초록색
                }
            } else {
                // 상위 20% - 기본 GIF
                switch(item.type) {
                    case 'weapon':
                        purchaseGif = 'kim_shop_buy_waepon.gif';
                        break;
                    case 'armor':
                        purchaseGif = 'kim_shop_buy_robe.gif';
                        break;
                    case 'helmet':
                        purchaseGif = 'kim_shop_buy_hood.gif';
                        break;
                    case 'gloves':
                        purchaseGif = 'kim_shop_buy_gloves.gif';
                        break;
                    case 'boots':
                        purchaseGif = 'kim_shop_buy_boots.gif';
                        break;
                    default:
                        purchaseGif = null;
                }
                
                if (averageQuality <= 90) {
                    qualityMessage = '😍 상급 옵션!';
                    embedColor = '#e74c3c'; // 빨간색
                } else if (averageQuality <= 95) {
                    qualityMessage = '🤩 최상급 옵션!!';
                    embedColor = '#e67e22'; // 주황색
                } else {
                    qualityMessage = '🔥 완벽한 옵션!!!';
                    embedColor = '#f1c40f'; // 황금색
                }
            }
            
            // GIF 첨부파일 생성 (파일이 존재하는 경우에만)
            let purchaseAttachment = null;
            const gifPath = path.join(__dirname, 'resource', purchaseGif);
            try {
                const fs = require('fs');
                if (fs.existsSync(gifPath)) {
                    purchaseAttachment = new AttachmentBuilder(gifPath, { name: purchaseGif });
                }
            } catch (error) {
                console.log(`GIF 파일을 찾을 수 없습니다: ${purchaseGif}`);
            }
            
            // 골드 차감
            user.gold -= item.price;
            
            // 인벤토리에 아이템 추가 (각 아이템은 고유한 능력치를 가짐)
            const uniqueItemId = `${category}_${itemIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            user.inventory.push({
                id: uniqueItemId,
                name: item.name,
                type: item.type,
                rarity: item.rarity,
                setName: item.setName,
                level: item.level || 1,
                quantity: 1,
                enhanceLevel: 0,
                stats: randomStats,
                price: item.price,
                description: item.description || ''
            });
            
            await user.save();
            
            // 능력치 표시 텍스트 생성
            let statsText = '';
            for (const [statName, value] of Object.entries(randomStats)) {
                if (value !== 0) {
                    const statDisplay = statName === 'attack' ? '공격력' : 
                                      statName === 'defense' ? '방어력' : 
                                      statName === 'dodge' ? '회피력' : 
                                      statName === 'luck' ? '행운' : statName;
                    
                    // 최대값인 경우 강조
                    const [min, max] = item.stats[statName];
                    const isMax = value === max;
                    statsText += `${statDisplay}: ${value > 0 ? '+' : ''}${value}${isMax ? ' 📈' : ''}\n`;
                }
            }
            
            // 가챠 연출용 R 버전 GIF 선택
            let gachaGif;
            switch(item.type) {
                case 'weapon':
                    gachaGif = 'kim_shop_buy_waeponR.gif';
                    break;
                case 'armor':
                case 'helmet':
                    gachaGif = 'kim_shop_buy_robeR.gif';
                    break;
                case 'gloves':
                    gachaGif = 'kim_shop_buy_glovesR.gif';
                    break;
                case 'boots':
                    gachaGif = 'kim_shop_buy_bootsR.gif';
                    break;
                default:
                    gachaGif = null;
            }
            
            // 가챠 연출용 첨부파일 생성
            let gachaAttachment = null;
            if (gachaGif) {
                const gachaPath = path.join(__dirname, 'resource', gachaGif);
                try {
                    const fs = require('fs');
                    if (fs.existsSync(gachaPath)) {
                        gachaAttachment = new AttachmentBuilder(gachaPath, { name: gachaGif });
                    }
                } catch (error) {
                    console.log(`가챠 GIF 파일을 찾을 수 없습니다: ${gachaGif}`);
                }
            }
            
            // 먼저 가챠 연출 GIF 표시
            const gachaEmbed = new EmbedBuilder()
                .setColor('#ffffff')
                .setTitle('🎲 아이템 획득 중...')
                .setDescription('어떤 옵션이 나올까요?');
            
            if (gachaAttachment) {
                gachaEmbed.setImage(`attachment://${gachaGif}`);
            }
            
            const gachaOptions = { 
                embeds: [gachaEmbed], 
                components: [],
                ephemeral: true 
            };
            
            if (gachaAttachment) {
                gachaOptions.files = [gachaAttachment];
            }
            
            await interaction.reply(gachaOptions);
            
            // 0.5초 후 실제 구매 정보로 업데이트
            setTimeout(async () => {
                const purchaseEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('🛍️ 구매 성공!')
                    .setDescription(`**${item.name}**을(를) 성공적으로 구매했습니다!`)
                    .addFields(
                        { name: '💎 아이템 정보', value: `${item.setName}\n${item.rarity} 등급`, inline: true },
                        { name: '📊 옵션 평가', value: `${qualityMessage}\n(상위 ${Math.round(100 - averageQuality)}%)`, inline: true },
                        { name: '📈 랜덤 능력치', value: statsText.trim() || '없음', inline: false },
                        { name: '💰 결제 정보', value: `구매가: ${item.price.toLocaleString()}<:currency_emoji:1377404064316522778>\n잔액: ${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                    )
                    .setFooter({ text: '인벤토리에서 장착할 수 있습니다!' });

                if (purchaseAttachment) {
                    purchaseEmbed.setImage(`attachment://${purchaseGif}`);
                }
                
                // 재구매 및 상점메인 버튼 추가
                const actionButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`buy_${category}_${itemIndex}`)
                            .setLabel('🔄 재구매')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(user.gold < item.price),
                        new ButtonBuilder()
                            .setCustomId('shop')
                            .setLabel('🛒 상점 메인')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                const updateOptions = { 
                    embeds: [purchaseEmbed], 
                    components: [actionButtons],
                    files: purchaseAttachment ? [purchaseAttachment] : []
                };

                await interaction.editReply(updateOptions);
            }, 500);
        }
        
        else if (interaction.customId === 'inventory') {
            if (user.inventory.length === 0) {
                const emptyInventoryEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('🎒 인벤토리')
                    .setDescription('인벤토리가 비어있습니다!')
                    .addFields(
                        { name: '💡 팁', value: '상점에서 아이템을 구매하거나 사냥을 통해 아이템을 얻을 수 있습니다!', inline: false }
                    );
                
                await interaction.reply({ embeds: [emptyInventoryEmbed], ephemeral: true });
                return;
            }
            
            // 인벤토리 메인 화면 (카테고리 선택)
            const inventoryEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🎒 인벤토리')
                .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 보유 아이템\n\n카테고리를 선택하여 아이템을 확인하세요!`)
                .addFields(
                    { name: '📊 아이템 개수', value: `총 ${user.inventory.length}개`, inline: true },
                    { name: '⚔️ 장비 아이템', value: `${user.inventory.filter(item => ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)).length}개`, inline: true },
                    { name: '📜 기타 아이템', value: `${user.inventory.filter(item => !['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)).length}개`, inline: true }
                );

            // 카테고리 버튼들 (3개씩 2줄)
            const categoryButtons1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('inv_category_weapons')
                        .setLabel('⚔️ 무기')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('inv_category_armor')
                        .setLabel('🛡️ 갑옷')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('inv_category_helmet_gloves')
                        .setLabel('⛑️ 헬멧/장갑')
                        .setStyle(ButtonStyle.Primary)
                );

            const categoryButtons2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('inv_category_boots')
                        .setLabel('👢 부츠')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('inv_category_accessory')
                        .setLabel('💎 액세서리')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('inv_category_consumables')
                        .setLabel('📜 주문서/소비/코인')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.reply({ 
                embeds: [inventoryEmbed], 
                components: [categoryButtons1, categoryButtons2],
                ephemeral: true 
            });
        }
        
        // 인벤토리 카테고리별 필터링
        else if (interaction.customId.startsWith('inv_category_')) {
            const category = interaction.customId.replace('inv_category_', '');
            
            let categoryItems = [];
            let categoryName = '';
            let categoryEmoji = '';
            
            switch(category) {
                case 'weapons':
                    categoryItems = user.inventory.filter(item => item.type === 'weapon');
                    categoryName = '무기';
                    categoryEmoji = '⚔️';
                    break;
                case 'armor':
                    categoryItems = user.inventory.filter(item => item.type === 'armor');
                    categoryName = '갑옷';
                    categoryEmoji = '🛡️';
                    break;
                case 'helmet_gloves':
                    categoryItems = user.inventory.filter(item => item.type === 'helmet' || item.type === 'gloves');
                    categoryName = '헬멧/장갑';
                    categoryEmoji = '⛑️';
                    break;
                case 'boots':
                    categoryItems = user.inventory.filter(item => item.type === 'boots');
                    categoryName = '부츠';
                    categoryEmoji = '👢';
                    break;
                case 'accessory':
                    categoryItems = user.inventory.filter(item => item.type === 'accessory');
                    categoryName = '액세서리';
                    categoryEmoji = '💎';
                    break;
                case 'consumables':
                    categoryItems = user.inventory.filter(item => !['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type));
                    categoryName = '주문서/소비/코인';
                    categoryEmoji = '📜';
                    break;
            }
            
            if (categoryItems.length === 0) {
                await interaction.reply({ 
                    content: `${categoryName} 아이템이 없습니다!`, 
                    ephemeral: true 
                });
                return;
            }

            // 페이지네이션 설정
            const itemsPerPage = 3;
            const currentPage = 0;
            const totalPages = Math.ceil(categoryItems.length / itemsPerPage);
            const startIndex = currentPage * itemsPerPage;
            const currentItems = categoryItems.slice(startIndex, startIndex + itemsPerPage);

            // 카테고리 임베드 생성
            const categoryEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`${categoryEmoji} ${categoryName} 인벤토리`)
                .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 ${categoryName} 목록`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 아이템을 선택하여 사용하거나 장착하세요!` });

            // 아이템 목록 텍스트 생성
            let itemList = '';
            currentItems.forEach((item, index) => {
                const globalIndex = startIndex + index;
                const isEquipped = user.equipment[item.type] && user.equipment[item.type].id === item.id;
                const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}성)` : '';
                
                itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? '🔴' : ''}\n`;
                itemList += `등급: ${item.rarity} | 수량: x${item.quantity}\n`;
                
                // 장비 아이템인 경우 스탯 표시
                if (['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)) {
                    let statsText = '';
                    for (const [statName, value] of Object.entries(item.stats)) {
                        if (value !== 0) {
                            const statDisplay = statName === 'attack' ? '공격력' : 
                                              statName === 'defense' ? '방어력' : 
                                              statName === 'dodge' ? '회피력' : 
                                              statName === 'luck' ? '행운' : statName;
                            statsText += `${statDisplay}: ${value > 0 ? '+' : ''}${value} `;
                        }
                    }
                    itemList += `${statsText}\n`;
                }
                
                itemList += `💰 판매가: ${Math.floor(item.price * 0.7).toLocaleString()}<:currency_emoji:1377404064316522778>\n\n`;
            });

            categoryEmbed.addFields({ name: '보유 아이템', value: itemList, inline: false });

            // 아이템 사용/장착 버튼들 (3개씩)
            const itemButtons = new ActionRowBuilder();
            currentItems.forEach((item, index) => {
                const globalIndex = startIndex + index;
                const isEquipped = user.equipment[item.type] && user.equipment[item.type].id === item.id;
                const isEquipment = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type);
                
                itemButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`inv_use_${item.id}_${category}_${currentPage}`)
                        .setLabel(`${globalIndex + 1}. ${isEquipment ? '장착' : '사용'}`)
                        .setStyle(isEquipped ? ButtonStyle.Success : ButtonStyle.Primary)
                        .setDisabled(isEquipped)
                );
            });

            // 페이지네이션 버튼
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`inv_${category}_prev_${currentPage}`)
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`inv_${category}_page_${currentPage}`)
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`inv_${category}_next_${currentPage}`)
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('inventory')
                        .setLabel('🔙 인벤토리 메인')
                        .setStyle(ButtonStyle.Primary)
                );

            const components = [itemButtons];
            if (totalPages > 1) {
                components.push(navButtons);
            } else {
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('inventory')
                        .setLabel('🔙 인벤토리 메인')
                        .setStyle(ButtonStyle.Primary)
                ));
            }

            await interaction.reply({
                embeds: [categoryEmbed],
                components: components,
                ephemeral: true
            });
        }
        
        // 인벤토리 아이템 사용/장착 처리
        else if (interaction.customId.startsWith('inv_use_')) {
            const parts = interaction.customId.split('_');
            const itemId = parts[2];
            const category = parts[3];
            const currentPage = parseInt(parts[4]);
            
            const inventoryItem = user.inventory.find(inv => inv.id === itemId);
            
            if (!inventoryItem) {
                await interaction.reply({ content: '해당 아이템을 찾을 수 없습니다!', ephemeral: true });
                return;
            }
            
            // 장비 아이템인 경우 장착 처리
            if (['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(inventoryItem.type)) {
                // 이미 착용 중인지 확인
                if (user.equipment[inventoryItem.type] && user.equipment[inventoryItem.type].id === itemId) {
                    await interaction.reply({ content: '이미 착용 중인 아이템입니다!', ephemeral: true });
                    return;
                }

                // 레벨 확인
                if (user.level < inventoryItem.level) {
                    await interaction.reply({ 
                        content: `레벨이 부족합니다! (필요: Lv.${inventoryItem.level}, 현재: Lv.${user.level})`, 
                        ephemeral: true 
                    });
                    return;
                }

                // 장착 처리
                user.equipment[inventoryItem.type] = inventoryItem;
                await user.save();

                const equipEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('⚔️ 장비 착용 완료!')
                    .setDescription(`**${inventoryItem.name}**을(를) 성공적으로 착용했습니다!`)
                    .addFields(
                        { name: '착용한 아이템', value: `${inventoryItem.name}${inventoryItem.enhanceLevel > 0 ? ` (+${inventoryItem.enhanceLevel}성)` : ''}`, inline: true },
                        { name: '아이템 등급', value: inventoryItem.rarity, inline: true },
                        { name: '새로운 전투력', value: calculateCombatPower(user).toLocaleString(), inline: true }
                    );

                await interaction.reply({
                    embeds: [equipEmbed],
                    ephemeral: true
                });
            } else {
                // 소비 아이템 사용
                inventoryItem.quantity -= 1;
                if (inventoryItem.quantity <= 0) {
                    user.inventory = user.inventory.filter(inv => inv.id !== itemId);
                }
                
                await user.save();
                await interaction.reply({ 
                    content: `**${inventoryItem.name}**을(를) 사용했습니다!`, 
                    ephemeral: true 
                });
            }
        }
        
        // 인벤토리 카테고리 페이지네이션 처리
        else if (interaction.customId.includes('inv_') && (interaction.customId.includes('_prev_') || interaction.customId.includes('_next_'))) {
            const parts = interaction.customId.split('_');
            
            if (parts[0] === 'inv' && (parts[2] === 'prev' || parts[2] === 'next')) {
                const category = parts[1];
                const direction = parts[2];
                const currentPage = parseInt(parts[3]);
                
                let newPage = currentPage;
                if (direction === 'prev' && currentPage > 0) {
                    newPage = currentPage - 1;
                } else if (direction === 'next') {
                    newPage = currentPage + 1;
                }

                // 카테고리별 아이템 필터링
                let categoryItems = [];
                let categoryName = '';
                let categoryEmoji = '';
                
                switch(category) {
                    case 'weapons':
                        categoryItems = user.inventory.filter(item => item.type === 'weapon');
                        categoryName = '무기';
                        categoryEmoji = '⚔️';
                        break;
                    case 'armor':
                        categoryItems = user.inventory.filter(item => item.type === 'armor');
                        categoryName = '갑옷';
                        categoryEmoji = '🛡️';
                        break;
                    case 'helmet_gloves':
                        categoryItems = user.inventory.filter(item => item.type === 'helmet' || item.type === 'gloves');
                        categoryName = '헬멧/장갑';
                        categoryEmoji = '⛑️';
                        break;
                    case 'boots':
                        categoryItems = user.inventory.filter(item => item.type === 'boots');
                        categoryName = '부츠';
                        categoryEmoji = '👢';
                        break;
                    case 'accessory':
                        categoryItems = user.inventory.filter(item => item.type === 'accessory');
                        categoryName = '액세서리';
                        categoryEmoji = '💎';
                        break;
                    case 'consumables':
                        categoryItems = user.inventory.filter(item => !['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type));
                        categoryName = '주문서/소비/코인';
                        categoryEmoji = '📜';
                        break;
                }

                const itemsPerPage = 3;
                const totalPages = Math.ceil(categoryItems.length / itemsPerPage);
                
                if (newPage >= totalPages || newPage < 0) {
                    await interaction.reply({ content: '잘못된 페이지입니다!', ephemeral: true });
                    return;
                }

                const startIndex = newPage * itemsPerPage;
                const currentItems = categoryItems.slice(startIndex, startIndex + itemsPerPage);

                // 카테고리 임베드 업데이트
                const categoryEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(`${categoryEmoji} ${categoryName} 인벤토리`)
                    .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 ${categoryName} 목록`)
                    .setFooter({ text: `페이지 ${newPage + 1}/${totalPages} | 아이템을 선택하여 사용하거나 장착하세요!` });

                // 아이템 목록 텍스트 생성
                let itemList = '';
                currentItems.forEach((item, index) => {
                    const globalIndex = startIndex + index;
                    const isEquipped = user.equipment[item.type] && user.equipment[item.type].id === item.id;
                    const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}성)` : '';
                    
                    itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? '🔴' : ''}\n`;
                    itemList += `등급: ${item.rarity} | 수량: x${item.quantity}\n`;
                    
                    // 장비 아이템인 경우 스탯 표시
                    if (['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)) {
                        let statsText = '';
                        for (const [statName, value] of Object.entries(item.stats)) {
                            if (value !== 0) {
                                const statDisplay = statName === 'attack' ? '공격력' : 
                                                  statName === 'defense' ? '방어력' : 
                                                  statName === 'dodge' ? '회피력' : 
                                                  statName === 'luck' ? '행운' : statName;
                                statsText += `${statDisplay}: ${value > 0 ? '+' : ''}${value} `;
                            }
                        }
                        itemList += `${statsText}\n`;
                    }
                    
                    itemList += `💰 판매가: ${Math.floor(item.price * 0.7).toLocaleString()}<:currency_emoji:1377404064316522778>\n\n`;
                });

                categoryEmbed.addFields({ name: '보유 아이템', value: itemList, inline: false });

                // 아이템 사용/장착 버튼들 업데이트
                const itemButtons = new ActionRowBuilder();
                currentItems.forEach((item, index) => {
                    const globalIndex = startIndex + index;
                    const isEquipped = user.equipment[item.type] && user.equipment[item.type].id === item.id;
                    const isEquipment = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type);
                    
                    itemButtons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`inv_use_${item.id}_${category}_${newPage}`)
                            .setLabel(`${globalIndex + 1}. ${isEquipment ? '장착' : '사용'}`)
                            .setStyle(isEquipped ? ButtonStyle.Success : ButtonStyle.Primary)
                            .setDisabled(isEquipped)
                    );
                });

                // 페이지네이션 버튼 업데이트
                const navButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`inv_${category}_prev_${newPage}`)
                            .setLabel('◀ 이전')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage === 0),
                        new ButtonBuilder()
                            .setCustomId(`inv_${category}_page_${newPage}`)
                            .setLabel(`${newPage + 1}/${totalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`inv_${category}_next_${newPage}`)
                            .setLabel('다음 ▶')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage >= totalPages - 1),
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🔙 인벤토리 메인')
                            .setStyle(ButtonStyle.Primary)
                    );

                const components = [itemButtons];
                if (totalPages > 1) {
                    components.push(navButtons);
                } else {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🔙 인벤토리 메인')
                            .setStyle(ButtonStyle.Primary)
                    ));
                }

                await interaction.update({
                    embeds: [categoryEmbed],
                    components: components
                });
            }
        }
        
        else if (interaction.customId.startsWith('use_')) {
            const itemId = interaction.customId.replace('use_', '');
            const inventoryItem = user.inventory.find(inv => inv.id === itemId);
            
            if (!inventoryItem) {
                await interaction.reply({ content: '해당 아이템을 보유하고 있지 않습니다!', ephemeral: true });
                return;
            }
            
            if (inventoryItem.type === 'consumable') {
                // 소비 아이템 사용
                inventoryItem.quantity -= 1;
                if (inventoryItem.quantity <= 0) {
                    user.inventory = user.inventory.filter(inv => inv.id !== itemId);
                }
                
                await user.save();
                await interaction.reply({ 
                    content: `**${inventoryItem.name}**을(를) 사용했습니다!`, 
                    ephemeral: true 
                });
            } else {
                // 장비 아이템 장착
                await interaction.reply({ 
                    content: `장비 시스템은 5페이지에서 이용할 수 있습니다!`, 
                    ephemeral: true 
                });
            }
        }
        
        else if (interaction.customId === 'equipment') {
            // 장비 메인 이미지 첨부파일 생성
            const equipmentAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_equipment.gif'), { name: 'kim_equipment.gif' });
            
            // 전투력 계산
            const combatPower = calculateCombatPower(user);
            
            const equipmentEmbed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle('⚔️ 장비 관리')
                .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 현재 장비 상태\n\n🔥 **총 전투력**: ${combatPower.toLocaleString()}`)
                .setImage('attachment://kim_equipment.gif')
                .addFields(
                    { name: '⚔️ 무기', value: user.equipment.weapon ? `${user.equipment.weapon.name}${user.equipment.weapon.enhanceLevel > 0 ? ` (+${user.equipment.weapon.enhanceLevel}성)` : ''}\n공격력: +${user.equipment.weapon.stats.attack}` : '없음', inline: true },
                    { name: '🛡️ 갑옷', value: user.equipment.armor ? `${user.equipment.armor.name}${user.equipment.armor.enhanceLevel > 0 ? ` (+${user.equipment.armor.enhanceLevel}성)` : ''}\n방어력: +${user.equipment.armor.stats.defense}` : '없음', inline: true },
                    { name: '⛑️ 헬멧', value: user.equipment.helmet ? `${user.equipment.helmet.name}${user.equipment.helmet.enhanceLevel > 0 ? ` (+${user.equipment.helmet.enhanceLevel}성)` : ''}` : '없음', inline: true },
                    { name: '🧤 장갑', value: user.equipment.gloves ? `${user.equipment.gloves.name}${user.equipment.gloves.enhanceLevel > 0 ? ` (+${user.equipment.gloves.enhanceLevel}성)` : ''}` : '없음', inline: true },
                    { name: '👢 부츠', value: user.equipment.boots ? `${user.equipment.boots.name}${user.equipment.boots.enhanceLevel > 0 ? ` (+${user.equipment.boots.enhanceLevel}성)` : ''}` : '없음', inline: true },
                    { name: '💎 액세서리', value: user.equipment.accessory ? `${user.equipment.accessory.name}${user.equipment.accessory.enhanceLevel > 0 ? ` (+${user.equipment.accessory.enhanceLevel}성)` : ''}` : '없음', inline: true }
                );

            // 카테고리별 장비 교체 버튼
            const categoryButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('equip_category_weapon')
                        .setLabel('⚔️ 무기')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('equip_category_armor')
                        .setLabel('🛡️ 갑옷')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('equip_category_helmet')
                        .setLabel('⛑️ 헬멧')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('equip_category_gloves')
                        .setLabel('🧤 장갑')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('equip_category_boots')
                        .setLabel('👢 부츠')
                        .setStyle(ButtonStyle.Primary)
                );

            const categoryButtons2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('equip_category_accessory')
                        .setLabel('💎 액세서리')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ 
                embeds: [equipmentEmbed], 
                components: [categoryButtons, categoryButtons2],
                files: [equipmentAttachment],
                ephemeral: true 
            });
        }
        
        // 장비 카테고리별 필터링
        else if (interaction.customId.startsWith('equip_category_')) {
            const category = interaction.customId.replace('equip_category_', '');
            
            // 해당 카테고리의 아이템만 필터링
            const categoryItems = user.inventory.filter(item => item.type === category);
            
            if (categoryItems.length === 0) {
                await interaction.reply({ 
                    content: `인벤토리에 ${getCategoryName(category)} 아이템이 없습니다!`, 
                    ephemeral: true 
                });
                return;
            }

            // 페이지네이션 설정
            const itemsPerPage = 3;
            const currentPage = 0;
            const totalPages = Math.ceil(categoryItems.length / itemsPerPage);
            const startIndex = currentPage * itemsPerPage;
            const currentItems = categoryItems.slice(startIndex, startIndex + itemsPerPage);

            // 카테고리 임베드 생성
            const categoryEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`${getCategoryEmoji(category)} ${getCategoryName(category)} 교체`)
                .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 ${getCategoryName(category)} 목록`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 원하는 아이템을 선택하여 장착하세요!` });

            // 아이템 목록 텍스트 생성
            let itemList = '';
            currentItems.forEach((item, index) => {
                const globalIndex = startIndex + index;
                const isEquipped = user.equipment[category] && user.equipment[category].id === item.id;
                const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}성)` : '';
                
                itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? '🔴' : ''}\n`;
                itemList += `등급: ${item.rarity} | 레벨: ${item.level}\n`;
                
                // 스탯 표시
                let statsText = '';
                for (const [statName, value] of Object.entries(item.stats)) {
                    if (value !== 0) {
                        const statDisplay = statName === 'attack' ? '공격력' : 
                                          statName === 'defense' ? '방어력' : 
                                          statName === 'dodge' ? '회피력' : 
                                          statName === 'luck' ? '행운' : statName;
                        statsText += `${statDisplay}: ${value > 0 ? '+' : ''}${value} `;
                    }
                }
                itemList += `${statsText}\n\n`;
            });

            categoryEmbed.addFields({ name: '보유 아이템', value: itemList, inline: false });

            // 아이템 선택 버튼들 (3개씩)
            const itemButtons = new ActionRowBuilder();
            currentItems.forEach((item, index) => {
                const globalIndex = startIndex + index;
                const isEquipped = user.equipment[category] && user.equipment[category].id === item.id;
                
                itemButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`equip_item_${item.id}_${category}_${currentPage}`)
                        .setLabel(`${globalIndex + 1}. ${item.name} 장착`)
                        .setStyle(isEquipped ? ButtonStyle.Success : ButtonStyle.Primary)
                        .setDisabled(isEquipped)
                );
            });

            // 페이지네이션 버튼
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`equip_${category}_prev_${currentPage}`)
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`equip_${category}_page_${currentPage}`)
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`equip_${category}_next_${currentPage}`)
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('equipment')
                        .setLabel('🔙 장비 메인')
                        .setStyle(ButtonStyle.Primary)
                );

            const components = [itemButtons];
            if (totalPages > 1) {
                components.push(navButtons);
            } else {
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('equipment')
                        .setLabel('🔙 장비 메인')
                        .setStyle(ButtonStyle.Primary)
                ));
            }

            await interaction.reply({
                embeds: [categoryEmbed],
                components: components,
                ephemeral: true
            });
        }
        
        // 장비 아이템 착용 처리
        else if (interaction.customId.startsWith('equip_item_')) {
            const parts = interaction.customId.split('_');
            const itemId = parts[2];
            const category = parts[3];
            const currentPage = parseInt(parts[4]);
            
            const item = user.inventory.find(inv => inv.id === itemId);
            if (!item) {
                await interaction.reply({ content: '해당 아이템을 찾을 수 없습니다!', ephemeral: true });
                return;
            }

            // 이미 착용 중인지 확인
            if (user.equipment[category] && user.equipment[category].id === itemId) {
                await interaction.reply({ content: '이미 착용 중인 아이템입니다!', ephemeral: true });
                return;
            }

            // 레벨 확인
            if (user.level < item.level) {
                await interaction.reply({ 
                    content: `레벨이 부족합니다! (필요: Lv.${item.level}, 현재: Lv.${user.level})`, 
                    ephemeral: true 
                });
                return;
            }

            // 장착 처리
            user.equipment[category] = item;
            await user.save();

            const equipEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('⚔️ 장비 착용 완료!')
                .setDescription(`**${item.name}**을(를) 성공적으로 착용했습니다!`)
                .addFields(
                    { name: '착용한 아이템', value: `${item.name}${item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}성)` : ''}`, inline: true },
                    { name: '아이템 등급', value: item.rarity, inline: true },
                    { name: '새로운 전투력', value: calculateCombatPower(user).toLocaleString(), inline: true }
                );

            await interaction.reply({
                embeds: [equipEmbed],
                ephemeral: true
            });
        }
        
        // 장비 카테고리 페이지네이션 처리
        else if (interaction.customId.includes('_prev_') || interaction.customId.includes('_next_')) {
            const parts = interaction.customId.split('_');
            
            if (parts[0] === 'equip' && (parts[2] === 'prev' || parts[2] === 'next')) {
                const category = parts[1];
                const direction = parts[2];
                const currentPage = parseInt(parts[3]);
                
                let newPage = currentPage;
                if (direction === 'prev' && currentPage > 0) {
                    newPage = currentPage - 1;
                } else if (direction === 'next') {
                    newPage = currentPage + 1;
                }

                // 해당 카테고리의 아이템만 필터링
                const categoryItems = user.inventory.filter(item => item.type === category);
                const itemsPerPage = 3;
                const totalPages = Math.ceil(categoryItems.length / itemsPerPage);
                
                if (newPage >= totalPages || newPage < 0) {
                    await interaction.reply({ content: '잘못된 페이지입니다!', ephemeral: true });
                    return;
                }

                const startIndex = newPage * itemsPerPage;
                const currentItems = categoryItems.slice(startIndex, startIndex + itemsPerPage);

                // 카테고리 임베드 업데이트
                const categoryEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(`${getCategoryEmoji(category)} ${getCategoryName(category)} 교체`)
                    .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 ${getCategoryName(category)} 목록`)
                    .setFooter({ text: `페이지 ${newPage + 1}/${totalPages} | 원하는 아이템을 선택하여 장착하세요!` });

                // 아이템 목록 텍스트 생성
                let itemList = '';
                currentItems.forEach((item, index) => {
                    const globalIndex = startIndex + index;
                    const isEquipped = user.equipment[category] && user.equipment[category].id === item.id;
                    const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}성)` : '';
                    
                    itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? '🔴' : ''}\n`;
                    itemList += `등급: ${item.rarity} | 레벨: ${item.level}\n`;
                    
                    // 스탯 표시
                    let statsText = '';
                    for (const [statName, value] of Object.entries(item.stats)) {
                        if (value !== 0) {
                            const statDisplay = statName === 'attack' ? '공격력' : 
                                              statName === 'defense' ? '방어력' : 
                                              statName === 'dodge' ? '회피력' : 
                                              statName === 'luck' ? '행운' : statName;
                            statsText += `${statDisplay}: ${value > 0 ? '+' : ''}${value} `;
                        }
                    }
                    itemList += `${statsText}\n\n`;
                });

                categoryEmbed.addFields({ name: '보유 아이템', value: itemList, inline: false });

                // 아이템 선택 버튼들 업데이트
                const itemButtons = new ActionRowBuilder();
                currentItems.forEach((item, index) => {
                    const globalIndex = startIndex + index;
                    const isEquipped = user.equipment[category] && user.equipment[category].id === item.id;
                    
                    itemButtons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`equip_item_${item.id}_${category}_${newPage}`)
                            .setLabel(`${globalIndex + 1}. ${item.name} 장착`)
                            .setStyle(isEquipped ? ButtonStyle.Success : ButtonStyle.Primary)
                            .setDisabled(isEquipped)
                    );
                });

                // 페이지네이션 버튼 업데이트
                const navButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`equip_${category}_prev_${newPage}`)
                            .setLabel('◀ 이전')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage === 0),
                        new ButtonBuilder()
                            .setCustomId(`equip_${category}_page_${newPage}`)
                            .setLabel(`${newPage + 1}/${totalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`equip_${category}_next_${newPage}`)
                            .setLabel('다음 ▶')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage >= totalPages - 1),
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('🔙 장비 메인')
                            .setStyle(ButtonStyle.Primary)
                    );

                const components = [itemButtons];
                if (totalPages > 1) {
                    components.push(navButtons);
                } else {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('🔙 장비 메인')
                            .setStyle(ButtonStyle.Primary)
                    ));
                }

                await interaction.update({
                    embeds: [categoryEmbed],
                    components: components
                });
            }
        }
        
        else if (interaction.customId === 'prev_page' || interaction.customId === 'next_page') {
            // 게임 메뉴 페이지네이션 처리
            const currentEmbed = interaction.message.embeds[0];
            const footerText = currentEmbed.footer?.text || '';
            const pageMatch = footerText.match(/(\d+)\/(\d+)\s*페이지/);
            
            let newPage;
            
            // 초기 게임 메뉴에서 페이지네이션 시작하는 경우 처리
            if (!pageMatch && footerText.includes('게임 메뉴에 오신 것을 환영합니다')) {
                // 첫 페이지로 간주
                if (interaction.customId === 'prev_page') {
                    await interaction.reply({ content: '이미 첫 페이지입니다!', ephemeral: true });
                    return;
                } else if (interaction.customId === 'next_page') {
                    newPage = 2; // 다음 페이지는 2페이지
                }
            } else if (pageMatch) {
                // 기존 페이지네이션 로직
                const currentPage = parseInt(pageMatch[1]);
                const totalPages = parseInt(pageMatch[2]);
                
                newPage = currentPage;
                if (interaction.customId === 'prev_page' && currentPage > 1) {
                    newPage = currentPage - 1;
                } else if (interaction.customId === 'next_page' && currentPage < totalPages) {
                    newPage = currentPage + 1;
                }
                
                if (newPage === currentPage) {
                    await interaction.reply({ content: '더 이상 이동할 페이지가 없습니다!', ephemeral: true });
                    return;
                }
            } else {
                await interaction.reply({ content: '페이지 정보를 찾을 수 없습니다!', ephemeral: true });
                return;
            }
            
            // 기존 페이지 구조와 동일하게 생성
            const pages = [
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('daily')
                            .setLabel('🎁 출석체크')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('work')
                            .setLabel('⚒️ 일하기')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('quest')
                            .setLabel('📜 의뢰')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('hunting')
                            .setLabel('⚔️ 사냥하기')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('pvp')
                            .setLabel('🛡️ PvP')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('stats')
                            .setLabel('💪 능력치')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('skills')
                            .setLabel('🔮 스킬')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('shop')
                            .setLabel('🛒 상점')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🎒 인벤토리')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('⚔️ 장비')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('enhancement')
                            .setLabel('⚡ 강화')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(user.level < 10),
                        new ButtonBuilder()
                            .setCustomId('ranking')
                            .setLabel('🏆 랭킹')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('info')
                            .setLabel('👤 내정보')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                }
            ];
            
            // 시간대별 이미지 및 색상 (원본과 동일)
            const currentTime = new Date();
            const hour = currentTime.getHours();
            
            let timeImage = '';
            let timeColor = '';
            
            if (hour >= 6 && hour < 12) {
                timeImage = 'kim_main_morning.png';
                timeColor = '#ffeb3b';
            } else if (hour >= 12 && hour < 18) {
                timeImage = 'kim_main_lunch.png';
                timeColor = '#ff9800';
            } else {
                timeImage = 'kim_main_night.png';
                timeColor = '#3f51b5';
            }
            
            const greetings = [
                '오늘도 힘차게 모험을 떠나볼까요?',
                '새로운 하루가 시작되었네요!',
                '모험가님, 준비는 되셨나요?',
                '오늘은 어떤 재미있는 일이 있을까요?',
                '강화왕의 세계에 오신 것을 환영합니다!',
                '레벨업을 향해 달려가볼까요?',
                '오늘도 좋은 하루 되세요!',
                '모험이 여러분을 기다리고 있어요!',
                '행운이 함께하길 바랍니다!',
                '새로운 도전이 시작됩니다!'
            ];
            
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            const maxExp = user.level * 100;
            const today = new Date().toDateString();
            const attendanceStatus = user.lastDaily === today ? '출석' : '결석';
            
            // 현재 페이지에 해당하는 버튼들 가져오기
            const currentPageIndex = newPage - 1; // 0-based index
            const currentPageButtons = pages[currentPageIndex];
            
            if (!currentPageButtons) {
                await interaction.reply({ content: '존재하지 않는 페이지입니다!', ephemeral: true });
                return;
            }
            
            // 임베드 생성 (원본과 동일한 스타일)
            const statusEmbed = new EmbedBuilder()
                .setColor(timeColor)
                .setTitle(`${getUserTitle(user)} ${user.nickname}님, ${randomGreeting}`)
                .addFields(
                    { name: '⭐ 레벨', value: `\`\`\`Lv.${user.level}\`\`\``, inline: true },
                    { name: '✨ 경험치', value: `\`\`\`${user.exp}/${maxExp}\`\`\``, inline: true },
                    { name: '<:currency_emoji:1377404064316522778> 골드', value: `\`\`\`${user.gold.toLocaleString()}\`\`\``, inline: true },
                    { name: '📅 출석현황', value: `\`\`\`${attendanceStatus}\`\`\``, inline: true },
                    { name: '🏆 종합순위', value: `\`\`\`준비중\`\`\``, inline: true },
                    { name: '💖 인기도', value: `\`\`\`${user.popularity}\`\`\``, inline: true }
                )
                .setImage(`attachment://${timeImage}`)
                .setFooter({ text: `${newPage}/5 페이지` });
                
            // 네비게이션 버튼
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newPage === 1),
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel(`${newPage}/5`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newPage === 5)
                );
                
            // 콘텐츠 버튼 (현재 페이지의 버튼들)
            const contentRow = new ActionRowBuilder()
                .addComponents(currentPageButtons.buttons);
            
            // 이미지 파일 첨부
            const imageAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', timeImage), { name: timeImage });
                
            await interaction.update({ 
                embeds: [statusEmbed], 
                components: [contentRow, navigationRow],
                files: [imageAttachment]
            });
        }
        
        else if (interaction.customId.startsWith('accept_quest_')) {
            const questId = parseInt(interaction.customId.split('_')[2]);
            
            // 의뢰 찾기
            const allClients = [
                ...QUEST_CLIENTS.villagers,
                ...QUEST_CLIENTS.merchants,
                ...QUEST_CLIENTS.scammers,
                ...QUEST_CLIENTS.travelers
            ];
            const quest = allClients.find(q => q.id === questId);
            
            if (!quest) {
                await interaction.update({ content: '의뢰를 찾을 수 없습니다!', embeds: [], components: [] });
                return;
            }

            // 쿨타임 추가
            addQuestCooldown(interaction.user.id);
            
            let resultEmbed;
            let embedColor;
            let resultTitle;
            let resultDescription;
            
            if (quest.type === 'scam') {
                // 사기 의뢰 - 골드 차감
                if (user.gold < quest.scamAmount) {
                    resultEmbed = new EmbedBuilder()
                        .setColor('#95a5a6')
                        .setTitle('💸 골드 부족')
                        .setDescription(`**${quest.name}**\n\n"아... 골드가 부족하시군요. 그럼 다음에 다시 오세요!"`)
                        .addFields(
                            { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                            { name: '💸 필요 골드', value: `${quest.scamAmount.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                        )
                        .setFooter({ text: '다행히 사기를 당하지 않았습니다!' });
                } else {
                    user.gold -= quest.scamAmount;
                    await user.save();
                    
                    resultEmbed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('💸 사기당했습니다!')
                        .setDescription(`**${quest.name}**\n\n"하하하! 고마워요! 그럼 전 이만..." *달아난다*`)
                        .addFields(
                            { name: '💸 잃은 골드', value: `${quest.scamAmount.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                            { name: '💰 남은 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                        )
                        .setFooter({ text: '다음엔 조심하세요...' });
                }
            } else {
                // 정상 의뢰 - 보상 지급
                const reward = calculateQuestReward(user.level, quest.type);
                
                user.gold += reward.gold;
                user.exp += reward.exp;
                
                // 레벨업 체크
                let levelUpMessage = '';
                const maxExp = user.level * 100;
                if (user.exp >= maxExp) {
                    const levelsGained = Math.floor(user.exp / maxExp);
                    user.level += levelsGained;
                    user.exp = user.exp % maxExp;
                    levelUpMessage = `\n🎉 **레벨업!** Lv.${user.level - levelsGained} → Lv.${user.level}`;
                }
                
                await user.save();
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✅ 의뢰 완료!')
                    .setDescription(`**${quest.name}**\n\n"정말 고마워요! 약속한 보상을 드릴게요!"${levelUpMessage}`)
                    .addFields(
                        { name: '💰 획득 골드', value: `+${reward.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                        { name: '✨ 획득 경험치', value: `+${reward.exp} EXP`, inline: true },
                        { name: '💎 현재 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                    )
                    .setFooter({ text: '의뢰 완료! 30분 후에 다시 이용할 수 있습니다.' });
            }
            
            const newQuestButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('quest')
                        .setLabel('📜 새 의뢰 찾기')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true) // 쿨타임 때문에 비활성화
                );

            await interaction.update({ 
                embeds: [resultEmbed], 
                components: [newQuestButton]
            });
        }
        
        else if (interaction.customId === 'decline_quest') {
            const declineEmbed = new EmbedBuilder()
                .setColor('#95a5a6')
                .setTitle('❌ 의뢰 거절')
                .setDescription('의뢰를 거절했습니다. 언제든지 다시 의뢰를 받을 수 있습니다.')
                .setFooter({ text: '다른 의뢰를 찾아보세요!' });

            const newQuestButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('quest')
                        .setLabel('📜 새 의뢰 찾기')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({ 
                embeds: [declineEmbed], 
                components: [newQuestButton]
            });
        }
        
        else if (interaction.customId === 'quest') {
            // 쿨타임 체크
            const cooldownMinutes = checkQuestCooldown(interaction.user.id);
            if (cooldownMinutes) {
                await interaction.reply({ 
                    content: `⏰ 의뢰 쿨타임이 **${cooldownMinutes}분** 남았습니다!`, 
                    ephemeral: true 
                });
                return;
            }

            // 랜덤 의뢰 선택
            const quest = getRandomQuest();
            
            const questEmbed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle(`${quest.emoji} ${quest.title}`)
                .setDescription(`**${quest.name}**\n\n"${quest.description}"`)
                .setFooter({ text: '의뢰를 수락하시겠습니까?' });

            if (quest.type === 'scam') {
                questEmbed.setColor('#e74c3c');
            }

            const questButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_quest_${quest.id}`)
                        .setLabel('✅ 수락')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('decline_quest')
                        .setLabel('❌ 거절')
                        .setStyle(ButtonStyle.Danger)
                );

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ 
                    embeds: [questEmbed], 
                    components: [questButtons]
                });
            } else {
                await interaction.reply({ 
                    embeds: [questEmbed], 
                    components: [questButtons], 
                    ephemeral: true 
                });
            }
        }
        
        else if (interaction.customId === 'back_to_game_menu') {
            // /게임 명령어와 완전히 동일한 메뉴로 돌아가기
            // 시간대별 이미지 및 인사말 설정
            const now = new Date();
            const hour = now.getHours();
            
            let timeImage = '';
            let timeColor = '';
            
            if (hour >= 6 && hour < 12) {
                // 아침 시간대 (6:00 - 11:59)
                timeImage = 'kim_main_morning.png';
                timeColor = '#ffeb3b'; // 노란색
            } else if (hour >= 12 && hour < 18) {
                // 점심 시간대 (12:00 - 17:59)
                timeImage = 'kim_main_lunch.png';
                timeColor = '#ff9800'; // 주황색
            } else {
                // 저녁/밤 시간대 (18:00 - 5:59)
                timeImage = 'kim_main_night.png';
                timeColor = '#3f51b5'; // 남색
            }

            // 상태창 (RPG 스타일)
            const greetings = [
                '오늘도 힘차게 모험을 떠나볼까요?',
                '새로운 하루가 시작되었네요!',
                '모험가님, 준비는 되셨나요?',
                '오늘은 어떤 재미있는 일이 있을까요?',
                '강화왕의 세계에 오신 것을 환영합니다!',
                '레벨업을 향해 달려가볼까요?',
                '오늘도 좋은 하루 되세요!',
                '모험이 여러분을 기다리고 있어요!',
                '행운이 함께하길 바랍니다!',
                '새로운 도전이 시작됩니다!'
            ];
            
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            
            // 경험치 계산 수정 (레벨업 시 필요 경험치 = 레벨 * 100)
            const maxExp = user.level * 100;
            
            // 출석 현황 계산 (오늘 출석체크 여부)
            const today = new Date().toDateString();
            const attendanceStatus = user.lastDaily === today ? '출석' : '결석';

            const statusEmbed = new EmbedBuilder()
                .setColor(timeColor)
                .setTitle(`${getUserTitle(user)} ${user.nickname}님, ${randomGreeting}`)
                .addFields(
                    { name: '⭐ 레벨', value: `\`\`\`Lv.${user.level}\`\`\``, inline: true },
                    { name: '✨ 경험치', value: `\`\`\`${user.exp}/${maxExp}\`\`\``, inline: true },
                    { name: '<:currency_emoji:1377404064316522778> 골드', value: `\`\`\`${user.gold.toLocaleString()}\`\`\``, inline: true },
                    { name: '📅 출석현황', value: `\`\`\`${attendanceStatus}\`\`\``, inline: true },
                    { name: '🏆 종합순위', value: `\`\`\`준비중\`\`\``, inline: true },
                    { name: '💖 인기도', value: `\`\`\`${user.popularity}\`\`\``, inline: true }
                )
                .setImage(`attachment://${timeImage}`)
                .setFooter({ text: '게임 메뉴에 오신 것을 환영합니다!' });

            // 페이지별 버튼 정의 (/게임과 동일)
            const pages = [
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('daily')
                            .setLabel('🎁 출석체크')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('work')
                            .setLabel('⚒️ 일하기')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('quest')
                            .setLabel('📜 의뢰')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('hunting')
                            .setLabel('⚔️ 사냥하기')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('pvp')
                            .setLabel('🛡️ PvP')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('stats')
                            .setLabel('💪 능력치')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('skills')
                            .setLabel('🔮 스킬')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('shop')
                            .setLabel('🛒 상점')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🎒 인벤토리')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('⚔️ 장비')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('enhancement')
                            .setLabel('⚡ 강화')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(user.level < 10),
                        new ButtonBuilder()
                            .setCustomId('ranking')
                            .setLabel('🏆 랭킹')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('info')
                            .setLabel('👤 내정보')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                }
            ];

            // 페이지 네비게이션 버튼
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel('1/5')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                );

            // 첫 페이지 버튼 row
            const contentRow = new ActionRowBuilder()
                .addComponents(pages[0].buttons);
                
            const attachment = new AttachmentBuilder(path.join(__dirname, 'resource', timeImage), { name: timeImage });

            await interaction.update({ 
                embeds: [statusEmbed], 
                components: [contentRow, navigationRow], 
                files: [attachment] 
            });
        }
    } catch (error) {
        console.error('인터렉션 처리 오류:', error);
    }
});

// Modal 제출 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    if (interaction.customId === 'registerModal') {
        const nickname = interaction.fields.getTextInputValue('nickname');
        const email = interaction.fields.getTextInputValue('email');
        
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            if (!user) {
                await interaction.reply({ content: '등록되지 않은 사용자입니다. 먼저 /가입 명령어를 사용해 가입해주세요!', ephemeral: true });
                return;
            }

            // 이미 회원가입 했는지 확인
            if (user.registered) {
                await interaction.editReply({ content: '이미 회원가입을 완료하셨습니다!' });
                return;
            }

            // 닉네임 중복 체크
            const existingUser = await User.findOne({ nickname });
            if (existingUser) {
                await interaction.editReply({ content: '이미 사용 중인 닉네임입니다!' });
                return;
            }

            // 이메일 형식 검증
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                await interaction.editReply({ content: '올바른 이메일 형식이 아닙니다!' });
                return;
            }

            // 인증코드 생성 및 저장
            const verificationCode = generateVerificationCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 만료

            user.nickname = nickname;
            user.email = email;
            user.emailVerificationCode = verificationCode;
            user.emailVerificationExpires = expiresAt;
            
            await user.save();

            // 이메일 전송
            try {
                await sendVerificationEmail(email, verificationCode);
                await interaction.editReply({ 
                    content: `회원가입 정보가 저장되었습니다! \n**${email}**로 인증코드를 발송했습니다.\n\`/인증 [코드]\` 명령어로 이메일 인증을 완료해주세요.`
                });
            } catch (emailError) {
                console.error('이메일 전송 오류:', emailError);
                await interaction.editReply({ 
                    content: '회원가입 정보는 저장되었지만 이메일 전송에 실패했습니다. 관리자에게 문의해주세요.'
                });
            }
        } catch (error) {
            console.error('회원가입 처리 오류:', error);
            await interaction.editReply({ content: '회원가입 처리 중 오류가 발생했습니다!' });
        }
    }
});

// 이모지 반응 추가 이벤트
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        // 봇의 반응은 무시
        if (user.bot) return;
        
        // 부분적인 메시지인 경우 전체 메시지 가져오기
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('반응 fetch 오류:', error);
                return;
            }
        }
        
        // 메시지 작성자가 봇인 경우 무시
        if (reaction.message.author.bot) return;
        
        // 자기 자신의 메시지에 대한 반응 무시
        if (reaction.message.author.id === user.id) return;
        
        // 인기도 관련 이모지 확인
        const popularityEmojis = {
            '❤️': 1,    // 하트: +1
            '👍': 1,    // 따봉: +1
            '😢': -1,   // 슬픔: -1
            '😭': -1    // 대성통곡: -1 (추가)
        };
        
        const emojiName = reaction.emoji.name;
        if (!popularityEmojis.hasOwnProperty(emojiName)) return;
        
        const value = popularityEmojis[emojiName];
        const result = await updatePopularity(
            reaction.message.author.id,
            emojiName,
            value,
            reaction.message.id,
            reaction.message.guild
        );
        
        // 결과 로그
        if (result.success) {
            console.log(`인기도 업데이트: ${reaction.message.author.tag} ${result.message}`);
        }
    } catch (error) {
        console.error('메시지 반응 처리 오류:', error);
    }
});

// 이모지 반응 제거 이벤트 (선택사항)
client.on('messageReactionRemove', async (reaction, user) => {
    try {
        // 봇의 반응은 무시
        if (user.bot) return;
        
        // 부분적인 메시지인 경우 전체 메시지 가져오기
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('반응 fetch 오류:', error);
                return;
            }
        }
        
        // 메시지 작성자가 봇인 경우 무시
        if (reaction.message.author.bot) return;
        
        // 자기 자신의 메시지에 대한 반응 무시
        if (reaction.message.author.id === user.id) return;
        
        // 반응 제거 시 인기도 원복 (선택사항)
        // 필요한 경우 구현 가능
    } catch (error) {
        console.error('메시지 반응 제거 처리 오류:', error);
    }
});

// 엠블럼 시스템 상호작용 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
    
    try {
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            await interaction.reply({ content: '등록되지 않은 사용자입니다. 먼저 /가입을 완료해주세요!', ephemeral: true });
            return;
        }

        // 엠블럼 계열 선택
        if (interaction.customId === 'emblem_category') {
            const category = interaction.values[0];
            const emblemData = EMBLEMS[category];
            
            if (!emblemData) {
                await interaction.reply({ content: '존재하지 않는 계열입니다!', ephemeral: true });
                return;
            }

            // 이미 엠블럼 보유 확인
            if (user.emblem) {
                await interaction.reply({ 
                    content: `이미 **${user.emblem}** 엠블럼을 보유하고 있습니다! 엠블럼은 변경할 수 없습니다.`, 
                    ephemeral: true 
                });
                return;
            }

            // 레벨 20 이상 확인
            if (user.level < 20) {
                await interaction.reply({ 
                    content: `엠블럼을 구매하려면 **레벨 20 이상**이어야 합니다! (현재 레벨: ${user.level})`, 
                    ephemeral: true 
                });
                return;
            }

            // 구매 가능한 엠블럼 목록 생성
            const availableEmblems = emblemData.emblems.filter(emblem => user.level >= emblem.level);
            
            if (availableEmblems.length === 0) {
                await interaction.reply({ 
                    content: `이 계열의 엠블럼을 구매하려면 더 높은 레벨이 필요합니다!`, 
                    ephemeral: true 
                });
                return;
            }

            // 엠블럼 선택 임베드 생성
            const categoryEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle(`${emblemData.emoji} ${emblemData.name} 계열 엠블럼`)
                .setDescription(`**${user.nickname}**님이 구매 가능한 엠블럼 목록입니다.\n\n**⚠️ 한 번 구매하면 변경할 수 없습니다!**`)
                .setFooter({ text: '원하는 엠블럼을 선택하여 구매하세요!' });

            // 엠블럼 목록 텍스트 생성
            let emblemList = '';
            availableEmblems.forEach((emblem, index) => {
                const canAfford = user.gold >= emblem.price;
                emblemList += `**${emblem.name}**\n`;
                emblemList += `💰 가격: ${emblem.price.toLocaleString()}<:currency_emoji:1377404064316522778> ${canAfford ? '✅' : '❌'}\n`;
                emblemList += `📊 필요 레벨: Lv.${emblem.level}\n\n`;
            });

            categoryEmbed.addFields({ name: '구매 가능한 엠블럼', value: emblemList, inline: false });

            // 엠블럼 구매 버튼들
            const emblemButtons = new ActionRowBuilder();
            availableEmblems.slice(0, 5).forEach((emblem, index) => {
                emblemButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`buy_emblem_${category}_${index}`)
                        .setLabel(`${emblem.name} 구매`)
                        .setStyle(user.gold >= emblem.price ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(user.gold < emblem.price)
                );
            });

            await interaction.reply({
                embeds: [categoryEmbed],
                components: [emblemButtons],
                ephemeral: true
            });
        }

        // 엠블럼 구매
        else if (interaction.customId.startsWith('buy_emblem_')) {
            const parts = interaction.customId.split('_');
            const category = parts[2];
            const emblemIndex = parseInt(parts[3]);

            const emblemData = EMBLEMS[category];
            if (!emblemData || !emblemData.emblems[emblemIndex]) {
                await interaction.reply({ content: '존재하지 않는 엠블럼입니다!', ephemeral: true });
                return;
            }

            const emblem = emblemData.emblems[emblemIndex];

            // 재확인
            if (user.emblem) {
                await interaction.reply({ content: '이미 엠블럼을 보유하고 있습니다!', ephemeral: true });
                return;
            }

            if (user.level < emblem.level) {
                await interaction.reply({ content: `레벨이 부족합니다! (필요: Lv.${emblem.level}, 현재: Lv.${user.level})`, ephemeral: true });
                return;
            }

            if (user.gold < emblem.price) {
                await interaction.reply({ content: '골드가 부족합니다!', ephemeral: true });
                return;
            }

            // 구매 처리
            user.gold -= emblem.price;
            user.emblem = emblem.name;
            await user.save();

            // Discord 역할 부여
            try {
                const guild = interaction.guild;
                let role = guild.roles.cache.find(r => r.name === emblem.roleName);
                
                if (!role) {
                    role = await guild.roles.create({
                        name: emblem.roleName,
                        color: '#FF6B00',
                        reason: '엠블럼 시스템 자동 생성'
                    });
                }

                const member = await guild.members.fetch(interaction.user.id);
                await member.roles.add(role);
            } catch (error) {
                console.error('역할 부여 오류:', error);
            }

            const purchaseEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🏆 엠블럼 구매 성공!')
                .setDescription(`**${emblem.name}** 엠블럼을 성공적으로 구매했습니다!`)
                .addFields(
                    { name: '💎 획득한 칭호', value: emblem.name, inline: true },
                    { name: '💰 결제 금액', value: `${emblem.price.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '💰 잔여 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                )
                .setFooter({ text: '이제 게임에서 새로운 칭호로 표시됩니다!' });

            await interaction.reply({
                embeds: [purchaseEmbed],
                ephemeral: true
            });
        }

    } catch (error) {
        console.error('엠블럼 시스템 오류:', error);
        await interaction.reply({ content: '오류가 발생했습니다. 다시 시도해주세요!', ephemeral: true });
    }
});

// 봇 로그인
client.login(TOKEN); 
