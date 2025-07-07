// 보스 토큰 장신구 시스템
const BOSS_ACCESSORIES = {
    // 장신구 세트 정의
    sets: {
        // 고블린 세트 (Tier 1 - 초급 사냥/파밍 특화)
        goblin: {
            id: 'goblin_set',
            name: '고블린 약탈자',
            tier: 1,
            theme: '골드와 아이템 파밍에 특화',
            items: {
                ring: {
                    id: 'goblin_ring',
                    name: '고블린 왕의 반지',
                    slotType: 'ring',
                    emoji: '💍',
                    stats: {
                        goldBonus: 20,      // 골드 획득량 +20%
                        luck: 10            // 행운 +10
                    },
                    description: '고블린 왕이 착용했던 황금 반지'
                },
                necklace: {
                    id: 'goblin_necklace',
                    name: '약탈자의 목걸이',
                    slotType: 'necklace',
                    emoji: '📿',
                    stats: {
                        dropRate: 15,       // 아이템 드롭률 +15%
                        attack: 50          // 공격력 +50
                    },
                    description: '약탈의 정수가 담긴 목걸이'
                },
                bracelet: {
                    id: 'goblin_bracelet',
                    name: '탐욕의 팔찌',
                    slotType: 'bracelet',
                    emoji: '🔗',
                    stats: {
                        shopBonus: 30,      // 상점 판매가 +30%
                        speed: 5            // 이동속도 +5%
                    },
                    description: '끝없는 탐욕이 깃든 팔찌'
                },
                earring: {
                    id: 'goblin_earring',
                    name: '도굴꾼의 귀걸이',
                    slotType: 'earring',
                    emoji: '💎',
                    stats: {
                        dungeonReward: 20,  // 던전 보상 +20%
                        dodge: 10           // 회피 +10
                    },
                    description: '보물을 찾는 능력이 향상되는 귀걸이'
                }
            }
        },

        // 해골 세트 (Tier 1 - 생존/방어 특화)
        skeleton: {
            id: 'skeleton_set',
            name: '불사의 해골왕',
            tier: 1,
            theme: '생존력과 방어에 특화',
            items: {
                ring: {
                    id: 'skeleton_ring',
                    name: '망자의 반지',
                    slotType: 'ring',
                    emoji: '💀',
                    stats: {
                        resurrect: 1,       // 부활 기회 +1 (일일 한정)
                        hp: 1000            // HP +1000
                    },
                    description: '죽음을 거부하는 신비한 반지'
                },
                necklace: {
                    id: 'skeleton_necklace',
                    name: '언데드 목걸이',
                    slotType: 'necklace',
                    emoji: '☠️',
                    stats: {
                        hpRegen: 5,         // HP 재생 +5/초
                        defense: 100        // 방어력 +100
                    },
                    description: '언데드의 생명력이 깃든 목걸이'
                },
                bracelet: {
                    id: 'skeleton_bracelet',
                    name: '뼈 팔찌',
                    slotType: 'bracelet',
                    emoji: '🦴',
                    stats: {
                        damageReduction: 10, // 받는 데미지 -10%
                        stunResist: 30      // 기절 저항 +30%
                    },
                    description: '단단한 뼈로 만든 방어 팔찌'
                },
                earring: {
                    id: 'skeleton_earring',
                    name: '해골 귀걸이',
                    slotType: 'earring',
                    emoji: '👻',
                    stats: {
                        pvpDefense: 15,     // PVP 방어력 +15%
                        mp: 500             // MP +500
                    },
                    description: '망령의 보호를 받는 귀걸이'
                }
            }
        },

        // 그림자 세트 (Tier 2 - PVP/치명타 특화)
        shadow: {
            id: 'shadow_set',
            name: '그림자 암살단',
            tier: 2,
            theme: 'PVP와 치명타에 특화',
            items: {
                ring: {
                    id: 'shadow_ring',
                    name: '암살자 반지',
                    slotType: 'ring',
                    emoji: '🌑',
                    stats: {
                        criticalChance: 15, // 치명타 확률 +15%
                        criticalDamage: 30, // 치명타 데미지 +30%
                        attack: 100
                    },
                    description: '일격필살의 힘이 담긴 반지'
                },
                necklace: {
                    id: 'shadow_necklace',
                    name: '그림자 망토',
                    slotType: 'necklace',
                    emoji: '🔪',
                    stats: {
                        dodge: 20,          // 회피율 +20%
                        speed: 10,          // 이동속도 +10%
                        pvpDamage: 15       // PVP 데미지 +15%
                    },
                    description: '그림자처럼 빠른 움직임을 준다'
                },
                bracelet: {
                    id: 'shadow_bracelet',
                    name: '은신 부적',
                    slotType: 'bracelet',
                    emoji: '🥷',
                    stats: {
                        pvpDamage: 10,      // PVP 데미지 +10%
                        criticalChance: 10  // 치명타 확률 +10%
                    },
                    description: '적의 눈에 띄지 않게 해주는 부적'
                },
                earring: {
                    id: 'shadow_earring',
                    name: '어둠의 귀걸이',
                    slotType: 'earring',
                    emoji: '🌙',
                    stats: {
                        attack: 75,         // 공격력 +75
                        criticalDamage: 25  // 치명타 데미지 +25%
                    },
                    description: '어둠의 힘을 이끌어내는 귀걸이'
                }
            }
        },

        // 대지 세트 (Tier 2 - 탱커/채굴 특화)
        earth: {
            id: 'earth_set',
            name: '대지의 수호자',
            tier: 2,
            theme: '방어와 자원 채굴에 특화',
            items: {
                ring: {
                    id: 'earth_ring',
                    name: '대지의 반지',
                    slotType: 'ring',
                    emoji: '🪨',
                    stats: {
                        defense: 200,       // 방어력 +200
                        miningBonus: 30,    // 채굴 보너스 +30%
                        hp: 2000
                    },
                    description: '대지의 힘이 깃든 단단한 반지'
                },
                necklace: {
                    id: 'earth_necklace',
                    name: '수호자 목걸이',
                    slotType: 'necklace',
                    emoji: '🛡️',
                    stats: {
                        hp: 3000,           // 체력 +3000
                        blockChance: 15,    // 블록 확률 +15%
                        thorns: 20          // 반사 데미지 20
                    },
                    description: '착용자를 보호하는 수호의 목걸이'
                },
                bracelet: {
                    id: 'earth_bracelet',
                    name: '불굴의 벨트',
                    slotType: 'bracelet',
                    emoji: '⛰️',
                    stats: {
                        defense: 150,       // 방어력 +150
                        hp: 2000,           // 체력 +2000
                        damageReduction: 10 // 데미지 감소 +10%
                    },
                    description: '산처럼 굳건한 의지를 준다'
                },
                earring: {
                    id: 'earth_earring',
                    name: '광부의 귀걸이',
                    slotType: 'earring',
                    emoji: '⛏️',
                    stats: {
                        miningBonus: 20,    // 채굴 보너스 +20%
                        luck: 15            // 행운 +15
                    },
                    description: '자원을 효율적으로 채굴하게 해준다'
                }
            }
        },

        // 서리 세트 (Tier 3 - 마법/제어 특화)
        frost: {
            id: 'frost_set',
            name: '서리 여왕의 축복',
            tier: 3,
            theme: '마법 능력과 적 제어에 특화',
            items: {
                ring: {
                    id: 'frost_ring',
                    name: '얼음 여왕의 반지',
                    slotType: 'ring',
                    emoji: '❄️',
                    stats: {
                        attack: 150,        // 공격력 +150
                        defense: 100,       // 방어력 +100
                        dodge: 20           // 회피 +20
                    },
                    description: '마법의 힘을 극대화하는 반지'
                },
                necklace: {
                    id: 'frost_necklace',
                    name: '서리 목걸이',
                    slotType: 'necklace',
                    emoji: '🧊',
                    stats: {
                        weatherBonus: 30,   // 날씨 보너스 +30%
                        attack: 200,        // 공격력 +200
                        dodge: 15           // 회피 +15
                    },
                    description: '적을 얼어붙게 만드는 차가운 목걸이'
                },
                bracelet: {
                    id: 'frost_bracelet',
                    name: '동결 팔찌',
                    slotType: 'bracelet',
                    emoji: '🌨️',
                    stats: {
                        defense: 200,       // 방어력 +200
                        hp: 3000            // 체력 +3000
                    },
                    description: '보호막을 생성하는 신비한 팔찌'
                },
                earring: {
                    id: 'frost_earring',
                    name: '눈꽃 귀걸이',
                    slotType: 'earring',
                    emoji: '❄️',
                    stats: {
                        weatherBonus: 30,   // 날씨 보너스 +30%
                        fishingBonus: 25    // 낚시 성공률 +25%
                    },
                    description: '자연의 힘을 이용하는 귀걸이'
                }
            }
        },

        // 화염 세트 (Tier 3 - 공격/버서커 특화)
        fire: {
            id: 'fire_set',
            name: '불꽃 폭군',
            tier: 3,
            theme: '순수 공격력과 지속 데미지에 특화',
            items: {
                ring: {
                    id: 'fire_ring',
                    name: '불꽃 반지',
                    slotType: 'ring',
                    emoji: '🔥',
                    stats: {
                        attack: 300,        // 공격력 +300
                        burnDamage: 50,     // 화상 데미지 +50/초
                        attackSpeed: 15     // 공격속도 +15%
                    },
                    description: '타오르는 힘이 깃든 반지'
                },
                necklace: {
                    id: 'fire_necklace',
                    name: '용암 목걸이',
                    slotType: 'necklace',
                    emoji: '🌋',
                    stats: {
                        attack: 250,        // 공격력 +250
                        criticalChance: 15, // 치명타 확률 +15%
                        criticalDamage: 30  // 치명타 데미지 +30%
                    },
                    description: '용암의 열기가 느껴지는 목걸이'
                },
                bracelet: {
                    id: 'fire_bracelet',
                    name: '불사조 깃털',
                    slotType: 'bracelet',
                    emoji: '🦅',
                    stats: {
                        hpRegen: 10,        // HP 재생 +10/초
                        attack: 200         // 공격력 +200
                    },
                    description: '불사조의 재생력이 깃든 팔찌'
                },
                earring: {
                    id: 'fire_earring',
                    name: '화염 귀걸이',
                    slotType: 'earring',
                    emoji: '💥',
                    stats: {
                        explosionDamage: 30,// 폭발 데미지 +30%
                        enhanceSuccess: 5   // 강화 성공률 +5%
                    },
                    description: '폭발적인 힘을 주는 귀걸이'
                }
            }
        },

        // 악마 세트 (Tier 4 - 올라운드/보스 특화)
        demon: {
            id: 'demon_set',
            name: '악마왕의 권능',
            tier: 4,
            theme: '모든 능력치와 보스전에 특화',
            items: {
                ring: {
                    id: 'demon_ring',
                    name: '악마왕 반지',
                    slotType: 'ring',
                    emoji: '👹',
                    stats: {
                        allStats: 50,       // 모든 스탯 +50
                        bossDamage: 30,     // 보스 데미지 +30%
                        lifesteal: 15       // 흡혈 +15%
                    },
                    description: '악마왕의 권능이 담긴 반지'
                },
                necklace: {
                    id: 'demon_necklace',
                    name: '지옥 목걸이',
                    slotType: 'necklace',
                    emoji: '🔱',
                    stats: {
                        killRegen: 20,      // 적 처치시 HP 20% 회복
                        executeDamage: 40,  // HP 30% 이하 적에게 추가 데미지 +40%
                        multiStrike: 15     // 다중 타격 확률 +15%
                    },
                    description: '지옥의 힘을 담은 목걸이'
                },
                bracelet: {
                    id: 'demon_bracelet',
                    name: '타락한 왕관',
                    slotType: 'bracelet',
                    emoji: '👑',
                    stats: {
                        bossDefense: 30,    // 보스 방어력 +30%
                        darkPower: 25,      // 어둠 속성 데미지 +25%
                        darkShield: 500     // 어둠 보호막 +500
                    },
                    description: '타락한 권력의 상징'
                },
                earring: {
                    id: 'demon_earring',
                    name: '악마의 속삭임',
                    slotType: 'earring',
                    emoji: '😈',
                    stats: {
                        expBonus: 50,       // 경험치 획득 +50%
                        goldBonus: 50,      // 골드 획득 +50%
                        luck: 30            // 행운 +30
                    },
                    description: '욕망을 자극하는 귀걸이'
                }
            }
        }
    },

    // 세트 효과 정의
    setEffects: {
        2: { // 2세트 효과
            goblin: { goldBonus: 10, luck: 5 },
            skeleton: { defense: 50, hp: 500 },
            shadow: { criticalChance: 5, dodge: 10 },
            earth: { defense: 100, damageReduction: 5 },
            frost: { attack: 50, defense: 50 },
            fire: { attack: 100, attackSpeed: 5 },
            demon: { attack: 50, defense: 50, bossDamage: 10 }
        },
        3: { // 3세트 효과
            goblin: { goldBonus: 20, dropRate: 10, shopBonus: 15 },
            skeleton: { hpRegen: 10, damageReduction: 5, resurrect: 1 },
            shadow: { pvpDamage: 20, criticalChance: 10, criticalDamage: 20 },
            earth: { hp: 2000, defense: 100, miningBonus: 10 },
            frost: { weatherBonus: 20, attack: 100, dodge: 10 },
            fire: { attack: 150, criticalChance: 10, hpRegen: 5 },
            demon: { bossDamage: 20, expBonus: 30, goldBonus: 30 }
        },
        4: { // 4세트 효과 - 특수 능력
            goblin: { 
                ability: 'treasure_hunter',
                description: '보물 사냥꾼: 모든 드롭에서 추가 아이템 획득 확률 30%'
            },
            skeleton: { 
                ability: 'undying',
                description: '불사: 치명적 피해를 받을 시 3초간 무적 (일일 1회)'
            },
            shadow: { 
                ability: 'shadow_clone',
                description: '그림자 분신: 30초간 분신 생성, 데미지 50% 흡수'
            },
            earth: { 
                ability: 'earthquake',
                description: '대지진: 주변 적 기절 및 방어력 50% 감소'
            },
            frost: { 
                ability: 'blizzard',
                description: '눈보라: 모든 적 동결 및 지속 데미지'
            },
            fire: { 
                ability: 'phoenix',
                description: '불사조: 사망 시 50% HP로 부활 (일일 1회)'
            },
            demon: { 
                ability: 'demon_form',
                description: '악마 변신: 60초간 모든 능력치 100% 증가'
            }
        }
    },

    // 토큰 비용 설정
    tokenCosts: {
        1: { // Tier 1
            ring: 15,
            necklace: 20,
            bracelet: 15,
            earring: 10
        },
        2: { // Tier 2
            ring: 25,
            necklace: 30,
            bracelet: 25,
            earring: 20
        },
        3: { // Tier 3
            ring: 40,
            necklace: 50,
            bracelet: 40,
            earring: 30
        },
        4: { // Tier 4
            ring: 60,
            necklace: 80,
            bracelet: 60,
            earring: 50
        }
    },

    // 세트 효과 계산
    calculateSetBonus(equippedItems) {
        const setCounts = {};
        
        // 장착된 아이템의 세트 카운트
        Object.values(equippedItems).forEach(item => {
            if (item && item.setId) {
                setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
            }
        });

        const bonuses = {
            stats: {},
            abilities: []
        };

        // 세트별 보너스 적용
        Object.entries(setCounts).forEach(([setId, count]) => {
            if (count >= 2 && this.setEffects[2][setId]) {
                Object.entries(this.setEffects[2][setId]).forEach(([stat, value]) => {
                    bonuses.stats[stat] = (bonuses.stats[stat] || 0) + value;
                });
            }
            if (count >= 3 && this.setEffects[3][setId]) {
                Object.entries(this.setEffects[3][setId]).forEach(([stat, value]) => {
                    bonuses.stats[stat] = (bonuses.stats[stat] || 0) + value;
                });
            }
            if (count >= 4 && this.setEffects[4][setId]) {
                bonuses.abilities.push(this.setEffects[4][setId]);
            }
        });

        return bonuses;
    }
};

module.exports = BOSS_ACCESSORIES;