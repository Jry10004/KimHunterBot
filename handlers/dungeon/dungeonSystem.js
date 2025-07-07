const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { applyDungeonRewardBonus, applyExpBonus, applyGoldBonus } = require('../common/specialEffects');
const { calculateCombatPower } = require('../common/utils');
const GAME_GIFS = require('../../data/gameGifs');

// 던전 시스템 설정
const DUNGEON_SYSTEM = {
    // 층별 스케일링 설정
    floorScaling: {
        gold: 1.2,      // 층당 20% 증가
        exp: 1.25       // 층당 25% 증가
    },
    dungeons: [
        {
            id: 'goblin_cave',
            name: '고블린 동굴',
            emoji: '🗿',
            requiredLevel: 10,
            floors: 5,
            entryFee: 5000,
            monsters: [
                { name: '고블린', hp: 500, attack: 50, defense: 20 },
                { name: '고블린 전사', hp: 800, attack: 80, defense: 30 },
                { name: '고블린 주술사', hp: 600, attack: 100, defense: 20 }
            ],
            boss: { name: '고블린 왕', hp: 3000, attack: 150, defense: 50 },
            rewards: {
                gold: { min: 1000, max: 3000 },
                exp: { min: 2000, max: 6000 },  // 4배 상향
                items: [
                    { id: 'goblin_tooth', name: '고블린 이빨', chance: 0.3 },
                    { id: 'shabby_sword', name: '낡은 검', chance: 0.1 }
                ]
            }
        },
        {
            id: 'dark_forest',
            name: '어둠의 숲',
            emoji: '🌲',
            requiredLevel: 25,
            floors: 7,
            entryFee: 10000,
            monsters: [
                { name: '늑대', hp: 1200, attack: 120, defense: 40 },
                { name: '검은 곰', hp: 2000, attack: 150, defense: 60 },
                { name: '나무 정령', hp: 1500, attack: 100, defense: 80 }
            ],
            boss: { name: '숲의 수호자', hp: 8000, attack: 250, defense: 100 },
            rewards: {
                gold: { min: 3000, max: 8000 },
                exp: { min: 6000, max: 14000 },  // 4배 상향
                items: [
                    { id: 'wolf_fang', name: '늑대 송곳니', chance: 0.3 },
                    { id: 'nature_essence', name: '자연의 정수', chance: 0.15 },
                    { id: 'forest_bow', name: '숲의 활', chance: 0.05 }
                ]
            }
        },
        {
            id: 'frozen_tower',
            name: '얼어붙은 탑',
            emoji: '🏔️',
            requiredLevel: 40,
            floors: 10,
            entryFee: 25000,
            monsters: [
                { name: '얼음 골렘', hp: 3000, attack: 200, defense: 150 },
                { name: '프로스트 메이지', hp: 2000, attack: 300, defense: 50 },
                { name: '설인', hp: 4000, attack: 250, defense: 100 }
            ],
            boss: { name: '얼음 여왕', hp: 15000, attack: 400, defense: 200 },
            rewards: {
                gold: { min: 8000, max: 20000 },
                exp: { min: 16000, max: 32000 },  // 4배 상향
                items: [
                    { id: 'ice_crystal', name: '얼음 수정', chance: 0.4 },
                    { id: 'frozen_heart', name: '얼어붙은 심장', chance: 0.2 },
                    { id: 'frost_blade', name: '서리검', chance: 0.08 }
                ]
            }
        },
        {
            id: 'dragons_lair',
            name: '용의 둥지',
            emoji: '🐉',
            requiredLevel: 60,
            floors: 15,
            entryFee: 50000,
            monsters: [
                { name: '드레이크', hp: 6000, attack: 400, defense: 200 },
                { name: '화염 정령', hp: 5000, attack: 500, defense: 100 },
                { name: '용인족 전사', hp: 8000, attack: 350, defense: 300 }
            ],
            boss: { name: '고대 드래곤', hp: 30000, attack: 700, defense: 400 },
            rewards: {
                gold: { min: 20000, max: 50000 },
                exp: { min: 40000, max: 80000 },  // 4배 상향
                items: [
                    { id: 'dragon_scale', name: '용의 비늘', chance: 0.5 },
                    { id: 'dragon_blood', name: '용의 피', chance: 0.3 },
                    { id: 'dragon_sword', name: '용검', chance: 0.02 }
                ]
            }
        }
    ],
    floorRewards: {
        gold: 2000,    // 기본 골드 4배 상향
        exp: 800       // 기본 경험치 4배 상향
    }
};

// 던전 세션 관리
const dungeonSessions = new Map();

class DungeonSystem {
    constructor() {
        this.sessions = dungeonSessions;
    }

    // 던전 메인 메뉴
    async showDungeonMenu(interaction) {
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            return await interaction.reply({ 
                content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
                flags: 64 
            });
        }

        // 던전 입장권 재생성
        this.regenerateDungeonTickets(user);

        const availableDungeons = DUNGEON_SYSTEM.dungeons.filter(d => user.level >= d.requiredLevel);
        const userPower = calculateCombatPower(user);

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🏰 던전 탐험')
            .setDescription('던전을 탐험하고 보물을 획득하세요!')
            .addFields(
                { name: '⚔️ 전투력', value: `${formatNumber(userPower)}`, inline: true },
                { name: '🎫 던전 입장권', value: `${user.dungeonTickets || 5}/5`, inline: true },
                { name: '💰 보유 골드', value: `${formatNumber(user.gold)}G`, inline: true }
            )
            .setFooter({ text: '던전을 선택하여 입장하세요!' });

        const buttons = [];
        availableDungeons.forEach(dungeon => {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`dungeon_enter_${dungeon.id}`)
                    .setLabel(`${dungeon.emoji} ${dungeon.name} (Lv.${dungeon.requiredLevel})`)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        const rows = [];
        while (buttons.length > 0) {
            rows.push(new ActionRowBuilder().addComponents(buttons.splice(0, 5)));
        }

        // 추가 버튼
        const extraRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('dungeon_ranking')
                    .setLabel('🏆 던전 랭킹')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('dungeon_history')
                    .setLabel('📜 탐험 기록')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        rows.push(extraRow);

        return await interaction.reply({
            embeds: [embed],
            components: rows,
            flags: 64
        });
    }

    // 던전 입장
    async enterDungeon(interaction, dungeonId) {
        const user = await getUser(interaction.user.id);
        const dungeon = DUNGEON_SYSTEM.dungeons.find(d => d.id === dungeonId);

        if (!dungeon) {
            return await interaction.reply({
                content: '❌ 존재하지 않는 던전입니다!',
                flags: 64
            });
        }

        if (user.level < dungeon.requiredLevel) {
            return await interaction.reply({
                content: `❌ 레벨 ${dungeon.requiredLevel} 이상이 되어야 입장할 수 있습니다!`,
                flags: 64
            });
        }

        if (!user.dungeonTickets || user.dungeonTickets <= 0) {
            return await interaction.reply({
                content: '❌ 던전 입장권이 부족합니다! (30분마다 1장 재생성)',
                flags: 64
            });
        }

        if (user.gold < dungeon.entryFee) {
            return await interaction.reply({
                content: `❌ 입장료가 부족합니다! (필요: ${formatNumber(dungeon.entryFee)}G)`,
                flags: 64
            });
        }

        // 입장료 차감 및 티켓 사용
        user.gold -= dungeon.entryFee;
        user.dungeonTickets--;
        await user.save();

        // 던전 세션 생성
        const sessionId = `${user.discordId}_${Date.now()}`;
        const session = {
            userId: user.discordId,
            dungeonId: dungeon.id,
            currentFloor: 1,
            maxFloors: dungeon.floors,
            totalGold: 0,
            totalExp: 0,
            items: [],
            startTime: Date.now(),
            currentMonster: null,
            userHp: 1000 + (user.level * 10),
            userMaxHp: 1000 + (user.level * 10)
        };

        this.sessions.set(sessionId, session);

        // 첫 번째 층 시작
        return await this.startFloor(interaction, sessionId);
    }

    // 층 시작
    async startFloor(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return await interaction.reply({
                content: '❌ 유효하지 않은 던전 세션입니다!',
                flags: 64
            });
        }

        const user = await getUser(session.userId);
        const dungeon = DUNGEON_SYSTEM.dungeons.find(d => d.id === session.dungeonId);

        // 몬스터 선택 (보스층 체크)
        let monster;
        if (session.currentFloor === dungeon.floors) {
            // 보스층
            monster = { ...dungeon.boss, isBoss: true };
        } else {
            // 일반 몬스터
            monster = { ...dungeon.monsters[Math.floor(Math.random() * dungeon.monsters.length)] };
        }

        session.currentMonster = {
            ...monster,
            currentHp: monster.hp,
            maxHp: monster.hp
        };

        const embed = new EmbedBuilder()
            .setColor(monster.isBoss ? '#FF0000' : '#9b59b6')
            .setTitle(`🏰 ${dungeon.name} - ${session.currentFloor}층`)
            .setDescription(monster.isBoss ? '⚠️ **보스 등장!**' : '몬스터와 조우했습니다!')
            .setImage(monster.isBoss ? GAME_GIFS.dungeon.boss : GAME_GIFS.dungeon.enter)
            .addFields(
                { 
                    name: `${monster.isBoss ? '👹' : '👾'} ${monster.name}`, 
                    value: `HP: ${this.createHpBar(monster.currentHp, monster.maxHp)}\n${formatNumber(monster.currentHp)}/${formatNumber(monster.maxHp)}`, 
                    inline: false 
                },
                { 
                    name: '🛡️ 플레이어', 
                    value: `HP: ${this.createHpBar(session.userHp, session.userMaxHp)}\n${session.userHp}/${session.userMaxHp}`, 
                    inline: false 
                }
            )
            .setFooter({ text: `던전 진행도: ${session.currentFloor}/${dungeon.floors}층` });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon_attack_${sessionId}`)
                    .setLabel('⚔️ 공격')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon_skill_${sessionId}`)
                    .setLabel('💥 스킬 사용')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!user.mp || user.mp < 30),
                new ButtonBuilder()
                    .setCustomId(`dungeon_potion_${sessionId}`)
                    .setLabel('🧪 포션 사용')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!this.hasPotion(user)),
                new ButtonBuilder()
                    .setCustomId(`dungeon_flee_${sessionId}`)
                    .setLabel('🏃 탈출')
                    .setStyle(ButtonStyle.Danger)
            );

        if (interaction.replied || interaction.deferred) {
            return await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });
        } else {
            return await interaction.update({
                embeds: [embed],
                components: [buttons]
            });
        }
    }

    // 던전 공격
    async performAttack(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return await interaction.reply({
                content: '❌ 유효하지 않은 던전 세션입니다!',
                flags: 64
            });
        }

        const user = await getUser(session.userId);
        const dungeon = DUNGEON_SYSTEM.dungeons.find(d => d.id === session.dungeonId);
        const monster = session.currentMonster;

        // 플레이어 공격
        const playerPower = calculateCombatPower(user);
        const playerDamage = Math.max(1, playerPower - monster.defense);
        monster.currentHp -= playerDamage;

        let battleLog = `⚔️ ${monster.name}에게 ${formatNumber(playerDamage)}의 데미지!\n`;

        // 몬스터 반격 (생존 시)
        if (monster.currentHp > 0) {
            const monsterDamage = Math.max(1, monster.attack - (user.defense || 0));
            session.userHp -= monsterDamage;
            battleLog += `👾 ${monster.name}의 반격! ${monsterDamage}의 데미지를 받았습니다!`;
        }

        // 전투 결과 확인
        if (monster.currentHp <= 0) {
            // 몬스터 처치
            return await this.handleMonsterDefeat(interaction, session, dungeon);
        } else if (session.userHp <= 0) {
            // 플레이어 패배
            return await this.handlePlayerDefeat(interaction, session, dungeon);
        }

        // 전투 계속
        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(`⚔️ 전투 중 - ${dungeon.name} ${session.currentFloor}층`)
            .setDescription(battleLog)
            .setImage(GAME_GIFS.dungeon.battle)
            .addFields(
                { 
                    name: `${monster.isBoss ? '👹' : '👾'} ${monster.name}`, 
                    value: `HP: ${this.createHpBar(monster.currentHp, monster.maxHp)}\n${formatNumber(monster.currentHp)}/${formatNumber(monster.maxHp)}`, 
                    inline: false 
                },
                { 
                    name: '🛡️ 플레이어', 
                    value: `HP: ${this.createHpBar(session.userHp, session.userMaxHp)}\n${session.userHp}/${session.userMaxHp}`, 
                    inline: false 
                }
            );

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon_attack_${sessionId}`)
                    .setLabel('⚔️ 공격')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon_skill_${sessionId}`)
                    .setLabel('💥 스킬 사용')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!user.mp || user.mp < 30),
                new ButtonBuilder()
                    .setCustomId(`dungeon_potion_${sessionId}`)
                    .setLabel('🧪 포션 사용')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!this.hasPotion(user)),
                new ButtonBuilder()
                    .setCustomId(`dungeon_flee_${sessionId}`)
                    .setLabel('🏃 탈출')
                    .setStyle(ButtonStyle.Danger)
            );

        return await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 몬스터 처치 처리
    async handleMonsterDefeat(interaction, session, dungeon) {
        const user = await getUser(session.userId);
        const monster = session.currentMonster;

        // 층 보상 계산 (스케일링 적용)
        const floorMultiplier = Math.pow(DUNGEON_SYSTEM.floorScaling.gold, session.currentFloor - 1);
        const expMultiplier = Math.pow(DUNGEON_SYSTEM.floorScaling.exp, session.currentFloor - 1);
        
        let goldReward = Math.floor(DUNGEON_SYSTEM.floorRewards.gold * floorMultiplier);
        let expReward = Math.floor(DUNGEON_SYSTEM.floorRewards.exp * expMultiplier);

        // 보스 보상 추가
        if (monster.isBoss) {
            const bossGold = Math.floor(Math.random() * (dungeon.rewards.gold.max - dungeon.rewards.gold.min) + dungeon.rewards.gold.min);
            const bossExp = Math.floor(Math.random() * (dungeon.rewards.exp.max - dungeon.rewards.exp.min) + dungeon.rewards.exp.min);
            goldReward += bossGold;
            expReward += bossExp;
        }

        // 특수 효과 적용 (던전 보상 +50%)
        goldReward = applyDungeonRewardBonus(goldReward, user);
        expReward = applyDungeonRewardBonus(expReward, user);

        session.totalGold += goldReward;
        session.totalExp += expReward;

        // 아이템 드롭
        const droppedItems = [];
        for (const item of dungeon.rewards.items) {
            if (Math.random() < item.chance) {
                droppedItems.push(item);
                session.items.push(item);
            }
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 몬스터 처치!')
            .setDescription(`${monster.name}을(를) 처치했습니다!`)
            .setImage(GAME_GIFS.hunting.victory)
            .addFields(
                { name: '💰 획득 골드', value: `+${formatNumber(goldReward)}G`, inline: true },
                { name: '⭐ 획득 경험치', value: `+${formatNumber(expReward)} EXP`, inline: true }
            );

        if (droppedItems.length > 0) {
            embed.addFields({
                name: '🎁 획득 아이템',
                value: droppedItems.map(item => `• ${item.name}`).join('\n'),
                inline: false
            });
        }

        // 던전 클리어 체크
        if (session.currentFloor >= dungeon.floors) {
            // 던전 완료
            return await this.completeDungeon(interaction, session, dungeon);
        }

        // 다음 층으로
        session.currentFloor++;
        session.currentMonster = null;

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`dungeon_next_${session.sessionId}`)
                    .setLabel(`🔼 ${session.currentFloor}층으로 이동`)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`dungeon_rest_${session.sessionId}`)
                    .setLabel('🏕️ 휴식 (HP 회복)')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`dungeon_exit_${session.sessionId}`)
                    .setLabel('🚪 던전 탈출')
                    .setStyle(ButtonStyle.Danger)
            );

        return await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 던전 완료
    async completeDungeon(interaction, session, dungeon) {
        const user = await getUser(session.userId);

        // 최종 보상 지급
        user.gold += session.totalGold;
        user.exp += session.totalExp;

        // 아이템 지급
        if (session.items.length > 0) {
            if (!user.inventory) user.inventory = [];
            session.items.forEach(item => {
                user.inventory.push({
                    id: item.id,
                    name: item.name,
                    quantity: 1,
                    obtainedFrom: dungeon.name
                });
            });
        }

        // 던전 클리어 기록
        if (!user.dungeonClears) user.dungeonClears = {};
        user.dungeonClears[dungeon.id] = (user.dungeonClears[dungeon.id] || 0) + 1;

        // 레벨업 체크
        const requiredExp = user.level * 100;
        if (user.exp >= requiredExp) {
            user.level++;
            user.exp -= requiredExp;
        }

        await user.save();
        this.sessions.delete(session.sessionId);

        const clearTime = Math.floor((Date.now() - session.startTime) / 1000);
        const minutes = Math.floor(clearTime / 60);
        const seconds = clearTime % 60;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 던전 클리어!')
            .setDescription(`${dungeon.emoji} ${dungeon.name}을(를) 완전히 정복했습니다!`)
            .addFields(
                { name: '💰 총 획득 골드', value: `+${formatNumber(session.totalGold)}G`, inline: true },
                { name: '⭐ 총 획득 경험치', value: `+${formatNumber(session.totalExp)} EXP`, inline: true },
                { name: '⏱️ 클리어 시간', value: `${minutes}분 ${seconds}초`, inline: true }
            );

        if (session.items.length > 0) {
            embed.addFields({
                name: '🎁 획득한 아이템',
                value: session.items.map(item => `• ${item.name}`).join('\n'),
                inline: false
            });
        }

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('dungeon_menu')
                    .setLabel('🏰 다른 던전 도전')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 플레이어 패배 처리
    async handlePlayerDefeat(interaction, session, dungeon) {
        const user = await getUser(session.userId);
        
        // 부분 보상 (50%)
        const partialGold = Math.floor(session.totalGold * 0.5);
        const partialExp = Math.floor(session.totalExp * 0.5);

        user.gold += partialGold;
        user.exp += partialExp;

        await user.save();
        this.sessions.delete(session.sessionId);

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('💀 던전 탐험 실패...')
            .setDescription('체력이 다해 던전에서 쓰러졌습니다...')
            .addFields(
                { name: '📊 도달 층수', value: `${session.currentFloor}/${dungeon.floors}층`, inline: true },
                { name: '💰 부분 보상', value: `+${formatNumber(partialGold)}G (50%)`, inline: true },
                { name: '⭐ 부분 경험치', value: `+${formatNumber(partialExp)} EXP (50%)`, inline: true }
            )
            .setFooter({ text: '더 강해져서 다시 도전하세요!' });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('dungeon_menu')
                    .setLabel('🏰 던전 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }

    // HP 바 생성
    createHpBar(current, max) {
        const percentage = Math.floor((current / max) * 10);
        const filled = '█'.repeat(Math.max(0, percentage));
        const empty = '░'.repeat(Math.max(0, 10 - percentage));
        return `[${filled}${empty}] ${Math.floor((current / max) * 100)}%`;
    }

    // 포션 확인
    hasPotion(user) {
        return user.inventory && user.inventory.some(item => 
            (item.id === 'health_potion' || item.name === '체력 포션') && item.quantity > 0
        );
    }

    // 던전 티켓 재생성
    regenerateDungeonTickets(user) {
        const now = Date.now();
        const lastRegen = user.lastDungeonTicketRegen || now;
        const timePassed = now - lastRegen;
        const ticketsToAdd = Math.floor(timePassed / (30 * 60 * 1000)); // 30분당 1장

        if (ticketsToAdd > 0) {
            user.dungeonTickets = Math.min(5, (user.dungeonTickets || 5) + ticketsToAdd);
            user.lastDungeonTicketRegen = now;
        }
    }
}

// 싱글톤 인스턴스
const dungeonSystem = new DungeonSystem();

// 인터랙션 핸들러
async function handleDungeonInteraction(interaction) {
    const customId = interaction.customId;

    if (customId === 'dungeon' || customId === 'dungeon_menu') {
        return await dungeonSystem.showDungeonMenu(interaction);
    }
    else if (customId.startsWith('dungeon_enter_')) {
        const dungeonId = customId.replace('dungeon_enter_', '');
        return await dungeonSystem.enterDungeon(interaction, dungeonId);
    }
    else if (customId.startsWith('dungeon_attack_')) {
        const sessionId = customId.replace('dungeon_attack_', '');
        return await dungeonSystem.performAttack(interaction, sessionId);
    }
    else if (customId.startsWith('dungeon_next_')) {
        const sessionId = customId.replace('dungeon_next_', '');
        return await dungeonSystem.startFloor(interaction, sessionId);
    }
}

module.exports = {
    handleDungeonInteraction,
    dungeonSystem,
    DungeonSystem
};