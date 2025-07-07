const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const ENHANCE_EVENT = require('../data/prelaunchEvent');
const { savePrelaunchData } = require('../handlers/events/prelaunchEvent');

// 쿨타임 관리
const enhanceCooldowns = new Map();

// 사전강화 메인 핸들러
async function handlePrelaunchEnhance(interaction) {
    await interaction.deferReply();
    
    // 이벤트 종료 확인
    if (global.serverOpened || global.prelaunchEventEnded) {
        return await interaction.editReply({
            content: '❌ 사전강화 이벤트가 종료되었습니다!\n서버 오픈 후 `/회원가입` 명령어로 가입하시면 사전강화 데이터가 연동됩니다.',
            // 모두에게 보이도록 flags 제거
        });
    }
    
    const userId = interaction.user.id;
    
    // 유저 데이터 초기화
    if (!global.prelaunchEventData) {
        global.prelaunchEventData = {};
    }
    
    if (!global.prelaunchEventData[userId]) {
        global.prelaunchEventData[userId] = {
            nickname: interaction.user.username,
            points: 0,
            currentLevel: 0,
            currentItem: null,
            totalEnhanced: 0,
            dogBotBonus: 0,
            lastDaily: null,
            successStreak: 0,
            failStreak: 0,
            achievements: [],
            totalTries: 0,
            totalSuccess: 0,
            totalFail: 0
        };
    } else {
        // 기존 유저도 닉네임 업데이트
        if (!global.prelaunchEventData[userId].nickname) {
            global.prelaunchEventData[userId].nickname = interaction.user.username;
        }
        // 필수 필드 초기화
        if (global.prelaunchEventData[userId].dogBotBonus === undefined) {
            global.prelaunchEventData[userId].dogBotBonus = 0;
        }
        if (global.prelaunchEventData[userId].totalSuccess === undefined) {
            global.prelaunchEventData[userId].totalSuccess = 0;
        }
        if (global.prelaunchEventData[userId].totalFail === undefined) {
            global.prelaunchEventData[userId].totalFail = 0;
        }
    }
    
    const userData = global.prelaunchEventData[userId];
    
    // 아이템이 없으면 선택 메뉴 표시
    if (!userData.currentItem) {
        return await showItemSelection(interaction);
    }
    
    // 강화 메뉴 표시
    return await showEnhanceMenu(interaction);
}

// 아이템 선택 메뉴
async function showItemSelection(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎯 사전강화 이벤트 - 아이템 선택')
        .setDescription('강화할 아이템을 선택하세요!\n\n💎 **포인트 1점 = 1골드로 정식 오픈 시 지급됩니다!**')
        .setFooter({ text: '아이템 선택 후 강화를 시작할 수 있습니다!' });
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('prelaunch_item_select')
        .setPlaceholder('🎯 강화할 아이템을 선택하세요')
        .addOptions(
            ENHANCE_EVENT.virtualItems.map(item => ({
                label: item.name,
                description: `난이도: ${item.difficulty}`,
                value: item.name,
                emoji: item.emoji
            }))
        );
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    return await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

// 강화 메뉴 표시
async function showEnhanceMenu(interaction) {
    const userId = interaction.user.id;
    const userData = global.prelaunchEventData[userId];
    const currentItem = userData.currentItem;
    
    // 성공률 계산
    const successRate = ENHANCE_EVENT.getSuccessRate(currentItem.baseSuccess, userData.currentLevel);
    
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎯 사전강화 이벤트')
        .setDescription(
            `**${currentItem.emoji} ${currentItem.name} +${userData.currentLevel}**\n\n` +
            `📊 강화 성공률: **${successRate}%**\n` +
            `💰 현재 포인트: **${(userData.points || 0).toLocaleString()}P**\n` +
            `🎯 총 강화 횟수: **${(userData.totalEnhanced || userData.attempts || 0)}회**`
        )
        .addFields(
            {
                name: '📈 통계',
                value: `성공: ${userData.totalSuccess || Math.floor((userData.attempts || 0) * 0.6)}회\n실패: ${userData.totalFail || Math.floor((userData.attempts || 0) * 0.4)}회`,
                inline: true
            },
            {
                name: '🔥 연속',
                value: `성공: ${userData.successStreak || 0}연속\n실패: ${userData.failStreak || 0}연속`,
                inline: true
            }
        )
        .setFooter({ text: '🎊 실패해도 레벨이 내려가지 않습니다!' });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`prelaunch_enhance_${userId}`)
                .setLabel('⚒️ 강화하기')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔨'),
            new ButtonBuilder()
                .setCustomId(`prelaunch_auto_enhance_${userId}`)
                .setLabel('🔄 10회 자동강화')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`prelaunch_change_item_${userId}`)
                .setLabel('🔄 아이템 변경')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`prelaunch_leaderboard_${userId}`)
                .setLabel('🏅 순위 확인')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const exitButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 게임으로 돌아가기')
                .setStyle(ButtonStyle.Danger)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons, exitButton]
    });
}

// 강화 실행
async function executeEnhance(interaction, isAuto = false, autoCount = 1) {
    console.log('[Prelaunch] executeEnhance called, isAuto:', isAuto, 'autoCount:', autoCount);
    
    const userId = interaction.user.id;
    const userData = global.prelaunchEventData[userId];
    
    if (!userData || !userData.currentItem) {
        return await interaction.editReply({
            content: '❌ 먼저 아이템을 선택해주세요!'
        });
    }
    
    // 쿨타임 체크
    const now = Date.now();
    const cooldownKey = `${userId}_${isAuto ? 'auto' : 'single'}`;
    const cooldownTime = isAuto ? 30000 : 3000; // 10회: 30초, 1회: 3초
    
    if (enhanceCooldowns.has(cooldownKey)) {
        const expirationTime = enhanceCooldowns.get(cooldownKey);
        if (now < expirationTime) {
            const timeLeft = Math.ceil((expirationTime - now) / 1000);
            return await interaction.editReply({
                content: `⏱️ 쿨타임 중입니다! ${timeLeft}초 후에 다시 시도해주세요.`,
                embeds: [],
                components: []
            });
        }
    }
    
    // 쿨타임 설정
    enhanceCooldowns.set(cooldownKey, now + cooldownTime);
    
    // 30분 후 쿨타임 자동 정리
    setTimeout(() => {
        enhanceCooldowns.delete(cooldownKey);
    }, 1800000);
    
    let results = [];
    let totalPointsGained = 0;
    
    for (let i = 0; i < autoCount; i++) {
        const currentLevel = userData.currentLevel;
        const successRate = ENHANCE_EVENT.getSuccessRate(userData.currentItem.baseSuccess, currentLevel);
        const random = Math.random() * 100;
        const success = random < successRate;
        
        userData.totalEnhanced = (userData.totalEnhanced || 0) + 1;
        userData.totalTries = (userData.totalTries || 0) + 1;
        userData.attempts = (userData.attempts || 0) + 1; // 기존 데이터 호환
        
        let pointsGained = 0;
        let message = '';
        
        if (success) {
            userData.currentLevel++;
            userData.totalSuccess = (userData.totalSuccess || 0) + 1;
            userData.successStreak = (userData.successStreak || 0) + 1;
            userData.failStreak = 0;
            
            // 포인트 계산
            pointsGained = ENHANCE_EVENT.basePoints.success + (currentLevel * ENHANCE_EVENT.basePoints.levelBonus);
            
            // 연속 성공 보너스
            const streakBonus = ENHANCE_EVENT.streakBonus.success[userData.successStreak];
            if (streakBonus) {
                pointsGained += streakBonus.points;
                message = streakBonus.message;
            }
            
            results.push({
                success: true,
                from: currentLevel,
                to: userData.currentLevel,
                points: pointsGained,
                message: message
            });
        } else {
            userData.totalFail = (userData.totalFail || 0) + 1;
            userData.failStreak = (userData.failStreak || 0) + 1;
            userData.successStreak = 0;
            
            // 실패 포인트
            pointsGained = ENHANCE_EVENT.basePoints.fail;
            
            // 연속 실패 보너스
            const streakBonus = ENHANCE_EVENT.streakBonus.fail[userData.failStreak];
            if (streakBonus) {
                pointsGained += streakBonus.points;
                message = streakBonus.message;
            }
            
            results.push({
                success: false,
                level: currentLevel,
                points: pointsGained,
                message: message
            });
        }
        
        userData.points += pointsGained;
        totalPointsGained += pointsGained;
        
        // 최대 레벨 체크
        if (userData.currentLevel >= userData.currentItem.maxLevel) {
            userData.currentLevel = userData.currentItem.maxLevel;
            break;
        }
    }
    
    // 데이터 저장
    savePrelaunchData();
    
    // 결과 표시
    try {
        if (isAuto) {
            await showAutoEnhanceResults(interaction, results, totalPointsGained);
        } else {
            await showEnhanceResult(interaction, results[0]);
        }
        return true;
    } catch (error) {
        console.error('[Prelaunch] Error showing results:', error);
        throw error;
    }
}

// 단일 강화 결과 표시
async function showEnhanceResult(interaction, result) {
    const userId = interaction.user.id;
    const userData = global.prelaunchEventData[userId];
    
    // 게임 닉네임 가져오기
    let nickname = userData.nickname || interaction.user.username;
    try {
        const User = require('../models/User');
        const gameUser = await User.findOne({ discordId: userId });
        if (gameUser && gameUser.nickname) {
            nickname = gameUser.nickname;
        }
    } catch (error) {
        // 에러 무시
    }
    
    // 재미있는 메시지 생성
    let title, description, emoji;
    
    if (result.success) {
        const successMessages = [
            { title: '🎊 대박! 터졌다!', desc: '눈 감고도 성공!' },
            { title: '⚡ 번개같은 성공!', desc: '순식간에 올라갔다!' },
            { title: '🌟 별이 빛나는 순간!', desc: '완벽한 타이밍!' },
            { title: '🔥 불타오르는 성공!', desc: '뜨거운 행운!' },
            { title: '💎 다이아몬드 손!', desc: '황금빛 성공!' },
            { title: '🎯 정확한 한 방!', desc: '백발백중!' },
            { title: '🌈 무지개가 떴다!', desc: '행운의 여신이 미소짓는다!' }
        ];
        
        const msg = successMessages[Math.floor(Math.random() * successMessages.length)];
        title = msg.title;
        emoji = '✅';
        
        // 특별한 레벨 도달 시 추가 메시지
        if (userData.currentLevel % 10 === 0) {
            description = `🎉 **${nickname}**님이 **+${userData.currentLevel}**을 달성했습니다!\n${msg.desc}`;
        } else if (userData.currentLevel >= 100) {
            description = `⚡ **${nickname}**님의 ${userData.currentItem.name}이(가) **+${result.from} → +${result.to}**로 강화되었습니다!\n💯 100강 이상의 전설적인 무기!`;
        } else {
            description = `**${nickname}**님의 ${userData.currentItem.name}이(가) **+${result.from} → +${result.to}**로 강화되었습니다!\n${msg.desc}`;
        }
    } else {
        const failMessages = [
            { title: '💥 펑! 터졌다...', desc: '아이템이 연기를 뿜고 있다...' },
            { title: '😭 눈물의 실패...', desc: '오늘은 운이 없는 날...' },
            { title: '💔 심장이 아프다...', desc: '다음엔 꼭 성공할거야!' },
            { title: '🌧️ 비가 내린다...', desc: '실패의 눈물이...' },
            { title: '⚰️ 잠시 묵념...', desc: '강화의 신이 외면했다...' },
            { title: '🎭 희극과 비극', desc: '오늘은 비극의 날...' },
            { title: '🌑 암흑의 순간...', desc: '빛이 보이지 않는다...' }
        ];
        
        const msg = failMessages[Math.floor(Math.random() * failMessages.length)];
        title = msg.title;
        emoji = '❌';
        description = `**${nickname}**님의 ${userData.currentItem.name} **+${result.level}** 강화 시도...\n${msg.desc}`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${title}`)
        .setColor(result.success ? '#00FF00' : '#FF0000')
        .setDescription(description)
        .addFields({
            name: '💰 획득 포인트',
            value: `+${result.points}P`,
            inline: true
        });
    
    if (result.message) {
        embed.addFields({
            name: '🎊 특별 보너스!',
            value: result.message,
            inline: true
        });
    }
    
    // 현재 상태 추가
    embed.addFields({
        name: '📊 현재 상태',
        value: `레벨: **+${userData.currentLevel}** | 총 포인트: **${userData.points.toLocaleString()}P**`,
        inline: false
    });
    
    // 쿨타임 정보 추가
    embed.addFields({
        name: '⏱️ 쿨타임',
        value: '1회 강화: 3초 | 10회 자동강화: 30초',
        inline: false
    });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('prelaunch_enhance')
                .setLabel('⚒️ 계속 강화')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('prelaunch_auto_enhance')
                .setLabel('🔄 10회 자동강화')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('prelaunch_menu')
                .setLabel('📋 메뉴로')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 게임으로')
                .setStyle(ButtonStyle.Danger)
        );
    
    // 모든 유저가 볼 수 있도록 editReply 사용
    await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 자동 강화 결과 표시
async function showAutoEnhanceResults(interaction, results, totalPoints) {
    console.log('[Prelaunch] showAutoEnhanceResults called with', results.length, 'results');
    
    const userId = interaction.user.id;
    const userData = global.prelaunchEventData[userId];
    
    // 게임 닉네임 가져오기
    let nickname = userData.nickname || interaction.user.username;
    try {
        const User = require('../models/User');
        const gameUser = await User.findOne({ discordId: userId });
        if (gameUser && gameUser.nickname) {
            nickname = gameUser.nickname;
        }
    } catch (error) {
        // 에러 무시
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const startLevel = results[0].success ? results[0].from : results[0].level;
    
    // 결과에 따른 타이틀 선택
    let title, color;
    if (successCount >= 8) {
        title = '🎊 대박! 환상적인 결과!';
        color = '#FFD700';
    } else if (successCount >= 5) {
        title = '✨ 좋은 결과입니다!';
        color = '#00FF00';
    } else if (successCount >= 3) {
        title = '😅 그럭저럭 괜찮네요';
        color = '#FFA500';
    } else {
        title = '😭 오늘은 운이 없는 날...';
        color = '#FF0000';
    }
    
    // 상세 결과 문자열 생성
    let resultDetails = '';
    let consecutiveSuccess = 0;
    let consecutiveFail = 0;
    
    results.forEach((result, index) => {
        if (result.success) {
            consecutiveSuccess++;
            consecutiveFail = 0;
            if (consecutiveSuccess >= 3) {
                resultDetails += `✅`;
            } else {
                resultDetails += `✅`;
            }
        } else {
            consecutiveFail++;
            consecutiveSuccess = 0;
            if (consecutiveFail >= 3) {
                resultDetails += `💥`;
            } else {
                resultDetails += `❌`;
            }
        }
        
        if ((index + 1) % 5 === 0) resultDetails += '\n';
    });
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(
            `**${nickname}**님의 10회 자동강화 결과!\n\n` +
            `${userData.currentItem.emoji} ${userData.currentItem.name} **+${startLevel} → +${userData.currentLevel}**\n\n` +
            `${resultDetails}\n\n` +
            `📊 **결과 요약**\n` +
            `✅ 성공: ${successCount}회 (${(successCount * 10)}%)\n` +
            `❌ 실패: ${failCount}회 (${(failCount * 10)}%)\n` +
            `📈 레벨 상승: **+${userData.currentLevel - startLevel}**\n\n` +
            `💰 획득 포인트: **+${totalPoints}P**`
        );
    
    // 특별한 결과에 대한 추가 메시지
    if (successCount === 10) {
        embed.addFields({
            name: '🌟 퍼펙트!',
            value: '10연속 성공! 전설이 되었습니다!',
            inline: false
        });
    } else if (successCount === 0) {
        embed.addFields({
            name: '💀 망했어요...',
            value: '10연속 실패... 다음엔 잘될거예요!',
            inline: false
        });
    }
    
    embed.setFooter({ text: `총 포인트: ${userData.points.toLocaleString()}P | 현재 레벨: +${userData.currentLevel}` });
    
    // 쿨타임 정보 추가
    embed.addFields({
        name: '⏱️ 쿨타임',
        value: '1회 강화: 3초 | 10회 자동강화: 30초',
        inline: false
    });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('prelaunch_auto_enhance')
                .setLabel('🔄 다시 10회')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('prelaunch_enhance')
                .setLabel('⚒️ 단일 강화')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('prelaunch_menu')
                .setLabel('📋 메뉴로')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 게임으로')
                .setStyle(ButtonStyle.Danger)
        );
    
    // 모든 유저가 볼 수 있도록 editReply 사용
    await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 순위표 표시
async function showLeaderboard(interaction) {
    // 포인트 순으로 정렬
    const rankings = await Promise.all(
        Object.entries(global.prelaunchEventData)
            .sort(([, a], [, b]) => b.points - a.points)
            .slice(0, 20)
            .map(async ([userId, data]) => {
                // 게임 닉네임 가져오기
                let nickname = 'Unknown';
                
                // 1. prelaunchEventData에 저장된 닉네임 확인
                if (data.nickname) {
                    nickname = data.nickname;
                } else {
                    try {
                        // 2. MongoDB에서 게임 닉네임 확인
                        const User = require('../models/User');
                        const gameUser = await User.findOne({ discordId: userId });
                        if (gameUser && gameUser.nickname) {
                            nickname = gameUser.nickname;
                            // prelaunchEventData에 닉네임 저장
                            data.nickname = nickname;
                        } else {
                            // 3. Discord 닉네임 사용
                            const discordUser = await interaction.client.users.fetch(userId);
                            nickname = discordUser.username;
                            // prelaunchEventData에 닉네임 저장
                            data.nickname = nickname;
                        }
                    } catch (error) {
                        console.log(`유저 ${userId} 정보를 가져올 수 없음`);
                        // 기본값 사용
                        if (!data.nickname) {
                            nickname = `User_${userId.slice(-4)}`;
                            data.nickname = nickname;
                        }
                    }
                }
                
                return {
                    userId,
                    nickname,
                    points: data.points || 0,
                    currentLevel: data.currentLevel || 0,
                    itemName: data.currentItem ? data.currentItem.name : '없음'
                };
            })
    );
    
    const userRank = rankings.findIndex(r => r.userId === interaction.user.id) + 1;
    
    const embed = new EmbedBuilder()
        .setTitle('🏅 사전강화 이벤트 순위')
        .setColor('#FFD700')
        .setDescription(
            rankings.map((r, i) => {
                const rank = i + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
                return `${medal} **${r.nickname}** - ${r.points.toLocaleString()}P (${r.itemName} +${r.currentLevel})`;
            }).join('\n')
        )
        .setFooter({ text: userRank > 0 ? `내 순위: ${userRank}위` : '순위권 밖' });
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('prelaunch_menu')
                .setLabel('🔙 메뉴로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({
        embeds: [embed],
        components: [backButton]
    });
    
    // 닉네임 정보 저장
    savePrelaunchData();
}

// 인터랙션 처리
async function handlePrelaunchInteraction(interaction) {
    const customId = interaction.customId;
    console.log('[Prelaunch] handlePrelaunchInteraction called with:', customId);
    
    // 버튼 검증 (사용자 ID가 포함된 버튼)
    if (customId.includes('_')) {
        const parts = customId.split('_');
        const buttonOwnerId = parts[parts.length - 1];
        
        // 버튼 주인이 아닌 경우
        if (buttonOwnerId !== interaction.user.id && !isNaN(buttonOwnerId)) {
            return await interaction.reply({
                content: '❌ 다른 사람의 강화 버튼은 사용할 수 없습니다!',
                flags: 64
            });
        }
    }
    
    // 아이템 선택
    if (customId === 'prelaunch_item_select') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        
        const selectedItemName = interaction.values[0];
        const selectedItem = ENHANCE_EVENT.virtualItems.find(item => item.name === selectedItemName);
        
        const userId = interaction.user.id;
        global.prelaunchEventData[userId].currentItem = { ...selectedItem };
        global.prelaunchEventData[userId].currentLevel = 0;
        
        savePrelaunchData();
        await showEnhanceMenu(interaction);
        return true;
    }
    
    // 강화하기
    else if (customId.startsWith('prelaunch_enhance')) {
        await interaction.deferUpdate();
        
        setTimeout(async () => {
            try {
                await executeEnhance(interaction, false);
            } catch (error) {
                console.error('[Prelaunch] Enhance error:', error);
                await interaction.editReply({ content: '❌ 강화 중 오류가 발생했습니다.' });
            }
        }, 100);
        
        return true;
    }
    
    // 자동 강화
    else if (customId.startsWith('prelaunch_auto_enhance')) {
        console.log('[Prelaunch] Auto enhance button clicked');
        await interaction.deferUpdate();
        
        setTimeout(async () => {
            try {
                await executeEnhance(interaction, true, 10);
            } catch (error) {
                console.error('[Prelaunch] Auto enhance error:', error);
                await interaction.editReply({ content: '❌ 자동 강화 중 오류가 발생했습니다.' });
            }
        }, 100);
        
        return true;
    }
    
    // 아이템 변경
    else if (customId.startsWith('prelaunch_change_item')) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        await showItemSelection(interaction);
        return true;
    }
    
    // 메뉴로
    else if (customId === 'prelaunch_menu') {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        await showEnhanceMenu(interaction);
        return true;
    }
    
    // 순위 확인
    else if (customId.startsWith('prelaunch_leaderboard')) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        await showLeaderboard(interaction);
        return true;
    }
    
    return false;
}

module.exports = {
    handlePrelaunchEnhance,
    handlePrelaunchInteraction,
    showLeaderboard
};