const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');
const MissionHelper = require('../../utils/missionHelper');
const ActivityLog = require('../../models/ActivityLog');
const { 
    calculateDamage, 
    calculateDodgeChance,
    applyWarriorDamageReduction,
    calculateDefenderShield,
    calculateDefenderDamageReduction,
    calculateDefenderCounterAttack,
    calculateThiefDodgeCounter
} = require('../common/damageCalculator');
const { 
    DUNGEON_THEMES, 
    DUNGEON_EVENTS, 
    DUNGEON_BUFFS, 
    PENDULUM_SKILLS,
    calculateDungeonScore,
    MONSTER_AI_PATTERNS 
} = require('../../data/dungeonEnhanced');
// const ARTIFACT_SYSTEM = require('../../data/artifactSystem'); // 삭제됨
const artifactData = require('../../data/artifactExploration');
const { MAX_LEVEL, canGainExperience, addExperienceSafely } = require('../../utils/levelCapHelper');

class AutoDungeonSystem {
    constructor() {
        this.activeDungeons = new Map();
        this.dungeonMonsters = this.initializeMonsters();
        this.floors = 300;
    }

    // 몬스터 초기화 (기존과 동일)
    initializeMonsters() {
        const monsters = new Map();
        
        for (let floor = 1; floor <= 300; floor++) {
            const difficulty = Math.ceil(floor / 10);
            const baseStats = this.getBaseStatsForFloor(floor);
            
            monsters.set(floor, {
                name: this.getMonsterName(floor),
                emoji: this.getMonsterEmoji(floor),
                stats: baseStats,
                rewards: this.getFloorRewards(floor),
                specialAbility: floor % 10 === 0 ? this.getBossAbility(floor) : null
            });
        }
        
        return monsters;
    }

    getBaseStatsForFloor(floor) {
        // 전투력 균형 조정 - 플레이어 진행도에 맞춰 점진적 증가
        // 1-50층: 초급 난이도 (일반 유저)
        // 51-100층: 중급 난이도 (레전더리 유저)
        // 101-150층: 고급 난이도 (레전더리 강화 유저)
        // 151-200층: 최고급 난이도 (앱솔루트 유저)
        // 201-300층: 초월 난이도 (앱솔루트 +20 이상)
        
        let baseAttack, baseDefense, baseHP;
        
        if (floor <= 50) {
            // 초급 구간
            baseAttack = 20 + (floor * 8);
            baseDefense = 15 + (floor * 6);
            baseHP = 200 + (floor * 60);
        } else if (floor <= 100) {
            // 중급 구간 - 급격한 상승
            baseAttack = 420 + ((floor - 50) * 20);
            baseDefense = 315 + ((floor - 50) * 15);
            baseHP = 3200 + ((floor - 50) * 150);
        } else if (floor <= 150) {
            // 고급 구간
            baseAttack = 1420 + ((floor - 100) * 40);
            baseDefense = 1065 + ((floor - 100) * 30);
            baseHP = 10700 + ((floor - 100) * 300);
        } else if (floor <= 200) {
            // 최고급 구간 - 앱솔루트 유저 대상
            baseAttack = 3420 + ((floor - 150) * 80);
            baseDefense = 2565 + ((floor - 150) * 60);
            baseHP = 25700 + ((floor - 150) * 600);
        } else {
            // 초월 구간 - 앱솔루트 +20 이상 대상
            baseAttack = 7420 + ((floor - 200) * 160);
            baseDefense = 5565 + ((floor - 200) * 120);
            baseHP = 55700 + ((floor - 200) * 1200);
        }
        
        return {
            attack: baseAttack,
            defense: baseDefense,
            maxHp: baseHP,
            currentHp: baseHP,
            criticalRate: Math.min(3 + Math.floor(floor / 3), 50), // 최대 50%
            accuracy: Math.min(60 + Math.floor(floor * 0.8), 95), // 최대 95%
            evasion: Math.min(3 + Math.floor(floor / 4), 30), // 최대 30%
            lifesteal: Math.min(Math.floor(floor / 15), 20) // 최대 20%
        };
    }

    getMonsterName(floor) {
        const names = {
            // 1-50층: 초급 구간
            1: '나약한 슬라임',
            5: '흉포한 늑대',
            10: '🔥 화염의 정령왕',
            15: '어둠의 기사',
            20: '⚡ 번개의 드래곤',
            25: '얼음 마녀',
            30: '💀 죽음의 군주',
            35: '혼돈의 키메라',
            40: '👹 지옥의 수문장',
            45: '고대의 티탄',
            50: '🌟 제1장 보스: 어둠의 황제',
            
            // 51-100층: 중급 구간
            55: '마계의 전령',
            60: '🔥 용암의 지배자',
            65: '폭풍의 정령',
            70: '⚡ 천둥신의 사도',
            75: '빙하의 여왕',
            80: '💀 언데드 군단장',
            85: '악몽의 키메라',
            90: '👹 심연의 감시자',
            95: '태고의 거인',
            100: '🌟 제2장 보스: 혼돈의 대군주',
            
            // 101-150층: 고급 구간
            105: '지옥불 악마',
            110: '🔥 태양의 화신',
            115: '폭풍의 제왕',
            120: '⚡ 뇌신의 화신',
            125: '영원한 겨울의 군주',
            130: '💀 죽음의 화신',
            135: '차원의 파괴자',
            140: '👹 지옥의 대공',
            145: '신들의 심판자',
            150: '🌟 제3장 보스: 종말의 예언자',
            
            // 151-200층: 최고급 구간
            155: '천계의 배신자',
            160: '🔥 불멸의 피닉스',
            165: '시공의 지배자',
            170: '⚡ 번개의 신',
            175: '절대영도의 지배자',
            180: '💀 영혼의 수확자',
            185: '무한의 파멸자',
            190: '👹 마왕의 화신',
            195: '운명의 조작자',
            200: '🌟 제4장 보스: 절대자의 그림자',
            
            // 201-250층: 초월 구간
            205: '신을 죽인 자',
            210: '🔥 창조의 불꽃',
            215: '우주의 파괴자',
            220: '⚡ 시간의 지배자',
            225: '차원의 절대자',
            230: '💀 만물의 종말',
            235: '혼돈의 창조자',
            240: '👹 심연의 절대자',
            245: '존재의 소거자',
            250: '🌟 제5장 보스: 무한의 절대자',
            
            // 251-300층: 신화 구간
            255: '태초의 존재',
            260: '🔥 원초의 화염',
            265: '창조 이전의 자',
            270: '⚡ 모든 것의 시작',
            275: '끝없는 심연',
            280: '💀 절대 무의 화신',
            285: '모든 차원의 지배자',
            290: '👹 최초이자 최후',
            295: '존재와 무의 경계',
            300: '🌟 최종장 보스: 절대신 크로노스'
        };
        
        return names[floor] || `${floor}층 몬스터`;
    }

    getMonsterEmoji(floor) {
        if (floor <= 50) {
            const emojis = ['👾', '🐺', '🔥', '⚔️', '⚡', '❄️', '💀', '🦴', '👹', '🐉', '🌟'];
            return emojis[Math.floor(floor / 5)] || '👾';
        } else if (floor <= 100) {
            const emojis = ['🔥', '⚡', '❄️', '💀', '👹', '🐉', '🌌', '⭐', '💫', '🌟'];
            return emojis[Math.floor((floor - 50) / 5)] || '🐉';
        } else if (floor <= 150) {
            const emojis = ['🌋', '⚡', '🌊', '💀', '🌑', '🔮', '🌌', '✨', '💥', '🌟'];
            return emojis[Math.floor((floor - 100) / 5)] || '🌌';
        } else if (floor <= 200) {
            const emojis = ['🔴', '🟣', '🔵', '⚫', '⚪', '🟡', '🟠', '🔺', '🔻', '🌟'];
            return emojis[Math.floor((floor - 150) / 5)] || '🔴';
        } else if (floor <= 250) {
            const emojis = ['♾️', '🌀', '🎆', '🌈', '🔯', '⬛', '🟦', '🟪', '🟥', '🌟'];
            return emojis[Math.floor((floor - 200) / 5)] || '♾️';
        } else {
            const emojis = ['🌌', '🌑', '🔮', '💠', '🔷', '🔶', '💎', '👁️', '🗿', '👑'];
            return emojis[Math.floor((floor - 250) / 5)] || '👑';
        }
    }

    getBossAbility(floor) {
        const abilities = {
            // 1-50층 보스
            10: { name: '화염 폭발', damage: 1.5, effect: 'burn' },
            20: { name: '번개 강타', damage: 2.0, effect: 'stun' },
            30: { name: '죽음의 저주', damage: 1.8, effect: 'curse' },
            40: { name: '지옥불', damage: 2.5, effect: 'hellfire' },
            50: { name: '절대 파멸', damage: 3.0, effect: 'destruction' },
            
            // 51-100층 보스
            60: { name: '용암 쓰나미', damage: 3.5, effect: 'melt' },
            70: { name: '천둥의 심판', damage: 4.0, effect: 'paralyze' },
            80: { name: '언데드 군단 소환', damage: 3.8, effect: 'undead_army' },
            90: { name: '심연의 포효', damage: 4.5, effect: 'fear' },
            100: { name: '혼돈의 파동', damage: 5.0, effect: 'chaos' },
            
            // 101-150층 보스
            110: { name: '태양 폭발', damage: 5.5, effect: 'solar_flare' },
            120: { name: '뇌신의 분노', damage: 6.0, effect: 'divine_wrath' },
            130: { name: '영혼 강탈', damage: 5.8, effect: 'soul_steal' },
            140: { name: '지옥의 문', damage: 6.5, effect: 'hell_gate' },
            150: { name: '종말의 나팔', damage: 7.0, effect: 'apocalypse' },
            
            // 151-200층 보스
            160: { name: '불사조의 부활', damage: 7.5, effect: 'phoenix_rebirth' },
            170: { name: '번개 신의 강림', damage: 8.0, effect: 'thunder_god' },
            180: { name: '영혼 수확', damage: 7.8, effect: 'soul_harvest' },
            190: { name: '마왕의 각성', damage: 8.5, effect: 'demon_lord' },
            200: { name: '절대자의 심판', damage: 9.0, effect: 'absolute_judgment' },
            
            // 201-250층 보스
            210: { name: '창조의 역전', damage: 9.5, effect: 'creation_reverse' },
            220: { name: '시간 정지', damage: 10.0, effect: 'time_stop' },
            230: { name: '만물 소거', damage: 9.8, effect: 'existence_erase' },
            240: { name: '무한 심연', damage: 10.5, effect: 'infinite_abyss' },
            250: { name: '절대 무한', damage: 11.0, effect: 'absolute_infinity' },
            
            // 251-300층 보스
            260: { name: '원초의 불꽃', damage: 11.5, effect: 'primordial_flame' },
            270: { name: '태초의 빅뱅', damage: 12.0, effect: 'big_bang' },
            280: { name: '절대 무의 구현', damage: 11.8, effect: 'absolute_void' },
            290: { name: '존재의 역설', damage: 12.5, effect: 'paradox' },
            300: { name: '크로노스의 종언', damage: 15.0, effect: 'chronos_end' }
        };
        
        return abilities[floor] || null;
    }

    getFloorRewards(floor) {
        let baseGold, baseExp;
        
        if (floor <= 50) {
            // 초급 구간 (90% 감소)
            baseGold = Math.floor((1000 + (floor * 500)) * 0.15);
            baseExp = Math.floor((500 + (floor * 100)) * 0.15);
        } else if (floor <= 100) {
            // 중급 구간 (90% 감소)
            baseGold = Math.floor((39000 + ((floor - 50) * 1000)) * 0.15);
            baseExp = Math.floor((8250 + ((floor - 50) * 200)) * 0.15);
        } else if (floor <= 150) {
            // 고급 구간 (90% 감소)
            baseGold = Math.floor((114000 + ((floor - 100) * 2000)) * 0.15);
            baseExp = Math.floor((23250 + ((floor - 100) * 400)) * 0.15);
        } else if (floor <= 200) {
            // 최고급 구간 (90% 감소)
            baseGold = Math.floor((264000 + ((floor - 150) * 4000)) * 0.15);
            baseExp = Math.floor((53250 + ((floor - 150) * 800)) * 0.15);
        } else if (floor <= 250) {
            // 초월 구간 (90% 감소)
            baseGold = Math.floor((564000 + ((floor - 200) * 8000)) * 0.15);
            baseExp = Math.floor((113250 + ((floor - 200) * 1600)) * 0.15);
        } else {
            // 신화 구간 (90% 감소)
            baseGold = Math.floor((1164000 + ((floor - 250) * 16000)) * 0.15);
            baseExp = Math.floor((233250 + ((floor - 250) * 3200)) * 0.15);
        }
        
        const rewards = {
            gold: baseGold + Math.floor(Math.random() * baseGold),
            exp: baseExp + Math.floor(Math.random() * baseExp / 2),
            items: []
        };
        
        // 유물만 드롭 - 층수에 따라 확률 조정
        // 3층마다 유물 드롭 찬스 (층수가 높을수록 좋은 유물)
        if (floor % 3 === 0 || floor === 1) { // 1층도 포함하여 첫 보상 보장
            const artifact = this.getRandomArtifact(floor);
            if (artifact) {
                rewards.items.push(artifact);
            }
        }
        
        // 10층마다 보스 보상 (특별 유물 확정)
        if (floor % 10 === 0) {
            rewards.gold *= 5;  // 3 -> 5 (더 많은 보스 보상)
            rewards.exp *= 3;   // 2 -> 3
            const bossArtifact = this.getBossArtifact(floor);
            if (bossArtifact) {
                rewards.items.push(bossArtifact);
            }
        }
        
        // 50층마다 특별 보상
        if (floor % 50 === 0) {
            rewards.gold *= 2;  // 추가 2배
            rewards.exp *= 2;   // 추가 2배
            // 레전더리 유물 확정
            const legendaryArtifact = this.getBossArtifact(floor);
            if (legendaryArtifact) {
                rewards.items.push(legendaryArtifact);
            }
        }
        
        return rewards;
    }
    
    // 랜덤 유물 생성
    getRandomArtifact(floor) {
        // 층수에 따른 등급 확률
        const rarityRoll = Math.random() * 100;
        let rarity = 'common';
        
        if (floor >= 250) {
            // 신화 구간 - 레전더리 확률 매우 높음
            if (rarityRoll < 30) rarity = 'legendary';
            else if (rarityRoll < 60) rarity = 'epic';
            else if (rarityRoll < 90) rarity = 'rare';
        } else if (floor >= 200) {
            // 초월 구간
            if (rarityRoll < 20) rarity = 'legendary';
            else if (rarityRoll < 50) rarity = 'epic';
            else if (rarityRoll < 85) rarity = 'rare';
        } else if (floor >= 150) {
            // 최고급 구간
            if (rarityRoll < 15) rarity = 'legendary';
            else if (rarityRoll < 40) rarity = 'epic';
            else if (rarityRoll < 80) rarity = 'rare';
        } else if (floor >= 100) {
            // 고급 구간
            if (rarityRoll < 10) rarity = 'legendary';
            else if (rarityRoll < 30) rarity = 'epic';
            else if (rarityRoll < 70) rarity = 'rare';
        } else if (floor >= 50) {
            // 중급 구간
            if (rarityRoll < 5) rarity = 'legendary';
            else if (rarityRoll < 20) rarity = 'epic';
            else if (rarityRoll < 60) rarity = 'rare';
        } else if (floor >= 40) {
            if (rarityRoll < 5) rarity = 'legendary';
            else if (rarityRoll < 20) rarity = 'epic';
            else if (rarityRoll < 50) rarity = 'rare';
        } else if (floor >= 25) {
            if (rarityRoll < 2) rarity = 'legendary';
            else if (rarityRoll < 10) rarity = 'epic';
            else if (rarityRoll < 35) rarity = 'rare';
        } else if (floor >= 10) {
            if (rarityRoll < 5) rarity = 'epic';
            else if (rarityRoll < 25) rarity = 'rare';
        } else {
            if (rarityRoll < 15) rarity = 'rare';
        }
        
        const artifactPool = artifactData.items[rarity];
        if (!artifactPool || artifactPool.length === 0) return null;
        
        const itemName = artifactPool[Math.floor(Math.random() * artifactPool.length)];
        const rarityData = artifactData.rarities[rarity];
        const adjective = artifactData.adjectives[rarity][Math.floor(Math.random() * artifactData.adjectives[rarity].length)];
        const prefix = artifactData.prefixes[rarity][Math.floor(Math.random() * artifactData.prefixes[rarity].length)];
        
        const value = Math.floor(rarityData.basePrice * (0.8 + Math.random() * 0.4));
        
        return {
            type: 'artifact',
            name: `${adjective} ${prefix} ${itemName}`,
            emoji: '🏺',
            rarity: rarity,
            value: value,
            description: `${rarityData.name} 등급의 유물`,
            quantity: 1
        };
    }
    
    // 보스 특별 유물
    getBossArtifact(floor) {
        // 50층마다 레전더리 확정
        if (floor % 50 === 0) {
            const legendaryArtifacts = artifactData.items.legendary;
            const itemName = legendaryArtifacts[Math.floor(Math.random() * legendaryArtifacts.length)];
            const rarityData = artifactData.rarities.legendary;
            const adjective = artifactData.adjectives.legendary[Math.floor(Math.random() * artifactData.adjectives.legendary.length)];
            const prefix = artifactData.prefixes.legendary[Math.floor(Math.random() * artifactData.prefixes.legendary.length)];
            
            const value = Math.floor(rarityData.basePrice * (0.8 + Math.random() * 0.4));
            
            return {
                type: 'artifact',
                name: `${adjective} ${prefix} ${itemName}`,
                emoji: '🏺',
                rarity: 'legendary',
                value: value,
                description: `${rarityData.name} 등급의 유물`,
                quantity: 1
            };
        }
        
        // 일반 보스는 에픽 이상
        return this.getRandomArtifact(floor + 10); // 보너스 층수
    }


    // 던전 자동 탐험 시작
    async startAutoDungeon(interaction) {
        // 먼저 defer 처리
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 });
            }
        } catch (error) {
            if (error.code === 10062) {
                console.log('[Dungeon] Start interaction expired');
                return;
            }
            console.error('[Dungeon] Start defer error:', error);
            return;
        }
        
        const userId = interaction.user.id;
        
        // 이미 활성화된 세션이 있는지 확인
        if (this.activeDungeons.has(userId)) {
            // 기존 세션 삭제
            this.activeDungeons.delete(userId);
            console.log(`[AutoDungeon] 기존 세션 삭제: ${userId}`);
        }

        // TicketManager로 티켓 재생성 먼저 처리
        const TicketManager = require('../../utils/ticketManager');
        let userData = await getUser(userId);
        userData = await TicketManager.regenerateTickets(userData);
        
        // 던전 티켓 체크
        if (!userData.dungeonTickets || userData.dungeonTickets <= 0) {
            // 다음 티켓 재생성까지 남은 시간 계산
            const now = Date.now();
            const REGEN_TIME = 30 * 60 * 1000; // 30분
            const lastRegen = userData.lastDungeonTicketRegen ? new Date(userData.lastDungeonTicketRegen).getTime() : (now - REGEN_TIME + 60000);
            const nextRegenTime = lastRegen + REGEN_TIME;
            const timeUntilRegen = Math.max(0, nextRegenTime - now);
            const minutesLeft = Math.ceil(timeUntilRegen / 60000);
            
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: 64 });
                }
                return await interaction.editReply({
                    content: `🎫 던전 티켓이 부족합니다!\n⏰ **${minutesLeft}분 후** 티켓이 생성됩니다.\n30분마다 1장씩 재생성됩니다.`
                });
            } catch (error) {
                console.error('[Dungeon] Ticket reply error:', error);
                return;
            }
        }
        
        // 티켓 사용 (TicketManager 사용)
        const ticketResult = await TicketManager.useTicket(userId, 'dungeon');
        if (!ticketResult.success) {
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: 64 });
                }
                return await interaction.editReply({
                    content: ticketResult.error
                });
            } catch (error) {
                console.error('[Dungeon] Ticket error reply:', error);
                return;
            }
        }
        userData = ticketResult.user;
        
        const combatPower = calculateCombatPower(userData);
        
        // 플레이어 스탯 구성
        const playerStats = {
            combatPower: combatPower,
            attack: (userData.stats?.strength || 10) * 10 + (userData.attack || 0),
            defense: (userData.stats?.vitality || 10) * 5 + (userData.defense || 0),
            hp: (userData.stats?.vitality || 10) * 100 + (userData.health || 100),
            criticalRate: Math.min((userData.stats?.luck || 10) * 0.5, 30),
            accuracy: 85 + Math.min((userData.stats?.agility || 10) * 0.3, 15),
            evasion: Math.min((userData.stats?.agility || 10) * 0.5, 25),
            lifesteal: Math.min((userData.stats?.intelligence || 10) * 0.3, 15),
            // 통합 데미지 계산을 위한 추가 정보
            stats: userData.stats,
            emblem: userData.emblem,
            level: userData.level
        };
        
        // 탐험 중 GIF 표시
        const processingEmbed = new EmbedBuilder()
            .setTitle('⚔️ 던전 탐험 중...')
            .setDescription('용감하게 던전을 탐험하고 있습니다!')
            .setImage('https://media.giphy.com/media/3o7btNRptqBgLSKR2w/giphy.gif')
            .setColor('#FFA500')
            .setFooter({ text: '잠시만 기다려주세요...' });

        await interaction.editReply({ embeds: [processingEmbed] });

        // 자동 탐험 진행
        const dungeonResult = await this.simulateDungeonRun(userData, playerStats);

        // 결과 표시
        await this.showDungeonResults(interaction, dungeonResult, userData);
    }

    // 던전 자동 진행 시뮬레이션
    async simulateDungeonRun(userData, playerStats) {
        const startFloor = userData.dungeonProgress?.lastFloor || 1;
        const pendulumSkillLevels = {
            high: Math.min(7, Math.floor((userData.pvpEnhancement?.high || 0) / 5) + 1),
            middle: Math.min(7, Math.floor((userData.pvpEnhancement?.middle || 0) / 5) + 1),
            low: Math.min(7, Math.floor((userData.pvpEnhancement?.low || 0) / 5) + 1)
        };

        const result = {
            startFloor,
            finalFloor: startFloor, // 시작 층에서 시작
            totalGold: 0,
            totalExp: 0,
            items: [],
            battleLogs: [],
            skillActivations: {
                high: 0,
                middle: 0,
                low: 0
            },
            events: [],
            deathReason: null,
            duration: 0,
            killCount: 0,
            playerCombatPower: playerStats.combatPower || 0
        };

        let currentHp = playerStats.hp;
        const maxHp = playerStats.hp;
        let killStreak = 0;

        // 각 층 자동 진행 (최대 300층까지)
        for (let floor = startFloor; floor <= 300; floor++) {
            const monster = this.dungeonMonsters.get(floor);
            const monsterCombatPower = this.calculateMonsterCombatPower(monster.stats);
            
            // 전투력 비교 - 플레이어가 너무 약하면 패배 확률 증가
            const powerRatio = (playerStats.combatPower || 1) / (monsterCombatPower || 1);
            
            const floorResult = await this.simulateFloorBattle(
                floor, 
                playerStats, 
                currentHp, 
                maxHp, 
                pendulumSkillLevels,
                killStreak,
                powerRatio
            );

            // 전투 로그 추가
            result.battleLogs.push({
                floor,
                monsterName: floorResult.monsterName,
                monsterPower: monsterCombatPower,
                damage: floorResult.damageDealt,
                damageTaken: floorResult.damageTaken,
                skillsUsed: floorResult.skillsActivated,
                victory: floorResult.victory
            });

            // 스킬 발동 횟수 누적
            if (floorResult.skillsActivated.high) result.skillActivations.high++;
            if (floorResult.skillsActivated.middle) result.skillActivations.middle++;
            if (floorResult.skillsActivated.low) result.skillActivations.low++;

            // 랜덤 이벤트 처리
            if (Math.random() < 0.2) {
                const event = this.generateRandomEvent(floor);
                result.events.push(event);
                if (event.heal > 0) {
                    currentHp = Math.min(currentHp + event.heal, maxHp);
                } else if (event.heal < 0) {
                    currentHp = Math.max(currentHp + event.heal, 0);
                }
                if (event.gold > 0) {
                    result.totalGold += event.gold;
                }
            }

            if (floorResult.victory) {
                result.finalFloor = floor;
                result.totalGold += floorResult.rewards.gold;
                result.totalExp += floorResult.rewards.exp;
                result.items.push(...floorResult.rewards.items);
                result.killCount++;
                killStreak++;
                
                // HP 회복 (층 회복률에 따라)
                const healAmount = Math.floor(maxHp * 0.1); // 10% 회복
                currentHp = Math.min(currentHp - floorResult.damageTaken + healAmount, maxHp);
            } else {
                // 패배해도 부분 보상 지급 (처치한 만큼)
                if (result.killCount > 0) {
                    result.totalGold += Math.floor(floorResult.rewards.gold * 0.3); // 30% 골드
                    result.totalExp += Math.floor(floorResult.rewards.exp * 0.3); // 30% 경험치
                }
                // 전투력 비교를 더 명확하게 표시
                const powerDifference = Math.floor(((monsterCombatPower - playerStats.combatPower) / playerStats.combatPower) * 100);
                const comparison = powerDifference > 0 ? `몬스터가 ${powerDifference}% 더 강함` : `내가 ${Math.abs(powerDifference)}% 더 강함`;
                result.deathReason = `${floor}층 ${floorResult.monsterName}에게 패배\n나의 전투력: ${playerStats.combatPower} vs 몬스터: ${monsterCombatPower} (${comparison})`;
                break;
            }

            // HP 체크
            if (currentHp <= 0) {
                result.deathReason = `${floor}층에서 HP가 0이 되어 쓰러짐`;
                break;
            }

            // 전투력이 너무 낮으면 더 이상 진행 불가 (30% 미만)
            if (powerRatio < 0.3) {
                const powerPercentage = Math.floor((playerStats.combatPower / monsterCombatPower) * 100);
                result.deathReason = `전투력 부족으로 ${floor + 1}층 진입 불가 (전투력 비율: ${powerPercentage}%)`;
                break;
            }
        }

        result.duration = 3; // 3초로 가정
        
        // 최소 보상 보장 (던전 진입 보상)
        if (result.totalGold === 0) {
            result.totalGold = 2500 * startFloor; // 층당 최소 2500골드 (50x increase)
            result.totalExp = 250 * startFloor; // 층당 최소 250경험치 (10x increase)
        }
        
        return result;
    }

    // 몬스터 전투력 계산 (플레이어와 동일한 방식 적용)
    calculateMonsterCombatPower(stats) {
        return Math.floor(
            stats.attack * 2 +
            stats.defense * 1.5 +
            stats.maxHp / 10 +
            stats.criticalRate * 2 +
            stats.accuracy * 0.5 +
            stats.evasion * 2
        );
    }

    // 층별 전투 시뮬레이션
    async simulateFloorBattle(floor, playerStats, currentHp, maxHp, pendulumSkillLevels, killStreak, powerRatio) {
        const monster = this.dungeonMonsters.get(floor);
        const monsterStats = { ...monster.stats };
        
        const result = {
            monsterName: monster.name,
            damageDealt: 0,
            damageTaken: 0,
            skillsActivated: { high: false, middle: false, low: false },
            victory: false,
            rewards: monster.rewards
        };

        // 전투력 차이가 너무 크면 빠른 승리/패배
        if (powerRatio > 1.5) {
            // 우위 (150% 이상)
            result.victory = true;
            result.damageDealt = monsterStats.maxHp;
            result.damageTaken = Math.floor(monsterStats.attack * 0.5);
            
            // 스킬도 높은 확률로 발동
            const randomSkill = ['high', 'middle', 'low'][Math.floor(Math.random() * 3)];
            if (Math.random() < 0.6) {
                result.skillsActivated[randomSkill] = true;
            }
            return result;
        } else if (powerRatio < 0.5) {
            // 열위 (50% 미만)
            result.victory = false;
            result.damageDealt = Math.floor(monsterStats.maxHp * 0.3);
            result.damageTaken = Math.floor(currentHp * 0.7);
            return result;
        }

        let playerHp = currentHp;
        let monsterHp = monsterStats.currentHp;

        // 전투 시뮬레이션 (최대 10턴)
        for (let turn = 0; turn < 10; turn++) {
            // 플레이어 공격 위치 (랜덤)
            const playerPosition = ['high', 'middle', 'low'][Math.floor(Math.random() * 3)];
            
            // 펜듈럼 스킬 자동 발동 체크
            const skillActivation = this.checkSkillActivation(playerPosition, pendulumSkillLevels);
            if (skillActivation) {
                result.skillsActivated[playerPosition] = true;
            }

            // 데미지 계산 (전투력 비율 반영)
            const damageResult = calculateDamage(playerStats, monsterStats, {
                skillMultiplier: 1.0,
                damageType: 'physical'
            });
            let damage = damageResult.totalDamage * Math.max(powerRatio, 0.5);
            
            // 스킬 효과 적용
            if (skillActivation) {
                switch (playerPosition) {
                    case 'high': // 별똥베기
                        damage *= PENDULUM_SKILLS.high.levels[pendulumSkillLevels.high].effect;
                        break;
                    case 'middle': // 슈가스팅
                        const healAmount = Math.floor(maxHp * PENDULUM_SKILLS.middle.levels[pendulumSkillLevels.middle].heal);
                        playerHp = Math.min(playerHp + healAmount, maxHp);
                        break;
                    case 'low': // 버섯팡
                        // 반격은 몬스터 공격 후 처리
                        break;
                }
            }

            // 킬 스트릭 보너스
            damage *= (1 + killStreak * 0.05);

            monsterHp -= damage;
            result.damageDealt += damage;

            // 몬스터 사망 체크
            if (monsterHp <= 0) {
                result.victory = true;
                break;
            }

            // 몬스터 공격 (전투력 비율 역반영)
            const monsterDamageResult = calculateDamage(monsterStats, playerStats, {
                skillMultiplier: 1.0,
                damageType: 'physical'
            });
            let monsterDamage = monsterDamageResult.totalDamage * Math.max(1 / powerRatio, 0.5);
            
            // 수호자 보호막 및 기본 방어 적용
            const shieldReduction = calculateDefenderShield(playerStats);
            const baseReduction = calculateDefenderDamageReduction(playerStats);
            const totalReduction = shieldReduction + baseReduction;
            
            if (totalReduction > 0) {
                monsterDamage *= (1 - totalReduction);
            }
            
            // 전사 불굴의 의지 체크
            const warriorReduction = applyWarriorDamageReduction(monsterDamage, playerStats);
            if (warriorReduction.reduced) {
                monsterDamage = warriorReduction.damage;
            }
            
            playerHp -= monsterDamage;
            result.damageTaken += monsterDamage;
            
            // 수호자 반격 체크
            const counterAttack = calculateDefenderCounterAttack(monsterDamage, playerStats);
            if (counterAttack.hasCounter && playerHp > 0) {
                monsterHp -= counterAttack.counterDamage;
                result.damageDealt += counterAttack.counterDamage;
            }

            // 버섯팡 반격 처리
            if (skillActivation && playerPosition === 'low') {
                const counterDamage = Math.floor(monsterDamage * PENDULUM_SKILLS.low.levels[pendulumSkillLevels.low].counter);
                monsterHp -= counterDamage;
                result.damageDealt += counterDamage;
            }

            // 플레이어 사망 체크
            if (playerHp <= 0) {
                break;
            }
        }

        // 10턴 후에도 결정 안나면 전투력 비교로 결정
        if (playerHp > 0 && monsterHp > 0) {
            result.victory = powerRatio >= 1.0;
            if (!result.victory) {
                result.damageTaken = currentHp;
            }
        }

        return result;
    }

    // 스킬 발동 확률 체크
    checkSkillActivation(position, skillLevels) {
        const level = skillLevels[position];
        if (!PENDULUM_SKILLS[position] || !PENDULUM_SKILLS[position].levels[level]) {
            return false;
        }
        
        const chance = PENDULUM_SKILLS[position].levels[level].chance || 0;
        return Math.random() * 100 < chance;
    }

    // 데미지 계산 - 이제 통합 시스템 사용
    // calculateDamage(attacker, defender) {
    //     let damage = attacker.attack - (defender.defense * 0.5);
    //     
    //     // 크리티컬 확률
    //     if (Math.random() * 100 < (attacker.criticalRate || 10)) {
    //         damage *= 1.5;
    //     }
    //     
    //     // 회피 확률
    //     if (Math.random() * 100 < (defender.evasion || 5)) {
    //         damage = 0;
    //     }
    //     
    //     return Math.max(Math.floor(damage), 10);
    // }

    // 랜덤 이벤트 생성
    generateRandomEvent(floor) {
        const events = [
            { name: '💰 보물상자 발견!', gold: floor * 2500, heal: 0 },  // 50 -> 2500 (50x)
            { name: '💚 회복의 샘', gold: 0, heal: 200 },
            { name: '⚡ 함정 발동!', gold: 0, heal: -100 },
            { name: '🧙 떠돌이 상인', gold: floor * 1000, heal: 50 }     // 20 -> 1000 (50x)
        ];
        
        return events[Math.floor(Math.random() * events.length)];
    }

    // 던전 결과 표시
    async showDungeonResults(interaction, result, userData) {
        const embed = new EmbedBuilder()
            .setTitle('⚔️ 던전 탐험 결과')
            .setColor(result.deathReason ? '#FF0000' : '#00FF00');

        // 전투력 정보 및 던전 정보
        const displayPower = result.playerCombatPower || 100;
        const remainingTickets = userData.dungeonTickets || 0;
        let description = `**전투력: ${formatNumber(displayPower)}**\n`;
        description += `🎫 남은 던전 티켓: ${remainingTickets}/5장`;
        
        embed.setDescription(description);

        // 탐험 진행도
        const progressBar = this.createProgressBar(result.startFloor, result.finalFloor, 300);
        embed.addFields({
            name: '📊 탐험 진행도',
            value: `\`\`\`${result.startFloor}층 ➜ ${result.finalFloor}층\n${progressBar}\`\`\``,
            inline: false
        });

        // 기본 정보
        const progressedFloors = result.killCount; // 실제로 클리어한 층수
        embed.addFields(
            { name: '⚔️ 처치 수', value: `${result.killCount}마리`, inline: true },
            { name: '💀 진행 층수', value: `${progressedFloors}층`, inline: true },
            { name: '⏱️ 소요 시간', value: `${result.duration}초`, inline: true }
        );

        // 보상
        const itemText = result.items.length > 0 
            ? result.items.map(item => `${item.name} x${item.quantity || 1}`).join(', ')
            : '없음';
        
        // 버그 사냥꾼 칭호 효과 확인 (표시용)
        const { applyGoldBonus: previewBonus } = require('../common/specialEffects');
        const previewFinalGold = previewBonus(result.totalGold, userData);
        const titleBonusApplied = previewFinalGold > result.totalGold;
        const titleBonusAmount = previewFinalGold - result.totalGold;
        
        const goldValue = titleBonusApplied 
            ? `${formatNumber(result.totalGold)}G → ${formatNumber(previewFinalGold)}G (+${formatNumber(titleBonusAmount)})`
            : formatNumber(result.totalGold) + 'G';
        
        // 만렙일 때 경험치 0으로 표시
        const displayExp = userData.level >= MAX_LEVEL ? 0 : result.totalExp;
        
        embed.addFields(
            { name: '💰 획득 골드', value: goldValue, inline: true },
            { name: '✨ 획득 경험치', value: formatNumber(displayExp) + ' EXP', inline: true },
            { name: '🎁 획득 아이템', value: itemText.substring(0, 50) + (itemText.length > 50 ? '...' : ''), inline: true }
        );

        // 펜듈럼 스킬 발동 횟수
        if (result.skillActivations.high > 0 || result.skillActivations.middle > 0 || result.skillActivations.low > 0) {
            const skillInfo = [];
            if (result.skillActivations.high > 0) skillInfo.push(`⭐ 별똥베기: ${result.skillActivations.high}회`);
            if (result.skillActivations.middle > 0) skillInfo.push(`🍄 슈가스팅: ${result.skillActivations.middle}회`);
            if (result.skillActivations.low > 0) skillInfo.push(`💥 버섯팡: ${result.skillActivations.low}회`);
            
            embed.addFields({
                name: '🎯 스킬 자동 발동',
                value: skillInfo.join('\n'),
                inline: false
            });
        }

        // 주요 이벤트
        if (result.events.length > 0) {
            const eventText = result.events.slice(0, 3).map(e => e.name).join('\n');
            embed.addFields({
                name: '📜 특별 이벤트',
                value: eventText,
                inline: false
            });
        }

        // 칭호 효과 표시
        if (titleBonusApplied && userData.equippedTitle === '버그 사냥꾼') {
            embed.addFields({
                name: '🏷️ 버그 사냥꾼 칭호 효과',
                value: `골드 획득 +10% 적용됨`,
                inline: false
            });
        }
        
        // 사망 이유 또는 성공 메시지
        if (result.deathReason) {
            embed.addFields({
                name: '💀 탐험 종료 이유',
                value: result.deathReason,
                inline: false
            });
        } else if (result.finalFloor === 300) {
            embed.addFields({
                name: '🏆 전설의 영웅!',
                value: '축하합니다! 300층 최종 보스 크로노스를 무찌러습니다!',
                inline: false
            });
        } else if (result.finalFloor % 50 === 0) {
            embed.addFields({
                name: '🏆 책터 클리어!',
                value: `축하합니다! ${result.finalFloor}층까지 클리어했습니다!`,
                inline: false
            });
        }

        // 전투 하이라이트 (보스전 중심)
        const highlights = result.battleLogs
            .filter(log => log.floor % 10 === 0 || (log.skillsUsed.high || log.skillsUsed.middle || log.skillsUsed.low))
            .slice(-5)
            .map(log => {
                let text = `${log.floor}층 - ${log.monsterName}`;
                if (log.floor % 10 === 0) text = `**${text}** (보스)`;
                text += ` [전투력: ${formatNumber(log.monsterPower)}]`;
                if (log.victory) {
                    text += ' ✅';
                } else {
                    text += ' ❌';
                }
                if (log.skillsUsed.high) text += ' ⭐';
                if (log.skillsUsed.middle) text += ' 🍄';
                if (log.skillsUsed.low) text += ' 💥';
                return text;
            });

        if (highlights.length > 0) {
            embed.addFields({
                name: '⚔️ 주요 전투 기록',
                value: highlights.join('\n'),
                inline: false
            });
        }

        // 아이템 상세 정보 (아이템이 많을 경우)
        if (result.items.length > 3) {
            const itemDetails = result.items.slice(0, 5).map(item => {
                const rarity = item.rarity ? `[${item.rarity}]` : '';
                return `• ${item.name} ${rarity} x${item.quantity || 1}`;
            }).join('\n');
            
            embed.addFields({
                name: '📦 획득 아이템 상세',
                value: itemDetails + (result.items.length > 5 ? `\n... 외 ${result.items.length - 5}개` : ''),
                inline: false
            });
        }
        
        // 보상 지급
        // 버그 사냥꾼 칭호 효과 적용
        const { applyGoldBonus } = require('../common/specialEffects');
        const originalGold = result.totalGold;
        const finalGold = applyGoldBonus(result.totalGold, userData);
        
        let bonusApplied = false;
        let bonusAmount = 0;
        if (finalGold > originalGold) {
            bonusApplied = true;
            bonusAmount = finalGold - originalGold;
            console.log(`[Dungeon] ${userData.nickname || userData.discordId} - 특수 효과 적용: ${originalGold} → ${finalGold} (+${bonusAmount})`);
        }
        
        userData.gold += finalGold;
        
        // 만렙 체크 후 경험치 추가
        let actualExpGained = 0;
        if (canGainExperience(userData)) {
            actualExpGained = addExperienceSafely(userData, result.totalExp);
        } else {
            console.log(`[Dungeon] ${userData.nickname}님은 만렙이므로 경험치를 받지 않습니다.`);
        }
        
        // 레벨업 체크
        let leveledUp = false;
        if (userData.level < MAX_LEVEL) {
            const { game } = require('../../config/gameConfig');
            const requiredExp = game.expFormula(userData.level);
            if (userData.exp >= requiredExp) {
                userData.level++;
                userData.exp -= requiredExp;
                userData.statPoints = (userData.statPoints || 0) + 5;
                leveledUp = true;
                
                // 만렙 도달 시 경험치 0으로 설정
                if (userData.level >= MAX_LEVEL) {
                    userData.level = MAX_LEVEL;
                    userData.exp = 0;
                }
            }
        }
        
        // 활동 로그 기록
        await ActivityLog.create({
            userId: userData.discordId,
            nickname: userData.nickname,
            activityType: 'dungeon',
            details: {
                dungeonFloor: result.finalFloor,
                dungeonRewards: {
                    gold: result.totalGold,
                    exp: result.totalExp,
                    items: result.items || []
                },
                goldChange: result.totalGold,
                expGained: actualExpGained,  // 실제 받은 경험치 기록
                levelUp: leveledUp,
                newLevel: leveledUp ? userData.level : null
            }
        });
        
        userData.dungeonProgress = {
            lastFloor: result.finalFloor,
            lastAttempt: Date.now()
        };
        
        // 통합 랭킹 데이터 업데이트
        if (!userData.rankingStats) userData.rankingStats = {};
        if (!userData.rankingStats.dungeon) {
            userData.rankingStats.dungeon = {
                maxFloor: 0,
                totalClears: 0,
                lastUpdated: null
            };
        }
        
        // 최고 층수 업데이트
        if (result.finalFloor > (userData.rankingStats.dungeon.maxFloor || 0)) {
            userData.rankingStats.dungeon.maxFloor = result.finalFloor;
        }
        
        // 총 클리어 횟수 증가
        userData.rankingStats.dungeon.totalClears = (userData.rankingStats.dungeon.totalClears || 0) + 1;
        userData.rankingStats.dungeon.lastUpdated = new Date();
        
        // 골드 획득 미션 업데이트
        await MissionHelper.updateGoldEarned(userData.discordId, result.totalGold);
        
        // 유물 인벤토리에 추가
        const artifacts = result.items.filter(item => item.type === 'artifact');
        if (artifacts.length > 0) {
            if (!userData.artifacts) userData.artifacts = [];
            
            for (const artifact of artifacts) {
                userData.artifacts.push({
                    name: artifact.name,
                    emoji: artifact.emoji,
                    rarity: artifact.rarity,
                    value: artifact.value,
                    baseValue: artifact.value,
                    currentPrice: artifact.value,
                    priceHistory: [{ price: artifact.value, date: new Date() }],
                    description: artifact.description,
                    foundDate: new Date(),
                    company: '던전 탐험',
                    region: `${result.finalFloor}층`
                });
            }
        }
        
        await userData.save();
        
        // 던전 세션 삭제 (중요!)
        this.activeDungeons.delete(userData.discordId);
        
        // 최고 기록 확인 및 뉴스 속보 생성
        await this.checkAndCreateNewsEvent(userData, result);

        // 버튼
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:auto:${interaction.user.id}`)
                    .setLabel(`${result.finalFloor}층부터 다시 탐험`)
                    .setEmoji('🔄')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`main_menu`)
                    .setLabel('메인 메뉴')
                    .setEmoji('🏠')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 진행도 바 생성
    createProgressBar(start, end, max = 300) {
        const filled = '█';
        const empty = '░';
        const barLength = 20;
        const progress = (end / max) * barLength;
        
        let bar = '';
        for (let i = 0; i < barLength; i++) {
            if (i < progress) {
                bar += filled;
            } else {
                bar += empty;
            }
        }
        
        return `[${bar}] ${Math.floor((end / max) * 100)}%`;
    }
    
    // 최고 기록 확인 및 뉴스 속보 생성
    async checkAndCreateNewsEvent(userData, result) {
        // 서버 최고 기록 확인
        const allUsers = await User.find({ 'dungeonProgress.lastFloor': { $exists: true } })
            .sort({ 'dungeonProgress.lastFloor': -1 })
            .limit(1);
        
        const currentRecord = allUsers[0]?.dungeonProgress?.lastFloor || 0;
        
        // 새로운 기록 달성 시
        if (result.finalFloor > currentRecord) {
            const newsSystem = require('../../systems/newsSystem');
            
            // 뉴스 이벤트 생성
            const newsEvent = {
                type: 'dungeon_record',
                title: `🏆 던전 최고 기록 갱신!`,
                content: `**${userData.nickname}**님이 던전 **${result.finalFloor}층**까지 도달하여 새로운 기록을 세웠습니다!`,
                userId: userData.discordId,
                floor: result.finalFloor,
                previousRecord: currentRecord,
                timestamp: new Date()
            };
            
            // 뉴스 시스템에 전달
            if (newsSystem && newsSystem.createBreakingNews) {
                await newsSystem.createBreakingNews(newsEvent);
            }
            
            // 관련 주식 변동 (던전/모험 관련 회사)
            await this.updateRelatedStocks(result.finalFloor);
        }
    }
    
    // 관련 주식 업데이트
    async updateRelatedStocks(floor) {
        try {
            const Stock = require('../../models/Stock');
            
            // 던전/모험 관련 주식들
            const relatedStocks = ['desert_explorers', 'mountain_seekers', 'jungle_raiders'];
            
            for (const stockId of relatedStocks) {
                const stock = await Stock.findOne({ companyId: stockId });
                if (stock) {
                    // 기록 갱신에 따른 주가 상승 (층수에 비례)
                    const priceIncrease = 1 + (floor / 500); // 최대 10% 상승
                    stock.currentPrice = Math.floor(stock.currentPrice * priceIncrease);
                    
                    // 가격 히스토리 업데이트
                    stock.priceHistory.push({
                        price: stock.currentPrice,
                        volume: Math.floor(Math.random() * 10000) + 5000,
                        timestamp: new Date()
                    });
                    
                    // 히스토리 제한
                    if (stock.priceHistory.length > 100) {
                        stock.priceHistory = stock.priceHistory.slice(-100);
                    }
                    
                    await stock.save();
                }
            }
        } catch (error) {
            console.error('던전 관련 주식 업데이트 오류:', error);
        }
    }
}

module.exports = new AutoDungeonSystem();