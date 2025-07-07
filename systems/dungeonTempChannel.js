// 던전 탐험 임시 채널 시스템
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 던전 크롤러 설정
const DUNGEON_CRAWLER = {
    maxFloor: 50,
    floors: {
        1: {
            monsters: [
                { name: '슬라임', emoji: '🟢', hp: 20, attack: 5, defense: 2, gold: 10 },
                { name: '고블린', emoji: '👺', hp: 25, attack: 7, defense: 3, gold: 15 }
            ],
            boss: { name: '대왕 슬라임', emoji: '🟩', hp: 50, attack: 10, defense: 5, gold: 50 },
            bossChance: 0.1
        },
        5: {
            monsters: [
                { name: '스켈레톤', emoji: '💀', hp: 40, attack: 12, defense: 5, gold: 25 },
                { name: '좀비', emoji: '🧟', hp: 50, attack: 10, defense: 7, gold: 30 }
            ],
            boss: { name: '리치', emoji: '🧙‍♂️', hp: 100, attack: 20, defense: 10, gold: 100 },
            bossChance: 0.15
        },
        10: {
            monsters: [
                { name: '오크', emoji: '👹', hp: 80, attack: 20, defense: 10, gold: 50 },
                { name: '트롤', emoji: '🧌', hp: 100, attack: 18, defense: 12, gold: 60 }
            ],
            boss: { name: '오크 족장', emoji: '👺', hp: 200, attack: 35, defense: 20, gold: 200 },
            bossChance: 0.2
        },
        20: {
            monsters: [
                { name: '미노타우로스', emoji: '🐂', hp: 150, attack: 35, defense: 20, gold: 100 },
                { name: '하피', emoji: '🦅', hp: 120, attack: 40, defense: 15, gold: 90 }
            ],
            boss: { name: '히드라', emoji: '🐉', hp: 400, attack: 60, defense: 30, gold: 500 },
            bossChance: 0.25
        },
        30: {
            monsters: [
                { name: '데몬', emoji: '😈', hp: 250, attack: 55, defense: 30, gold: 200 },
                { name: '발키리', emoji: '⚔️', hp: 220, attack: 60, defense: 25, gold: 180 }
            ],
            boss: { name: '데몬 로드', emoji: '👿', hp: 800, attack: 100, defense: 50, gold: 1000 },
            bossChance: 0.3
        },
        40: {
            monsters: [
                { name: '엘더 드래곤', emoji: '🐲', hp: 400, attack: 80, defense: 45, gold: 350 },
                { name: '피닉스', emoji: '🔥', hp: 350, attack: 90, defense: 40, gold: 400 }
            ],
            boss: { name: '고대의 용', emoji: '🌟', hp: 1500, attack: 150, defense: 80, gold: 2000 },
            bossChance: 0.35
        },
        50: {
            monsters: [
                { name: '타이탄', emoji: '⛰️', hp: 600, attack: 120, defense: 70, gold: 500 }
            ],
            boss: { name: '최종 보스 - 카오스', emoji: '🌌', hp: 3000, attack: 250, defense: 150, gold: 5000 },
            bossChance: 1.0 // 50층은 무조건 보스
        }
    },
    items: {
        'heal_potion': { name: '체력 포션', emoji: '🧪', effect: 'heal', value: 50 },
        'attack_boost': { name: '공격력 증진제', emoji: '⚔️', effect: 'attack', value: 10 },
        'defense_boost': { name: '방어력 증진제', emoji: '🛡️', effect: 'defense', value: 5 },
        'full_heal': { name: '완전 회복 포션', emoji: '💚', effect: 'fullheal', value: 0 }
    }
};

// 던전 층 데이터 가져오기 (중간층 처리)
function getFloorData(floor) {
    // 정의된 층 찾기
    const definedFloors = Object.keys(DUNGEON_CRAWLER.floors).map(Number).sort((a, b) => a - b);
    let selectedFloor = 1;
    
    for (const f of definedFloors) {
        if (floor >= f) {
            selectedFloor = f;
        } else {
            break;
        }
    }
    
    return DUNGEON_CRAWLER.floors[selectedFloor];
}

// 던전 층 시작
async function startDungeonFloorTemp(channel, session, floor, getUser) {
    const floorData = getFloorData(floor);
    const isLastFloor = floor === DUNGEON_CRAWLER.maxFloor;
    
    // 랜덤 몬스터 선택
    const monster = floorData.monsters[Math.floor(Math.random() * floorData.monsters.length)];
    
    // 보스 출현 확률
    const isBoss = Math.random() < floorData.bossChance;
    const currentMonster = isBoss ? floorData.boss : monster;
    
    // 몬스터 HP 계산
    const monsterHp = isBoss 
        ? Math.floor(currentMonster.hp * (1 + (floor - 1) * 0.2))
        : currentMonster.hp;
    
    // 아이템 발견 확률
    const foundItem = Math.random() < 0.3;
    if (foundItem) {
        const itemKeys = Object.keys(DUNGEON_CRAWLER.items);
        const randomItem = itemKeys[Math.floor(Math.random() * itemKeys.length)];
        session.inventory.push(randomItem);
    }
    
    const floorEmbed = new EmbedBuilder()
        .setColor(isBoss ? '#FF0000' : '#8B4513')
        .setTitle(`🏰 던전 ${floor}층`)
        .setDescription(isBoss ? '⚠️ **보스가 나타났습니다!**' : `${currentMonster.emoji} ${currentMonster.name}이(가) 나타났습니다!`)
        .addFields(
            { name: '👤 당신의 상태', value: `HP: ${session.hp}/${session.maxHp}\n⚔️ 공격력: ${session.attack}\n🛡️ 방어력: ${session.defense}`, inline: true },
            { name: '👾 몬스터 상태', value: `HP: ${monsterHp}\n⚔️ 공격력: ${currentMonster.attack}\n🛡️ 방어력: ${currentMonster.defense}`, inline: true },
            { name: '🎒 인벤토리', value: session.inventory.length > 0 ? `${session.inventory.length}개 아이템 보유` : '비어있음', inline: true }
        );
    
    if (foundItem) {
        floorEmbed.addFields({ name: '🎁 아이템 발견!', value: '새로운 아이템을 발견했습니다!', inline: false });
    }
    
    const actionButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('dungeon_fight_temp')
                .setLabel('⚔️ 전투')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('dungeon_item_temp')
                .setLabel('🎒 아이템 사용')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(session.inventory.length === 0),
            new ButtonBuilder()
                .setCustomId('dungeon_run_temp')
                .setLabel('🏃 도망')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(isBoss),
            new ButtonBuilder()
                .setCustomId('dungeon_escape_temp')
                .setLabel('🚪 탈출')
                .setStyle(ButtonStyle.Secondary)
        );
    
    // 현재 몬스터 정보를 세션에 저장
    session.currentMonster = {
        ...currentMonster,
        hp: monsterHp,
        maxHp: monsterHp,
        isBoss: isBoss
    };
    
    await channel.send({ embeds: [floorEmbed], components: [actionButtons] });
}

// 던전 전투 실행
async function executeDungeonBattleTemp(channel, session, getUser) {
    const monster = session.currentMonster;
    if (!monster) return;
    
    // 플레이어 공격
    const playerDamage = Math.max(1, session.attack - monster.defense + Math.floor(Math.random() * 10));
    monster.hp -= playerDamage;
    
    let battleResult = `⚔️ ${playerDamage}의 피해를 입혔습니다!\n`;
    
    if (monster.hp <= 0) {
        // 몬스터 처치
        session.monstersDefeated++;
        const goldEarned = Math.floor(monster.gold * (1 + (session.floor - 1) * 0.5));
        session.goldEarned += goldEarned;
        
        if (monster.isBoss) {
            const user = await getUser(session.userId);
            user.dungeonStats.bossKills++;
            await user.save();
        }
        
        const victoryEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 전투 승리!')
            .setDescription(`${monster.emoji} ${monster.name}을(를) 처치했습니다!`)
            .addFields(
                { name: '💰 획득 골드', value: `${goldEarned.toLocaleString()}G`, inline: true },
                { name: '📊 현재 상태', value: `HP: ${session.hp}/${session.maxHp}`, inline: true }
            );
        
        const continueButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('dungeon_next_temp')
                    .setLabel(session.floor === DUNGEON_CRAWLER.maxFloor ? '🏆 클리어!' : '⬆️ 다음 층')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('dungeon_escape_temp')
                    .setLabel('🚪 탈출')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await channel.send({ embeds: [victoryEmbed], components: [continueButtons] });
    } else {
        // 몬스터 반격
        const monsterDamage = Math.max(1, monster.attack - session.defense + Math.floor(Math.random() * 10));
        session.hp -= monsterDamage;
        battleResult += `❌ ${monsterDamage}의 피해를 받았습니다!`;
        
        if (session.hp <= 0) {
            // 플레이어 사망
            await endDungeonRunTemp(channel, session, false, getUser);
        } else {
            // 전투 계속
            const battleEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚔️ 전투 중!')
                .setDescription(battleResult)
                .addFields(
                    { name: '👤 당신의 상태', value: `HP: ${session.hp}/${session.maxHp}`, inline: true },
                    { name: '👾 몬스터 상태', value: `HP: ${monster.hp}/${monster.maxHp}`, inline: true }
                );
            
            await channel.send({ embeds: [battleEmbed] });
            
            // 1초 후 다시 전투 화면 표시
            setTimeout(() => startDungeonFloorTemp(channel, session, session.floor, getUser), 1000);
        }
    }
}

// 던전 종료
async function endDungeonRunTemp(channel, session, survived, getUser, deleteTempChannel) {
    const user = await getUser(session.userId);
    if (!user) return;
    
    // 통계 업데이트
    user.dungeonStats.totalRuns++;
    user.dungeonStats.totalGoldEarned += session.goldEarned;
    user.dungeonStats.itemsFound += session.inventory.length;
    user.dungeonStats.lastRun = new Date();
    
    if (session.floor - 1 > user.dungeonStats.maxFloor) {
        user.dungeonStats.maxFloor = session.floor - 1;
    }
    
    if (!survived) {
        user.dungeonStats.totalDeaths++;
        session.goldEarned = Math.floor(session.goldEarned * 0.5); // 사망 시 50%만 획득
    }
    
    // 골드 지급
    user.gold += session.goldEarned;
    await user.save();
    
    const resultEmbed = new EmbedBuilder()
        .setColor(survived ? '#00FF00' : '#FF0000')
        .setTitle(survived ? '🏆 던전 탐험 완료!' : '💀 던전에서 쓰러졌습니다...')
        .setDescription(survived 
            ? `${session.floor - 1}층까지 클리어했습니다!`
            : `${session.floor}층에서 쓰러졌습니다...`)
        .addFields(
            { name: '💰 획득 골드', value: `${session.goldEarned.toLocaleString()}G`, inline: true },
            { name: '⚔️ 처치한 몬스터', value: `${session.monstersDefeated}마리`, inline: true },
            { name: '🎒 발견한 아이템', value: `${session.inventory.length}개`, inline: true }
        )
        .setFooter({ text: '5초 후 채널이 삭제됩니다.' });
    
    const restartButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('dungeon_restart')
                .setLabel('🔄 다시 도전')
                .setStyle(ButtonStyle.Primary)
        );
    
    await channel.send({ embeds: [resultEmbed], components: [restartButton] });
    
    // 세션 정리
    const dungeonSessions = global.dungeonSessions || new Map();
    dungeonSessions.delete(session.userId);
    
    // 5초 후 채널 삭제
    setTimeout(async () => {
        await deleteTempChannel(channel.id);
    }, 5000);
}

module.exports = {
    DUNGEON_CRAWLER,
    startDungeonFloorTemp,
    executeDungeonBattleTemp,
    endDungeonRunTemp
};