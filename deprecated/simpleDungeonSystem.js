const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');

class SimpleDungeonSystem {
    constructor() {
        this.activeDungeons = new Map();
        this.maxFloors = 100;
    }

    // 층별 몬스터 생성
    getMonsterForFloor(floor) {
        const monsterNames = [
            { range: [1, 10], name: '나약한 슬라임', emoji: '🟢' },
            { range: [11, 20], name: '흉포한 늑대', emoji: '🐺' },
            { range: [21, 30], name: '어둠의 기사', emoji: '⚔️' },
            { range: [31, 40], name: '화염 정령', emoji: '🔥' },
            { range: [41, 50], name: '얼음 마녀', emoji: '❄️' },
            { range: [51, 60], name: '번개 드래곤', emoji: '⚡' },
            { range: [61, 70], name: '죽음의 군주', emoji: '💀' },
            { range: [71, 80], name: '혼돈의 키메라', emoji: '🦴' },
            { range: [81, 90], name: '지옥의 수문장', emoji: '👹' },
            { range: [91, 100], name: '어둠의 황제', emoji: '🌟' }
        ];

        const monsterInfo = monsterNames.find(m => floor >= m.range[0] && floor <= m.range[1]) || monsterNames[0];
        
        // 층수에 따른 몬스터 스탯
        const baseHp = 500 + (floor * 200);
        const baseAttack = 50 + (floor * 20);
        const baseDefense = 20 + (floor * 10);
        
        // 10층마다 보스 (스탯 2배)
        const isBoss = floor % 10 === 0;
        
        return {
            name: isBoss ? `👑 ${monsterInfo.name} (보스)` : monsterInfo.name,
            emoji: monsterInfo.emoji,
            floor: floor,
            hp: isBoss ? baseHp * 2 : baseHp,
            maxHp: isBoss ? baseHp * 2 : baseHp,
            attack: isBoss ? baseAttack * 2 : baseAttack,
            defense: isBoss ? baseDefense * 2 : baseDefense,
            isBoss: isBoss
        };
    }

    // 플레이어 스탯 계산
    calculatePlayerStats(userData) {
        const combatPower = calculateCombatPower(userData);
        
        // 기본 스탯
        const baseHp = 1000;
        const baseAttack = 100;
        const baseDefense = 50;
        
        // 레벨과 스탯에 따른 보너스
        const levelBonus = userData.level * 10;
        const strBonus = (userData.stats?.strength || 10) * 5;
        const vitBonus = (userData.stats?.vitality || 10) * 20;
        const agiBonus = (userData.stats?.agility || 10) * 2;
        
        // 장비 보너스
        let equipmentAttack = 0;
        let equipmentDefense = 0;
        let equipmentHp = 0;
        
        if (userData.equipment) {
            Object.values(userData.equipment).forEach(item => {
                if (item && item.stats) {
                    equipmentAttack += item.stats.attack || 0;
                    equipmentDefense += item.stats.defense || 0;
                    equipmentHp += item.stats.hp || 0;
                }
            });
        }
        
        // 조각 공격력 보너스
        let fragmentAttackBonus = 0;
        if (userData.energyFragments?.fragments) {
            Object.entries(userData.energyFragments.fragments).forEach(([level, count]) => {
                if (count > 0) {
                    fragmentAttackBonus += parseInt(level) * count;
                }
            });
        }
        
        return {
            maxHp: baseHp + vitBonus + levelBonus + equipmentHp,
            currentHp: baseHp + vitBonus + levelBonus + equipmentHp,
            attack: baseAttack + strBonus + equipmentAttack + fragmentAttackBonus,
            defense: baseDefense + agiBonus + equipmentDefense,
            combatPower: combatPower,
            healingRate: this.calculateHealingRate(userData)
        };
    }

    // 회복률 계산
    calculateHealingRate(userData) {
        let baseHealing = 10;
        
        // 장비 보너스
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
        
        // 레벨 보너스
        const levelBonus = Math.floor(userData.level / 10);
        
        return Math.min(baseHealing + equipmentBonus + levelBonus, 50);
    }

    // 던전 시작
    async startDungeon(interaction) {
        const userId = interaction.user.id;
        
        if (this.activeDungeons.has(userId)) {
            return await interaction.reply({
                content: '❌ 이미 던전을 탐험 중입니다!',
                ephemeral: true
            });
        }
        
        const userData = await getUser(userId);
        const playerStats = this.calculatePlayerStats(userData);
        
        const dungeonData = {
            userId,
            username: userData.nickname,
            currentFloor: userData.dungeonProgress?.lastFloor || 1,
            playerStats: playerStats,
            startTime: Date.now(),
            totalRewards: {
                gold: 0,
                exp: 0,
                items: []
            },
            floorsCleared: 0
        };
        
        this.activeDungeons.set(userId, dungeonData);
        
        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🏰 던전 탐험')
            .setDescription(`**${userData.nickname}**님의 던전 탐험이 시작됩니다!`)
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: '📊 플레이어 정보', value: 
                    `💖 HP: ${playerStats.currentHp}/${playerStats.maxHp}\n` +
                    `⚔️ 공격력: ${playerStats.attack}\n` +
                    `🛡️ 방어력: ${playerStats.defense}\n` +
                    `💚 회복률: ${playerStats.healingRate}%\n` +
                    `💪 전투력: ${formatNumber(playerStats.combatPower)}`, 
                    inline: true 
                },
                { name: '🏰 던전 정보', value: 
                    `현재 층: ${dungeonData.currentFloor}층\n` +
                    `최대 층: ${this.maxFloors}층\n` +
                    `보스: 10층마다 출현\n` +
                    `\n💡 팁: 스펙이 높을수록\n더 높은 층까지 도달 가능!`, 
                    inline: true 
                }
            )
            .setFooter({ text: '⚔️ 전투를 시작하려면 아래 버튼을 클릭하세요!' })
            .setTimestamp();
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:battle:${userId}`)
                    .setLabel('⚔️ 전투 시작')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon:rest:${userId}`)
                    .setLabel('💚 휴식 (회복)')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`dungeon:exit:${userId}`)
                    .setLabel('🚪 던전 나가기')
                    .setStyle(ButtonStyle.Danger)
            );
        
        // 드롭다운 메뉴에서 선택한 경우 update 사용
        if (interaction.isStringSelectMenu()) {
            await interaction.update({
                embeds: [embed],
                components: [buttons]
            });
        } else {
            await interaction.reply({
                embeds: [embed],
                components: [buttons]
            });
        }
    }

    // 전투 처리 (단순화)
    async processBattle(interaction) {
        const userId = interaction.user.id;
        const dungeonData = this.activeDungeons.get(userId);
        
        if (!dungeonData) {
            return await interaction.reply({
                content: '❌ 진행 중인 던전이 없습니다!',
                ephemeral: true
            });
        }
        
        const monster = this.getMonsterForFloor(dungeonData.currentFloor);
        const player = dungeonData.playerStats;
        
        // 전투 계산 (자동)
        let battleLog = [];
        let turn = 1;
        let monsterHp = monster.hp;
        let playerHp = player.currentHp;
        
        // 전투 진행
        while (monsterHp > 0 && playerHp > 0 && turn <= 20) {
            // 플레이어 공격
            const playerDamage = Math.max(1, player.attack - monster.defense);
            const critChance = Math.random() < 0.1; // 10% 크리티컬
            const finalPlayerDamage = critChance ? playerDamage * 2 : playerDamage;
            monsterHp -= finalPlayerDamage;
            
            battleLog.push(`🗡️ [턴 ${turn}] 플레이어 공격: ${finalPlayerDamage} 데미지${critChance ? ' (크리티컬!)' : ''}`);
            
            if (monsterHp <= 0) break;
            
            // 몬스터 공격
            const monsterDamage = Math.max(1, monster.attack - player.defense);
            playerHp -= monsterDamage;
            
            battleLog.push(`👾 [턴 ${turn}] ${monster.name} 공격: ${monsterDamage} 데미지`);
            
            turn++;
        }
        
        // 전투 결과
        const victory = monsterHp <= 0;
        
        if (victory) {
            // 보상 계산
            const goldReward = Math.floor((100 * dungeonData.currentFloor) * (monster.isBoss ? 3 : 1));
            const expReward = Math.floor((50 * dungeonData.currentFloor) * (monster.isBoss ? 2 : 1));
            
            dungeonData.totalRewards.gold += goldReward;
            dungeonData.totalRewards.exp += expReward;
            dungeonData.floorsCleared++;
            
            // HP 회복
            const healAmount = Math.floor(player.maxHp * (player.healingRate / 100));
            playerHp = Math.min(playerHp + healAmount, player.maxHp);
            player.currentHp = playerHp;
            
            // 특별 보상
            if (monster.isBoss) {
                dungeonData.totalRewards.items.push({
                    name: `${dungeonData.currentFloor}층 보스 전리품`,
                    type: 'boss_loot'
                });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('⚔️ 전투 승리!')
                .setDescription(`**${monster.emoji} ${monster.name}**을(를) 물리쳤습니다!`)
                .addFields(
                    { name: '📊 전투 기록', value: battleLog.slice(-5).join('\n'), inline: false },
                    { name: '🏆 전투 보상', value: 
                        `💰 골드: +${formatNumber(goldReward)}G\n` +
                        `✨ 경험치: +${formatNumber(expReward)}\n` +
                        `💚 HP 회복: +${healAmount} (${player.healingRate}%)`,
                        inline: true
                    },
                    { name: '📊 현재 상태', value: 
                        `💖 HP: ${playerHp}/${player.maxHp}\n` +
                        `🏰 현재 층: ${dungeonData.currentFloor}층\n` +
                        `📈 클리어한 층: ${dungeonData.floorsCleared}층`,
                        inline: true
                    }
                )
                .setFooter({ text: monster.isBoss ? '🎉 보스를 물리쳤습니다!' : '다음 층으로 진행하세요!' });
            
            // 다음 층으로
            dungeonData.currentFloor++;
            
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`dungeon:battle:${userId}`)
                        .setLabel(`⚔️ ${dungeonData.currentFloor}층 도전`)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`dungeon:rest:${userId}`)
                        .setLabel('💚 휴식 (회복)')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(playerHp >= player.maxHp),
                    new ButtonBuilder()
                        .setCustomId(`dungeon:exit:${userId}`)
                        .setLabel('🚪 보상받고 나가기')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({
                embeds: [embed],
                components: [buttons]
            });
            
        } else {
            // 패배
            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('💀 전투 패배...')
                .setDescription(`**${monster.emoji} ${monster.name}**에게 패배했습니다...`)
                .addFields(
                    { name: '📊 전투 기록', value: battleLog.slice(-5).join('\n'), inline: false },
                    { name: '📊 최종 결과', value: 
                        `🏰 도달 층수: ${dungeonData.currentFloor}층\n` +
                        `💰 획득 골드: ${formatNumber(Math.floor(dungeonData.totalRewards.gold * 0.5))}G (50%)\n` +
                        `✨ 획득 경험치: ${formatNumber(Math.floor(dungeonData.totalRewards.exp * 0.5))} (50%)`,
                        inline: false
                    }
                )
                .setFooter({ text: '패배 시 보상이 50% 감소합니다.' });
            
            // 보상 지급 (50%)
            const userData = await getUser(userId);
            userData.gold += Math.floor(dungeonData.totalRewards.gold * 0.5);
            userData.dungeonProgress = {
                lastFloor: Math.max(dungeonData.currentFloor - 1, 1),
                lastAttempt: Date.now(),
                bestFloor: Math.max(userData.dungeonProgress?.bestFloor || 0, dungeonData.currentFloor)
            };
            await userData.save();
            
            this.activeDungeons.delete(userId);
            
            await interaction.update({
                embeds: [embed],
                components: []
            });
        }
    }

    // 휴식 (회복)
    async rest(interaction) {
        const userId = interaction.user.id;
        const dungeonData = this.activeDungeons.get(userId);
        
        if (!dungeonData) {
            return await interaction.reply({
                content: '❌ 진행 중인 던전이 없습니다!',
                ephemeral: true
            });
        }
        
        const player = dungeonData.playerStats;
        const healAmount = Math.floor(player.maxHp * (player.healingRate / 100));
        const beforeHp = player.currentHp;
        player.currentHp = Math.min(player.currentHp + healAmount, player.maxHp);
        const actualHeal = player.currentHp - beforeHp;
        
        const embed = new EmbedBuilder()
            .setColor('#27ae60')
            .setTitle('💚 휴식')
            .setDescription('잠시 휴식을 취하며 체력을 회복했습니다.')
            .addFields(
                { name: '💚 회복량', value: `+${actualHeal} HP (회복률: ${player.healingRate}%)`, inline: true },
                { name: '💖 현재 HP', value: `${player.currentHp}/${player.maxHp}`, inline: true },
                { name: '🏰 현재 층', value: `${dungeonData.currentFloor}층`, inline: true }
            )
            .setFooter({ text: 'HP가 가득 찼습니다!' });
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon:battle:${userId}`)
                    .setLabel('⚔️ 전투 계속')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon:rest:${userId}`)
                    .setLabel('💚 휴식 (회복)')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(player.currentHp >= player.maxHp),
                new ButtonBuilder()
                    .setCustomId(`dungeon:exit:${userId}`)
                    .setLabel('🚪 던전 나가기')
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
                content: '❌ 진행 중인 던전이 없습니다!',
                ephemeral: true
            });
        }
        
        // 보상 지급
        const userData = await getUser(userId);
        userData.gold += dungeonData.totalRewards.gold;
        userData.dungeonProgress = {
            lastFloor: dungeonData.currentFloor,
            lastAttempt: Date.now(),
            bestFloor: Math.max(userData.dungeonProgress?.bestFloor || 0, dungeonData.currentFloor)
        };
        await userData.save();
        
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🚪 던전 탐험 종료')
            .setDescription(`${dungeonData.username}님의 던전 탐험이 종료되었습니다.`)
            .addFields(
                { name: '📊 탐험 결과', value: 
                    `🏰 도달 층수: ${dungeonData.currentFloor}층\n` +
                    `⏱️ 소요 시간: ${Math.floor((Date.now() - dungeonData.startTime) / 60000)}분\n` +
                    `📈 클리어한 층: ${dungeonData.floorsCleared}층`,
                    inline: true
                },
                { name: '🏆 획득 보상', value: 
                    `💰 골드: ${formatNumber(dungeonData.totalRewards.gold)}G\n` +
                    `✨ 경험치: ${formatNumber(dungeonData.totalRewards.exp)}\n` +
                    `📦 아이템: ${dungeonData.totalRewards.items.length}개`,
                    inline: true
                }
            )
            .setFooter({ text: '수고하셨습니다! 다음에 더 높은 층에 도전해보세요!' })
            .setTimestamp();
        
        if (dungeonData.totalRewards.items.length > 0) {
            embed.addFields({
                name: '📦 획득한 아이템',
                value: dungeonData.totalRewards.items.map(item => `• ${item.name}`).join('\n').slice(0, 1000),
                inline: false
            });
        }
        
        this.activeDungeons.delete(userId);
        
        await interaction.update({
            embeds: [embed],
            components: []
        });
    }
}

module.exports = new SimpleDungeonSystem();