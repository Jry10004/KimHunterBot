const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const MissionHelper = require('../../utils/missionHelper');

// 에너지 조각 시스템 상수
const ENERGY_FRAGMENT_SYSTEM = {
    MINE_COST: 10000, // 10,000골드로 변경
    MINE_COOLDOWN: 5000, // 5초 (테스트 기간)
    DAILY_FUSION_LIMIT: 20,
    FUSION_REQUIRED: 2, // 3개에서 2개로 변경
    ATTACK_BONUS_PER_LEVEL: 1, // 레벨당 공격력 +1
    SUCCESS_RATES: {
        '1-25': 95,
        '26-50': 75,
        '51-75': 55,
        '76-99': 35,
        '99-100': 10
    },
    TIER_NAMES: {
        '1-10': { name: '기초 에너지 조각', emoji: '🔸' },
        '11-25': { name: '마법 에너지 조각', emoji: '💠' },
        '26-50': { name: '크리스탈 에너지 조각', emoji: '💎' },
        '51-75': { name: '별빛 에너지 조각', emoji: '⭐' },
        '76-99': { name: '창조 에너지 조각', emoji: '🌌' },
        '100': { name: '완전한 에너지 코어', emoji: '🌟' }
    },
    FAILURE_STACK_CHANCE: 50,
    FAILURE_STACK_REQUIRED: 20,
    CRITICAL_FAIL_CHANCE: 10,
    FAIL_DROP: { min: 3, max: 10 }
};

// 조각 티어 가져오기
function getFragmentTier(level) {
    if (level >= 1 && level <= 10) return '1-10';
    if (level >= 11 && level <= 25) return '11-25';
    if (level >= 26 && level <= 50) return '26-50';
    if (level >= 51 && level <= 75) return '51-75';
    if (level >= 76 && level <= 99) return '76-99';
    if (level === 100) return '100';
    return null;
}

// 조각 정보 가져오기
function getFragmentInfo(tier) {
    return ENERGY_FRAGMENT_SYSTEM.TIER_NAMES[tier] || { name: '알 수 없는 조각', emoji: '❓' };
}

// 융합 성공률 가져오기
function getFusionSuccessRate(level) {
    if (level >= 1 && level <= 25) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['1-25'];
    if (level >= 26 && level <= 50) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['26-50'];
    if (level >= 51 && level <= 75) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['51-75'];
    if (level >= 76 && level <= 99) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['76-99'];
    if (level === 99) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['99-100'];
    return 0;
}

// 에너지 조각 메인 메뉴
async function showFragmentMenu(interaction) {
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
            flags: 64 
        });
    }

    // 일일 융합 초기화
    const today = new Date().toDateString();
    if (!user.energyFragments) {
        user.energyFragments = {
            fragments: new Map(),
            dailyFusions: 0,
            dailyFusionDate: today,
            failureStack: 0,
            lastMine: 0
        };
    }
    
    if (user.energyFragments.dailyFusionDate !== today) {
        user.energyFragments.dailyFusions = 0;
        user.energyFragments.dailyFusionDate = today;
        await user.save();
    }

    const fragments = user.energyFragments?.fragments || new Map();
    let fragmentText = '';
    let totalFragments = 0;
    let totalAttackBonus = 0;

    const sortedFragments = Array.from(fragments.entries()).sort((a, b) => a[0] - b[0]);
    
    if (sortedFragments.length === 0) {
        fragmentText = '보유한 조각이 없습니다.\n채굴을 통해 조각을 획득하세요!';
    } else {
        for (const [level, count] of sortedFragments) {
            if (count > 0) {
                const tier = getFragmentTier(level);
                const info = getFragmentInfo(tier);
                const attackBonus = parseInt(level) * ENERGY_FRAGMENT_SYSTEM.ATTACK_BONUS_PER_LEVEL * count;
                fragmentText += `${info.emoji} Lv.${level} - ${count}개 (공격력 +${attackBonus})\n`;
                totalFragments += count;
                totalAttackBonus += attackBonus;
            }
        }
    }

    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('💎 에너지 조각 시스템')
        .setDescription('2개의 같은 레벨 조각을 융합하여 다음 레벨 조각을 만드세요!\n레벨이 오를수록 공격력이 증가합니다! (+1/레벨)')
        .addFields(
            { name: '📊 보유 조각', value: fragmentText.trim() || '없음', inline: false },
            { name: '💎 총 조각', value: `${totalFragments}개`, inline: true },
            { name: '⚔️ 총 공격력 보너스', value: `+${totalAttackBonus}`, inline: true },
            { name: '🔄 일일 융합', value: `${user.energyFragments?.dailyFusions || 0}/${ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT}회`, inline: true },
            { name: '📈 실패 스택', value: `${user.energyFragments?.failureStack || 0}/20`, inline: true }
        )
        .setFooter({ text: '💡 Lv.100 조각은 특별한 아이템으로 교환할 수 있습니다!' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_mine')
                .setLabel('⛏️ 채굴하기')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('fragment_fusion')
                .setLabel('🔄 융합하기')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('fragment_exchange')
                .setLabel('🎁 교환소')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('fragment_ranking')
                .setLabel('🏆 랭킹')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    // interaction이 이미 응답된 경우 update 사용
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    // 드롭다운 메뉴에서 선택한 경우 update 사용
    if (interaction.isStringSelectMenu()) {
        return await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    return await interaction.reply({
        embeds: [embed],
        components: [buttons],
        flags: 64
    });
}

// 채굴 실행
async function executeFragmentMining(interaction) {
    const user = await getUser(interaction.user.id);
    
    // 쿨타임 체크
    const now = Date.now();
    const lastMine = user.energyFragments?.lastMine || 0;
    const timeSinceLastMine = now - lastMine;
    
    if (timeSinceLastMine < ENERGY_FRAGMENT_SYSTEM.MINE_COOLDOWN) {
        const cooldownRemaining = ENERGY_FRAGMENT_SYSTEM.MINE_COOLDOWN - timeSinceLastMine;
        const remainingSeconds = Math.ceil(cooldownRemaining / 1000);
        return await interaction.reply({ 
            content: `⏰ 채굴 쿨타임이 ${remainingSeconds}초 남았습니다!`, 
            flags: 64 
        });
    }
    
    // 골드 체크
    if (user.gold < ENERGY_FRAGMENT_SYSTEM.MINE_COST) {
        return await interaction.reply({ 
            content: `💸 골드가 부족합니다! 필요: ${ENERGY_FRAGMENT_SYSTEM.MINE_COST}G, 보유: ${user.gold}G`, 
            flags: 64 
        });
    }
    
    // 채굴 실행
    const mineResult = Math.random() * 100;
    let minedFragments = 0;
    let bonusFragments = 0;
    
    if (mineResult < 70) {
        minedFragments = 1; // 70% 확률로 1개
    } else if (mineResult < 95) {
        minedFragments = 2; // 25% 확률로 2개
    } else {
        minedFragments = 3; // 5% 확률로 3개
        bonusFragments = Math.floor(Math.random() * 3) + 1; // 보너스 1-3개
    }
    
    const totalMined = minedFragments + bonusFragments;
    
    // 데이터 업데이트
    await User.updateOne(
        { discordId: interaction.user.id },
        {
            $inc: { 
                gold: -ENERGY_FRAGMENT_SYSTEM.MINE_COST,
                [`energyFragments.fragments.1`]: totalMined,
                'energyFragments.totalMined': totalMined
            },
            $set: { 'energyFragments.lastMine': now }
        }
    );
    
    // 미션 진행도 업데이트
    await MissionHelper.updateEnergyMining(interaction.user.id);
    
    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('⛏️ 채굴 성공!')
        .setDescription(`${totalMined}개의 Lv.1 에너지 조각을 채굴했습니다!`)
        .addFields(
            { name: '💎 채굴량', value: `${minedFragments}개${bonusFragments > 0 ? ` (+${bonusFragments} 보너스!)` : ''}`, inline: true },
            { name: '💰 사용 골드', value: `${ENERGY_FRAGMENT_SYSTEM.MINE_COST}G`, inline: true },
            { name: '⏱️ 다음 채굴', value: '5초 후', inline: true }
        );
    
    if (bonusFragments > 0) {
        embed.setColor('#f1c40f')
            .setFooter({ text: '🎉 대박! 보너스 조각을 발견했습니다!' });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_menu')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.reply({
        embeds: [embed],
        components: [buttons],
        flags: 64
    });
}

// 자동 융합 실행
async function executeAutoFusion(interaction) {
    const user = await getUser(interaction.user.id);
    
    // 융합권 체크
    const hasTicket = false; // 실제 구현시 융합권 체크 로직 추가
    
    if (!hasTicket && user.energyFragments.dailyFusions >= ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT) {
        return await interaction.reply({ 
            content: `🚫 오늘의 융합 횟수를 모두 사용했습니다! (${ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT}/20회)\n💡 내일 다시 시도하거나 융합권을 사용하세요!`, 
            flags: 64 
        });
    }
    
    // 융합 가능한 조각 찾기
    const fragments = new Map(user.energyFragments?.fragments || []);
    const fusionResults = [];
    let fusionsPerformed = 0;
    
    // 레벨별로 융합 시도
    for (let level = 1; level < 100; level++) {
        let count = fragments.get(String(level)) || 0;
        
        while (count >= ENERGY_FRAGMENT_SYSTEM.FUSION_REQUIRED && (!hasTicket && user.energyFragments.dailyFusions + fusionsPerformed < ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT)) {
            fusionsPerformed++;
            
            // 융합 시도
            const successRate = getFusionSuccessRate(level);
            const guaranteedSuccess = user.energyFragments.failureStack >= ENERGY_FRAGMENT_SYSTEM.FAILURE_STACK_REQUIRED;
            const success = guaranteedSuccess || (Math.random() * 100 < successRate);
            
            if (success) {
                // 성공
                await User.updateOne(
                    { discordId: interaction.user.id },
                    {
                        $inc: {
                            [`energyFragments.fragments.${level}`]: -ENERGY_FRAGMENT_SYSTEM.FUSION_REQUIRED,
                            [`energyFragments.fragments.${level + 1}`]: 1,
                            'energyFragments.successfulFusions': 1
                        },
                        $set: { 'energyFragments.failureStack': 0 }
                    }
                );
                
                fusionResults.push({
                    level,
                    success: true,
                    message: `✅ Lv.${level} → Lv.${level + 1} 융합 성공!`
                });
                
                // count 감소
                count -= ENERGY_FRAGMENT_SYSTEM.FUSION_REQUIRED;
            } else {
                // 실패
                const criticalFail = Math.random() * 100 < ENERGY_FRAGMENT_SYSTEM.CRITICAL_FAIL_CHANCE;
                let lostFragments = ENERGY_FRAGMENT_SYSTEM.FUSION_REQUIRED;
                
                if (criticalFail) {
                    const extraLoss = Math.floor(Math.random() * 
                        (ENERGY_FRAGMENT_SYSTEM.FAIL_DROP.max - ENERGY_FRAGMENT_SYSTEM.FAIL_DROP.min + 1)) + 
                        ENERGY_FRAGMENT_SYSTEM.FAIL_DROP.min;
                    lostFragments += extraLoss;
                }
                
                // 실패 스택 증가
                let stackIncrease = 0;
                if (Math.random() * 100 < ENERGY_FRAGMENT_SYSTEM.FAILURE_STACK_CHANCE) {
                    stackIncrease = 1;
                }
                
                await User.updateOne(
                    { discordId: interaction.user.id },
                    {
                        $inc: {
                            [`energyFragments.fragments.${level}`]: -lostFragments,
                            'energyFragments.failureStack': stackIncrease
                        }
                    }
                );
                
                fusionResults.push({
                    level,
                    success: false,
                    criticalFail,
                    message: criticalFail ? 
                        `💥 Lv.${level} 융합 대실패! (${lostFragments}개 소멸)` :
                        `❌ Lv.${level} 융합 실패 (${ENERGY_FRAGMENT_SYSTEM.FUSION_REQUIRED}개 소멸)`
                });
                
                // count 감소
                count -= lostFragments;
                if (count < 0) count = 0;
            }
        }
    }
    
    // 일일 융합 횟수 증가
    await User.updateOne(
        { discordId: interaction.user.id },
        { $inc: { 'energyFragments.dailyFusions': fusionsPerformed } }
    );
    
    // 결과 표시
    if (fusionResults.length === 0) {
        return await interaction.reply({ 
            content: '🚫 융합 가능한 조각이 없습니다! (3개 이상 필요)', 
            flags: 64 
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🔄 자동 융합 결과')
        .setDescription(`총 ${fusionsPerformed}회 융합을 시도했습니다.`)
        .addFields(
            { 
                name: '📊 융합 결과', 
                value: fusionResults.slice(0, 10).map(r => r.message).join('\n') + 
                    (fusionResults.length > 10 ? `\n... 그리고 ${fusionResults.length - 10}개 더` : ''),
                inline: false 
            }
        )
        .setFooter({ text: `남은 일일 융합: ${ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT - user.energyFragments.dailyFusions - fusionsPerformed}회` });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_fusion')
                .setLabel('🔄 다시 융합')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('fragment_menu')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    // 공개 메시지 생성 (성공/실패에 따라 다른 메시지)
    let publicMessage = '';
    const successCount = fusionResults.filter(r => r.success).length;
    const failCount = fusionResults.filter(r => !r.success).length;
    const criticalFailCount = fusionResults.filter(r => r.criticalFail).length;
    
    if (successCount > 0 && failCount === 0) {
        // 모두 성공
        publicMessage = `🎉 ${interaction.user.username}님이 ${successCount}회 융합에 모두 성공했습니다! 대박!`;
    } else if (successCount === 0 && failCount > 0) {
        // 모두 실패
        publicMessage = `😢 ${interaction.user.username}님이 ${failCount}회 융합에 모두 실패했습니다... 힘내세요!`;
        if (criticalFailCount > 0) {
            publicMessage += ` (대실패 ${criticalFailCount}회 포함 😱)`;
        }
    } else {
        // 성공과 실패 혼재
        publicMessage = `⚡ ${interaction.user.username}님의 융합 결과: 성공 ${successCount}회, 실패 ${failCount}회`;
    }
    
    // 최고 레벨 성공 시 특별 메시지
    const highestSuccess = fusionResults.filter(r => r.success && r.level >= 90).sort((a, b) => b.level - a.level)[0];
    if (highestSuccess) {
        publicMessage += `\n🌟 Lv.${highestSuccess.level} → Lv.${highestSuccess.level + 1} 융합 성공! 굉장해요!`;
    }
    
    // 개인 응답
    await interaction.reply({
        embeds: [embed],
        components: [buttons],
        flags: 64
    });
    
    // 공개 메시지 발송
    if (fusionsPerformed > 0) {
        const publicEmbed = new EmbedBuilder()
            .setColor(successCount > failCount ? '#2ecc71' : '#e74c3c')
            .setTitle('💎 조각 융합 결과')
            .setDescription(publicMessage)
            .setTimestamp();
        
        await interaction.followUp({
            embeds: [publicEmbed]
        });
    }
    
    return;
}

// 조각 교환소
async function showFragmentExchange(interaction) {
    const user = await getUser(interaction.user.id);
    const lv100Fragments = user.energyFragments?.fragments?.get('100') || 0;
    
    const exchangeItems = [
        { name: '🚧 준비중', cost: 999, description: '곧 만나요!' },
        { name: '🔨 개발중', cost: 999, description: '조금만 기다려주세요!' },
        { name: '🎁 커밍순', cost: 999, description: '특별한 선물을 준비중입니다!' },
        { name: '✨ 업데이트 예정', cost: 999, description: '더 좋은 아이템으로 찾아뵙겠습니다!' },
        { name: '🌟 Coming Soon', cost: 999, description: '기대해주세요!' }
    ];
    
    const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🎁 에너지 코어 교환소')
        .setDescription(`완전한 에너지 코어(Lv.100)를 특별한 아이템으로 교환하세요!`)
        .addFields(
            { name: '🌟 보유 코어', value: `${lv100Fragments}개`, inline: false },
            { 
                name: '📦 교환 가능 아이템', 
                value: exchangeItems.map((item, index) => 
                    `${index + 1}. ${item.name} - ${item.cost}개\n   ${item.description}`
                ).join('\n\n'),
                inline: false 
            }
        );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_exchange_1')
                .setLabel('🚧 준비중')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('fragment_exchange_2')
                .setLabel('🔨 개발중')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('fragment_exchange_3')
                .setLabel('🎁 커밍순')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('fragment_menu')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

// 조각 랭킹 표시
async function showFragmentRanking(interaction) {
    // 모든 유저의 조각 정보 가져오기
    const users = await User.find({ registered: true })
        .select('nickname energyFragments')
        .lean();
    
    // 랭킹 계산
    const rankings = users.map(user => {
        const fragments = user.energyFragments?.fragments || {};
        let totalScore = 0;
        let maxLevel = 0;
        
        // 레벨별 가중치를 적용한 점수 계산
        Object.entries(fragments).forEach(([level, count]) => {
            const lvl = parseInt(level);
            if (count > 0) {
                totalScore += lvl * count; // 레벨 * 개수로 점수 계산
                maxLevel = Math.max(maxLevel, lvl);
            }
        });
        
        return {
            nickname: user.nickname,
            score: totalScore,
            maxLevel: maxLevel,
            totalFragments: Object.values(fragments).reduce((sum, count) => sum + count, 0)
        };
    }).filter(user => user.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 에너지 조각 랭킹')
        .setDescription('레벨과 보유량을 기준으로 한 상위 10명')
        .setTimestamp();
    
    if (rankings.length === 0) {
        embed.addFields({ 
            name: '랭킹 없음', 
            value: '아직 조각을 보유한 유저가 없습니다.' 
        });
    } else {
        rankings.forEach((user, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            embed.addFields({
                name: `${medal} ${user.nickname}`,
                value: `점수: ${formatNumber(user.score)} | 최고 Lv.${user.maxLevel} | 총 ${user.totalFragments}개`,
                inline: false
            });
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_menu')
                .setLabel('🔙 뒤로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

module.exports = {
    showFragmentMenu,
    executeFragmentMining,
    executeAutoFusion,
    showFragmentExchange,
    showFragmentRanking,
    ENERGY_FRAGMENT_SYSTEM
};