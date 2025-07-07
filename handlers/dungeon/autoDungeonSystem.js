const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');
const { 
    DUNGEON_THEMES, 
    DUNGEON_EVENTS, 
    DUNGEON_BUFFS, 
    PENDULUM_SKILLS,
    calculateDungeonScore,
    MONSTER_AI_PATTERNS 
} = require('../../data/dungeonEnhanced');
const ARTIFACT_SYSTEM = require('../../data/artifactSystem');

class AutoDungeonSystem {
    constructor() {
        this.activeDungeons = new Map();
        this.dungeonMonsters = this.initializeMonsters();
        this.floors = 50;
    }

    // 몬스터 초기화 (기존과 동일)
    initializeMonsters() {
        const monsters = new Map();
        
        for (let floor = 1; floor <= 50; floor++) {
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
        const baseAttack = 20 + (floor * 8); // 더 낮은 시작점
        const baseDefense = 15 + (floor * 6);
        const baseHP = 200 + (floor * 60);
        
        return {
            attack: baseAttack,
            defense: baseDefense,
            maxHp: baseHP,
            currentHp: baseHP,
            criticalRate: Math.min(3 + Math.floor(floor / 3), 20),
            accuracy: Math.min(60 + Math.floor(floor * 0.8), 85),
            evasion: Math.min(3 + Math.floor(floor / 4), 15),
            lifesteal: Math.min(Math.floor(floor / 15), 8)
        };
    }

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

    getMonsterEmoji(floor) {
        const emojis = ['👾', '🐺', '🔥', '⚔️', '⚡', '❄️', '💀', '🦴', '👹', '🐉', '🌟'];
        return emojis[Math.floor(floor / 5)] || '👾';
    }

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

    getFloorRewards(floor) {
        const baseGold = 100 * floor;
        const baseExp = 50 * floor;
        
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
            rewards.gold *= 3;
            rewards.exp *= 2;
            const bossArtifact = this.getBossArtifact(floor);
            if (bossArtifact) {
                rewards.items.push(bossArtifact);
            }
        }
        
        return rewards;
    }
    
    // 랜덤 유물 생성
    getRandomArtifact(floor) {
        // 층수에 따른 등급 확률
        const rarityRoll = Math.random() * 100;
        let rarity = 'common';
        
        if (floor >= 40) {
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
        
        const artifactPool = ARTIFACT_SYSTEM.artifacts[rarity];
        if (!artifactPool || artifactPool.length === 0) return null;
        
        const artifact = artifactPool[Math.floor(Math.random() * artifactPool.length)];
        const value = Math.floor(Math.random() * (artifact.value[1] - artifact.value[0] + 1)) + artifact.value[0];
        
        return {
            type: 'artifact',
            name: artifact.name,
            emoji: artifact.emoji,
            rarity: rarity,
            value: value,
            description: artifact.description,
            quantity: 1
        };
    }
    
    // 보스 특별 유물
    getBossArtifact(floor) {
        if (floor === 50) {
            // 50층 최종 보스는 레전더리 확정
            const legendaryArtifacts = ARTIFACT_SYSTEM.artifacts.legendary;
            const artifact = legendaryArtifacts[Math.floor(Math.random() * legendaryArtifacts.length)];
            const value = Math.floor(Math.random() * (artifact.value[1] - artifact.value[0] + 1)) + artifact.value[0];
            
            return {
                type: 'artifact',
                name: artifact.name,
                emoji: artifact.emoji,
                rarity: 'legendary',
                value: value,
                description: artifact.description,
                quantity: 1
            };
        }
        
        // 일반 보스는 에픽 이상
        return this.getRandomArtifact(floor + 10); // 보너스 층수
    }


    // 던전 자동 탐험 시작
    async startAutoDungeon(interaction) {
        const userId = interaction.user.id;
        
        // 이미 활성화된 세션이 있는지 확인
        if (this.activeDungeons.has(userId)) {
            // 기존 세션 삭제
            this.activeDungeons.delete(userId);
            console.log(`[AutoDungeon] 기존 세션 삭제: ${userId}`);
        }

        const userData = await getUser(userId);
        
        // 일일 제한 체크
        const today = new Date().toDateString();
        if (!userData.dungeonDaily) {
            userData.dungeonDaily = {
                date: today,
                attempts: 0
            };
        }
        
        if (userData.dungeonDaily.date !== today) {
            userData.dungeonDaily = {
                date: today,
                attempts: 0
            };
        }
        
        if (userData.dungeonDaily.attempts >= 3) {
            return await interaction.reply({
                content: '🚫 오늘의 던전 탐험 횟수를 모두 사용했습니다!\n내일 뉴스 이벤트를 기다려주세요.',
                ephemeral: true
            });
        }
        
        userData.dungeonDaily.attempts++;
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
            lifesteal: Math.min((userData.stats?.intelligence || 10) * 0.3, 15)
        };
        
        // 탐험 중 GIF 표시
        const processingEmbed = new EmbedBuilder()
            .setTitle('⚔️ 던전 탐험 중...')
            .setDescription('용감하게 던전을 탐험하고 있습니다!')
            .setImage('https://media.giphy.com/media/3o7btNRptqBgLSKR2w/giphy.gif')
            .setColor('#FFA500')
            .setFooter({ text: '잠시만 기다려주세요...' });

        await interaction.reply({ embeds: [processingEmbed] });

        // 자동 탐험 진행
        const dungeonResult = await this.simulateDungeonRun(userData, playerStats);

        // 반복 보상 너프 적용 (2회차 50%, 3회차 25%)
        if (userData.dungeonDaily.attempts > 1) {
            const nerfRate = userData.dungeonDaily.attempts === 2 ? 0.5 : 0.25;
            dungeonResult.totalGold = Math.floor(dungeonResult.totalGold * nerfRate);
            dungeonResult.totalExp = Math.floor(dungeonResult.totalExp * nerfRate);
            dungeonResult.nerfApplied = true;
            dungeonResult.nerfRate = nerfRate;
        }

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

        // 각 층 자동 진행 (최대 50층까지)
        for (let floor = startFloor; floor <= 50; floor++) {
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
            result.totalGold = 50 * startFloor; // 층당 최소 50골드
            result.totalExp = 25 * startFloor; // 층당 최소 25경험치
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
            let damage = this.calculateDamage(playerStats, monsterStats) * Math.max(powerRatio, 0.5);
            
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
            const monsterDamage = this.calculateDamage(monsterStats, playerStats) * Math.max(1 / powerRatio, 0.5);
            playerHp -= monsterDamage;
            result.damageTaken += monsterDamage;

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

    // 데미지 계산
    calculateDamage(attacker, defender) {
        let damage = attacker.attack - (defender.defense * 0.5);
        
        // 크리티컬 확률
        if (Math.random() * 100 < (attacker.criticalRate || 10)) {
            damage *= 1.5;
        }
        
        // 회피 확률
        if (Math.random() * 100 < (defender.evasion || 5)) {
            damage = 0;
        }
        
        return Math.max(Math.floor(damage), 10);
    }

    // 랜덤 이벤트 생성
    generateRandomEvent(floor) {
        const events = [
            { name: '💰 보물상자 발견!', gold: floor * 50, heal: 0 },
            { name: '💚 회복의 샘', gold: 0, heal: 200 },
            { name: '⚡ 함정 발동!', gold: 0, heal: -100 },
            { name: '🧙 떠돌이 상인', gold: floor * 20, heal: 50 }
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
        const remainingAttempts = 3 - userData.dungeonDaily.attempts;
        let description = `**전투력: ${formatNumber(displayPower)}**\n`;
        description += `🎫 남은 던전 탐험: ${remainingAttempts}/3회`;
        
        // 반복 보상 너프 안내
        if (result.nerfApplied) {
            description += `\n⚠️ 반복 보상 ${Math.floor(result.nerfRate * 100)}% 적용`;
        }
        
        embed.setDescription(description);

        // 탐험 진행도
        const progressBar = this.createProgressBar(result.startFloor, result.finalFloor, 50);
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
        
        embed.addFields(
            { name: '💰 획득 골드', value: formatNumber(result.totalGold) + 'G', inline: true },
            { name: '✨ 획득 경험치', value: formatNumber(result.totalExp) + ' EXP', inline: true },
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

        // 사망 이유 또는 성공 메시지
        if (result.deathReason) {
            embed.addFields({
                name: '💀 탐험 종료 이유',
                value: result.deathReason,
                inline: false
            });
        } else if (result.finalFloor === 50) {
            embed.addFields({
                name: '🏆 던전 클리어!',
                value: '축하합니다! 50층까지 모두 클리어했습니다!',
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
        userData.gold += result.totalGold;
        userData.dungeonProgress = {
            lastFloor: result.finalFloor,
            lastAttempt: Date.now()
        };
        
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
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(result.finalFloor >= 50),
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
    createProgressBar(start, end, max) {
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