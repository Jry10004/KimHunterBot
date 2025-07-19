const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const fs = require('fs').promises;
const path = require('path');

// 이벤트 상태 파일 경로
const EVENT_STATE_FILE = path.join(__dirname, '../../data/eventState.json');

// 이벤트 상태
const eventState = {
    active: false,
    currentBoss: null,
    participants: new Map(), // userId -> { attacks: number, totalDamage: number }
    bossStartTime: null,
    eventChannel: null,
    intervalId: null,
    updateIntervalId: null,
    statusUpdateId: null, // 상태 업데이트 타이머
    eventEndRequested: false,
    bossCount: 0, // 현재 보스 번호
    totalBossesDefeated: 0, // 총 처치한 보스 수
    maxBossesPerHour: 5, // 시간당 최대 보스 수
    bossSpawnTimes: [] // 보스 소환 시간 기록
};

// 안전한 인터벌 정리 함수
function clearAllIntervals() {
    if (eventState.intervalId) {
        try {
            clearInterval(eventState.intervalId);
        } catch (error) {
            console.error('[PuppyEvent] Error clearing intervalId:', error);
        }
        eventState.intervalId = null;
    }
    if (eventState.updateIntervalId) {
        try {
            clearInterval(eventState.updateIntervalId);
        } catch (error) {
            console.error('[PuppyEvent] Error clearing updateIntervalId:', error);
        }
        eventState.updateIntervalId = null;
    }
}

// 이벤트 상태 저장
async function saveEventState() {
    try {
        // currentBoss의 attackedUsers를 Set에서 객체로 변환
        let bossToSave = null;
        if (eventState.currentBoss) {
            bossToSave = { ...eventState.currentBoss };
            if (bossToSave.attackedUsers instanceof Set) {
                // Set을 객체로 변환 (userId: true 형태)
                const attackedUsersObj = {};
                bossToSave.attackedUsers.forEach(userId => {
                    attackedUsersObj[userId] = true;
                });
                bossToSave.attackedUsers = attackedUsersObj;
            }
        }
        
        const stateToSave = {
            puppyNecklaceEvent: {
                active: eventState.active,
                currentBoss: bossToSave,
                participants: eventState.participants,
                bossStartTime: eventState.bossStartTime,
                eventChannel: eventState.eventChannel,
                eventEndRequested: eventState.eventEndRequested,
                bossCount: eventState.bossCount,
                totalBossesDefeated: eventState.totalBossesDefeated
            }
        };
        
        // 기존 파일 읽기
        let existingData = {};
        try {
            const fileContent = await fs.readFile(EVENT_STATE_FILE, 'utf8');
            existingData = JSON.parse(fileContent);
        } catch (error) {
            // 파일이 없거나 파싱 오류 시 빈 객체 사용
        }
        
        // puppyNecklaceEvent 데이터 업데이트
        existingData.puppyNecklaceEvent = stateToSave.puppyNecklaceEvent;
        
        await fs.writeFile(EVENT_STATE_FILE, JSON.stringify(existingData, null, 2), 'utf8');
        console.log('[이벤트] 상태 저장 완료');
    } catch (error) {
        console.error('[이벤트] 상태 저장 실패:', error);
    }
}

// 이벤트 상태 복원
async function loadEventState() {
    try {
        const fileContent = await fs.readFile(EVENT_STATE_FILE, 'utf8');
        const data = JSON.parse(fileContent);
        
        // 이벤트 상태 초기화
        eventState.active = false;
        eventState.currentBoss = null;
        eventState.participants = {};
        eventState.bossStartTime = null;
        eventState.eventChannel = null;
        eventState.eventEndRequested = false;
        eventState.bossCount = 0;
        eventState.totalBossesDefeated = 0;
        
        if (data.puppyNecklaceEvent && data.puppyNecklaceEvent.active) {
            eventState.active = data.puppyNecklaceEvent.active;
            eventState.currentBoss = data.puppyNecklaceEvent.currentBoss;
            eventState.participants = data.puppyNecklaceEvent.participants || {};
            eventState.bossStartTime = data.puppyNecklaceEvent.bossStartTime;
            eventState.eventChannel = data.puppyNecklaceEvent.eventChannel;
            eventState.eventEndRequested = data.puppyNecklaceEvent.eventEndRequested;
            eventState.bossCount = data.puppyNecklaceEvent.bossCount || 0;
            eventState.totalBossesDefeated = data.puppyNecklaceEvent.totalBossesDefeated || 0;
            
            console.log('[이벤트] 상태 복원 완료');
            return true;
        }
        
        console.log('[이벤트] 이벤트가 비활성 상태입니다.');
    } catch (error) {
        console.error('[이벤트] 상태 복원 실패:', error);
        // 오류 발생 시에도 상태 초기화
        eventState.active = false;
        eventState.currentBoss = null;
        eventState.participants = {};
        eventState.bossStartTime = null;
        eventState.eventChannel = null;
        eventState.eventEndRequested = false;
        eventState.bossCount = 0;
        eventState.totalBossesDefeated = 0;
    }
    return false;
}

// 이벤트 타이머 재설정
async function restoreEventTimers(client) {
    if (!eventState.active || !eventState.eventChannel) return;
    
    const channel = client.channels.cache.get(eventState.eventChannel);
    if (!channel) {
        console.error('[이벤트] 이벤트 채널을 찾을 수 없습니다.');
        return;
    }
    
    // 현재 보스가 있고 시간이 남았다면
    if (eventState.currentBoss && eventState.bossStartTime) {
        const elapsed = Date.now() - eventState.bossStartTime;
        const remaining = 30 * 60 * 1000 - elapsed; // 30분 - 경과 시간
        
        if (remaining > 0) {
            // 남은 시간 후 다음 보스 스폰
            setTimeout(() => {
                try {
                    const bossStartTime = eventState.currentBoss?.startTime;
                    const startTimeValue = bossStartTime instanceof Date ? bossStartTime.getTime() : bossStartTime;
                    
                    if (eventState.currentBoss && eventState.bossStartTime === startTimeValue) {
                        spawnBoss(client);
                    }
                } catch (error) {
                    console.error('[PuppyEvent] Timer callback error:', error);
                }
            }, remaining);
            
            console.log(`[이벤트] 현재 보스 타이머 재설정: ${Math.floor(remaining / 60000)}분 후 다음 보스`);
        } else {
            // 시간이 지났으면 즉시 새 보스 스폰
            spawnBoss(client);
        }
    } else {
        // 보스가 없으면 즉시 스폰
        spawnBoss(client);
    }
    
    // 30분마다 보스 스폰 (startEvent와 동일하게)
    clearAllIntervals(); // 기존 인터벌 정리
    eventState.intervalId = setInterval(() => {
        try {
            spawnBoss(client);
        } catch (error) {
            console.error('[PuppyEvent] Boss spawn interval error:', error);
        }
    }, 30 * 60 * 1000);
    
    // 10분마다 현황 업데이트
    eventState.updateIntervalId = setInterval(() => {
        try {
            updateEventStatus(client);
        } catch (error) {
            console.error('[PuppyEvent] Status update interval error:', error);
        }
    }, 10 * 60 * 1000);
    
    // 관리자 채널로 복원 알림
    const adminChannel = client.channels.cache.get('1387483613913944145');
    if (adminChannel) {
        const restoreEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('📢 이벤트 재개 알림')
            .setDescription(
                `서버 재시작 후 이벤트가 복원되었습니다!\n\n` +
                `현재 ${eventState.bossCount}번째 도둑\n` +
                `총 ${eventState.totalBossesDefeated}명의 도둑 처치\n` +
                `참여자: ${Object.keys(eventState.participants).length}명`
            )
            .setTimestamp();
        
        await adminChannel.send({ embeds: [restoreEmbed] });
    }
}

// 캐주얼한 형용사 접두사
const ADJECTIVES = {
    low: [ // 일반 등급 (전투력 하위)
        '못생긴', '삐쩍마른', '겁많은', '어리버리한', '졸린',
        '배고픈', '멍청한', '느릿느릿한', '실수쟁이', '초보'
    ],
    mid: [ // 중급 등급 (전투력 중위)
        '평범한', '잘생긴', '귀여운', '날씬한', '똑똑한',
        '재빠른', '교활한', '근육질', '냉철한', '베테랑'
    ],
    high: [ // 상급 등급 (전투력 상위)
        '전설의', '무적의', '천재', '최강의', '악마같은',
        '천상계', '신비로운', '불멸의', '완벽한', '전지전능한'
    ]
};

// 보스 스펙 - 너프 적용 (3-4명이 협력하면 처치 가능)
const BOSS_SPECS = {
    low: { minHp: 10000, maxHp: 20000, attack: 70, defense: 35 }, // 기존 25k-50k -> 10k-20k
    mid: { minHp: 20000, maxHp: 40000, attack: 140, defense: 70 }, // 기존 50k-100k -> 20k-40k
    high: { minHp: 40000, maxHp: 80000, attack: 280, defense: 140 } // 기존 100k-200k -> 40k-80k
};

// 전투력 분포 기반 티어 결정을 위한 캐시
let powerDistributionCache = {
    data: null,
    lastUpdate: null,
    updateInterval: 30 * 60 * 1000 // 30분마다 갱신
};

// 전투력 분포 계산 함수
async function calculatePowerDistribution() {
    const now = Date.now();
    
    // 캐시가 유효하면 캐시 반환
    if (powerDistributionCache.data && 
        powerDistributionCache.lastUpdate && 
        (now - powerDistributionCache.lastUpdate) < powerDistributionCache.updateInterval) {
        return powerDistributionCache.data;
    }
    
    const { calculateCombatPower } = require('../common/combatPower');
    
    // 모든 등록된 유저의 전투력 계산
    const users = await User.find({ registered: true });
    const userPowers = users.map(user => ({
        discordId: user.discordId,
        nickname: user.nickname,
        power: calculateCombatPower(user)
    }));
    
    // 전투력 기준 정렬
    userPowers.sort((a, b) => b.power - a.power);
    
    const totalUsers = userPowers.length;
    if (totalUsers === 0) {
        return { highThreshold: 50000, midThreshold: 20000, userPowers: [] };
    }
    
    // 분위수 계산 (상위 33%, 중위 33%, 하위 34%)
    const percentile33 = Math.floor(totalUsers * 0.33);
    const percentile66 = Math.floor(totalUsers * 0.66);
    
    const distribution = {
        highThreshold: userPowers[percentile33]?.power || 50000,
        midThreshold: userPowers[percentile66]?.power || 20000,
        userPowers: userPowers
    };
    
    // 캐시 업데이트
    powerDistributionCache.data = distribution;
    powerDistributionCache.lastUpdate = now;
    
    return distribution;
}

// 랜덤 유저 선택 함수 (티어별)
async function getRandomUsersByTier(tier, count = 3) {
    const distribution = await calculatePowerDistribution();
    const { highThreshold, midThreshold, userPowers } = distribution;
    
    if (userPowers.length === 0) {
        return [{ nickname: '알 수 없는 유저', power: 1000 }];
    }
    
    let tierUsers;
    if (tier === 'high') {
        // 상위 33%에서 선택
        tierUsers = userPowers.filter(u => u.power >= highThreshold);
    } else if (tier === 'mid') {
        // 중위 33%에서 선택
        tierUsers = userPowers.filter(u => u.power < highThreshold && u.power >= midThreshold);
    } else {
        // 하위 34%에서 선택
        tierUsers = userPowers.filter(u => u.power < midThreshold);
    }
    
    // 해당 티어에 유저가 없으면 전체에서 선택
    if (tierUsers.length === 0) {
        tierUsers = userPowers;
    }
    
    // 랜덤 선택
    const shuffled = tierUsers.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, tierUsers.length));
}

// 시간대별 소환 간격 계산 함수
function getSpawnInterval() {
    const now = new Date();
    const hour = now.getHours();
    
    // 한국 시간 기준
    // 0-6시: 자정~새벽 (40-50분)
    // 6-9시: 아침 (30-40분)
    // 9-18시: 낮 (20-30분)
    // 18-22시: 저녁 (10-20분) - 가장 활발
    // 22-24시: 밤 (30-40분)
    
    let minMinutes, maxMinutes;
    
    if (hour >= 0 && hour < 6) {
        // 자정~새벽: 40-50분
        minMinutes = 40;
        maxMinutes = 50;
    } else if (hour >= 6 && hour < 9) {
        // 아침: 30-40분
        minMinutes = 30;
        maxMinutes = 40;
    } else if (hour >= 9 && hour < 18) {
        // 낮: 20-30분
        minMinutes = 20;
        maxMinutes = 30;
    } else if (hour >= 18 && hour < 22) {
        // 저녁 (황금시간대): 10-20분
        minMinutes = 10;
        maxMinutes = 20;
    } else {
        // 밤: 30-40분
        minMinutes = 30;
        maxMinutes = 40;
    }
    
    // 랜덤 간격 생성
    const interval = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
    console.log(`[이벤트] 다음 보스 소환 간격: ${interval}분 (${hour}시 기준)`);
    
    return interval * 60 * 1000; // 밀리초로 변환
}

// 보스 상태 업데이트 간격 계산
function getUpdateInterval() {
    // 5-10분 사이 랜덤
    const minutes = Math.floor(Math.random() * 6) + 5;
    return minutes * 60 * 1000;
}

// 동적 보스 소환 스케줄러
function scheduleDynamicBossSpawn(client) {
    if (eventState.intervalId) {
        clearInterval(eventState.intervalId);
    }
    
    const scheduleNext = () => {
        const interval = getSpawnInterval();
        
        eventState.intervalId = setTimeout(() => {
            try {
                spawnBoss(client);
                // 다음 소환 예약
                scheduleNext();
            } catch (error) {
                console.error('[PuppyEvent] Dynamic spawn error:', error);
                // 에러 발생 시에도 다음 소환 예약
                scheduleNext();
            }
        }, interval);
    };
    
    scheduleNext();
}

// 보스 상태 업데이트 스케줄러
function scheduleStatusUpdate(client) {
    const scheduleNext = () => {
        const interval = getUpdateInterval();
        
        setTimeout(() => {
            try {
                if (eventState.active && eventState.currentBoss && eventState.currentBoss.currentHp > 0) {
                    updateBossStatus(client);
                }
                // 다음 업데이트 예약
                scheduleNext();
            } catch (error) {
                console.error('[PuppyEvent] Status update error:', error);
                // 에러 발생 시에도 다음 업데이트 예약
                scheduleNext();
            }
        }, interval);
    };
    
    scheduleNext();
}

// 보스 생성 함수
async function generateBoss() {
    eventState.bossCount++; // 보스 번호 증가
    
    // 전투력 분포 계산
    const distribution = await calculatePowerDistribution();
    const { highThreshold, midThreshold, userPowers } = distribution;
    
    // 보스 번호나 진행도에 따라 티어 결정 (점진적으로 어려워짐)
    let tier = 'low';
    const bossNum = eventState.bossCount;
    
    if (bossNum <= 2) {
        // 처음 2마리는 하위 티어
        tier = 'low';
    } else if (bossNum <= 5) {
        // 3-5번째는 중위 티어
        tier = 'mid';
    } else if (bossNum <= 8) {
        // 6-8번째는 중위/상위 혼합
        tier = Math.random() < 0.5 ? 'mid' : 'high';
    } else {
        // 9번째 이후는 상위 티어 위주
        const rand = Math.random();
        if (rand < 0.6) tier = 'high';
        else if (rand < 0.9) tier = 'mid';
        else tier = 'low';
    }
    
    // 해당 티어의 유저들 중에서 랜덤 선택
    const tierUsers = await getRandomUsersByTier(tier, 3);
    const randomUser = tierUsers[Math.floor(Math.random() * tierUsers.length)];
    
    // 티어별 형용사 선택
    const adjective = ADJECTIVES[tier][Math.floor(Math.random() * ADJECTIVES[tier].length)];
    
    // 보스 스펙 설정
    const spec = BOSS_SPECS[tier];
    const hp = Math.floor(Math.random() * (spec.maxHp - spec.minHp)) + spec.minHp;
    
    // 보스 생성
    const boss = {
        name: `${adjective} 도둑 ${randomUser.nickname}`,
        maxHp: hp,
        currentHp: hp,
        attack: spec.attack,
        defense: spec.defense,
        tier: tier,
        attackedUsers: new Set(), // 이 보스를 공격한 유저들
        embedAttackers: {}, // embed ID별 공격자 기록
        currentEmbedId: null, // 현재 embed의 ID
        lastUpdateTime: Date.now(), // 마지막 업데이트 시간
        updateCount: 0, // 업데이트 횟수
        startTime: new Date(),
        bossNumber: eventState.bossCount, // 보스 번호 저장
        basedOnPower: randomUser.power, // 기반이 된 유저의 전투력
        powerThresholds: { // 현재 서버의 전투력 기준점
            high: highThreshold,
            mid: midThreshold
        }
    };
    
    console.log(`[이벤트] 보스 생성 - ${boss.name} (${tier} 티어, 기반 전투력: ${boss.basedOnPower})`);
    
    return boss;
}

// 보스 상태 업데이트 함수
async function updateBossStatus(client) {
    if (!eventState.active || !eventState.currentBoss || eventState.currentBoss.currentHp <= 0) return;
    
    const channel = client.channels.cache.get(eventState.eventChannel);
    if (!channel) return;
    
    // HP 바 생성
    const hpPercentage = Math.floor((eventState.currentBoss.currentHp / eventState.currentBoss.maxHp) * 100);
    const barLength = 20;
    const filledLength = Math.floor((hpPercentage / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    
    let color;
    if (hpPercentage > 60) color = '🟢';
    else if (hpPercentage > 30) color = '🟡';
    else color = '🔴';
    
    const hpBar = `${color} [${filledBar}${emptyBar}] ${hpPercentage}%`;
    
    // 티어별 설명
    let tierDescription = '';
    let tierEmoji = '';
    if (eventState.currentBoss.tier === 'high') {
        tierDescription = `상급 (전투력 ${eventState.currentBoss.powerThresholds?.high?.toLocaleString() || '50,000'}+)`;
        tierEmoji = '👹';
    } else if (eventState.currentBoss.tier === 'mid') {
        tierDescription = `중급 (전투력 ${eventState.currentBoss.powerThresholds?.mid?.toLocaleString() || '20,000'}~${eventState.currentBoss.powerThresholds?.high?.toLocaleString() || '50,000'})`;
        tierEmoji = '😈';
    } else {
        tierDescription = `하급 (전투력 ${eventState.currentBoss.powerThresholds?.mid?.toLocaleString() || '20,000'} 미만)`;
        tierEmoji = '👺';
    }
    
    eventState.currentBoss.updateCount = (eventState.currentBoss.updateCount || 0) + 1;
    
    const embed = new EmbedBuilder()
        .setColor(hpPercentage > 60 ? '#00FF00' : hpPercentage > 30 ? '#FFFF00' : '#FF0000')
        .setTitle(`⚔️ ${eventState.currentBoss.bossNumber}번째 도둑 - 상태 업데이트 #${eventState.currentBoss.updateCount} ⚔️`)
        .setDescription(`# 🦝 **${eventState.currentBoss.name}**\n\n` +
            `**도둑이 아직 도망가지 못했습니다!**\n` +
            `**계속해서 공격하세요!**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        .addFields(
            { 
                name: `📊 도둑 정보 ${tierEmoji}`, 
                value: `\`\`\`티어: ${tierDescription}\nHP: ${eventState.currentBoss.currentHp.toLocaleString()}/${eventState.currentBoss.maxHp.toLocaleString()}\n공격력: ${eventState.currentBoss.attack}\n방어력: ${eventState.currentBoss.defense}\`\`\``,
                inline: true
            },
            {
                name: '🎯 공격 상태',
                value: `\`\`\`상태 업데이트로\n다시 공격 가능!\n\n총 공격자: ${eventState.currentBoss.attackedUsers ? Object.keys(eventState.currentBoss.attackedUsers).length : 0}명\`\`\``,
                inline: true
            },
            {
                name: '💔 체력 상태',
                value: `\`\`\`diff\n${hpBar}\nHP: ${eventState.currentBoss.currentHp.toLocaleString()}/${eventState.currentBoss.maxHp.toLocaleString()}\n\`\`\``,
                inline: false
            }
        )
        .setFooter({ text: `⏰ 남은 시간: ${Math.max(0, 30 - Math.floor((Date.now() - eventState.bossStartTime) / 60000))}분` })
        .setTimestamp();
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('necklace_event_attack')
                .setLabel('⚔️ 공격하기')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('necklace_event_ranking')
                .setLabel('🏆 랭킹 확인')
                .setStyle(ButtonStyle.Primary)
        );
    
    const message = await channel.send({ embeds: [embed], components: [buttons] });
    
    // 새 embed ID 저장
    eventState.currentBoss.currentEmbedId = message.id;
    eventState.currentBoss.lastUpdateTime = Date.now();
    
    // 상태 저장
    await saveEventState();
}

// 보스 출현 함수
async function spawnBoss(client) {
    if (!eventState.active || !eventState.eventChannel) return;
    
    // 시간당 보스 수 제한 체크
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // 1시간 이내 소환된 보스 수 계산
    eventState.bossSpawnTimes = eventState.bossSpawnTimes.filter(time => time > oneHourAgo);
    
    if (eventState.bossSpawnTimes.length >= eventState.maxBossesPerHour) {
        console.log(`[이벤트] 시간당 최대 보스 수(${eventState.maxBossesPerHour})에 도달. 다음 소환 대기.`);
        return;
    }
    
    // 이전 보스가 아직 살아있으면 새 보스 소환 안 함
    if (eventState.currentBoss && eventState.currentBoss.currentHp > 0) {
        console.log('[이벤트] 이전 보스가 아직 살아있습니다. 새 보스 소환을 건너뜁니다.');
        return;
    }
    
    // 새 보스 생성
    eventState.currentBoss = await generateBoss();
    eventState.bossStartTime = Date.now();
    eventState.bossSpawnTimes.push(Date.now()); // 소환 시간 기록
    
    console.log(`[이벤트] 새 보스 생성: ${eventState.currentBoss.name}, HP: ${eventState.currentBoss.currentHp}/${eventState.currentBoss.maxHp}, 번호: ${eventState.bossCount}`);
    
    const channel = client.channels.cache.get(eventState.eventChannel);
    if (!channel) return;
    
    // HP 바 생성
    const hpPercentage = Math.floor((eventState.currentBoss.currentHp / eventState.currentBoss.maxHp) * 100);
    const barLength = 20;
    const filledLength = Math.floor((hpPercentage / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    
    let color;
    if (hpPercentage > 60) color = '🟢';
    else if (hpPercentage > 30) color = '🟡';
    else color = '🔴';
    
    const hpBar = `${color} [${filledBar}${emptyBar}] ${hpPercentage}%`;
    
    // 보스 번호에 따른 특별 메시지
    let bossTitle = '⚔️ 목걸이 도둑 출현! ⚔️';
    let specialMessage = '';
    
    if (eventState.bossCount === 1) {
        bossTitle = '⚔️ 첫 번째 도둑 출현! ⚔️';
        specialMessage = '\n🔥 **첫 번째 도둑입니다! 목걸이를 되찾으러 가볼까요?**';
    } else if (eventState.bossCount === 2) {
        bossTitle = '⚔️ 두 번째 도둑 출현! ⚔️';
        specialMessage = '\n🎯 **두 번째 도둑이 나타났습니다!**';
    } else if (eventState.bossCount === 3) {
        bossTitle = '⚔️ 세 번째 도둑 출현! ⚔️';
        specialMessage = '\n💪 **세 번째 도둑입니다! 이번엔 목걸이가 있을까요?**';
    } else if (eventState.bossCount % 10 === 0) {
        bossTitle = `🌟 ${eventState.bossCount}번째 도둑 출현! 🌟`;
        specialMessage = `\n🎊 **${eventState.bossCount}번째 도둑입니다! 특별한 일이 일어날지도?**`;
    } else {
        bossTitle = `⚔️ ${eventState.bossCount}번째 도둑 출현! ⚔️`;
    }
    
    // 티어별 설명
    let tierDescription = '';
    let tierEmoji = '';
    if (eventState.currentBoss.tier === 'high') {
        tierDescription = `상급 (전투력 ${eventState.currentBoss.powerThresholds?.high?.toLocaleString() || '50,000'}+)`;
        tierEmoji = '👹';
    } else if (eventState.currentBoss.tier === 'mid') {
        tierDescription = `중급 (전투력 ${eventState.currentBoss.powerThresholds?.mid?.toLocaleString() || '20,000'}~${eventState.currentBoss.powerThresholds?.high?.toLocaleString() || '50,000'})`;
        tierEmoji = '😈';
    } else {
        tierDescription = `하급 (전투력 ${eventState.currentBoss.powerThresholds?.mid?.toLocaleString() || '20,000'} 미만)`;
        tierEmoji = '👺';
    }
    
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(bossTitle)
        .setDescription(`# 🦝 **${eventState.currentBoss.name}**\n\n` +
            `**댕댕봇의 목걸이를 훔친 도둑이 나타났습니다!**\n` +
            `**서둘러 도둑을 처치하고 목걸이를 되찾으세요!**${specialMessage}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        .addFields(
            { 
                name: `📊 도둑 정보 ${tierEmoji}`, 
                value: `\`\`\`티어: ${tierDescription}\nHP: ${eventState.currentBoss.currentHp.toLocaleString()}/${eventState.currentBoss.maxHp.toLocaleString()}\n공격력: ${eventState.currentBoss.attack}\n방어력: ${eventState.currentBoss.defense}\`\`\``,
                inline: true
            },
            {
                name: '🎯 참가 조건',
                value: `\`\`\`즉시 공격 가능\n30분 후 도망감\n댕댕봇구출자 보너스\`\`\``,
                inline: true
            },
            {
                name: '🎁 보상',
                value: `\`\`\`참여 랭킹: 댕댕이의 우정 반지\n딜량 랭킹: 골드\n\n다음 도둑이 목걸이를\n가지고 있을 수도...?\`\`\``,
                inline: true
            },
            {
                name: '💔 체력 상태',
                value: `\`\`\`diff\n${hpBar}\nHP: ${eventState.currentBoss.currentHp.toLocaleString()}/${eventState.currentBoss.maxHp.toLocaleString()}\n\`\`\``,
                inline: false
            }
        )
        .setFooter({ text: `⏰ 1시간 후 자동으로 도망갑니다!` })
        .setTimestamp();
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('necklace_event_attack')
                .setLabel('⚔️ 공격하기')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('necklace_event_ranking')
                .setLabel('🏆 랭킹 확인')
                .setStyle(ButtonStyle.Primary)
        );
    
    const message = await channel.send({ embeds: [embed], components: [buttons] });
    
    // 현재 embed ID 저장
    eventState.currentBoss.currentEmbedId = message.id;
    eventState.currentBoss.currentMessageId = message.id;
    
    // 상태 저장
    await saveEventState();
    
    // 보스 상태 업데이트 스케줄러 시작 (5-10분마다)
    scheduleStatusUpdate(client);
    
    // 1시간 후 보스 제거 (또는 처치 시)
    setTimeout(async () => {
        if (eventState.currentBoss && eventState.bossStartTime === eventState.currentBoss.startTime.getTime()) {
            // 보스가 아직 살아있으면 도망감
            if (eventState.currentBoss.currentHp > 0) {
                // 댕댕봇구출자 보너스 처리 (보스 도망 시)
                const now = new Date();
                const hour = now.getHours();
                
                // 새벽 3시~8시 사이가 아닌 경우에만 작동
                if (hour < 3 || hour >= 8) {
                    // ⚠️ 중요: 댕댕봇구출자는 고유 칭호입니다. 함부로 수정하지 마세요!
                    // 현재 소유자: 선규 (364197967114272769)
                    // 변경 시 반드시 개발자와 상의 필요
                    const rescuers = await User.find({ titles: '댕댕봇 구출자' });
                    for (const rescuer of rescuers) {
                        const userId = rescuer.discordId;
                        if (!eventState.participants[userId]) {
                            eventState.participants[userId] = { attacks: 0, totalDamage: 0 };
                        }
                        const userData = eventState.participants[userId];
                        userData.attacks += 1;
                        
                        console.log(`[이벤트] 댕댕봇구출자 ${rescuer.nickname}에게 참여 횟수 +1 (보스 도망 보상)`);
                        
                        // 이벤트 채널에 보너스 알림 전송
                        const bonusEmbed = new EmbedBuilder()
                            .setColor('#FFD700')
                            .setTitle('🎁 댕댕봇구출자 특별 보너스!')
                            .setDescription('보스가 도망가서 댕댕봇구출자에게 특별 보너스가 지급됩니다')
                            .addFields(
                                { 
                                    name: '👑 보너스 대상', 
                                    value: `${rescuer.nickname} (댕댕봇 구출자)`,
                                    inline: true
                                },
                                { 
                                    name: '🎁 보상 내용', 
                                    value: '참여 횟수 +1',
                                    inline: true
                                }
                            )
                            .setFooter({ text: '※ 새벽 3시~8시에는 이 보너스가 작동하지 않습니다' })
                            .setTimestamp();
                        
                        const channel = client.channels.cache.get(eventState.eventChannel);
                        if (channel) {
                            await channel.send({ embeds: [bonusEmbed] });
                        }
                    }
                } else {
                    console.log('[이벤트] 새벽 3시~8시 사이는 댕댕봇구출자 보너스 비활성화');
                }
                
                const channel = client.channels.cache.get(eventState.eventChannel);
                if (channel) {
                    const escapeEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🏃 도둑이 도망갔습니다!')
                        .setDescription(`**${eventState.currentBoss.name}**이(가) 목걸이를 가지고 도망쳤습니다!\n\n` +
                            `총 ${eventState.currentBoss.attackedUsers ? Object.keys(eventState.currentBoss.attackedUsers).length : 0}명이 공격했지만 처치하지 못했습니다.`)
                        .setFooter({ text: '다음 도둑을 기다려주세요!' });
                    
                    await channel.send({ embeds: [escapeEmbed] });
                }
            }
            
            // 다음 보스는 동적 스케줄러가 알아서 소환
            eventState.currentBoss = null;
            eventState.bossStartTime = null;
        }
    }, 60 * 60 * 1000); // 1시간
}

// 이벤트 시작
async function startEvent(client, channelId) {
    if (eventState.active) {
        return { success: false, message: '이벤트가 이미 진행 중입니다.' };
    }
    
    eventState.active = true;
    eventState.eventChannel = channelId;
    eventState.participants = {};
    eventState.eventEndRequested = false;
    eventState.bossCount = 0;
    eventState.totalBossesDefeated = 0;
    
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
        return { success: false, message: '이벤트 채널을 찾을 수 없습니다.' };
    }
    
    // 모든 유저의 이벤트 관련 데이터 초기화
    await User.updateMany(
        { registered: true },
        { 
            $set: { 
                'puppyEventData.attackCount': 0,
                'puppyEventData.totalDamage': 0,
                'puppyEventData.bossesDefeated': 0,
                'puppyEventData.lastAttackTime': null
            }
        }
    );
    console.log('[PuppyEvent] 모든 유저의 이벤트 데이터가 초기화되었습니다.');
    
    // 이벤트 시작 안내
    const startEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🚨 [긴급 이벤트] 댕댕봇의 목걸이 도둑을 잡아라! 🚨')
        .setDescription(
            `댕댕봇이 아끼던 목걸이가 도난당했습니다!\n` +
            `범인들이 김헌터 왕국 곳곳에 숨어있다는 제보가 들어왔습니다.\n\n` +
            `모든 헌터들이여, 도둑들을 찾아 처치하고\n` +
            `댕댕봇의 목걸이를 되찾아주세요!\n\n` +
            `⚔️ 도둑들은 30분마다 나타납니다\n` +
            `🎁 목걸이를 찾으면 특별한 보상이!`
        )
        .addFields(
            { 
                name: '💎 참여 횟수 랭킹 보상 - 댕댕이의 우정 목걸이', 
                value: 
                    `1등: **[신화 헌터]** (+15강)\n` +
                    `2등: **[히어로 헌터]** (+13강)\n` +
                    `3등: **[마스터 헌터]** (+10강)\n` +
                    `4등: **[엘리트 헌터]** (+8강)\n` +
                    `5등 이하: **[무계급]** (+0강)\n` +
                    `*옵션: 모든 스탯 +100*`,
                inline: false 
            },
            {
                name: '💰 누적 딜량 랭킹 보상',
                value:
                    `1등: **20,000,000** 골드\n` +
                    `2등: **10,000,000** 골드\n` +
                    `3등: **5,000,000** 골드\n` +
                    `참가자 전원: **1,000,000** 골드`,
                inline: false
            }
        )
        .setImage('https://cdn.discordapp.com/attachments/1321808998491750452/1395762625408929852/asset_XzQptxhwRv3eNh1SBHsJvXeg__.___image-prompt-editing_1752846103.png')
        .setFooter({ text: '첫 도둑이 곧 나타납니다!' })
        .setTimestamp();
    
    await channel.send({ embeds: [startEmbed] });
    
    // 기존 타이머 정리
    if (eventState.intervalId) {
        clearInterval(eventState.intervalId);
        eventState.intervalId = null;
    }
    if (eventState.updateIntervalId) {
        clearInterval(eventState.updateIntervalId);
        eventState.updateIntervalId = null;
    }
    
    // 첫 보스 스폰
    setTimeout(() => spawnBoss(client), 5000);
    
    // 동적 보스 소환 스케줄러 시작
    scheduleDynamicBossSpawn(client);
    
    // 보스 상태 업데이트 스케줄러 시작 (5-10분마다)
    scheduleStatusUpdate(client);
    
    // 10분마다 현황 업데이트
    eventState.updateIntervalId = setInterval(() => {
        try {
            updateEventStatus(client);
        } catch (error) {
            console.error('[PuppyEvent] Status update interval error:', error);
        }
    }, 10 * 60 * 1000);
    
    return { success: true, message: '이벤트가 시작되었습니다!' };
}

// 이벤트 종료
async function endEvent(client, interaction) {
    if (!eventState.active) {
        return { success: false, message: '진행 중인 이벤트가 없습니다.' };
    }
    
    eventState.eventEndRequested = true;
    
    // 다음 보스에서 목걸이 드롭 설정
    const channel = client.channels.cache.get(eventState.eventChannel);
    if (channel) {
        await channel.send('📢 **다음 보스가 목걸이를 가지고 있다는 정보가 입수되었습니다!**');
    }
    
    return { success: true, message: '다음 보스 처치 시 이벤트가 종료됩니다.' };
}

// 이벤트 현황 업데이트
async function updateEventStatus(client) {
    if (!eventState.active || !eventState.eventChannel) return;
    
    const channel = client.channels.cache.get(eventState.eventChannel);
    if (!channel) return;
    
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('📊 목걸이 도둑 잡기 이벤트 현황')
        .setTimestamp();
    
    // 보스 정보
    if (eventState.currentBoss && eventState.currentBoss.currentHp > 0) {
        // HP 바 생성
        const hpPercentage = Math.floor((eventState.currentBoss.currentHp / eventState.currentBoss.maxHp) * 100);
        const barLength = 20;
        const filledLength = Math.floor((hpPercentage / 100) * barLength);
        const emptyLength = barLength - filledLength;
        
        const filledBar = '█'.repeat(filledLength);
        const emptyBar = '░'.repeat(emptyLength);
        
        let color;
        if (hpPercentage > 60) color = '🟢';
        else if (hpPercentage > 30) color = '🟡';
        else color = '🔴';
        
        const hpBar = `${color} [${filledBar}${emptyBar}] ${hpPercentage}%`;
        
        const elapsed = Date.now() - eventState.bossStartTime;
        const remaining = Math.max(0, 30 - Math.floor(elapsed / 60000));
        
        // 티어 정보 추가
        let tierInfo = '';
        if (eventState.currentBoss.tier === 'high') {
            tierInfo = '👹 상급 티어';
        } else if (eventState.currentBoss.tier === 'mid') {
            tierInfo = '😈 중급 티어';
        } else {
            tierInfo = '👺 하급 티어';
        }
        
        embed.addFields(
            { 
                name: `🦝 현재 도둑 (${eventState.currentBoss.bossNumber || eventState.bossCount}번째)`, 
                value: `**${eventState.currentBoss.name}** ${tierInfo}\n` +
                       `💔 HP: ${eventState.currentBoss.currentHp.toLocaleString()}/${eventState.currentBoss.maxHp.toLocaleString()}\n` +
                       `\`\`\`diff\n${hpBar}\n\`\`\`\n` +
                       `⏰ 남은 시간: ${remaining}분`,
                inline: false
            }
        );
        
        // 현재 보스 공격자 수
        const attackerCount = eventState.currentBoss.attackedUsers ? Object.keys(eventState.currentBoss.attackedUsers).length : 0;
        embed.addFields({
            name: '⚔️ 참여 현황',
            value: `현재 공격자: **${attackerCount}명**`,
            inline: true
        });
    } else {
        embed.addFields({
            name: '⏳ 대기 중',
            value: '다음 도둑 출현까지 대기 중...',
            inline: false
        });
    }
    
    // 참여 횟수 랭킹 TOP 5
    const attackRanking = Object.entries(eventState.participants)
        .sort((a, b) => b[1].attacks - a[1].attacks)
        .slice(0, 5);
    
    // 누적 딜량 랭킹 TOP 5
    const damageRanking = Object.entries(eventState.participants)
        .sort((a, b) => b[1].totalDamage - a[1].totalDamage)
        .slice(0, 5);
    
    // 참여 횟수 랭킹
    let attackText = '';
    for (let i = 0; i < attackRanking.length; i++) {
        const [userId, data] = attackRanking[i];
        const user = await User.findOne({ discordId: userId });
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        attackText += `${medal} **${user?.nickname || '알 수 없음'}** - ${data.attacks}회\n`;
    }
    
    if (attackText) {
        embed.addFields({
            name: '🏆 참여 횟수 TOP 5',
            value: attackText || '아직 참여자가 없습니다.',
            inline: true
        });
    }
    
    // 누적 딜량 랭킹
    let damageText = '';
    for (let i = 0; i < damageRanking.length; i++) {
        const [userId, data] = damageRanking[i];
        const user = await User.findOne({ discordId: userId });
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        damageText += `${medal} **${user?.nickname || '알 수 없음'}** - ${data.totalDamage.toLocaleString()}\n`;
    }
    
    if (damageText) {
        embed.addFields({
            name: '💥 누적 딜량 TOP 5',
            value: damageText || '아직 참여자가 없습니다.',
            inline: true
        });
    }
    
    // 전체 통계
    embed.addFields({
        name: '📈 전체 통계',
        value: `총 참여자: **${Object.keys(eventState.participants).length}명**\n` +
               `총 공격 횟수: **${Array.from(eventState.participants.values()).reduce((sum, p) => sum + p.attacks, 0)}회**\n` +
               `총 누적 데미지: **${Array.from(eventState.participants.values()).reduce((sum, p) => sum + p.totalDamage, 0).toLocaleString()}**\n` +
               `처치한 도둑: **${eventState.totalBossesDefeated}명**`,
        inline: false
    });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('necklace_event_ranking')
                .setLabel('🏆 상세 랭킹')
                .setStyle(ButtonStyle.Primary)
        );
    
    await channel.send({ embeds: [embed], components: [buttons] });
}

// 보스 공격 처리
async function attackBoss(interaction) {
    // 버튼 응답 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        console.error('[이벤트] 공격 defer 오류:', error);
    }
    
    if (!eventState.active || !eventState.currentBoss || eventState.currentBoss.currentHp <= 0) {
        return;
    }
    
    const userId = interaction.user.id;
    const messageId = interaction.message.id;
    
    // embedAttackers 초기화
    if (!eventState.currentBoss.embedAttackers) {
        eventState.currentBoss.embedAttackers = {};
    }
    
    // 현재 메시지(embed)에 대한 공격자 목록 초기화
    if (!eventState.currentBoss.embedAttackers[messageId]) {
        eventState.currentBoss.embedAttackers[messageId] = {};
    }
    
    // 이 embed에서 이미 공격했는지 확인
    if (eventState.currentBoss.embedAttackers[messageId][userId]) {
        // 이미 공격한 경우 메시지 표시
        const channel = interaction.client.channels.cache.get(eventState.eventChannel);
        if (channel) {
            const attackedUser = await User.findOne({ discordId: userId });
            const alreadyAttackedEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setAuthor({ 
                    name: attackedUser ? attackedUser.nickname : interaction.user.username,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setDescription(`⛔ **이미 이 상태에서 공격했습니다!**\n보스 상태가 업데이트되면 다시 공격할 수 있습니다.`)
                .setFooter({ text: '보스 상태 업데이트마다 1회 공격 가능합니다.' });
            
            await channel.send({ embeds: [alreadyAttackedEmbed] });
        }
        return;
    }
    
    const user = await User.findOne({ discordId: userId });
    if (!user || !user.registered) {
        return;
    }
    
    // 데미지 계산
    const { calculateDamage } = require('../common/damageCalculator');
    const damageResult = calculateDamage(user, eventState.currentBoss, {
        skillMultiplier: 1.0,
        damageType: 'physical'
    });
    
    const damage = Math.min(damageResult.totalDamage, eventState.currentBoss.currentHp);
    eventState.currentBoss.currentHp -= damage;
    
    // 이번 embed의 공격자로 등록
    eventState.currentBoss.embedAttackers[messageId][userId] = true;
    
    // 전체 보스 공격자로도 등록 (통계용)
    if (!eventState.currentBoss.attackedUsers) {
        eventState.currentBoss.attackedUsers = {};
    }
    eventState.currentBoss.attackedUsers[userId] = true;
    
    // 참가자 기록 업데이트
    if (!eventState.participants[userId]) {
        eventState.participants[userId] = { attacks: 0, totalDamage: 0 };
    }
    const userData = eventState.participants[userId];
    userData.attacks += 1;
    userData.totalDamage += damage;
    
    // 직업 정보 가져오기
    const emblemName = user.emblem?.replace(/\s*\+\d+$/, '') || '';
    let className = '모험가';
    let classEmoji = '⚔️';
    
    // 실제 직업 판별 (5개 직업만 존재)
    if (emblemName.includes('전사') || emblemName.includes('warrior')) {
        className = '전사';
        classEmoji = '🗡️';
    } else if (emblemName.includes('궁수') || emblemName.includes('archer')) {
        className = '궁수';
        classEmoji = '🏹';
    } else if (emblemName.includes('마법사') || emblemName.includes('mage') || emblemName.includes('wizard')) {
        className = '마법사';
        classEmoji = '🔮';
    } else if (emblemName.includes('도적') || emblemName.includes('thief') || emblemName.includes('rogue')) {
        className = '도적';
        classEmoji = '🗡️';
    } else if (emblemName.includes('수호자') || emblemName.includes('defender') || emblemName.includes('guardian')) {
        className = '수호자';
        classEmoji = '🛡️';
    }
    
    // 데미지 결과에서 특수 효과 확인
    const isCritical = damageResult.isCritical;
    const hasDoubleHit = damageResult.hasDoubleHit;
    const hasExtraAttack = damageResult.hasExtraAttack;
    const elementalDamage = damageResult.elementalDamage;
    
    // 공격 묘사 생성
    let attackDescription = '';
    let skillName = '기본 공격';
    
    if (className === '전사') {
        if (isCritical) {
            skillName = '광폭화';
            attackDescription = `전사의 분노가 극에 달해 강력한 일격을 날렸습니다!`;
        } else {
            const warriorAttacks = ['강타', '돌진', '휩쓸기'];
            skillName = warriorAttacks[Math.floor(Math.random() * warriorAttacks.length)];
            attackDescription = `무거운 검을 휘둘러 도둑을 공격했습니다.`;
        }
    } else if (className === '궁수') {
        if (hasDoubleHit) {
            skillName = '속사';
            attackDescription = `빠른 손놀림으로 두 발의 화살을 연속으로 쏘았습니다!`;
        } else if (isCritical) {
            skillName = '급소 저격';
            attackDescription = `정확한 조준으로 도둑의 급소를 맞췄습니다!`;
        } else {
            const archerAttacks = ['정밀 사격', '곡사', '관통 사격'];
            skillName = archerAttacks[Math.floor(Math.random() * archerAttacks.length)];
            attackDescription = `활시위를 당겨 화살을 날렸습니다.`;
        }
    } else if (className === '마법사') {
        if (elementalDamage > 0) {
            const elements = ['화염', '얼음', '번개'];
            const element = elements[Math.floor(Math.random() * elements.length)];
            skillName = `${element} 마법`;
            attackDescription = `강력한 ${element} 마법으로 도둑을 공격했습니다!`;
        } else if (isCritical) {
            skillName = '원소 폭발';
            attackDescription = `모든 원소의 힘을 모아 강력한 폭발을 일으켰습니다!`;
        } else {
            skillName = '마법 화살';
            attackDescription = `마력을 응축시켜 도둑에게 발사했습니다.`;
        }
    } else if (className === '도적') {
        if (hasExtraAttack) {
            skillName = '그림자 습격';
            attackDescription = `그림자에서 나타나 추가 공격을 가했습니다!`;
        } else if (isCritical) {
            skillName = '암살';
            attackDescription = `은밀하게 접근해 치명적인 일격을 가했습니다!`;
        } else {
            const thiefAttacks = ['기습', '난도질', '독침'];
            skillName = thiefAttacks[Math.floor(Math.random() * thiefAttacks.length)];
            attackDescription = `날렵한 몸놀림으로 도둑을 공격했습니다.`;
        }
    } else if (className === '수호자') {
        if (isCritical) {
            skillName = '정의의 일격';
            attackDescription = `정의의 힘을 실어 강력한 일격을 날렸습니다!`;
        } else {
            const defenderAttacks = ['방패 강타', '성스러운 일격', '수호의 타격'];
            skillName = defenderAttacks[Math.floor(Math.random() * defenderAttacks.length)];
            attackDescription = `묵직한 방패로 도둑을 공격했습니다.`;
        }
    } else {
        // 엠블럼이 없는 경우
        if (isCritical) {
            skillName = '회심의 일격';
            attackDescription = `온 힘을 다해 강력한 일격을 날렸습니다!`;
        } else {
            skillName = '기본 공격';
            attackDescription = `도둑을 향해 공격했습니다.`;
        }
    }
    
    // HP 바 생성
    const hpPercentage = Math.floor((eventState.currentBoss.currentHp / eventState.currentBoss.maxHp) * 100);
    const barLength = 20;
    const filledLength = Math.floor((hpPercentage / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    const hpBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    const hpColor = hpPercentage > 60 ? '🟢' : hpPercentage > 30 ? '🟡' : '🔴';
    
    // 공격 결과 이모지
    const hitEmojis = ['💥', '⚡', '🔥', '❄️', '🌪️', '⭐', '💫'];
    const hitEmoji = hitEmojis[Math.floor(Math.random() * hitEmojis.length)];
    
    // 응답 메시지
    let responseEmbed = new EmbedBuilder()
        .setColor(isCritical ? '#FFD700' : '#FF6B6B')
        .setAuthor({ 
            name: `${classEmoji} ${className} ${user.nickname}`,
            iconURL: interaction.user.displayAvatarURL()
        })
        .setTitle(`${hitEmoji} ${skillName}!`)
        .setDescription(
            `${attackDescription}\n\n` +
            `**${eventState.currentBoss.name}**${isCritical ? '에게 치명적인 피해를 입혔습니다!' : '에게 피해를 입혔습니다!'}`
        );
    
    // 필드 추가
    let damageText = `**${damage.toLocaleString()}**`;
    if (isCritical) damageText += ' ⚡';
    
    responseEmbed.addFields(
        { 
            name: '💥 데미지', 
            value: damageText, 
            inline: true 
        }
    );
    
    // 특수 효과 표시
    let specialEffects = [];
    
    if (hasDoubleHit && className === '궁수') {
        specialEffects.push('🏹 **2연타 발동!**');
        responseEmbed.addFields({
            name: '🎯 추가 타격',
            value: `**${damageResult.doubleHitDamage.toLocaleString()}**`,
            inline: true
        });
    }
    
    if (hasExtraAttack && className === '도적') {
        specialEffects.push('🗡️ **그림자 공격!**');
        responseEmbed.addFields({
            name: '👤 추가 공격',
            value: `**${damageResult.extraDamage.toLocaleString()}**`,
            inline: true
        });
    }
    
    if (elementalDamage > 0 && className === '마법사') {
        specialEffects.push('🔮 **원소 피해!**');
        responseEmbed.addFields({
            name: '✨ 원소 데미지',
            value: `**${elementalDamage.toLocaleString()}**`,
            inline: true
        });
    }
    
    // 시너지 보너스가 있으면 표시
    if (damageResult.synergyBonus > 0) {
        specialEffects.push(`💪 **시너지 +${damageResult.synergyBonus}%**`);
    }
    
    // HP 상태
    responseEmbed.addFields({ 
        name: '📊 도둑 체력', 
        value: `${hpColor} ${hpBar}\n${eventState.currentBoss.currentHp.toLocaleString()}/${eventState.currentBoss.maxHp.toLocaleString()} (${hpPercentage}%)`, 
        inline: false 
    });
    
    // 특수 효과가 있으면 표시
    if (specialEffects.length > 0) {
        responseEmbed.addFields({
            name: '✨ 발동 효과',
            value: specialEffects.join('\n'),
            inline: false
        });
    }
    
    // 누적 통계
    responseEmbed.addFields({
        name: '📈 내 기록',
        value: `참여: ${userData.attacks}회 | 총 딜량: ${userData.totalDamage.toLocaleString()}`,
        inline: false
    });
    
    // 상태 저장 (공격 시마다)
    await saveEventState();
    
    // 보스 처치 확인
    if (eventState.currentBoss.currentHp <= 0) {
        eventState.totalBossesDefeated++; // 총 처치 수 증가
        responseEmbed.setColor('#00FF00')
            .setTitle(`🏆 ${skillName} 피니시!`);
        
        if (eventState.eventEndRequested) {
            // 이벤트 종료
            responseEmbed
                .setDescription(
                    `${classEmoji} **${className} ${user.nickname}**님의 화려한 마무리!\n\n` +
                    `🎉 **${eventState.currentBoss.name}**을(를) 쓰러뜨리고 댕댕봇의 목걸이를 되찾았습니다!\n` +
                    `💎 목걸이에는 댕댕봇의 이름이 새겨져 있네요!\n\n` +
                    `📢 **이벤트가 종료됩니다!** 잠시 후 보상이 지급됩니다.`
                )
                .setImage('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723800/victory.gif')
                .setFooter({ text: '🎊 축하합니다! 댕댕봇이 기뻐하고 있어요!' });
            
            // 이벤트 종료 처리
            setTimeout(() => distributeRewards(interaction.client), 3000);
        } else {
            const defeatMessages = [
                `화려한 콤보로 도둑을 쓰러뜨렸습니다!`,
                `완벽한 타이밍! 도둑이 나가떨어졌습니다!`,
                `압도적인 실력! 도둑이 항복했습니다!`,
                `전설적인 한 방! 도둑이 기절했습니다!`
            ];
            
            responseEmbed
                .setDescription(
                    `${classEmoji} **${className} ${user.nickname}**님의 ${defeatMessages[Math.floor(Math.random() * defeatMessages.length)]}\n\n` +
                    `💀 **${eventState.currentBoss.bossNumber}번째 도둑 ${eventState.currentBoss.name}** 처치 완료!\n` +
                    `💰 도둑의 주머니를 뒤졌지만... 목걸이는 없네요.\n` +
                    `🔍 다른 도둑을 찾아야 할 것 같습니다!\n\n` +
                    `📊 총 ${eventState.totalBossesDefeated}명의 도둑 처치`
                )
                .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723799/defeat.png');
            
            // 현재 보스 제거
            eventState.currentBoss = null;
            eventState.bossStartTime = null;
            
            // 다음 보스 스폰 예약
            setTimeout(() => spawnBoss(interaction.client), 5000);
        }
        
        // 처치 보너스 표시
        responseEmbed.addFields({
            name: '🎁 처치 보너스',
            value: `🏅 최종 일격 달성!\n💪 참여 횟수 +1 보너스`,
            inline: false
        });
    }
    
    // 이벤트 채널에 결과 전송
    const channel = interaction.client.channels.cache.get(eventState.eventChannel);
    if (channel) {
        await channel.send({ embeds: [responseEmbed] });
    }
}

// 랭킹 표시
async function showRanking(interaction) {
    // 버튼 응답 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        console.error('[이벤트] 랭킹 defer 오류:', error);
    }
    
    if (!eventState.active) {
        return;
    }
    
    // 참여 횟수 랭킹
    const attackRanking = Object.entries(eventState.participants)
        .sort((a, b) => b[1].attacks - a[1].attacks)
        .slice(0, 10);
    
    // 누적 딜량 랭킹
    const damageRanking = Object.entries(eventState.participants)
        .sort((a, b) => b[1].totalDamage - a[1].totalDamage)
        .slice(0, 10);
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 목걸이 도둑 잡기 이벤트 랭킹')
        .setTimestamp();
    
    // 참여 횟수 랭킹
    let attackText = '';
    for (let i = 0; i < attackRanking.length; i++) {
        const [userId, data] = attackRanking[i];
        const user = await User.findOne({ discordId: userId });
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        attackText += `${medal} **${user?.nickname || '알 수 없음'}** - ${data.attacks}회\n`;
    }
    
    // 누적 딜량 랭킹
    let damageText = '';
    for (let i = 0; i < damageRanking.length; i++) {
        const [userId, data] = damageRanking[i];
        const user = await User.findOne({ discordId: userId });
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        damageText += `${medal} **${user?.nickname || '알 수 없음'}** - ${data.totalDamage.toLocaleString()}\n`;
    }
    
    embed.addFields(
        { name: '⚔️ 참여 횟수 랭킹 (목걸이 보상)', value: attackText || '아직 참여자가 없습니다.', inline: true },
        { name: '💥 누적 딜량 랭킹 (골드 보상)', value: damageText || '아직 참여자가 없습니다.', inline: true }
    );
    
    // 이벤트 채널에 랭킹 전송
    const channel = interaction.client.channels.cache.get(eventState.eventChannel);
    if (channel) {
        await channel.send({ embeds: [embed] });
    }
}

// 보상 지급
async function distributeRewards(client) {
    if (!eventState.active) return;
    
    const channel = client.channels.cache.get(eventState.eventChannel);
    if (!channel) return;
    
    // 참여 횟수 랭킹
    const attackRanking = Object.entries(eventState.participants)
        .sort((a, b) => b[1].attacks - a[1].attacks);
    
    // 누적 딜량 랭킹
    const damageRanking = Object.entries(eventState.participants)
        .sort((a, b) => b[1].totalDamage - a[1].totalDamage);
    
    // 아이템 생성 준비
    const { createItem } = require('../../utils/itemCreator');
    
    // 참여 횟수 보상 (목걸이)
    const rankEnhancements = [15, 13, 10, 8, 0]; // 1-4등, 5등 이하
    
    for (let i = 0; i < attackRanking.length; i++) {
        const [userId, data] = attackRanking[i];
        const user = await User.findOne({ discordId: userId });
        if (!user) continue;
        
        const enhancement = i < 4 ? rankEnhancements[i] : rankEnhancements[4];
        
        // 댕댕이의 우정 목걸이 생성
        const necklace = {
            name: '댕댕이의 우정 목걸이',
            type: 'necklace',
            rarity: 'legendary',
            stats: {
                strength: 100,
                agility: 100,
                intelligence: 100,
                vitality: 100,
                luck: 100
            },
            enhanceLevel: enhancement,
            price: 1000000,
            description: '댕댕봇의 우정이 담긴 특별한 목걸이',
            itemTag: '이벤트 한정'
        };
        
        user.inventory.push(necklace);
        await user.save();
    }
    
    // 누적 딜량 보상 (골드)
    const goldRewards = [20000000, 10000000, 5000000]; // 1-3등
    
    for (let i = 0; i < damageRanking.length; i++) {
        const [userId, data] = damageRanking[i];
        const user = await User.findOne({ discordId: userId });
        if (!user) continue;
        
        const goldAmount = i < 3 ? goldRewards[i] : 1000000;
        user.gold += goldAmount;
        await user.save();
    }
    
    // 결과 발표
    const resultEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎊 목걸이 도둑 잡기 이벤트 종료!')
        .setDescription('댕댕봇의 목걸이를 무사히 되찾았습니다!\n모든 참여자분들께 감사드립니다.')
        .setTimestamp();
    
    // 참여 횟수 TOP 5
    let attackTop5 = '**[참여 횟수 랭킹 - 댕댕이의 우정 목걸이]**\n';
    for (let i = 0; i < Math.min(5, attackRanking.length); i++) {
        const [userId] = attackRanking[i];
        const user = await User.findOne({ discordId: userId });
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const enhancement = i < 4 ? rankEnhancements[i] : rankEnhancements[4];
        const rankName = require('../enhance/enhanceSystem').ENHANCE_SYSTEM.rankNames[enhancement];
        attackTop5 += `${medal} **${user?.nickname || '알 수 없음'}** - [${rankName}] 목걸이 획득\n`;
    }
    
    // 누적 딜량 TOP 3
    let damageTop3 = '**[누적 딜량 랭킹 - 골드 보상]**\n';
    for (let i = 0; i < Math.min(3, damageRanking.length); i++) {
        const [userId] = damageRanking[i];
        const user = await User.findOne({ discordId: userId });
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        const gold = goldRewards[i];
        damageTop3 += `${medal} **${user?.nickname || '알 수 없음'}** - ${gold.toLocaleString()} 골드\n`;
    }
    
    resultEmbed.addFields(
        { name: '🏆 수상자 명단', value: attackTop5 + '\n' + damageTop3, inline: false }
    );
    
    await channel.send({ embeds: [resultEmbed] });
    
    // 이벤트 정리
    clearAllIntervals();
    eventState.active = false;
    eventState.currentBoss = null;
    eventState.participants = {};
    eventState.eventChannel = null;
    eventState.bossCount = 0;
    eventState.totalBossesDefeated = 0;
    
    // 상태 저장 (이벤트 종료)
    await saveEventState();
}

// 이벤트 강제 종료 (관리자용)
async function forceEndEvent(client) {
    // 타이머 정리
    clearAllIntervals();
    
    // 이벤트 상태 완전 초기화
    eventState.active = false;
    eventState.currentBoss = null;
    eventState.participants = new Map();
    eventState.bossStartTime = null;
    eventState.eventChannel = null;
    eventState.eventEndRequested = false;
    eventState.bossCount = 0;
    eventState.totalBossesDefeated = 0;
    
    // 파일에 초기화된 상태 저장
    await saveEventState();
    
    console.log('[이벤트] 이벤트가 강제 종료되었습니다.');
    return { success: true, message: '이벤트가 강제 종료되었습니다.' };
}

// 이벤트 상태 디버그 정보 (관리자용)
async function getEventDebugInfo() {
    const distribution = await calculatePowerDistribution();
    
    const debugInfo = {
        active: eventState.active,
        bossCount: eventState.bossCount,
        totalBossesDefeated: eventState.totalBossesDefeated,
        participantCount: Object.keys(eventState.participants).length,
        currentBoss: eventState.currentBoss ? {
            name: eventState.currentBoss.name,
            tier: eventState.currentBoss.tier,
            hp: `${eventState.currentBoss.currentHp}/${eventState.currentBoss.maxHp}`,
            basedOnPower: eventState.currentBoss.basedOnPower,
            attackerCount: Object.keys(eventState.currentBoss.attackedUsers || {}).length
        } : null,
        powerDistribution: {
            totalUsers: distribution.userPowers.length,
            highThreshold: distribution.highThreshold,
            midThreshold: distribution.midThreshold,
            highTierCount: distribution.userPowers.filter(u => u.power >= distribution.highThreshold).length,
            midTierCount: distribution.userPowers.filter(u => u.power < distribution.highThreshold && u.power >= distribution.midThreshold).length,
            lowTierCount: distribution.userPowers.filter(u => u.power < distribution.midThreshold).length
        }
    };
    
    return debugInfo;
}

// 프로세스 종료 시 인터벌 정리
process.on('exit', () => {
    clearAllIntervals();
});

process.on('SIGINT', () => {
    clearAllIntervals();
    process.exit();
});

process.on('SIGTERM', () => {
    clearAllIntervals();
    process.exit();
});

module.exports = {
    eventState,
    startEvent,
    endEvent,
    attackBoss,
    showRanking,
    loadEventState,
    restoreEventTimers,
    forceEndEvent,
    getEventDebugInfo
};