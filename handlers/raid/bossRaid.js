const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const BOSS_SYSTEM = require('../../data/bossSystem');
const { applyBossRaidBonus, applyExpBonus, applyGoldBonus } = require('../common/specialEffects');
const { calculateCombatPower } = require('../common/utils');
const MissionHelper = require('../../utils/missionHelper');

// 보스 레이드 세션 관리
const bossRaidSessions = new Map();
const raidCooldowns = new Map();

class BossRaidSystem {
    constructor() {
        this.sessions = bossRaidSessions;
        this.cooldowns = raidCooldowns;
    }

    // 보스 레이드 메인 메뉴
    async showBossRaidMenu(interaction) {
        try {
            // defer 처리
            if (!interaction.deferred && !interaction.replied) {
                if (interaction.isButton()) {
                    await interaction.deferUpdate();
                } else {
                    await interaction.deferReply();
                }
            }
            
            const user = await getUser(interaction.user.id);
            if (!user || !user.registered) {
                return await interaction.editReply({ 
                    content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
                    embeds: [],
                    components: []
                });
            }
            
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('👹 보스 레이드')
                .setDescription('보스 레이드 관련 메뉴입니다.')
                .addFields(
                    { 
                        name: '🪙 보스 토큰', 
                        value: user.bossTokens && user.bossTokens.size > 0 
                            ? `${user.bossTokens.size}종류 보유` 
                            : '보유한 토큰이 없습니다',
                        inline: false 
                    }
                )
                .setFooter({ text: '보스는 1시간마다 자동 소환됩니다!' })
                .setTimestamp();

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('boss_token_shop')
                        .setLabel('💎 장신구 상점')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💍'),
                    new ButtonBuilder()
                        .setCustomId('boss_raid_ranking')
                        .setLabel('🏆 레이드 랭킹')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('main_menu')
                        .setLabel('🏠 메인 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );

            return await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });
        } catch (error) {
            console.error('[Boss Raid] Menu error:', error);
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({ 
                    content: '❌ 보스 레이드 메뉴를 표시하는 중 오류가 발생했습니다.', 
                    flags: 64 
                });
            }
        }
    }

    // 보스 도전
    async challengeBoss(interaction, bossId) {
        // 현재 사용하지 않음
        return;
    }

    // 전투 처리 (월드 보스에서만 사용)
    async processBattle(interaction, sessionId, action) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return await interaction.reply({
                content: '❌ 전투 세션을 찾을 수 없습니다!',
                flags: 64
            });
        }

        const user = await getUser(session.userId);
        const boss = BOSS_SYSTEM.bosses.find(b => b.id === session.bossId);

        if (action === 'flee') {
            this.sessions.delete(sessionId);
            return await interaction.update({
                content: '🏃 보스 레이드에서 도망쳤습니다.',
                embeds: [],
                components: []
            });
        }

        // 플레이어 공격
        let damage = 0;
        if (action === 'attack') {
            damage = Math.floor(Math.random() * 200) + 100;
        } else if (action === 'skill') {
            damage = Math.floor(Math.random() * 400) + 200;
            user.mp = Math.max(0, (user.mp || 100) - 50);
        }

        damage = applyBossRaidBonus(damage, user);
        session.bossHp -= damage;
        session.totalDamage += damage;

        // 보스 공격
        const bossDamage = Math.floor(Math.random() * boss.attack) + boss.attack / 2;
        if (action !== 'defend') {
            session.userHp -= bossDamage;
        } else {
            session.userHp -= Math.floor(bossDamage * 0.3);
        }

        // 승리 체크
        if (session.bossHp <= 0) {
            return await this.handleVictory(interaction, session, user, boss);
        }

        // 패배 체크
        if (session.userHp <= 0) {
            return await this.handleDefeat(interaction, session, user);
        }

        // 전투 계속
        const battleEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`⚔️ ${boss.emoji} ${boss.name} 레이드`)
            .setDescription(`${action === 'attack' ? '일반 공격' : action === 'skill' ? '스킬 공격' : '방어'}으로 ${damage} 데미지를 입혔습니다!`)
            .addFields(
                { 
                    name: '👹 보스 정보', 
                    value: `HP: ${formatNumber(Math.max(0, session.bossHp))}/${formatNumber(boss.hp)}\n공격력: ${boss.attack}\n방어력: ${boss.defense}`, 
                    inline: true 
                },
                { 
                    name: '🛡️ 플레이어 정보', 
                    value: `HP: ${session.userHp}/${session.userMaxHp}\nMP: ${user.mp || 100}/100`, 
                    inline: true 
                }
            );

        const battleButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`boss_attack_${sessionId}`)
                    .setLabel('⚔️ 일반 공격')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`boss_skill_${sessionId}`)
                    .setLabel('💥 스킬 (MP 50)')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(user.mp < 50),
                new ButtonBuilder()
                    .setCustomId(`boss_defend_${sessionId}`)
                    .setLabel('🛡️ 방어')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`boss_flee_${sessionId}`)
                    .setLabel('🏃 도망')
                    .setStyle(ButtonStyle.Danger)
            );

        return await interaction.update({
            embeds: [battleEmbed],
            components: [battleButtons]
        });
    }

    // 승리 처리
    async handleVictory(interaction, session, user, boss) {
        this.sessions.delete(session.sessionId);
        
        // 쿨타임 설정 (30분)
        this.cooldowns.set(user.discordId, Date.now() + (30 * 60 * 1000));

        // 보상 계산
        let goldReward = boss.rewards.gold;
        let expReward = boss.rewards.exp;
        
        // 특수 효과 적용
        console.log(`[BossRaid] ${user.nickname || user.discordId} - 특수 효과 적용 전 골드: ${goldReward}, 경험치: ${expReward}`);
        goldReward = applyGoldBonus(goldReward, user);
        expReward = applyExpBonus(expReward, user);
        console.log(`[BossRaid] ${user.nickname || user.discordId} - 특수 효과 적용 후 골드: ${goldReward}, 경험치: ${expReward}`);

        user.gold += goldReward;
        user.exp += expReward;
        
        // 골드 획득 미션 업데이트
        await MissionHelper.updateGoldEarned(user.discordId, goldReward);

        // 조각 드롭 계산
        const BOSS_FRAGMENTS = require('../../data/bossFragments');
        const fragmentDrops = BOSS_FRAGMENTS.calculateFragmentDrops(boss.id);
        
        // 조각 인벤토리에 추가
        for (const fragment of fragmentDrops) {
            const currentAmount = user.bossFragments.get(fragment.id) || 0;
            user.bossFragments.set(fragment.id, currentAmount + fragment.amount);
        }

        // 레벨업 체크
        const requiredExp = user.level * 100;
        if (user.exp >= requiredExp) {
            user.level++;
            user.exp -= requiredExp;
        }

        // 레이드 통계 업데이트
        if (!user.raidStats) {
            user.raidStats = {
                totalRaids: 0,
                victories: 0,
                defeats: 0,
                totalDamageDealt: 0
            };
        }
        
        user.raidStats.totalRaids++;
        user.raidStats.victories++;
        user.raidStats.totalDamageDealt += session.totalDamage;

        await user.save();

        const victoryEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 레이드 승리!')
            .setDescription(`${boss.emoji} ${boss.name}을(를) 처치했습니다!`)
            .addFields(
                { name: '💰 골드 획득', value: `+${formatNumber(goldReward)}G`, inline: true },
                { name: '⭐ 경험치 획득', value: `+${formatNumber(expReward)} EXP`, inline: true },
                { name: '💥 총 데미지', value: formatNumber(session.totalDamage), inline: true }
            );

        // 조각 드롭 표시
        if (fragmentDrops.length > 0) {
            const fragmentText = fragmentDrops.map(f => 
                `${f.emoji} ${f.name} x${f.amount}`
            ).join('\n');
            
            victoryEmbed.addFields({
                name: '💎 획득한 조각',
                value: fragmentText,
                inline: false
            });
        }

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('boss_raid_menu')
                    .setLabel('🔄 다른 보스 도전')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('fragment_exchange')
                    .setLabel('💎 조각 교환소')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.update({
            embeds: [victoryEmbed],
            components: [buttons]
        });
    }

    // 패배 처리
    async handleDefeat(interaction, session, user) {
        this.sessions.delete(session.sessionId);
        
        // 쿨타임 설정 (15분)
        this.cooldowns.set(user.discordId, Date.now() + (15 * 60 * 1000));

        // 레이드 통계 업데이트
        if (!user.raidStats) {
            user.raidStats = {
                totalRaids: 0,
                victories: 0,
                defeats: 0,
                totalDamageDealt: 0
            };
        }
        
        user.raidStats.totalRaids++;
        user.raidStats.defeats++;
        user.raidStats.totalDamageDealt += session.totalDamage;

        await user.save();

        const defeatEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('💀 레이드 실패...')
            .setDescription('보스에게 패배했습니다.')
            .addFields(
                { name: '💥 총 데미지', value: formatNumber(session.totalDamage), inline: true },
                { name: '⏰ 쿨타임', value: '15분', inline: true }
            );

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('boss_raid_menu')
                    .setLabel('🔄 보스 레이드 메뉴')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.update({
            embeds: [defeatEmbed],
            components: [buttons]
        });
    }

    // 랭킹 표시
    async showRanking(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }

            // 다양한 랭킹 데이터 가져오기
            const [victoryRanking, damageRanking, tokenRanking] = await Promise.all([
                // 승리 횟수 랭킹
                User.find({ 'raidStats.victories': { $gt: 0 } })
                    .sort({ 'raidStats.victories': -1 })
                    .limit(5)
                    .select('nickname raidStats.victories raidStats.totalRaids'),
                
                // 총 데미지 랭킹
                User.find({ 'raidStats.totalDamageDealt': { $gt: 0 } })
                    .sort({ 'raidStats.totalDamageDealt': -1 })
                    .limit(5)
                    .select('nickname raidStats.totalDamageDealt'),
                
                // 토큰 보유량 랭킹
                User.aggregate([
                    { $match: { bossTokens: { $exists: true, $ne: {} } } },
                    { 
                        $project: {
                            nickname: 1,
                            totalTokens: {
                                $sum: {
                                    $map: {
                                        input: { $objectToArray: "$bossTokens" },
                                        as: "token",
                                        in: "$$token.v"
                                    }
                                }
                            }
                        }
                    },
                    { $sort: { totalTokens: -1 } },
                    { $limit: 5 }
                ])
            ]);

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 보스 레이드 랭킹')
                .setDescription('다양한 부문의 상위 랭커들')
                .setTimestamp();

            // 승리 횟수 랭킹
            if (victoryRanking.length > 0) {
                const victoryText = victoryRanking.map((player, index) => {
                    const winRate = player.raidStats.totalRaids > 0 
                        ? Math.round((player.raidStats.victories / player.raidStats.totalRaids) * 100) 
                        : 0;
                    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                    return `${medals[index]} ${player.nickname || 'Unknown'}\n   ${player.raidStats.victories}승 (승률 ${winRate}%)`;
                }).join('\n');
                
                embed.addFields({
                    name: '⚔️ 승리 횟수 TOP 5',
                    value: victoryText || '데이터 없음',
                    inline: true
                });
            }

            // 총 데미지 랭킹
            if (damageRanking.length > 0) {
                const damageText = damageRanking.map((player, index) => {
                    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                    const damage = player.raidStats.totalDamageDealt || 0;
                    return `${medals[index]} ${player.nickname || 'Unknown'}\n   ${damage.toLocaleString()} 데미지`;
                }).join('\n');
                
                embed.addFields({
                    name: '💥 총 데미지 TOP 5',
                    value: damageText || '데이터 없음',
                    inline: true
                });
            }

            // 토큰 보유량 랭킹
            if (tokenRanking.length > 0) {
                const tokenText = tokenRanking.map((player, index) => {
                    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                    return `${medals[index]} ${player.nickname || 'Unknown'}\n   ${player.totalTokens || 0}개 보유`;
                }).join('\n');
                
                embed.addFields({
                    name: '🪙 토큰 부자 TOP 5',
                    value: tokenText || '데이터 없음',
                    inline: true
                });
            }

            // 사용자 본인의 순위 표시
            const userId = interaction.user.id;
            const user = await User.findOne({ discordId: userId });
            
            if (user && user.raidStats && user.raidStats.totalRaids > 0) {
                const myRank = await User.countDocuments({
                    'raidStats.victories': { $gt: user.raidStats.victories }
                }) + 1;

                const winRate = Math.round((user.raidStats.victories / user.raidStats.totalRaids) * 100);
                
                embed.addFields({
                    name: '📊 내 순위',
                    value: `전체 ${myRank}위\n` +
                           `승리: ${user.raidStats.victories}회 (승률 ${winRate}%)\n` +
                           `총 데미지: ${(user.raidStats.totalDamageDealt || 0).toLocaleString()}`,
                    inline: false
                });
            }

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('boss_raid_menu')
                        .setLabel('🔙 돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                );

            return await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });
        } catch (error) {
            console.error('[Boss Raid] Ranking error:', error);
            return await interaction.editReply({
                content: '❌ 랭킹을 불러오는 중 오류가 발생했습니다.',
                embeds: [],
                components: []
            });
        }
    }
}

// 싱글톤 인스턴스
const bossRaidSystem = new BossRaidSystem();

// 인터랙션 핸들러
async function handleBossRaidInteraction(interaction) {
    const customId = interaction.customId;

    if (customId === 'boss_raid' || customId === 'boss_raid_menu') {
        return await bossRaidSystem.showBossRaidMenu(interaction);
    }
    else if (customId.startsWith('boss_challenge_')) {
        const bossId = customId.replace('boss_challenge_', '');
        return await bossRaidSystem.challengeBoss(interaction, bossId);
    }
    else if (customId.startsWith('boss_attack_') || customId.startsWith('boss_skill_') || 
             customId.startsWith('boss_defend_') || customId.startsWith('boss_flee_')) {
        const parts = customId.split('_');
        const action = parts[1];
        const sessionId = parts.slice(2).join('_');
        return await bossRaidSystem.processBattle(interaction, sessionId, action);
    }
    else if (customId === 'boss_raid_ranking') {
        return await bossRaidSystem.showRanking(interaction);
    }
    else if (customId === 'boss_token_shop') {
        const { showAccessoryShopMenu } = require('./bossAccessoryShop');
        return await showAccessoryShopMenu(interaction);
    }
}

module.exports = {
    handleBossRaidInteraction,
    BossRaidSystem: bossRaidSystem
};