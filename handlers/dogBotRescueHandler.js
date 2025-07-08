const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DOGBOT_RESCUE_EVENT, calculateDamage, getCurrentFloor, getHPPercentage, createProgressBar } = require('../data/dogBotRescueEvent');
const User = require('../models/User');
const stateManager = require('../systems/dogBotStateManager');
const announcer = require('../systems/dogBotEventAnnouncer');
const fs = require('fs');
const path = require('path');

// 닉네임 캐시 로드
let nicknameCache = {};
try {
    const cachePath = path.join(__dirname, '../data/userNicknameCache.json');
    if (fs.existsSync(cachePath)) {
        const cacheData = fs.readFileSync(cachePath, 'utf8');
        nicknameCache = JSON.parse(cacheData);
        delete nicknameCache.comment; // comment 필드 제거
        console.log('[댕댕봇구출] 닉네임 캐시 로드:', Object.keys(nicknameCache).length + '개');
    }
} catch (error) {
    console.error('[댕댕봇구출] 닉네임 캐시 로드 실패:', error);
}

// 쿨다운 관리
const attackCooldowns = new Map();

async function handleDogBotRescueInteraction(interaction) {
    const customId = interaction.customId;
    
    console.log(`[댕댕봇구출] 상호작용 처리: ${customId}`);
    
    try {
        if (customId === 'dogbot_attack') {
            return await handleAttack(interaction);
        } else if (customId === 'dogbot_ranking') {
            return await showRanking(interaction);
        } else if (customId === 'dogbot_status') {
            return await showStatus(interaction);
        }
    } catch (error) {
        console.error(`[댕댕봇구출] ${customId} 처리 오류:`, error);
        
        // 에러 응답
        const errorMessage = '⚠️ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        if (interaction.deferred) {
            await interaction.editReply({ content: errorMessage });
        } else if (!interaction.replied) {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
}

// 공격 처리
async function handleAttack(interaction) {
    try {
        console.log(`[댕댕봇구출] 공격 처리 시작 - ${interaction.user.id}`);
        
        // 이벤트 활성화 체크
        if (!stateManager.state || !stateManager.state.status || !stateManager.state.status.isActive) {
            console.log('[댕댕봇구출] 이벤트 비활성화 상태');
            return await interaction.reply({
                content: '🚫 현재 댕댕봇 구출 이벤트가 진행중이지 않습니다.',
                ephemeral: true
            });
        }
    
    // 이미 구출 완료
    if (stateManager.state.status.rescueComplete) {
        return await interaction.reply({
            content: '🎉 댕댕봇은 이미 구출되었습니다!',
            ephemeral: true
        });
    }
    
    // 이미 처리된 interaction인지 확인
    if (interaction.replied || interaction.deferred) {
        console.log('[댕댕봇구출] 이미 처리된 interaction');
        return;
    }
    
    await interaction.deferReply();
    
    const userId = interaction.user.id;
    const user = await User.findOne({ discordId: userId });
    
    if (!user || !user.registered) {
        const registrationEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🚫 회원가입이 필요합니다!')
            .setDescription('댕댕봇 구출 이벤트에 참여하려면 먼저 회원가입이 필요합니다.')
            .addFields(
                { name: '📝 회원가입 방법', value: '**#join 채널**로 이동하여 가입해주세요', inline: false },
                { name: '💡 안내', value: '회원가입 후 이벤트에 참여할 수 있습니다!', inline: false }
            )
            .setFooter({ text: '회원가입 후 다시 공격해주세요!' });
            
        const registerButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('register')
                    .setLabel('회원가입 하기')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );
            
        return await interaction.editReply({ 
            embeds: [registrationEmbed],
            components: [registerButton]
        });
    }
    
    // 쿨다운 체크
    const now = Date.now();
    const cooldownEnd = attackCooldowns.get(userId);
    
    if (cooldownEnd && cooldownEnd > now) {
        const remainingTime = Math.ceil((cooldownEnd - now) / 1000 / 60);
        
        const cooldownEmbed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('⏰ 쿨다운 중!')
            .setDescription(`다음 공격까지 **${remainingTime}분** 남았습니다.`)
            .addFields({
                name: '💡 팁',
                value: '• 10분마다 1회 공격 가능\n• 크리티컬 확률 10%\n• 모두 함께 힘을 합쳐주세요!',
                inline: false
            })
            .setFooter({ text: '잠시 후 다시 시도해주세요!' });
            
        return await interaction.editReply({
            embeds: [cooldownEmbed],
            components: []
        });
    }
    
    // 현재 층 정보
    const currentFloor = getCurrentFloor();
    const floorNum = stateManager.state.status.currentFloor;
    
    // 무기 정보 가져오기 (사전강화 데이터만 사용)
    let weaponData = null;
    let weaponName = '맨손';
    let enhanceLevel = 0;
    
    // 사전강화 데이터에서 무기 정보 가져오기 (중첩된 구조 처리)
    const prelaunchData = global.prelaunchEventData || {};
    let userPrelaunchData = null;
    
    // 중첩된 eventData 구조 처리
    if (prelaunchData.eventData && prelaunchData.eventData.eventData) {
        userPrelaunchData = prelaunchData.eventData.eventData[userId];
    } else if (prelaunchData.eventData) {
        userPrelaunchData = prelaunchData.eventData[userId];
    } else {
        // 직접 접근 시도 (백업 파일 형식)
        userPrelaunchData = prelaunchData[userId];
    }
    
    if (userPrelaunchData && userPrelaunchData.currentItem) {
        weaponName = userPrelaunchData.currentItem.name;
        enhanceLevel = userPrelaunchData.currentLevel || 0;
        weaponData = DOGBOT_RESCUE_EVENT.attack.weaponDamage[weaponName];
        
        console.log(`[댕댕봇구출] 사전강화 무기 사용 - ${user.nickname}: ${weaponName}+${enhanceLevel}`);
    } else {
        // 사전강화 참여하지 않은 유저
        console.log(`[댕댕봇구출] 사전강화 미참여 - ${user.nickname}: 맨손 사용`);
    }
    
    // 데미지 계산
    const damageResult = calculateDamage(
        DOGBOT_RESCUE_EVENT.attack.baseDamage.min,
        DOGBOT_RESCUE_EVENT.attack.baseDamage.max,
        weaponData,
        enhanceLevel
    );
    
    // HP 감소
    currentFloor.currentHP = Math.max(0, currentFloor.currentHP - damageResult.damage);
    stateManager.updateFloorHP(floorNum, currentFloor.currentHP);
    
    // 통계 기록
    stateManager.recordDamage(userId, damageResult.damage, floorNum, damageResult.isCritical);
    
    // 쿨다운 설정
    attackCooldowns.set(userId, now + DOGBOT_RESCUE_EVENT.attack.cooldown);
    
    // 결과 임베드
    const hpPercentage = getHPPercentage(currentFloor);
    const progressBar = createProgressBar(hpPercentage);
    
    // 재미있는 메시지 선택 (무기명과 강화 횟수 포함)
    const weaponDisplayName = enhanceLevel > 0 ? `${weaponName}+${enhanceLevel}` : weaponName;
    const attackMessages = [
        `🔨 **${user.nickname}**님이 [${weaponDisplayName}](으)로 펀치!`,
        `⚔️ **${user.nickname}**님의 화려한 [${weaponDisplayName}] 콤보!`,
        `💥 **${user.nickname}**님이 [${weaponDisplayName}](으)로 강력한 일격!`,
        `🎯 **${user.nickname}**님의 정확한 [${weaponDisplayName}] 공격!`,
        `🌟 **${user.nickname}**님이 [${weaponDisplayName}](으)로 멋진 한 방!`
    ];
    
    // 댕댕봇 응원 메시지
    const dogBotMessages = [
        '멍멍! 조금만 더 노력해줘멍! 🐕',
        '왈왈! 여러분이 최고예요멍! 🐕',
        '힘내라멍! 곧 구출될 것 같아멍! 🐕',
        '수학 문제 내고 싶어멍... 구해줘멍! 🐕',
        '개발자가 커피만 마시고 있어멍... 😭',
        '멍멍! 강해지는 게 느껴져멍! 💪',
        '왈왈! 이번 공격 멋있었어멍! ✨',
        '조금만 더! 할 수 있어멍! 🎯',
        '우리 곧 만날 수 있을 거예요멍! 🌟',
        '멍멍! 다들 고마워멍! 감동이야멍! 😢'
    ];

    // 특별한 상황별 메시지
    let specialMessage = '';
    const previousHP = currentFloor.currentHP + damageResult.damage;
    const hpBeforePercentage = Math.floor((previousHP / currentFloor.maxHP) * 100);
    
    // 체력 기반 특별 이벤트
    if (hpBeforePercentage > 50 && hpPercentage <= 50) {
        specialMessage = DOGBOT_RESCUE_EVENT.messages.specialEvents.halfHP;
    } else if (hpBeforePercentage > 20 && hpPercentage <= 20) {
        specialMessage = DOGBOT_RESCUE_EVENT.messages.specialEvents.lowHP;
    } else if (hpBeforePercentage > 10 && hpPercentage <= 10) {
        specialMessage = DOGBOT_RESCUE_EVENT.messages.specialEvents.nearDeath;
    }
    
    // 크리티컬 히트
    else if (damageResult.isCritical) {
        specialMessage = '🎊 **크리티컬 히트!** 댕댕봇이 환호합니다! "멍멍! 대박이야멍!"';
    } 
    // 첫 공격
    else if (stateManager.state.statistics.totalAttacks === 1) {
        specialMessage = DOGBOT_RESCUE_EVENT.messages.specialEvents.firstBlood;
    }
    // 유저 첫 공격
    else if (stateManager.state.statistics.userAttackCount[userId] === 1) {
        specialMessage = '🎉 **첫 참여!** 댕댕봇이 반갑게 인사합니다! "어서와멍! 고마워멍!"';
    }
    // 연속 공격 (콤보)
    else {
        const lastAttacks = stateManager.state.statistics.attackLog.slice(-10);
        let combo = 0;
        for (let i = lastAttacks.length - 1; i >= 0; i--) {
            if (lastAttacks[i].userId === userId) {
                combo++;
            } else {
                break;
            }
        }
        
        if (DOGBOT_RESCUE_EVENT.messages.comboMessages[combo]) {
            specialMessage = DOGBOT_RESCUE_EVENT.messages.comboMessages[combo];
        } else if (combo >= 10) {
            specialMessage = `🔥🔥 **${combo}연속 콤보!** 전설적인 연속 공격입니다!`;
        }
    }
    
    // 공격 횟수 기념
    if (stateManager.state.statistics.userAttackCount[userId] % 10 === 0) {
        specialMessage = `🏆 **${stateManager.state.statistics.userAttackCount[userId]}번째 공격!** 댕댕봇이 감탄합니다! "대단해멍!"`;
    }

    const embed = new EmbedBuilder()
        .setColor(damageResult.isCritical ? '#FFD700' : currentFloor.color)
        .setTitle(`${damageResult.isCritical ? '💥 크리티컬!' : '⚔️ 공격!'} ${currentFloor.name}`)
        .setDescription(attackMessages[Math.floor(Math.random() * attackMessages.length)])
        .addFields(
            { 
                name: '📊 공격 정보', 
                value: `👤 **${user.nickname}**\n🗡️ ${weaponName}${enhanceLevel > 0 ? `+${enhanceLevel}` : ''}\n💥 데미지: **${damageResult.damage.toLocaleString()}**${damageResult.isCritical ? ' (크리티컬!)' : ''}`, 
                inline: true 
            },
            {
                name: '📈 전투 통계',
                value: `⚔️ 공격 횟수: ${stateManager.state.statistics.userAttackCount[userId] || 1}회\n💯 누적 데미지: ${(stateManager.state.statistics.userDamage[userId] || damageResult.damage).toLocaleString()}`,
                inline: true
            }
        )
        .addFields({
            name: `${currentFloor.emoji || '🏰'} ${floorNum}층 보스 체력`,
            value: `${progressBar}\n${currentFloor.currentHP.toLocaleString()}/${currentFloor.maxHP.toLocaleString()} HP`,
            inline: false
        });
    
    // 특별 메시지 추가
    if (specialMessage) {
        embed.addFields({
            name: '✨ 특별 이벤트',
            value: specialMessage,
            inline: false
        });
    }
    
    // 댕댕봇 응원 메시지
    embed.addFields({
        name: '🐕 댕댕봇의 응원',
        value: `*"${dogBotMessages[Math.floor(Math.random() * dogBotMessages.length)]}"*`,
        inline: false
    });
    
    // 보스 대사
    if (hpPercentage > 70) {
        embed.addFields({
            name: '💬 보스의 반응',
            value: `*"${DOGBOT_RESCUE_EVENT.messages.developerQuotes.high[Math.floor(Math.random() * DOGBOT_RESCUE_EVENT.messages.developerQuotes.high.length)]}"*`,
            inline: false
        });
    } else if (hpPercentage > 30) {
        embed.addFields({
            name: '💬 보스의 반응',
            value: `*"${DOGBOT_RESCUE_EVENT.messages.developerQuotes.medium[Math.floor(Math.random() * DOGBOT_RESCUE_EVENT.messages.developerQuotes.medium.length)]}"*`,
            inline: false
        });
    } else {
        embed.addFields({
            name: '💬 보스의 반응',
            value: `*"${DOGBOT_RESCUE_EVENT.messages.developerQuotes.low[Math.floor(Math.random() * DOGBOT_RESCUE_EVENT.messages.developerQuotes.low.length)]}"*`,
            inline: false
        });
    }
    
    // 공격 결과 임베드는 버튼 없이 전송
    
    // 층 클리어 체크
    if (currentFloor.currentHP <= 0) {
        if (floorNum < stateManager.state.status.totalFloors) {
            // 다음 층으로
            stateManager.advanceFloor();
            const nextFloor = DOGBOT_RESCUE_EVENT.floors[floorNum + 1];
            
            embed.setColor('#00FF00')
                .setTitle('🎉 층 돌파!')
                .setDescription(DOGBOT_RESCUE_EVENT.messages.floorClear[floorNum])
                .setFields([]) // 기존 필드 제거
                .addFields(
                    {
                        name: '🎊 축하합니다!',
                        value: `**${currentFloor.name}**을(를) 물리쳤습니다!\n${user.nickname}님이 마지막 일격을 가했습니다!`,
                        inline: false
                    },
                    {
                        name: '🐕 댕댕봇의 메시지',
                        value: `*"멍멍! ${floorNum}층 클리어! 고마워멍! 이제 ${5 - floorNum}층만 남았어멍!"*`,
                        inline: false
                    },
                    {
                        name: `⬆️ 다음 층: ${nextFloor.emoji} ${nextFloor.name}`,
                        value: `체력: ${nextFloor.maxHP.toLocaleString()} HP\n${nextFloor.description}`,
                        inline: false
                    }
                );
            
            // 층 클리어 시에도 버튼 없이
        } else {
            // 이벤트 완료
            stateManager.endEvent();
            
            // 자동 공지 중지
            announcer.stopAnnouncements();
            
            // 전체 통계
            const totalTime = Math.floor((Date.now() - stateManager.state.status.startTime) / 1000 / 60);
            
            // 완료 공지 발송을 위한 통계 준비
            const completionStats = {
                totalTime: totalTime,
                participants: stateManager.state.statistics.participants.length,
                totalAttacks: stateManager.state.statistics.totalAttacks,
                totalDamage: stateManager.state.statistics.totalDamage,
                mvp: stateManager.state.statistics.mvp,
                userAttackCount: stateManager.state.statistics.userAttackCount
            };
            
            // 공격 횟수 1등 찾기
            const attackRanking = Object.entries(stateManager.state.statistics.userAttackCount || {})
                .sort((a, b) => b[1] - a[1]);
            
            let attackMVPMessage = '';
            if (attackRanking.length > 0 && attackRanking[0][1] > 0) {
                const attackMVPId = attackRanking[0][0];
                const attackMVPUser = await User.findOne({ discordId: attackMVPId });
                
                // 공격 횟수 1등에게 칭호 지급
                if (attackMVPUser) {
                    if (!attackMVPUser.titles) attackMVPUser.titles = [];
                    if (!attackMVPUser.titles.includes('댕댕봇 구출자')) {
                        attackMVPUser.titles.push('댕댕봇 구출자');
                        await attackMVPUser.save();
                    }
                    attackMVPMessage = `\n🎖️ **댕댕봇 구출자** 칭호 획득!`;
                }
            }
            
            // 긴급 속보 공지 발송
            if (interaction.client) {
                announcer.sendCompletionAnnouncement(interaction.client, completionStats);
            }
            
            embed.setColor('#FFD700')
                .setTitle('🎊 댕댕봇 구출 성공!')
                .setDescription(DOGBOT_RESCUE_EVENT.messages.floorClear[5])
                .setImage('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723787/dogbot.png')
                .setFields([]) // 기존 필드 제거
                .addFields(
                    {
                        name: '🐕 댕댕봇의 감사 인사',
                        value: '*"멍멍! 구해줘서 정말 고마워멍! 이제 다시 수학 문제를 낼 수 있어멍! 왈왈!"*',
                        inline: false
                    },
                    {
                        name: '📊 최종 통계',
                        value: `⏱️ 소요 시간: **${totalTime}분**\n` +
                               `👥 참여자: **${stateManager.state.statistics.participants.length}명**\n` +
                               `⚔️ 총 공격: **${stateManager.state.statistics.totalAttacks}회**\n` +
                               `💥 총 데미지: **${stateManager.state.statistics.totalDamage.toLocaleString()}**`,
                        inline: true
                    },
                    {
                        name: '🏆 MVP (딜량)',
                        value: `<@${stateManager.state.statistics.mvp.userId}>\n${stateManager.state.statistics.mvp.damage.toLocaleString()} 데미지`,
                        inline: true
                    }
                );
            
            // 공격 횟수 1등 표시
            if (attackRanking.length > 0 && attackRanking[0][1] > 0) {
                const attackMVPUser = await User.findOne({ discordId: attackRanking[0][0] });
                embed.addFields({
                    name: '⚔️ 공격왕 (공격 횟수)',
                    value: `<@${attackRanking[0][0]}>\n${attackRanking[0][1]}회 공격${attackMVPMessage}`,
                    inline: true
                });
            }
            
            embed.addFields({
                name: '💬 개발자의 한마디',
                value: '*"이런... 결국 댕댕봇을 빼앗겼군... 다음엔 더 많은 버그를 준비하겠어..."*',
                inline: false
            });
            
            // 이벤트 완료 시에도 버튼 없이
        }
    }
    
    return await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('[댕댕봇구출] 공격 처리 오류:', error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: '⚠️ 공격 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
            });
        } else if (!interaction.replied) {
            await interaction.reply({
                content: '⚠️ 공격 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                ephemeral: true
            });
        }
    }
}

// 딜 순위 표시
async function showRanking(interaction) {
    await interaction.deferReply();
    
    // state 체크
    if (!stateManager.state || !stateManager.state.status) {
        return await interaction.editReply({
            content: '⏳ 데이터를 로드중입니다. 잠시 후 다시 시도해주세요.'
        });
    }
    
    // 이벤트 활성화 체크
    if (!stateManager.state.status.isActive) {
        return await interaction.editReply({
            content: '🚫 현재 댕댕봇 구출 이벤트가 진행중이지 않습니다.'
        });
    }
    
    const rankings = stateManager.getDamageRanking();
    
    if (rankings.length === 0) {
        return await interaction.editReply({
            content: '📊 아직 아무도 공격하지 않았습니다!'
        });
    }
    
    // 순위별 메달
    const medals = ['🥇', '🥈', '🥉'];
    
    // 딜량 순위 텍스트 생성
    let rankingText = '';
    for (let i = 0; i < Math.min(10, rankings.length); i++) {
        const rank = rankings[i];
        const medal = medals[i] || `**${i + 1}.**`;
        let nickname = '알 수 없음';
        
        // unknown이 아닌 경우에만 DB 조회
        if (rank.userId !== 'unknown') {
            const user = await User.findOne({ discordId: rank.userId });
            if (user && user.nickname) {
                nickname = user.nickname;
            } else {
                // DB에 없는 경우 Discord API로 직접 조회 시도
                try {
                    const discordUser = await interaction.client.users.fetch(rank.userId);
                    nickname = discordUser.username || `익명유저`;
                } catch (error) {
                    // 파일 기반 캐시된 닉네임 확인
                    nickname = nicknameCache[rank.userId] || `탈퇴유저`;
                }
            }
        }
        
        rankingText += `${medal} **${nickname}**\n`;
        rankingText += `　　💥 총 데미지: **${rank.damage.toLocaleString()}**\n`;
        rankingText += `　　⚔️ 공격 횟수: ${rank.attacks}회\n\n`;
    }
    
    // 공격 횟수 순위 생성
    const attackRanking = Object.entries(stateManager.state.statistics.userAttackCount || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    let attackRankingText = '';
    for (let i = 0; i < attackRanking.length; i++) {
        const [userId, attackCount] = attackRanking[i];
        const medal = medals[i] || `**${i + 1}.**`;
        let nickname = '알 수 없음';
        
        // unknown이 아닌 경우에만 DB 조회
        if (userId !== 'unknown') {
            const user = await User.findOne({ discordId: userId });
            if (user && user.nickname) {
                nickname = user.nickname;
            } else {
                // DB에 없는 경우 Discord API로 직접 조회 시도
                try {
                    const discordUser = await interaction.client.users.fetch(userId);
                    nickname = discordUser.username || `익명유저`;
                } catch (error) {
                    // 파일 기반 캐시된 닉네임 확인
                    nickname = nicknameCache[userId] || `탈퇴유저`;
                }
            }
        }
        
        attackRankingText += `${medal} **${nickname}**\n`;
        attackRankingText += `　　⚔️ 공격 횟수: **${attackCount}회**\n`;
        if (i === 0) {
            attackRankingText += `　　🎖️ **댕댕봇 구출자** 칭호 보유\n`;
        }
        attackRankingText += '\n';
    }
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 댕댕봇 구출 순위')
        .setDescription('딜량과 공격 횟수 순위를 확인하세요!')
        .addFields(
            {
                name: '💥 딜량 순위',
                value: rankingText || '아직 데이터가 없습니다.',
                inline: true
            },
            {
                name: '⚔️ 공격 횟수 순위',
                value: attackRankingText || '아직 데이터가 없습니다.',
                inline: true
            }
        )
        .addFields({
            name: '📊 전체 통계',
            value: `👥 참여자: **${stateManager.state.statistics.participants.length}명**\n` +
                   `⚔️ 총 공격: **${stateManager.state.statistics.totalAttacks}회**\n` +
                   `💥 총 데미지: **${stateManager.state.statistics.totalDamage.toLocaleString()}**`,
            inline: false
        })
        .setFooter({ text: '10분마다 공격 가능 • 함께 힘을 모아주세요!' })
        .setTimestamp();
    
    // 층별 MVP
    const floorMVPs = Object.entries(stateManager.state.statistics.floorMVP);
    if (floorMVPs.length > 0) {
        let mvpText = '';
        const processedFloors = new Set(); // 중복 방지
        
        for (const [floor, mvp] of floorMVPs) {
            if (mvp.userId) {
                // floor3와 3을 같은 것으로 처리
                const floorNum = floor.replace('floor', '');
                
                // 이미 처리한 층이면 건너뛰기
                if (processedFloors.has(floorNum)) {
                    continue;
                }
                processedFloors.add(floorNum);
                
                const user = await User.findOne({ discordId: mvp.userId });
                mvpText += `**${floorNum}층**: ${user?.nickname || '알 수 없음'} (${mvp.damage.toLocaleString()})\n`;
            }
        }
        if (mvpText) {
            embed.addFields({
                name: '🌟 층별 MVP',
                value: mvpText,
                inline: false
            });
        }
    }
    
    return await interaction.editReply({ embeds: [embed] });
}

// 현황 표시
async function showStatus(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    // state 체크
    if (!stateManager.state || !stateManager.state.status) {
        return await interaction.editReply({
            content: '⏳ 데이터를 로드중입니다. 잠시 후 다시 시도해주세요.'
        });
    }
    
    // 이벤트 활성화 체크
    if (!stateManager.state.status.isActive) {
        return await interaction.editReply({
            content: '🚫 현재 댕댕봇 구출 이벤트가 진행중이지 않습니다.'
        });
    }
    
    const currentFloor = getCurrentFloor();
    const floorNum = stateManager.state.status.currentFloor;
    const hpPercentage = getHPPercentage(currentFloor);
    const progressBar = createProgressBar(hpPercentage);
    
    const embed = new EmbedBuilder()
        .setColor(currentFloor.color)
        .setTitle(`🏰 댕댕봇 구출 작전 현황`)
        .setDescription(stateManager.state.status.isActive ? 
            '🚨 **현재 진행 중!**' : 
            stateManager.state.status.rescueComplete ? 
            '✅ **구출 완료!**' : 
            '⏸️ **대기 중**')
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723787/dogbot.png');
    
    if (stateManager.state.status.isActive) {
        embed.addFields(
            {
                name: `📍 현재 위치: ${floorNum}층 - ${currentFloor.name}`,
                value: currentFloor.description,
                inline: false
            },
            {
                name: '💀 보스 정보',
                value: `${currentFloor.bossQuote}`,
                inline: false
            },
            {
                name: '❤️ 보스 체력',
                value: `${progressBar}\n${currentFloor.currentHP.toLocaleString()}/${currentFloor.maxHP.toLocaleString()} HP`,
                inline: false
            }
        );
        
        // 최근 공격 로그
        const recentAttacks = stateManager.state.statistics.attackLog.slice(-5).reverse();
        if (recentAttacks.length > 0) {
            let logText = '';
            for (const attack of recentAttacks) {
                const user = await User.findOne({ discordId: attack.userId });
                const timeAgo = Math.floor((Date.now() - attack.timestamp) / 1000 / 60);
                logText += `• **${user?.nickname || '알 수 없음'}** - ${attack.damage.toLocaleString()}${attack.isCritical ? ' 💥' : ''} (${timeAgo}분 전)\n`;
            }
            embed.addFields({
                name: '📜 최근 공격 기록',
                value: logText,
                inline: false
            });
        }
    }
    
    // 진행 상황
    let progressText = '';
    for (let i = 1; i <= stateManager.state.status.totalFloors; i++) {
        const floor = stateManager.state.floors[i];
        const cleared = i < floorNum || (i === floorNum && floor.currentHP <= 0);
        progressText += cleared ? '✅ ' : i === floorNum ? '🔥 ' : '⬜ ';
        progressText += `**${i}층** ${DOGBOT_RESCUE_EVENT.floors[i].name}\n`;
    }
    
    embed.addFields({
        name: '🗺️ 전체 진행도',
        value: progressText,
        inline: false
    });
    
    
    return await interaction.editReply({ embeds: [embed] });
}

module.exports = {
    handleDogBotRescueInteraction,
    attackCooldowns
};