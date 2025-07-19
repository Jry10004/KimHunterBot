const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { calculateDamage, calculateCriticalDamage } = require('../handlers/common/damageCalculator');
const { calculateCombatPower } = require('../handlers/common/combatPower');
const { getUser } = require('../handlers/common/utils');

// 허수아비 더미 설정
const DUMMY_CONFIG = {
    hp: 1000000, // 100만 HP
    defense: 500, // 표준 방어력
    level: 80,   // 표준 레벨
    resistances: {
        physical: 0,
        magical: 0,
        true: 0
    }
};

// 직업별 통계 저장
const jobStatistics = new Map();

// 개인별 세션 저장
const dummySessions = new Map();

// 허수아비 메인 메뉴
async function showDummyMenu(interaction) {
    const user = await getUser(interaction.user.id);
    if (!user) {
        return await interaction.editReply({
            content: '❌ 먼저 회원가입을 해주세요!',
            embeds: [],
            components: []
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎯 훈련용 허수아비')
        .setDescription('허수아비를 공격하여 데미지를 테스트할 수 있습니다.')
        .addFields(
            { name: '💚 체력', value: `${DUMMY_CONFIG.hp.toLocaleString()} HP`, inline: true },
            { name: '🛡️ 방어력', value: `${DUMMY_CONFIG.defense}`, inline: true },
            { name: '📊 레벨', value: `Lv.${DUMMY_CONFIG.level}`, inline: true }
        )
        .setFooter({ text: '허수아비는 공격하지 않으며, HP가 0이 되면 자동으로 재생성됩니다.' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('dummy_attack')
                .setLabel('⚔️ 공격하기')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('dummy_statistics')
                .setLabel('📊 통계 보기')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('dummy_my_stats')
                .setLabel('📈 내 기록')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('dummy_job_analysis')
                .setLabel('🔍 직업 분석')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 허수아비 공격
async function attackDummy(interaction) {
    const user = await getUser(interaction.user.id);
    if (!user) {
        return await interaction.followUp({
            content: '❌ 오류가 발생했습니다.',
            flags: 64
        });
    }

    // 세션 가져오기 또는 생성
    const sessionKey = interaction.user.id;
    if (!dummySessions.has(sessionKey)) {
        dummySessions.set(sessionKey, {
            startTime: Date.now(),
            totalDamage: 0,
            attackCount: 0,
            critCount: 0,
            maxDamage: 0,
            minDamage: Infinity,
            damages: [],
            currentHP: DUMMY_CONFIG.hp
        });
    }

    const session = dummySessions.get(sessionKey);

    // 데미지 계산
    const damageResult = calculateDamage(user, DUMMY_CONFIG);
    const isCritical = Math.random() < (user.criticalChance || 0.1);
    let finalDamage = damageResult.totalDamage;

    if (isCritical) {
        const critResult = calculateCriticalDamage(user, damageResult.totalDamage);
        finalDamage = critResult.totalDamage;
        session.critCount++;
    }

    // 세션 업데이트
    session.attackCount++;
    session.totalDamage += finalDamage;
    session.damages.push(finalDamage);
    session.maxDamage = Math.max(session.maxDamage, finalDamage);
    session.minDamage = Math.min(session.minDamage, finalDamage);
    session.currentHP = Math.max(0, session.currentHP - finalDamage);

    // 직업별 통계 업데이트
    const jobType = getJobType(user);
    if (!jobStatistics.has(jobType)) {
        jobStatistics.set(jobType, {
            totalDamage: 0,
            attackCount: 0,
            critCount: 0,
            maxDamage: 0,
            avgDamage: 0,
            users: new Set()
        });
    }

    const jobStats = jobStatistics.get(jobType);
    jobStats.totalDamage += finalDamage;
    jobStats.attackCount++;
    if (isCritical) jobStats.critCount++;
    jobStats.maxDamage = Math.max(jobStats.maxDamage, finalDamage);
    jobStats.avgDamage = Math.floor(jobStats.totalDamage / jobStats.attackCount);
    jobStats.users.add(interaction.user.id);

    // 결과 표시
    const embed = new EmbedBuilder()
        .setColor(isCritical ? '#FFD700' : '#00FF00')
        .setTitle(`${isCritical ? '💥 치명타!' : '⚔️ 공격!'} ${finalDamage.toLocaleString()} 데미지`)
        .addFields(
            { name: '💚 남은 체력', value: `${session.currentHP.toLocaleString()} / ${DUMMY_CONFIG.hp.toLocaleString()}`, inline: true },
            { name: '📊 평균 데미지', value: `${Math.floor(session.totalDamage / session.attackCount).toLocaleString()}`, inline: true },
            { name: '🎯 치명타율', value: `${((session.critCount / session.attackCount) * 100).toFixed(1)}%`, inline: true }
        )
        .setFooter({ text: `${session.attackCount}번째 공격 | 최대: ${session.maxDamage.toLocaleString()} | 최소: ${session.minDamage.toLocaleString()}` });

    // HP가 0이 되면 리셋
    if (session.currentHP <= 0) {
        embed.addFields({
            name: '🎉 허수아비 처치!',
            value: `총 ${session.attackCount}번의 공격으로 처치했습니다!`,
            inline: false
        });
        
        // 세션 리셋
        session.currentHP = DUMMY_CONFIG.hp;
        session.startTime = Date.now();
        session.totalDamage = 0;
        session.attackCount = 0;
        session.critCount = 0;
        session.maxDamage = 0;
        session.minDamage = Infinity;
        session.damages = [];
    }

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('dummy_attack')
                .setLabel('⚔️ 다시 공격')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('dummy_menu')
                .setLabel('🏠 메뉴로')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 전체 통계 보기
async function showStatistics(interaction) {
    if (jobStatistics.size === 0) {
        return await interaction.editReply({
            content: '📊 아직 수집된 데이터가 없습니다.',
            embeds: [],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('dummy_menu')
                        .setLabel('🏠 메뉴로')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('📊 허수아비 전체 통계')
        .setDescription('모든 직업의 평균 데미지 통계입니다.')
        .setTimestamp();

    // 직업별 평균 데미지로 정렬
    const sortedJobs = Array.from(jobStatistics.entries())
        .sort((a, b) => b[1].avgDamage - a[1].avgDamage);

    sortedJobs.forEach(([jobType, stats], index) => {
        const jobEmoji = getJobEmoji(jobType);
        const critRate = ((stats.critCount / stats.attackCount) * 100).toFixed(1);
        
        embed.addFields({
            name: `${index + 1}. ${jobEmoji} ${jobType}`,
            value: [
                `평균 데미지: **${stats.avgDamage.toLocaleString()}**`,
                `최대 데미지: ${stats.maxDamage.toLocaleString()}`,
                `치명타율: ${critRate}%`,
                `총 공격 횟수: ${stats.attackCount}회`,
                `참여 유저: ${stats.users.size}명`
            ].join('\n'),
            inline: true
        });
    });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('dummy_menu')
                .setLabel('🏠 메뉴로')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('dummy_job_analysis')
                .setLabel('🔍 상세 분석')
                .setStyle(ButtonStyle.Primary)
        );

    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 내 기록 보기
async function showMyStats(interaction) {
    const sessionKey = interaction.user.id;
    const session = dummySessions.get(sessionKey);

    if (!session || session.attackCount === 0) {
        return await interaction.editReply({
            content: '📈 아직 공격 기록이 없습니다.',
            embeds: [],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('dummy_menu')
                        .setLabel('🏠 메뉴로')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }

    const user = await getUser(interaction.user.id);
    const jobType = getJobType(user);
    const duration = Date.now() - session.startTime;
    const dps = Math.floor(session.totalDamage / (duration / 1000));

    // 최근 10개 데미지 기록
    const recentDamages = session.damages.slice(-10).reverse();

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('📈 내 공격 기록')
        .setDescription(`직업: ${getJobEmoji(jobType)} ${jobType}`)
        .addFields(
            { name: '⚔️ 총 공격 횟수', value: `${session.attackCount}회`, inline: true },
            { name: '💥 총 데미지', value: `${session.totalDamage.toLocaleString()}`, inline: true },
            { name: '📊 평균 데미지', value: `${Math.floor(session.totalDamage / session.attackCount).toLocaleString()}`, inline: true },
            { name: '🎯 치명타율', value: `${((session.critCount / session.attackCount) * 100).toFixed(1)}%`, inline: true },
            { name: '⚡ DPS', value: `${dps.toLocaleString()}/초`, inline: true },
            { name: '🏆 최대 데미지', value: `${session.maxDamage.toLocaleString()}`, inline: true },
            {
                name: '📝 최근 10개 기록',
                value: recentDamages.length > 0 
                    ? recentDamages.map((dmg, idx) => `${idx + 1}. ${dmg.toLocaleString()}`).join('\n')
                    : '기록 없음',
                inline: false
            }
        )
        .setFooter({ text: `테스트 시간: ${Math.floor(duration / 1000)}초` });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('dummy_attack')
                .setLabel('⚔️ 계속 공격')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('dummy_reset')
                .setLabel('🔄 기록 초기화')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('dummy_menu')
                .setLabel('🏠 메뉴로')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 직업별 상세 분석
async function showJobAnalysis(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🔍 직업별 상세 분석')
        .setDescription('각 직업의 강점과 약점을 분석합니다.')
        .setTimestamp();

    // 직업별 분석 데이터 수집
    const jobAnalysis = new Map();
    
    for (const [jobType, stats] of jobStatistics) {
        const avgDamage = stats.avgDamage;
        const critRate = (stats.critCount / stats.attackCount) * 100;
        
        // 기준값 대비 성능 계산 (전사를 100%로 기준)
        const warriorStats = jobStatistics.get('전사');
        const performanceRatio = warriorStats ? (avgDamage / warriorStats.avgDamage * 100) : 100;
        
        jobAnalysis.set(jobType, {
            avgDamage,
            critRate,
            performanceRatio,
            attackCount: stats.attackCount,
            users: stats.users.size
        });
    }

    // 성능 순으로 정렬
    const sortedAnalysis = Array.from(jobAnalysis.entries())
        .sort((a, b) => b[1].performanceRatio - a[1].performanceRatio);

    sortedAnalysis.forEach(([jobType, analysis]) => {
        const jobEmoji = getJobEmoji(jobType);
        const performanceBar = createPerformanceBar(analysis.performanceRatio);
        
        embed.addFields({
            name: `${jobEmoji} ${jobType}`,
            value: [
                `성능: ${performanceBar} ${analysis.performanceRatio.toFixed(1)}%`,
                `평균 데미지: ${analysis.avgDamage.toLocaleString()}`,
                `치명타율: ${analysis.critRate.toFixed(1)}%`,
                `샘플 수: ${analysis.attackCount}회 (${analysis.users}명)`,
                `평가: ${getJobEvaluation(jobType, analysis)}`
            ].join('\n'),
            inline: false
        });
    });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('dummy_statistics')
                .setLabel('📊 통계로 돌아가기')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('dummy_menu')
                .setLabel('🏠 메뉴로')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 직업 타입 가져오기
function getJobType(user) {
    if (!user.emblem) return '무직';
    
    const emblemName = user.emblem.replace(/\s*\+\d+$/, '');
    const jobMap = {
        // 전사
        '초보전사': '전사',
        '튼튼한 기사': '전사',
        '용맹한 검사': '전사',
        '맹렬한 전사': '전사',
        '전설의 기사': '전사',
        
        // 궁수
        '마을사냥꾼': '궁수',
        '숲의 궁수': '궁수',
        '바람 사수': '궁수',
        '정확한 사격수': '궁수',
        '전설의 명궁': '궁수',
        
        // 수호자
        '초보 수호자': '수호자',
        '철벽 방패병': '수호자',
        '불굴의 수호자': '수호자',
        '강철 파수꾼': '수호자',
        '전설의 철벽': '수호자',
        
        // 마법사
        '견습 마법사': '마법사',
        '원소 술사': '마법사',
        '신비한 현자': '마법사',
        '대마법사': '마법사',
        '전설의 아크메이지': '마법사',
        
        // 도적
        '떠돌이 도적': '도적',
        '운 좋은 도둑': '도적',
        '행운의 닌자': '도적',
        '복 많은 도적': '도적',
        '전설의 행운아': '도적'
    };
    
    return jobMap[emblemName] || '무직';
}

// 직업 이모지
function getJobEmoji(jobType) {
    const emojiMap = {
        '전사': '⚔️',
        '궁수': '🏹',
        '수호자': '🛡️',
        '마법사': '🧙',
        '도적': '🗡️',
        '무직': '❓'
    };
    return emojiMap[jobType] || '❓';
}

// 성능 바 생성
function createPerformanceBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

// 직업 평가
function getJobEvaluation(jobType, analysis) {
    if (analysis.performanceRatio >= 100) return '✅ 우수한 성능';
    if (analysis.performanceRatio >= 80) return '🔵 평균적인 성능';
    if (analysis.performanceRatio >= 60) return '🟡 개선 필요';
    return '🔴 밸런스 조정 필요';
}

// 인터랙션 핸들러
async function handleDummyInteraction(interaction) {
    if (interaction.customId === 'dummy_menu') {
        return await showDummyMenu(interaction);
    } else if (interaction.customId === 'dummy_attack') {
        return await attackDummy(interaction);
    } else if (interaction.customId === 'dummy_statistics') {
        return await showStatistics(interaction);
    } else if (interaction.customId === 'dummy_my_stats') {
        return await showMyStats(interaction);
    } else if (interaction.customId === 'dummy_job_analysis') {
        return await showJobAnalysis(interaction);
    } else if (interaction.customId === 'dummy_reset') {
        const sessionKey = interaction.user.id;
        dummySessions.delete(sessionKey);
        
        await interaction.followUp({
            content: '✅ 기록이 초기화되었습니다.',
            flags: 64
        });
        
        return await showDummyMenu(interaction);
    }
}

module.exports = {
    showDummyMenu,
    handleDummyInteraction,
    DUMMY_CONFIG,
    jobStatistics,
    dummySessions
};