const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');
const { 
    DUNGEON_THEMES, 
    DUNGEON_EVENTS, 
    DUNGEON_BUFFS, 
    PENDULUM_SKILLS,
    DUNGEON_ITEMS,
    calculateDungeonScore,
    MONSTER_AI_PATTERNS 
} = require('../../data/dungeonEnhanced');

class DungeonSystem {
    constructor() {
        this.activeDungeons = new Map();
        this.dungeonMonsters = this.initializeMonsters();
        this.floors = 50; // 총 50층
    }

    // 던전 몬스터 초기화
    initializeMonsters() {
        const monsters = new Map();
        
        // 층별 몬스터 생성
        for (let floor = 1; floor <= 50; floor++) {
            const difficulty = Math.ceil(floor / 10); // 1-5 난이도
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

    // 층별 기본 스탯
    getBaseStatsForFloor(floor) {
        const baseAttack = 50 + (floor * 15);
        const baseDefense = 30 + (floor * 10);
        const baseHP = 500 + (floor * 100);
        
        return {
            attack: baseAttack,
            defense: baseDefense,
            maxHp: baseHP,
            currentHp: baseHP,
            criticalRate: Math.min(5 + floor, 30),
            accuracy: Math.min(70 + floor, 95),
            evasion: Math.min(5 + Math.floor(floor / 2), 25),
            lifesteal: Math.min(Math.floor(floor / 5), 15)
        };
    }

    // 몬스터 이름 생성
    getMonsterName(floor) {
        const names = {
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
            50: '🌟 최종 보스: 어둠의 황제'
        };
        
        return names[floor] || `${floor}층 몬스터`;
    }

    // 몬스터 이모지
    getMonsterEmoji(floor) {
        const emojis = ['👾', '🐺', '🔥', '⚔️', '⚡', '❄️', '💀', '🦴', '👹', '🐉', '🌟'];
        return emojis[Math.floor(floor / 5)] || '👾';
    }

    // 보스 특수 능력
    getBossAbility(floor) {
        const abilities = {
            10: { name: '화염 폭발', damage: 1.5, effect: 'burn' },
            20: { name: '번개 강타', damage: 2.0, effect: 'stun' },
            30: { name: '죽음의 저주', damage: 1.8, effect: 'curse' },
            40: { name: '지옥불', damage: 2.5, effect: 'hellfire' },
            50: { name: '절대 파멸', damage: 3.0, effect: 'destruction' }
        };
        
        return abilities[floor] || null;
    }

    // 층별 보상
    getFloorRewards(floor) {
        const baseGold = 100 * floor;
        const baseExp = 50 * floor;
        
        const rewards = {
            gold: baseGold + Math.floor(Math.random() * baseGold),
            exp: baseExp,
            items: []
        };
        
        // 5층마다 특별 보상
        if (floor % 5 === 0) {
            rewards.items.push({
                type: 'essence',
                name: `${floor}층 정수`,
                quantity: 1
            });
        }
        
        // 10층마다 보스 보상
        if (floor % 10 === 0) {
            rewards.gold *= 3;
            rewards.exp *= 2;
            rewards.items.push({
                type: 'equipment',
                name: this.getBossReward(floor),
                rarity: floor >= 40 ? 'legendary' : floor >= 20 ? 'epic' : 'rare'
            });
        }
        
        return rewards;
    }

    // 보스 보상 아이템
    getBossReward(floor) {
        const rewards = {
            10: '화염의 검',
            20: '번개의 갑옷',
            30: '죽음의 반지',
            40: '지옥의 투구',
            50: '황제의 왕관'
        };
        
        return rewards[floor] || '신비한 아이템';
    }

    // 던전 시작
    async startDungeon(interaction) {
        const userId = interaction.user.id;
        
        if (this.activeDungeons.has(userId)) {
            return await interaction.reply({
                content: '이미 던전을 탐험 중입니다!',
                ephemeral: true
            });
        }
        
        const userData = await getUser(userId);
        const playerStats = calculateCombatPower(userData);
        
        // 플레이어 스펙에 따른 회복률 계산
        const healingRate = this.calculateHealingRate(playerStats, userData);
        
        // 유저의 펜듈럼 스킬 레벨 가져오기 (PVP 강화 데이터와 연동)
        // PVP 강화 레벨을 1-7 스킬 레벨로 변환 (5강화당 1레벨)
        const pendulumSkillLevels = {
            high: Math.min(7, Math.floor((userData.pvpEnhancement?.high || 0) / 5) + 1),
            middle: Math.min(7, Math.floor((userData.pvpEnhancement?.middle || 0) / 5) + 1),
            low: Math.min(7, Math.floor((userData.pvpEnhancement?.low || 0) / 5) + 1)
        };
        
        const dungeonData = {
            userId,
            currentFloor: userData.dungeonProgress?.lastFloor || 1,
            playerStats: {
                ...playerStats,
                maxHp: playerStats.hp,
                currentHp: playerStats.hp,
                healingRate,
                skills: this.getAvailableSkills(playerStats),
                cooldowns: new Map(),
                pendulumSkillLevel: pendulumSkillLevels
            },
            startTime: Date.now(),
            totalRewards: {
                gold: 0,
                exp: 0,
                items: []
            },
            inventory: [],
            buffs: new Map(),
            killStreak: 0,
            damageTaken: 0,
            itemsCollected: 0,
            eventHistory: []
        };
        
        this.activeDungeons.set(userId, dungeonData);
        
        // 현재 층의 테마 가져오기
        const currentTheme = this.getDungeonTheme(dungeonData.currentFloor);
        
        const embed = new EmbedBuilder()
            .setTitle(`${currentTheme.emoji} 던전 탐험 시작!`)
            .setDescription(`${userData.nickname}님이 **${currentTheme.name}**에 입장했습니다!\n\n*${currentTheme.ambience}*`)
            .addFields(
                { name: '📍 현재 층', value: `${dungeonData.currentFloor}층`, inline: true },
                { name: '❤️ HP', value: `${dungeonData.playerStats.currentHp}/${dungeonData.playerStats.maxHp}`, inline: true },
                { name: '💚 회복률', value: `${healingRate}%`, inline: true },
                { name: '⚡ 특수 효과', value: currentTheme.effect, inline: false }
            )
            .setColor(currentTheme.bgColor || '#9B59B6')
            .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/dungeon_entrance.png')
            .setFooter({ text: '💡 Tip: 각 층마다 특별한 이벤트가 발생할 수 있습니다!' })
            .setTimestamp();
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:explore:${userId}`)
                    .setLabel('탐험 시작')
                    .setEmoji('⚔️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon:inventory:${userId}`)
                    .setLabel('인벤토리')
                    .setEmoji('🎒')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`dungeon:rest:${userId}`)
                    .setLabel('휴식 (HP 회복)')
                    .setEmoji('💚')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`dungeon:exit:${userId}`)
                    .setLabel('던전 나가기')
                    .setEmoji('🚪')
                    .setStyle(ButtonStyle.Danger)
            );
        
        await interaction.reply({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    // 던전 테마 가져오기
    getDungeonTheme(floor) {
        // 10층마다 테마 변경
        const themeFloors = Object.keys(DUNGEON_THEMES).map(f => parseInt(f)).sort((a, b) => b - a);
        const themeFloor = themeFloors.find(f => floor >= f) || 1;
        return DUNGEON_THEMES[themeFloor];
    }
    
    // 사용 가능한 스킬 가져오기
    getAvailableSkills(stats) {
        const skills = [];
        
        // 스탯 기반 스킬 확인
        if (stats.str >= 30) skills.push('powerStrike');
        if (stats.dex >= 30) skills.push('shadowStep');
        if (stats.int >= 30) skills.push('meteor');
        
        return skills;
    }

    // 플레이어 스펙에 따른 회복률 계산
    calculateHealingRate(stats, userData) {
        let baseHealing = 10; // 기본 회복률 10%
        
        // 장비 등급에 따른 보너스
        const equipment = userData.equipment || {};
        const equipmentBonus = Object.values(equipment).reduce((total, item) => {
            if (!item) return total;
            const rarityBonus = {
                'common': 1,
                'uncommon': 2,
                'rare': 3,
                'epic': 5,
                'legendary': 8
            };
            return total + (rarityBonus[item.rarity] || 0);
        }, 0);
        
        // 전투력에 따른 보너스
        const combatPowerBonus = Math.floor(stats.combatPower / 1000);
        
        // 생명력 흡수에 따른 보너스
        const lifestealBonus = Math.floor(stats.lifesteal / 2);
        
        // 최종 회복률 (최대 50%)
        const totalHealing = Math.min(baseHealing + equipmentBonus + combatPowerBonus + lifestealBonus, 50);
        
        return totalHealing;
    }

    // 탐험 진행
    async processExplore(interaction) {
        const userId = interaction.user.id;
        const dungeonData = this.activeDungeons.get(userId);
        
        if (!dungeonData) {
            return await interaction.reply({
                content: '던전 세션을 찾을 수 없습니다.',
                ephemeral: true
            });
        }
        
        // 랜덤 이벤트 확률 (30%)
        if (Math.random() < 0.3) {
            return await this.triggerRandomEvent(interaction, dungeonData);
        }
        
        // 일반 전투
        return await this.processBattle(interaction, dungeonData);
    }
    
    // 랜덤 이벤트 트리거
    async triggerRandomEvent(interaction, dungeonData) {
        const eventTypes = Object.keys(DUNGEON_EVENTS);
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const event = DUNGEON_EVENTS[eventType];
        
        dungeonData.currentEvent = { type: eventType, ...event };
        
        const embed = new EmbedBuilder()
            .setTitle(`${event.emoji} ${event.name}`)
            .setDescription(event.description)
            .setColor('#FFA500')
            .addFields(
                { name: '현재 상태', value: `HP: ${dungeonData.playerStats.currentHp}/${dungeonData.playerStats.maxHp}`, inline: true },
                { name: '현재 층', value: `${dungeonData.currentFloor}층`, inline: true }
            );
        
        const buttons = new ActionRowBuilder();
        
        event.choices.forEach(choice => {
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:event:${choice.action}:${interaction.user.id}`)
                    .setLabel(choice.label)
                    .setStyle(ButtonStyle.Secondary)
            );
        });
        
        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    // 전투 진행 (PVP 시스템 활용)
    async processBattle(interaction, dungeonData) {
        const monster = this.dungeonMonsters.get(dungeonData.currentFloor);
        const player = dungeonData.playerStats;
        
        // 몬스터 AI 패턴 설정
        const aiPattern = this.getMonsterAIPattern(dungeonData.currentFloor);
        const monsterPosition = this.getMonsterAttackPosition(aiPattern, dungeonData);
        
        // 현재 테마 효과 적용
        const theme = this.getDungeonTheme(dungeonData.currentFloor);
        
        // 펜듈럼 스킬 정보 생성
        const skillLevels = dungeonData.playerStats.pendulumSkillLevel || { high: 1, middle: 1, low: 1 };
        const pendulumInfo = [];
        
        if (skillLevels.high > 1 && PENDULUM_SKILLS.high && PENDULUM_SKILLS.high.levels[skillLevels.high]) {
            const skill = PENDULUM_SKILLS.high.levels[skillLevels.high];
            const damageBonus = skill.effect ? Math.round((skill.effect - 1) * 100) : 0;
            pendulumInfo.push(`⭐ 별똥베기: ${skill.chance || 0}% 확률로 데미지 ${damageBonus}% 증가`);
        }
        if (skillLevels.middle > 1 && PENDULUM_SKILLS.middle && PENDULUM_SKILLS.middle.levels[skillLevels.middle]) {
            const skill = PENDULUM_SKILLS.middle.levels[skillLevels.middle];
            const healAmount = skill.heal ? Math.round(skill.heal * 100) : 0;
            pendulumInfo.push(`🍄 슈가스팅: ${skill.chance || 0}% 확률로 HP ${healAmount}% 회복`);
        }
        if (skillLevels.low > 1 && PENDULUM_SKILLS.low && PENDULUM_SKILLS.low.levels[skillLevels.low]) {
            const skill = PENDULUM_SKILLS.low.levels[skillLevels.low];
            const counterAmount = skill.counter ? Math.round(skill.counter * 100) : 0;
            pendulumInfo.push(`💥 버섯팡: ${skill.chance || 0}% 확률로 받은 데미지의 ${counterAmount}% 반격`);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`⚔️ ${dungeonData.currentFloor}층 전투!`)
            .setDescription(`${monster.emoji} **${monster.name}**와(과) 전투 중!\n\n*${theme.effect}*`)
            .addFields(
                { name: '플레이어 HP', value: `${player.currentHp}/${player.maxHp}`, inline: true },
                { name: '몬스터 HP', value: `${monster.stats.currentHp}/${monster.stats.maxHp}`, inline: true },
                { name: '킬 스트릭', value: `${dungeonData.killStreak}연승`, inline: true }
            )
            .setColor(theme.bgColor || '#E74C3C')
            .setTimestamp();
        
        // 펜듈럼 스킬 정보 추가
        if (pendulumInfo.length > 0) {
            embed.addFields({
                name: '🎯 자동 발동 스킬',
                value: pendulumInfo.join('\n'),
                inline: false
            });
        }
        
        // 버프 표시
        if (dungeonData.buffs.size > 0) {
            const buffText = Array.from(dungeonData.buffs.values())
                .map(buff => `${buff.emoji} ${buff.name} (${buff.duration}턴)`)
                .join('\n');
            embed.addFields({ name: '활성 버프', value: buffText, inline: false });
        }
        
        // 스킬 레벨 표시를 위한 버튼 생성
        const buttonSkillLevels = dungeonData.playerStats.pendulumSkillLevel || { high: 1, middle: 1, low: 1 };
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:attack:high:${interaction.user.id}`)
                    .setLabel(`별똥베기 Lv.${buttonSkillLevels.high || 1}`)
                    .setEmoji('⭐')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon:attack:middle:${interaction.user.id}`)
                    .setLabel(`슈가스팅 Lv.${buttonSkillLevels.middle || 1}`)
                    .setEmoji('🍄')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`dungeon:attack:low:${interaction.user.id}`)
                    .setLabel(`버섯팡 Lv.${buttonSkillLevels.low || 1}`)
                    .setEmoji('💥')
                    .setStyle(ButtonStyle.Danger)
            );
        
        // 스킬 버튼 추가
        if (player.skills.length > 0) {
            const skillButton = new ButtonBuilder()
                .setCustomId(`dungeon:skills:${interaction.user.id}`)
                .setLabel('스킬')
                .setEmoji('✨')
                .setStyle(ButtonStyle.Secondary);
            buttons.addComponents(skillButton);
        }
        
        // 아이템 사용 버튼
        if (dungeonData.inventory.length > 0) {
            const itemButton = new ButtonBuilder()
                .setCustomId(`dungeon:use_item:${interaction.user.id}`)
                .setLabel('아이템')
                .setEmoji('🎒')
                .setStyle(ButtonStyle.Secondary);
            buttons.addComponents(itemButton);
        }
        
        // 몬스터 위치 저장
        dungeonData.currentBattle = {
            monsterPosition,
            monster: { ...monster.stats },
            aiPattern
        };
        
        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    // 몬스터 AI 패턴 결정
    getMonsterAIPattern(floor) {
        if (floor % 10 === 0) return MONSTER_AI_PATTERNS.intelligent;
        if (floor > 30) return MONSTER_AI_PATTERNS.aggressive;
        if (floor > 20) return MONSTER_AI_PATTERNS.defensive;
        return MONSTER_AI_PATTERNS.random;
    }
    
    // 몬스터 공격 위치 결정
    getMonsterAttackPosition(aiPattern, dungeonData) {
        const positions = ['high', 'middle', 'low'];
        
        if (aiPattern.attackPreference) {
            // 가중치 기반 선택
            const weights = aiPattern.attackPreference.map((pos, index) => 
                positions.indexOf(pos) * (3 - index)
            );
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let random = Math.random() * totalWeight;
            
            for (let i = 0; i < weights.length; i++) {
                random -= weights[i];
                if (random <= 0) {
                    return aiPattern.attackPreference[i];
                }
            }
        }
        
        // 랜덤 선택
        return positions[Math.floor(Math.random() * 3)];
    }

    // 공격 처리
    async processAttack(interaction, position) {
        const userId = interaction.user.id;
        const dungeonData = this.activeDungeons.get(userId);
        
        if (!dungeonData || !dungeonData.currentBattle) {
            return await interaction.reply({
                content: '진행 중인 전투가 없습니다!',
                ephemeral: true
            });
        }
        
        const { monsterPosition, monster } = dungeonData.currentBattle;
        const player = dungeonData.playerStats;
        const monsterInfo = this.dungeonMonsters.get(dungeonData.currentFloor);
        
        let playerDamage = 0;
        let monsterDamage = 0;
        let battleLog = [];
        
        // 스킬 자동 발동 체크
        const autoSkill = this.checkAutoSkill(player, position, dungeonData);
        if (autoSkill) {
            battleLog.push(`✨ ${autoSkill.emoji} **${autoSkill.name}** 스킬 자동 발동!`);
        }
        
        // 위치 비교 (PVP 시스템과 동일)
        if (position === monsterPosition) {
            // 충돌! 양쪽 모두 감소된 데미지
            playerDamage = Math.floor(player.attack * 0.5);
            monsterDamage = Math.floor(monster.attack * 0.5);
            battleLog.push('💥 공격이 충돌했습니다! (데미지 50% 감소)');
        } else {
            // 일반 공격
            playerDamage = this.calculateDamage(player, monster);
            monsterDamage = this.calculateDamage(monster, player);
        }
        
        // 스킬 효과 적용
        if (autoSkill) {
            const skillEffect = this.applyAutoSkillEffect(autoSkill, playerDamage, monsterDamage, player, monster);
            playerDamage = skillEffect.playerDamage;
            monsterDamage = skillEffect.monsterDamage;
            if (skillEffect.log) battleLog.push(skillEffect.log);
        }
        
        // 데미지 적용
        monster.currentHp -= playerDamage;
        player.currentHp -= monsterDamage;
        
        battleLog.push(`⚔️ 플레이어가 ${playerDamage} 데미지를 입혔습니다!`);
        battleLog.push(`👾 몬스터가 ${monsterDamage} 데미지를 입혔습니다!`);
        
        // 전투 결과 확인
        if (monster.currentHp <= 0) {
            // 승리
            return await this.handleVictory(interaction, dungeonData);
        } else if (player.currentHp <= 0) {
            // 패배
            return await this.handleDefeat(interaction, dungeonData);
        }
        
        // 전투 계속
        dungeonData.currentBattle.monster = monster;
        
        const embed = new EmbedBuilder()
            .setTitle(`⚔️ ${dungeonData.currentFloor}층 전투 진행 중!`)
            .setDescription(battleLog.join('\n'))
            .addFields(
                { name: '플레이어 HP', value: `${player.currentHp}/${player.maxHp}`, inline: true },
                { name: '몬스터 HP', value: `${monster.currentHp}/${monster.maxHp}`, inline: true }
            )
            .setColor('#F39C12')
            .setTimestamp();
        
        // 스킬 레벨 표시를 위한 버튼 생성
        const combatSkillLevels = dungeonData.playerStats.pendulumSkillLevel || { high: 1, middle: 1, low: 1 };
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:attack:high:${userId}`)
                    .setLabel(`별똥베기 Lv.${combatSkillLevels.high || 1}`)
                    .setEmoji('⭐')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon:attack:middle:${userId}`)
                    .setLabel(`슈가스팅 Lv.${combatSkillLevels.middle || 1}`)
                    .setEmoji('🍄')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`dungeon:attack:low:${userId}`)
                    .setLabel(`버섯팡 Lv.${combatSkillLevels.low || 1}`)
                    .setEmoji('💥')
                    .setStyle(ButtonStyle.Danger)
            );
        
        // 새로운 몬스터 위치 생성
        const positions = ['high', 'middle', 'low'];
        dungeonData.currentBattle.monsterPosition = positions[Math.floor(Math.random() * 3)];
        
        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 데미지 계산 (PVP 시스템과 동일)
    calculateDamage(attacker, defender) {
        let damage = attacker.attack - (defender.defense * 0.5);
        
        // 크리티컬 확률
        if (Math.random() * 100 < attacker.criticalRate) {
            damage *= 1.5;
        }
        
        // 회피 확률
        if (Math.random() * 100 < defender.evasion) {
            damage = 0;
        }
        
        // 명중률
        if (Math.random() * 100 > attacker.accuracy) {
            damage *= 0.5;
        }
        
        return Math.max(Math.floor(damage), 0);
    }

    // 승리 처리
    async handleVictory(interaction, dungeonData) {
        const monster = this.dungeonMonsters.get(dungeonData.currentFloor);
        const rewards = monster.rewards;
        
        // 보상 추가
        dungeonData.totalRewards.gold += rewards.gold;
        dungeonData.totalRewards.exp += rewards.exp;
        dungeonData.totalRewards.items.push(...rewards.items);
        
        // 층 클리어
        dungeonData.currentFloor++;
        delete dungeonData.currentBattle;
        
        // 회복 적용
        const healAmount = Math.floor(dungeonData.playerStats.maxHp * (dungeonData.playerStats.healingRate / 100));
        dungeonData.playerStats.currentHp = Math.min(
            dungeonData.playerStats.currentHp + healAmount,
            dungeonData.playerStats.maxHp
        );
        
        const embed = new EmbedBuilder()
            .setTitle('🎉 전투 승리!')
            .setDescription(`${monster.name}을(를) 물리쳤습니다!`)
            .addFields(
                { name: '획득 골드', value: `${formatNumber(rewards.gold)}G`, inline: true },
                { name: '획득 경험치', value: `${formatNumber(rewards.exp)} EXP`, inline: true },
                { name: 'HP 회복', value: `+${healAmount} (${dungeonData.playerStats.healingRate}%)`, inline: true },
                { name: '현재 HP', value: `${dungeonData.playerStats.currentHp}/${dungeonData.playerStats.maxHp}`, inline: true }
            )
            .setColor('#27AE60')
            .setTimestamp();
        
        if (rewards.items.length > 0) {
            embed.addFields({
                name: '획득 아이템',
                value: rewards.items.map(item => `• ${item.name} x${item.quantity || 1}`).join('\n')
            });
        }
        
        // 다음 층으로
        if (dungeonData.currentFloor > 50) {
            // 던전 클리어
            return await this.handleDungeonClear(interaction, dungeonData);
        }
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:explore:${interaction.user.id}`)
                    .setLabel(`${dungeonData.currentFloor}층 도전`)
                    .setEmoji('⚔️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon:rest:${interaction.user.id}`)
                    .setLabel('휴식 (HP 회복)')
                    .setEmoji('💚')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`dungeon:exit:${interaction.user.id}`)
                    .setLabel('보상 받고 나가기')
                    .setEmoji('🚪')
                    .setStyle(ButtonStyle.Danger)
            );
        
        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 패배 처리
    async handleDefeat(interaction, dungeonData) {
        const embed = new EmbedBuilder()
            .setTitle('💀 전투 패배...')
            .setDescription(`${dungeonData.currentFloor}층에서 쓰러졌습니다...`)
            .addFields(
                { name: '도달 층수', value: `${dungeonData.currentFloor}층`, inline: true },
                { name: '획득 골드', value: `${formatNumber(Math.floor(dungeonData.totalRewards.gold * 0.5))}G (50%)`, inline: true },
                { name: '획득 경험치', value: `${formatNumber(Math.floor(dungeonData.totalRewards.exp * 0.5))} EXP (50%)`, inline: true }
            )
            .setColor('#E74C3C')
            .setTimestamp();
        
        // 패배 시 보상 50%만 지급
        const userData = await getUser(interaction.user.id);
        userData.gold += Math.floor(dungeonData.totalRewards.gold * 0.5);
        userData.dungeonProgress = {
            lastFloor: Math.max(dungeonData.currentFloor - 1, 1),
            lastAttempt: Date.now()
        };
        await userData.save();
        
        this.activeDungeons.delete(interaction.user.id);
        
        await interaction.update({
            embeds: [embed],
            components: []
        });
    }

    // 휴식 (회복)
    async rest(interaction) {
        const userId = interaction.user.id;
        const dungeonData = this.activeDungeons.get(userId);
        
        if (!dungeonData) {
            return await interaction.reply({
                content: '진행 중인 던전이 없습니다!',
                ephemeral: true
            });
        }
        
        // 회복률에 따른 회복
        const healAmount = Math.floor(dungeonData.playerStats.maxHp * (dungeonData.playerStats.healingRate / 100));
        dungeonData.playerStats.currentHp = Math.min(
            dungeonData.playerStats.currentHp + healAmount,
            dungeonData.playerStats.maxHp
        );
        
        const embed = new EmbedBuilder()
            .setTitle('💚 휴식')
            .setDescription('잠시 휴식을 취하며 HP를 회복했습니다.')
            .addFields(
                { name: 'HP 회복량', value: `+${healAmount} (${dungeonData.playerStats.healingRate}%)`, inline: true },
                { name: '현재 HP', value: `${dungeonData.playerStats.currentHp}/${dungeonData.playerStats.maxHp}`, inline: true },
                { name: '현재 층', value: `${dungeonData.currentFloor}층`, inline: true }
            )
            .setColor('#27AE60')
            .setTimestamp();
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:explore:${userId}`)
                    .setLabel('탐험 계속')
                    .setEmoji('⚔️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon:rest:${userId}`)
                    .setLabel('휴식 (HP 회복)')
                    .setEmoji('💚')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(dungeonData.playerStats.currentHp >= dungeonData.playerStats.maxHp),
                new ButtonBuilder()
                    .setCustomId(`dungeon:exit:${userId}`)
                    .setLabel('던전 나가기')
                    .setEmoji('🚪')
                    .setStyle(ButtonStyle.Danger)
            );
        
        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 던전 나가기
    async exitDungeon(interaction) {
        const userId = interaction.user.id;
        const dungeonData = this.activeDungeons.get(userId);
        
        if (!dungeonData) {
            return await interaction.reply({
                content: '진행 중인 던전이 없습니다!',
                ephemeral: true
            });
        }
        
        // 보상 지급
        const userData = await getUser(userId);
        userData.gold += dungeonData.totalRewards.gold;
        userData.dungeonProgress = {
            lastFloor: dungeonData.currentFloor,
            lastAttempt: Date.now()
        };
        await userData.save();
        
        const embed = new EmbedBuilder()
            .setTitle('🚪 던전 탐험 종료')
            .setDescription('던전을 나왔습니다.')
            .addFields(
                { name: '도달 층수', value: `${dungeonData.currentFloor - 1}층`, inline: true },
                { name: '총 획득 골드', value: `${formatNumber(dungeonData.totalRewards.gold)}G`, inline: true },
                { name: '총 획득 경험치', value: `${formatNumber(dungeonData.totalRewards.exp)} EXP`, inline: true }
            )
            .setColor('#3498DB')
            .setTimestamp();
        
        if (dungeonData.totalRewards.items.length > 0) {
            embed.addFields({
                name: '획득한 아이템',
                value: dungeonData.totalRewards.items.map(item => `• ${item.name} x${item.quantity || 1}`).join('\n')
            });
        }
        
        this.activeDungeons.delete(userId);
        
        await interaction.update({
            embeds: [embed],
            components: []
        });
    }

    // 던전 완전 클리어
    async handleDungeonClear(interaction, dungeonData) {
        // 특별 보상
        dungeonData.totalRewards.gold += 1000000;
        dungeonData.totalRewards.items.push({
            type: 'title',
            name: '던전 정복자',
            rarity: 'legendary'
        });
        
        const userData = await getUser(interaction.user.id);
        userData.gold += dungeonData.totalRewards.gold;
        userData.titles = userData.titles || [];
        userData.titles.push('던전 정복자');
        userData.dungeonClears = (userData.dungeonClears || 0) + 1;
        await userData.save();
        
        const embed = new EmbedBuilder()
            .setTitle('🏆 던전 완전 정복!')
            .setDescription('축하합니다! 50층까지 모두 클리어했습니다!')
            .addFields(
                { name: '총 획득 골드', value: `${formatNumber(dungeonData.totalRewards.gold)}G`, inline: true },
                { name: '특별 보상', value: '칭호: 던전 정복자', inline: true }
            )
            .setColor('#FFD700')
            .setTimestamp();
        
        this.activeDungeons.delete(interaction.user.id);
        
        await interaction.update({
            embeds: [embed],
            components: []
        });
    }
    
    // 펜듈럼 스킬 자동 발동 체크
    checkAutoSkill(player, position, dungeonData) {
        // 유저 데이터에서 펜듈럼 스킬 레벨 확인
        const userSkillLevels = {
            high: player.pendulumSkillLevel?.high || 1,
            middle: player.pendulumSkillLevel?.middle || 1,
            low: player.pendulumSkillLevel?.low || 1
        };
        
        // 안전성 체크
        if (!PENDULUM_SKILLS || !PENDULUM_SKILLS[position]) {
            return null;
        }
        
        const skill = PENDULUM_SKILLS[position];
        const skillLevel = userSkillLevels[position] || 1;
        
        if (!skill.levels || !skill.levels[skillLevel]) {
            return null;
        }
        
        const skillData = skill.levels[skillLevel];
        
        // 확률 체크
        if (Math.random() * 100 < (skillData.chance || 0)) {
            return {
                name: skill.name || '알 수 없는 스킬',
                emoji: skill.emoji || '✨',
                position: position,
                level: skillLevel,
                data: skillData
            };
        }
        
        return null;
    }
    
    // 펜듈럼 스킬 효과 적용
    applyAutoSkillEffect(skill, playerDamage, monsterDamage, player, monster) {
        let newPlayerDamage = playerDamage;
        let newMonsterDamage = monsterDamage;
        let log = null;
        
        switch (skill.position) {
            case 'high': // 별똥베기 - 데미지 증가
                newPlayerDamage = Math.floor(playerDamage * skill.data.effect);
                log = `💫 ${skill.data.description}`;
                break;
                
            case 'middle': // 슈가스팅 - HP 회복
                const healAmount = Math.floor(player.maxHp * skill.data.heal);
                player.currentHp = Math.min(player.currentHp + healAmount, player.maxHp);
                log = `🌱 ${skill.data.description} (+${healAmount} HP)`;
                break;
                
            case 'low': // 버섯팡 - 반격
                const counterDamage = Math.floor(monsterDamage * skill.data.counter);
                monster.currentHp -= counterDamage;
                log = `💥 ${skill.data.description} (${counterDamage} 반격 데미지)`;
                break;
        }
        
        return {
            playerDamage: newPlayerDamage,
            monsterDamage: newMonsterDamage,
            log: log
        };
    }
    
    // 스킬 메뉴 표시
    async showSkillMenu(interaction) {
        const userId = interaction.user.id;
        const dungeonData = this.activeDungeons.get(userId);
        
        if (!dungeonData) {
            return await interaction.reply({
                content: '던전 세션을 찾을 수 없습니다.',
                ephemeral: true
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('✨ 스킬 선택')
            .setDescription('사용할 스킬을 선택하세요.')
            .setColor('#9B59B6');
        
        const buttons = new ActionRowBuilder();
        
        dungeonData.playerStats.skills.forEach(skillName => {
            const skill = DUNGEON_SKILLS[skillName];
            const cooldown = dungeonData.playerStats.cooldowns.get(skillName) || 0;
            
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:use_skill:${skillName}:${userId}`)
                    .setLabel(skill.name)
                    .setEmoji(skill.emoji)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(cooldown > 0)
            );
            
            embed.addFields({
                name: `${skill.emoji} ${skill.name}`,
                value: `${skill.description}${cooldown > 0 ? `\n⏱️ 재사용 대기: ${cooldown}턴` : ''}`,
                inline: true
            });
        });
        
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`dungeon:back:${userId}`)
                .setLabel('돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
        
        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    // 스킬 사용
    async useSkill(interaction, skillName) {
        const userId = interaction.user.id;
        const dungeonData = this.activeDungeons.get(userId);
        
        if (!dungeonData || !dungeonData.currentBattle) {
            return await interaction.reply({
                content: '전투 중에만 스킬을 사용할 수 있습니다.',
                ephemeral: true
            });
        }
        
        const skill = DUNGEON_SKILLS[skillName];
        if (!skill) return;
        
        // 쿨다운 설정
        dungeonData.playerStats.cooldowns.set(skillName, skill.cooldown);
        
        // 스킬 효과 적용
        let damage = 0;
        let effectText = '';
        
        switch (skillName) {
            case 'powerStrike':
                damage = Math.floor(dungeonData.playerStats.attack * 2);
                effectText = '강력한 일격을 날립니다!';
                break;
            case 'shadowStep':
                dungeonData.playerStats.nextDodge = true;
                effectText = '그림자 속으로 사라집니다...';
                break;
            case 'meteor':
                damage = Math.floor(dungeonData.playerStats.attack * 3);
                effectText = '거대한 운석이 떨어집니다!';
                break;
        }
        
        // 데미지 적용
        if (damage > 0) {
            dungeonData.currentBattle.monster.currentHp -= damage;
        }
        
        // 결과 표시
        const embed = new EmbedBuilder()
            .setTitle(`${skill.emoji} ${skill.name} 발동!`)
            .setDescription(effectText)
            .addFields(
                { name: '효과', value: damage > 0 ? `데미지: ${damage}` : '특수 효과 적용', inline: true },
                { name: '몬스터 HP', value: `${Math.max(0, dungeonData.currentBattle.monster.currentHp)}/${dungeonData.currentBattle.monster.maxHp}`, inline: true }
            )
            .setColor('#9B59B6');
        
        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
        
        // 몬스터가 죽었는지 확인
        if (dungeonData.currentBattle.monster.currentHp <= 0) {
            await this.handleVictory(interaction, dungeonData);
        } else {
            // 전투 계속
            await this.processBattle(interaction, dungeonData);
        }
    }
    
    // 인벤토리 표시
    async showInventory(interaction) {
        const userId = interaction.user.id;
        const dungeonData = this.activeDungeons.get(userId);
        
        if (!dungeonData) {
            return await interaction.reply({
                content: '던전 세션을 찾을 수 없습니다.',
                ephemeral: true
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🎒 인벤토리')
            .setDescription('보유 중인 아이템')
            .setColor('#2ECC71');
        
        if (dungeonData.inventory.length === 0) {
            embed.addFields({ name: '아이템', value: '보유 중인 아이템이 없습니다.' });
        } else {
            const itemList = dungeonData.inventory.map((item, index) => 
                `${index + 1}. ${item.emoji} ${item.name} x${item.quantity || 1}`
            ).join('\n');
            
            embed.addFields({ name: '아이템 목록', value: itemList });
        }
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:back:${userId}`)
                    .setLabel('돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    // 이벤트 처리
    async processEvent(interaction, eventAction) {
        const userId = interaction.user.id;
        const dungeonData = this.activeDungeons.get(userId);
        
        if (!dungeonData || !dungeonData.currentEvent) {
            return await interaction.reply({
                content: '이벤트를 찾을 수 없습니다.',
                ephemeral: true
            });
        }
        
        const event = dungeonData.currentEvent;
        let result = '';
        let rewards = { gold: 0, exp: 0, items: [] };
        
        switch (event.type) {
            case 'treasure':
                if (eventAction === 'open') {
                    if (Math.random() < 0.3) {
                        // 함정!
                        const damage = Math.floor(dungeonData.playerStats.maxHp * 0.2);
                        dungeonData.playerStats.currentHp -= damage;
                        result = `함정이었습니다! ${damage}의 피해를 입었습니다.`;
                    } else {
                        rewards.gold = 500 + Math.floor(Math.random() * 1000);
                        result = `보물상자에서 ${rewards.gold}G를 발견했습니다!`;
                    }
                } else if (eventAction === 'careful') {
                    rewards.gold = 300;
                    result = '신중하게 열어 300G를 획득했습니다.';
                } else if (eventAction === 'smash') {
                    if (Math.random() < 0.5) {
                        rewards.gold = 1500;
                        result = '상자를 부수고 1500G를 획득했습니다!';
                    } else {
                        result = '상자가 부서지며 내용물도 함께 파괴되었습니다...';
                    }
                }
                break;
                
            case 'merchant':
                if (eventAction === 'heal') {
                    const healAmount = Math.floor(dungeonData.playerStats.maxHp * 0.3);
                    dungeonData.playerStats.currentHp = Math.min(
                        dungeonData.playerStats.currentHp + healAmount,
                        dungeonData.playerStats.maxHp
                    );
                    dungeonData.totalRewards.gold -= 500;
                    result = `HP가 ${healAmount} 회복되었습니다!`;
                } else if (eventAction === 'buff') {
                    dungeonData.buffs.set('merchantBuff', {
                        name: '상인의 축복',
                        emoji: '🌟',
                        duration: 5,
                        effects: { attack: 1.3, defense: 1.3 }
                    });
                    dungeonData.totalRewards.gold -= 1000;
                    result = '상인의 축복을 받았습니다! (공격력, 방어력 +30%)';
                } else {
                    result = '상인을 무시하고 지나갑니다.';
                }
                break;
        }
        
        // 보상 적용
        dungeonData.totalRewards.gold += rewards.gold;
        dungeonData.totalRewards.exp += rewards.exp;
        
        const embed = new EmbedBuilder()
            .setTitle(`${event.emoji} 이벤트 결과`)
            .setDescription(result)
            .setColor('#3498DB')
            .addFields(
                { name: '현재 HP', value: `${dungeonData.playerStats.currentHp}/${dungeonData.playerStats.maxHp}`, inline: true },
                { name: '보유 골드', value: `${dungeonData.totalRewards.gold}G`, inline: true }
            );
        
        delete dungeonData.currentEvent;
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:explore:${userId}`)
                    .setLabel('계속 탐험')
                    .setEmoji('⚔️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon:rest:${userId}`)
                    .setLabel('휴식')
                    .setEmoji('💚')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`dungeon:exit:${userId}`)
                    .setLabel('나가기')
                    .setEmoji('🚪')
                    .setStyle(ButtonStyle.Danger)
            );
        
        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }
}

module.exports = new DungeonSystem();