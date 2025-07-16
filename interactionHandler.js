const { handleInteraction } = require('./handlers');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const User = require('./models/User');
const { calculateCombatPower, isAdmin } = require('./handlers/common/utils');

// 매크로 감지 시스템 함수들 가져오기
const antiMacro = require('./systems/antiMacro');
const { recordUserAction, checkPenaltyStatus, isExempted } = antiMacro;
const macroMonitor = require('./systems/macroMonitor');

// 휴식 보상 시스템
const { restBonusSystem } = require('./systems/restBonus');

// 유저 가져오기 헬퍼
async function getUser(userId) {
    try {
        // 타임아웃 추가 (2초)
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database timeout')), 2000)
        );
        
        const userPromise = User.findOne({ discordId: userId });
        
        let user = await Promise.race([userPromise, timeoutPromise]);
        if (!user) {
            return null;
        }
        return user;
    } catch (error) {
        console.error('사용자 조회 오류:', error);
        return null;
    }
}

// 메인 메뉴 생성
function createMainMenu(user, isAdmin = false) {
    const menuOptions = [
        {
            label: '👤 프로필',
            description: '내 정보와 스탯 확인',
            value: 'profile',
            emoji: '👤'
        },
        {
            label: '🏆 엠블럼',
            description: '직업 선택 및 진화',
            value: 'emblem',
            emoji: '🏆'
        },
        {
            label: '🎮 미니게임',
            description: '다양한 미니게임 플레이',
            value: 'minigame',
            emoji: '🎮'
        },
        {
            label: '⚔️ PVP',
            description: '다른 유저와 대전',
            value: 'pvp',
            emoji: '⚔️'
        },
        {
            label: '🏰 던전 탐험',
            description: '던전을 탐험하며 보상 획득',
            value: 'dungeon',
            emoji: '🏰'
        },
        {
            label: '👹 보스 레이드',
            description: '강력한 보스와 전투',
            value: 'boss',
            emoji: '👹'
        },
        {
            label: '📈 주식',
            description: '주식 거래소',
            value: 'stocks',
            emoji: '📈'
        },
        {
            label: '🏺 유물탐사',
            description: '고대 유물 발굴 및 거래',
            value: 'artifacts',
            emoji: '🏺'
        },
        {
            label: '💎 조각',
            description: '에너지 조각 시스템',
            value: 'fragments',
            emoji: '💎'
        },
        {
            label: '🛒 상점',
            description: '아이템 구매',
            value: 'shop',
            emoji: '🛒'
        },
        {
            label: '🎖️ 강화',
            description: '아이템 계급 승급',
            value: 'enhance',
            emoji: '🎖️'
        },
        {
            label: '🏅 랭킹',
            description: '전체 유저 순위 확인',
            value: 'ranking',
            emoji: '🏅'
        },
        {
            label: '📅 일일활동',
            description: '출석체크 및 일일 미션',
            value: 'daily',
            emoji: '📅'
        },
        {
            label: '🎯 사냥',
            description: '몬스터 사냥',
            value: 'hunting',
            emoji: '🎯'
        },
        {
            label: '🏃 운동',
            description: '체력 단련',
            value: 'work',
            emoji: '🏃'
        },
        {
            label: '📊 시세 확인',
            description: '전리품 시세 정보',
            value: 'market_prices',
            emoji: '📊'
        }
    ];

    // 관리자 메뉴 추가
    if (isAdmin) {
        menuOptions.push({
            label: '🛠️ 관리자 패널',
            description: '서버 관리 및 시스템 제어',
            value: 'admin_panel',
            emoji: '🛠️'
        });
    }

    return new StringSelectMenuBuilder()
        .setCustomId('main_menu')
        .setPlaceholder('✨ 김헌터 월드에 오신 것을 환영합니다!')
        .addOptions(menuOptions.slice(0, 25));
}

// 메인 인터랙션 핸들러
async function handleMainInteraction(interaction) {
    // 상호작용 추적 로깅
    console.log(`[InteractionHandler] START - Type: ${interaction.type}, Command: ${interaction.commandName || 'N/A'}, CustomId: ${interaction.customId || 'N/A'}, User: ${interaction.user.id}, Deferred: ${interaction.deferred}, Replied: ${interaction.replied}`);
    
    try {
        // 상호작용 만료 타임아웃 체크 (3초)
        const startTime = Date.now();
        const INTERACTION_TIMEOUT = 2500; // 2.5초 후 defer 시도 중단
        
        // 타임아웃 안전 검사
        const timeoutCheck = () => {
            return Date.now() - startTime > INTERACTION_TIMEOUT;
        };
        
        // defer 처리를 더 빠르게 (150ms 이내)
        if (!interaction.deferred && !interaction.replied && !timeoutCheck()) {
            try {
                // 상호작용 타입에 따라 defer 방식 결정
                if (interaction.isCommand?.() || interaction.isModalSubmit?.()) {
                    // 자체 defer 처리하는 명령어들
                    const selfDeferCommands = ['게임', '엠블럼관리'];
                    
                    // 모달을 표시하는 명령어들 (defer하면 안됨)
                    const modalCommands = ['회원가입'];
                    
                    if (selfDeferCommands.includes(interaction.commandName)) {
                        console.log(`[InteractionHandler] Skipping defer for ${interaction.commandName} command (self-defer)`);
                    } 
                    // 모달을 표시하는 명령어들은 defer하지 않음
                    else if (modalCommands.includes(interaction.commandName)) {
                        console.log(`[InteractionHandler] Skipping defer for ${interaction.commandName} command (modal)`);
                    }
                    // 공지작성의 새공지 서브커맨드는 Modal을 표시하므로 defer하지 않음
                    else if (interaction.commandName === '공지작성' && interaction.options?.getSubcommand?.() === '새공지') {
                        console.log(`[InteractionHandler] Skipping defer for 공지작성 새공지 subcommand (modal)`);
                    }
                    // 모달 제출은 defer하지 않음
                    else if (interaction.isModalSubmit?.()) {
                        console.log(`[InteractionHandler] Skipping defer for modal submit: ${interaction.customId}`);
                    }
                    else {
                        console.log(`[InteractionHandler] Deferring command/modal - Command: ${interaction.commandName || 'N/A'}`);
                        await interaction.deferReply({ flags: 64 });
                        console.log(`[InteractionHandler] Successfully deferred - Command: ${interaction.commandName || 'N/A'}`);
                    }
                } else if (interaction.isButton?.() || interaction.isStringSelectMenu?.()) {
                    // 모달을 표시하는 버튼들은 defer하지 않음
                    const modalButtons = [
                        'admin_emblem_give', 'admin_emblem_set_level', 'admin_emblem_reset',
                        'admin_money_adjust', 'admin_reset_user', 'admin_announcement',
                        'stat_add_custom', 'admin_user_level', 'admin_user_gold', 
                        'admin_give_item', 'admin_user_stats', 'start_registration'
                    ];
                    
                    if (modalButtons.includes(interaction.customId) || interaction.customId.startsWith('verify_email_')) {
                        console.log(`[InteractionHandler] Skipping defer for modal button: ${interaction.customId}`);
                    } else {
                        console.log(`[InteractionHandler] Deferring button/select - CustomId: ${interaction.customId || 'N/A'}`);
                        await interaction.deferUpdate();
                        console.log(`[InteractionHandler] Successfully deferred update - CustomId: ${interaction.customId || 'N/A'}`);
                    }
                }
            } catch (deferError) {
                console.log(`[InteractionHandler] Defer error:`, deferError.code, deferError.message);
                if (deferError.code === 10062) {
                    console.log('⚠️ 상호작용 타임아웃:', interaction.id);
                    return;
                }
                // 다른 defer 오류는 계속 진행
            }
        } else {
            console.log(`[InteractionHandler] Skip defer - Already deferred: ${interaction.deferred}, Already replied: ${interaction.replied}, Timeout: ${timeoutCheck()}`);
        }
        // 매크로 감지 시스템
        const userId = interaction.user.id;
        
        // 면제 상태 확인 (관리자 등)
        if (!isExempted(userId)) {
            // 제재 상태 확인
            const penaltyStatus = checkPenaltyStatus(userId);
            if (penaltyStatus.restricted) {
                const remainingTime = penaltyStatus.timeLeft ? 
                    `${Math.ceil(penaltyStatus.timeLeft / 60000)}분` : 
                    '영구';
                
                // 안전한 응답
                try {
                    if (interaction.deferred) {
                        return await interaction.editReply({
                            content: `🚫 ${penaltyStatus.message}\n\n⏰ 남은 시간: ${remainingTime}`
                        });
                    } else if (!interaction.replied) {
                        return await interaction.reply({
                            content: `🚫 ${penaltyStatus.message}\n\n⏰ 남은 시간: ${remainingTime}`,
                            flags: 64
                        });
                    }
                } catch (e) {
                    console.error('제재 응답 오류:', e.message);
                }
            }
            
            // 사용자 행동 기록
            const actionType = interaction.isCommand() ? 
                `command:${interaction.commandName}` : 
                interaction.isButton() ? 
                    `button:${interaction.customId}` : 
                interaction.isStringSelectMenu() ? 
                    `select:${interaction.customId}` : 
                'other';
                
            const macroCheck = recordUserAction(userId, actionType);
            
            // 매크로 의심 패턴 감지 시 CAPTCHA 트리거
            if (macroCheck && macroCheck.needsCaptcha) {
                console.log(`[매크로 감지] 의심스러운 패턴 감지 - 유저: ${userId}, 점수: ${macroCheck.suspicionScore}`);
                
                // CAPTCHA 트리거
                const captchaResult = await antiMacro.triggerCaptchaVerification(userId, interaction.channel);
                
                if (captchaResult) {
                    try {
                        // DM으로 CAPTCHA 전송
                        const user = await interaction.client.users.fetch(userId);
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('🔒 매크로 검증 요청')
                            .setDescription(captchaResult.message + '\n\n**💬 이 DM 또는 아무 채널에 답을 입력하세요!**')
                            .setColor('#FF0000')
                            .setImage('attachment://captcha.png')
                            .setFooter({ text: '⏰ 60초 내에 답변을 입력해주세요.' })
                            .setTimestamp();
                        
                        await user.send({
                            embeds: [dmEmbed],
                            files: [{ attachment: captchaResult.image, name: 'captcha.png' }]
                        });
                        
                        // 채널에 알림
                        const channelEmbed = new EmbedBuilder()
                            .setTitle('⚠️ 매크로 방지 검증')
                            .setDescription(`<@${userId}>님, 의심스러운 활동이 감지되어 검증이 필요합니다.\nDM을 확인해주세요!`)
                            .setColor('#FF6B6B');
                        
                        await interaction.channel.send({ embeds: [channelEmbed] });
                        
                    } catch (error) {
                        console.error('[매크로 감지] CAPTCHA 전송 실패:', error);
                    }
                }
            }
        }
        
        // 슬래시 커맨드 처리
        if (interaction.isCommand()) {
            const { commandName } = interaction;
            
            // 메인 메뉴 커맨드 - game.js 파일 사용 (자체 defer 처리)
            if (commandName === '게임') {
                const gameCommand = require('./commands/game/game');
                return await gameCommand.execute(interaction);
            }
            
            // 탈퇴 명령어
            else if (commandName === '탈퇴') {
                const unregisterCommand = require('./commands/utility/unregister');
                return await unregisterCommand.execute(interaction);
            }
            
            // 엠블럼관리 명령어
            else if (commandName === '엠블럼관리') {
                console.log(`[InteractionHandler] Processing 엠블럼관리 command - Deferred: ${interaction.deferred}, Replied: ${interaction.replied}`);
                const emblemAdminCommand = require('./commands/admin/emblemAdmin');
                return await emblemAdminCommand.execute(interaction);
            }
            
            // 댕댕봇소환 명령어
            else if (commandName === '댕댕봇소환') {
                // 개발자 확인
                if (!['295980447849250817', '532128778175619084', '424480594542592009'].includes(interaction.user.id)) {
                    return await interaction.reply({ 
                        content: '❌ 이 명령어는 개발자만 사용할 수 있습니다!', 
                        flags: 64 
                    });
                }
                
                await interaction.reply({ 
                    content: '🐕 댕댕봇이 소환되었습니다! 잠시 후 수학 문제가 출제됩니다.', 
                    flags: 64 
                });
                
                // 댕댕봇 이벤트 즉시 실행
                const { triggerDogBotEvent } = require('./handlers/events/dogBotEvent');
                if (triggerDogBotEvent) {
                    setTimeout(() => {
                        triggerDogBotEvent(interaction.client, interaction.channelId);
                    }, 3000);
                }
            }
            
            // 댕댕봇구출시작 명령어
            else if (commandName === '댕댕봇구출시작') {
                const startRescueCommand = require('./commands/startRescueEvent');
                return await startRescueCommand.execute(interaction);
            }
            
            // 감정테스트 명령어
            else if (commandName === '감정테스트') {
                const testCommand = require('./commands/testAppraisal');
                return await testCommand.execute(interaction);
            }
            
            // 뉴스 명령어
            else if (commandName === '뉴스') {
                const newsCommand = require('./commands/newsCommand');
                return await newsCommand.execute(interaction);
            }
            
            // 뉴스채널설정 명령어
            else if (commandName === '뉴스채널설정') {
                const setNewsChannelCommand = require('./commands/setNewsChannel');
                return await setNewsChannelCommand.execute(interaction);
            }
            
            // 뉴스테스트 명령어
            else if (commandName === '뉴스테스트') {
                const testNewsCommand = require('./commands/testNews');
                return await testNewsCommand.execute(interaction);
            }
            
            // 데이터복구 명령어
            else if (commandName === '데이터복구') {
                const dataRestoreCommand = require('./commands/dataRestore');
                return await dataRestoreCommand.execute(interaction);
            }
            
            // 버그발견 명령어
            else if (commandName === '버그발견') {
                const bugCommand = require('./commands/utility/qa');
                return await bugCommand.execute(interaction);
            }
            
            // 버그리포트 명령어
            else if (commandName === '버그리포트') {
                const bugReportCommand = require('./commands/bugReport');
                return await bugReportCommand.execute(interaction);
            }
            
            // 칭호 명령어
            else if (commandName === '칭호') {
                const titlesCommand = require('./commands/utility/myTitles');
                return await titlesCommand.execute(interaction);
            }
            
            // 칭호부여 명령어 (관리자)
            else if (commandName === '칭호부여') {
                const grantTitleCommand = require('./commands/admin/grantTitle');
                return await grantTitleCommand.execute(interaction);
            }
            
            // PVP 정리 명령어 (관리자)
            else if (commandName === 'pvp정리') {
                const cleanupPVPCommand = require('./commands/admin/cleanupPVP');
                return await cleanupPVPCommand.execute(interaction);
            }
            
            // 돈지급 명령어 (관리자)
            else if (commandName === '돈지급') {
                const giveMoneyCommand = require('./commands/admin/giveMoney');
                return await giveMoneyCommand.execute(interaction);
            }
            
            // 청소 명령어
            else if (commandName === '청소') {
                const clearCommand = require('./commands/admin/clear');
                return await clearCommand.execute(interaction);
            }
            
            // 말 명령어 (관리자)
            else if (commandName === '말') {
                const sayCommand = require('./commands/admin/say');
                return await sayCommand.execute(interaction);
            }
            
            // 댕댕봇 구출 이벤트 명령어
            else if (commandName === '댕댕봇납치') {
                const rescueCommand = require('./commands/dogBotRescue');
                return await rescueCommand.execute(interaction);
            }
            
            // 구출 이벤트 시작 명령어 (관리자)
            else if (commandName === '구출이벤트시작') {
                const startRescueCommand = require('./commands/startRescueEvent');
                return await startRescueCommand.execute(interaction);
            }
            
            // 매크로감지 명령어 (관리자)
            else if (commandName === '매크로감지') {
                const macroDetectCommand = require('./commands/admin/macroDetect');
                return await macroDetectCommand.execute(interaction);
            }
            
            // IP관리 명령어 (관리자)
            else if (commandName === 'ip관리') {
                const ipManageCommand = require('./commands/admin/ipManage');
                return await ipManageCommand.execute(interaction);
            }
            
            // 관리자 명령어
            else if (commandName === '관리자') {
                // 서브커맨드가 있는지 먼저 확인
                const hasSubcommand = interaction.options.data.length > 0 && interaction.options.data[0].type === 1;
                
                if (hasSubcommand) {
                    const subcommand = interaction.options.getSubcommand();
                    
                    if (subcommand === '엠블럼상점새로고침') {
                        const emblemShopRefreshCommand = require('./commands/admin/emblemShopRefresh');
                        return await emblemShopRefreshCommand.execute(interaction);
                    }
                } else {
                    // 서브커맨드가 없을 때 관리자 패널 표시
                    const { showAdminMenu } = require('./handlers/admin/adminSystem');
                    return await showAdminMenu(interaction);
                }
            }
            
            // 사전강화종료 명령어 (관리자)
            else if (commandName === '사전강화종료') {
                const endPrelaunchCommand = require('./commands/admin/endPrelaunch');
                return await endPrelaunchCommand.execute(interaction);
            }
            
            // 에너지채굴 명령어
            else if (commandName === '에너지채굴') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 에너지채굴 시스템으로 이동
                const { handleEconomyInteraction } = require('./handlers/economy');
                interaction.customId = 'fragment_menu';
                return await handleEconomyInteraction(interaction);
            }
            
            // 유물탐사 명령어
            else if (commandName === '유물탐사') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 유물탐사 시스템으로 이동
                const { handleEconomyInteraction } = require('./handlers/economy');
                interaction.customId = 'artifact_exploration';
                return await handleEconomyInteraction(interaction);
            }
            
            // 인기도 시스템 명령어
            else if (commandName === '좋아요') {
                const likeCommand = require('./commands/like');
                return await likeCommand.execute(interaction);
            }
            
            // 말 명령어 (관리자 전용)
            else if (commandName === '말') {
                // 관리자 권한 확인
                if (!interaction.member.permissions.has('Administrator')) {
                    return await interaction.reply({ 
                        content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', 
                        flags: 64 
                    });
                }
                
                const message = interaction.options.getString('메시지');
                const targetChannel = interaction.options.getChannel('채널') || interaction.channel;
                
                try {
                    await targetChannel.send(message);
                    await interaction.reply({ 
                        content: `✅ 메시지를 ${targetChannel.name} 채널에 전송했습니다.`, 
                        flags: 64 
                    });
                } catch (error) {
                    console.error('말 명령어 오류:', error);
                    await interaction.reply({ 
                        content: '❌ 메시지 전송 중 오류가 발생했습니다.', 
                        flags: 64 
                    });
                }
            }
            
            // 공지작성 명령어 (관리자 전용)
            else if (commandName === '공지작성') {
                const subcommand = interaction.options.getSubcommand();
                
                // 새공지 서브커맨드는 Modal을 표시해야 하므로 권한 체크만 하고 바로 Modal 표시
                if (subcommand === '새공지') {
                    // 관리자 권한 확인
                    if (!interaction.member.permissions.has('Administrator')) {
                        // 새공지는 defer하지 않았으므로 reply 사용
                        return await interaction.reply({ 
                            content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', 
                            flags: 64 
                        });
                    }
                    
                    const template = interaction.options.getString('템플릿');
                    const { createAnnouncementModal } = require('./handlers/admin/createAnnouncementModal');
                    const modal = createAnnouncementModal(template);
                    return await interaction.showModal(modal);
                }
                
                // 다른 서브커맨드들은 이미 defer되었으므로 editReply 사용
                if (!interaction.member.permissions.has('Administrator')) {
                    return await interaction.editReply({ 
                        content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.'
                    });
                }
                
                const noticeSystem = require('./systems/noticeSystem');
                
                switch (subcommand) {
                        
                    case '미리보기':
                        const previewId = interaction.options.getString('공지id');
                        const previewNotice = noticeSystem.getNotice(previewId);
                        
                        if (!previewNotice) {
                            return await interaction.editReply({ 
                                content: '❌ 해당 ID의 공지를 찾을 수 없습니다.'
                            });
                        }
                        
                        await interaction.editReply({ 
                            embeds: [previewNotice.embed]
                        });
                        break;
                        
                    case '발송':
                        const sendId = interaction.options.getString('공지id');
                        const channel = interaction.options.getChannel('채널');
                        const mention = interaction.options.getString('멘션') || 'none';
                        
                        const sendNotice = noticeSystem.getNotice(sendId);
                        
                        if (!sendNotice) {
                            return await interaction.editReply({ 
                                content: '❌ 해당 ID의 공지를 찾을 수 없습니다.'
                            });
                        }
                        
                        let mentionText = '';
                        if (mention === 'everyone') mentionText = '@everyone';
                        else if (mention === 'here') mentionText = '@here';
                        
                        try {
                            await channel.send({ 
                                content: mentionText, 
                                embeds: [sendNotice.embed] 
                            });
                            
                            await interaction.editReply({ 
                                content: `✅ 공지를 ${channel.name} 채널에 발송했습니다.`
                            });
                        } catch (error) {
                            console.error('공지 발송 오류:', error);
                            await interaction.editReply({ 
                                content: '❌ 공지 발송 중 오류가 발생했습니다.'
                            });
                        }
                        break;
                        
                    case '목록':
                        const notices = noticeSystem.getAllNotices();
                        
                        if (notices.length === 0) {
                            return await interaction.editReply({ 
                                content: '📋 저장된 공지가 없습니다.'
                            });
                        }
                        
                        const listEmbed = new EmbedBuilder()
                            .setTitle('📋 저장된 공지 목록')
                            .setColor('#0099ff')
                            .setDescription(notices.map(n => 
                                `**ID:** ${n.id}\n**제목:** ${n.title}\n**생성일:** ${n.createdAt.toLocaleString('ko-KR')}\n`
                            ).join('\n'))
                            .setFooter({ text: `총 ${notices.length}개의 공지` });
                            
                        await interaction.editReply({ embeds: [listEmbed] });
                        break;
                        
                    case '삭제':
                        const deleteId = interaction.options.getString('공지id');
                        const deleted = noticeSystem.deleteNotice(deleteId);
                        
                        if (deleted) {
                            await interaction.editReply({ 
                                content: '✅ 공지가 삭제되었습니다.'
                            });
                        } else {
                            await interaction.editReply({ 
                                content: '❌ 해당 ID의 공지를 찾을 수 없습니다.'
                            });
                        }
                        break;
                }
            }
            
            // 인기도 랭킹 명령어
            else if (commandName === '인기도랭킹') {
                const popularityCommand = require('./commands/popularityRanking');
                return await popularityCommand.execute(interaction);
            }
            
            // 보스소환테스트 명령어
            else if (commandName === '보스소환테스트') {
                const spawnBossCommand = require('./commands/spawnBossTest');
                return await spawnBossCommand.execute(interaction);
            }
            
            // 댕댕봇백업 명령어
            else if (commandName === '댕댕봇백업') {
                const dogBotBackupCommand = require('./commands/dogBotBackup');
                return await dogBotBackupCommand.execute(interaction);
            }
            
            // 게임 관련 명령어들
            else if (commandName === '독버섯') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 독버섯 게임 메뉴로 바로 이동
                const { handleMinigameInteraction } = require('./handlers/minigames');
                interaction.customId = 'minigame_mushroom';
                interaction.values = ['mushroom'];
                return await handleMinigameInteraction(interaction);
            }
            else if (commandName === '홀짝') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 홀짝 게임 메뉴로 바로 이동
                const { handleMinigameInteraction } = require('./handlers/minigames');
                interaction.customId = 'minigame_oddeven';
                interaction.values = ['oddeven'];
                return await handleMinigameInteraction(interaction);
            }
            else if (commandName === '초성') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 초성 게임 메뉴로 바로 이동
                const { handleMinigameInteraction } = require('./handlers/minigames');
                interaction.customId = 'minigame_chosung';
                interaction.values = ['chosung'];
                return await handleMinigameInteraction(interaction);
            }
            else if (commandName === '끝말잇기') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 끝말잇기 게임 메뉴로 바로 이동
                const { handleMinigameInteraction } = require('./handlers/minigames');
                interaction.customId = 'minigame_wordchain';
                interaction.values = ['wordchain'];
                return await handleMinigameInteraction(interaction);
            }
            
            // 낚시 명령어
            else if (commandName === '낚시') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 낚시 시작
                const { handleFishingInteraction } = require('./handlers/economy/fishing');
                interaction.customId = 'fishing_cast';
                return await handleFishingInteraction(interaction, user);
            }
            
            // 재료 제작 명령어 (비활성화)
            // else if (commandName === '재료제작') {
            //     const { showCraftingMenu } = require('./systems/materialCraftingSystem');
            //     return await showCraftingMenu(interaction, interaction.user.id);
            // }
            
            // 경제 관련 명령어들
            else if (commandName === '주식') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 주식 메뉴로 바로 이동
                const { handleEconomyInteraction } = require('./handlers/economy');
                interaction.values = ['stocks'];
                return await handleEconomyInteraction(interaction);
            }
            else if (commandName === '에너지채굴') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 에너지 조각 메뉴로 바로 이동
                const { handleEconomyInteraction } = require('./handlers/economy');
                interaction.values = ['fragments'];
                return await handleEconomyInteraction(interaction);
            }
            else if (commandName === '유물탐사') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 유물탐사 메뉴로 바로 이동
                const { handleEconomyInteraction } = require('./handlers/economy');
                interaction.values = ['artifacts'];
                return await handleEconomyInteraction(interaction);
            }
            else if (commandName === 'minestatus' || commandName === '광산상태') {
                const mineStatusCommand = require('./commands/mineStatus');
                return await mineStatusCommand.execute(interaction);
            }
            
            // PVP 관련 명령어
            else if (commandName === '결투') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // PVP 메뉴로 바로 이동
                const { handlePVPInteraction } = require('./handlers/pvp');
                interaction.customId = 'pvp_menu';
                return await handlePVPInteraction(interaction);
            }
            
            // 일일 활동 관련 명령어
            else if (commandName === '의뢰') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 퀘스트 메뉴로 바로 이동
                const { handleDailyInteraction } = require('./handlers/daily');
                interaction.values = ['quest'];
                return await handleDailyInteraction(interaction);
            }
            
            // 계급부여 명령어
            else if (commandName === '계급부여') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 강화 시스템으로 바로 이동
                const { handleEnhanceInteraction } = require('./handlers/enhance/enhanceSystem');
                interaction.customId = 'enhance_menu';
                return await handleEnhanceInteraction(interaction);
            }
            
            // 랭킹 명령어
            else if (commandName === '랭킹') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 랭킹 시스템 임시 메시지
                return await interaction.editReply({
                    content: '🏅 랭킹 시스템은 준비 중입니다!',
                    embeds: [],
                    components: []
                });
            }
            
            // 사전강화 명령어
            else if (commandName === '사전강화') {
                // 채널 제한 없음 - 1386447256408035399 채널에서 모든 유저 사용 가능
                
                // 데이터 로드 확인
                if (!global.prelaunchEventData || Object.keys(global.prelaunchEventData).length === 0) {
                    const { loadPrelaunchData } = require('./handlers/events/prelaunchEvent');
                    global.prelaunchEventData = loadPrelaunchData();
                    console.log('📊 사전강화 데이터 로드:', Object.keys(global.prelaunchEventData).length + '명');
                }
                
                const { handlePrelaunchEnhance } = require('./systems/prelaunchEnhance');
                return await handlePrelaunchEnhance(interaction);
            }
            
            // 회원가입 명령어
            else if (commandName === '회원가입') {
                const registerCommand = require('./commands/utility/register');
                return await registerCommand.execute(interaction);
            }
            
            // 인증 명령어
            else if (commandName === '인증') {
                const verifyCommand = require('./commands/utility/verifyEmail');
                return await verifyCommand.execute(interaction);
            }
            
            // 엠블럼스탯수정 명령어
            else if (commandName === '엠블럼스탯수정') {
                const fixEmblemStatsCommand = require('./commands/admin/fixEmblemStats');
                return await fixEmblemStatsCommand.execute(interaction);
            }
            
            // 최근가입자 명령어
            else if (commandName === '최근가입자') {
                const recentUsersCommand = require('./commands/admin/recentUsers');
                return await recentUsersCommand.execute(interaction);
            }
            
            // 사용자삭제 명령어
            else if (commandName === '사용자삭제') {
                const deleteUserCommand = require('./commands/admin/deleteUser');
                return await deleteUserCommand.execute(interaction);
            }
            
            // 명령어초기화 명령어
            else if (commandName === '명령어초기화') {
                const commandInitCommand = require('./commands/commandInit');
                return await commandInitCommand.execute(interaction);
            }
            
            // 명령어등록 명령어
            else if (commandName === '명령어등록') {
                const commandRegisterCommand = require('./commands/admin/commandRegister');
                return await commandRegisterCommand.execute(interaction);
            }
            
            else if (commandName === '명령어초기화') {
                const clearCommandsCommand = require('./commands/admin/clearCommands');
                return await clearCommandsCommand.execute(interaction);
            }
            
            // 엠블럼 명령어
            else if (commandName === '엠블럼') {
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 엠블럼 메뉴로 바로 이동
                const { showEmblem } = require('./handlers/character/emblem');
                return await showEmblem(interaction);
            }
            
            // 사냥 명령어
            else if (commandName === '사냥') {
                await interaction.deferReply({ flags: 64 });
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.' 
                    });
                }
                
                // 사냥 메뉴로 바로 이동
                const { showHuntingMenu } = require('./handlers/daily/hunting');
                return await showHuntingMenu(interaction);
            }
            
            // 청소 명령어
            else if (commandName === '청소') {
                const cleanCommand = require('./commands/admin/clean');
                return await cleanCommand.execute(interaction);
            }
            
            // 매크로감지 명령어 (관리자 전용)
            else if (commandName === '매크로감지') {
                const macroDetectCommand = require('./commands/admin/macroDetect');
                return await macroDetectCommand.execute(interaction);
            }
            
            // 게임데이터초기화 명령어 (관리자 전용)
            else if (commandName === '게임데이터초기화') {
                const dataResetCommand = require('./commands/admin/dataReset');
                return await dataResetCommand.execute(interaction);
            }
            
            // 회원가입채널설정 명령어 (관리자 전용)
            else if (commandName === '회원가입채널설정') {
                const setupRegistrationCommand = require('./commands/admin/setupRegistrationChannel');
                return await setupRegistrationCommand.execute(interaction);
            }
            
            // 주식채널설정 명령어 (관리자 전용)
            else if (commandName === '주식채널설정') {
                const setupStockCommand = require('./commands/admin/setupStockChannel');
                return await setupStockCommand.execute(interaction);
            }
            
            // 상점채널설정 명령어 (관리자 전용)
            else if (commandName === '상점채널설정') {
                const setupShopCommand = require('./commands/admin/setupShopChannel');
                return await setupShopCommand.execute(interaction);
            }
            
            // 공지채널설정 명령어 (관리자 전용)
            else if (commandName === '공지채널설정') {
                const setupAnnouncementCommand = require('./commands/admin/setupAnnouncementChannel');
                return await setupAnnouncementCommand.execute(interaction);
            }
            
            // 보스채널설정 명령어 (관리자 전용)
            else if (commandName === '보스채널설정') {
                const setupBossCommand = require('./commands/admin/setupBossChannel');
                return await setupBossCommand.execute(interaction);
            }
            
            // 채널이름일괄변경 명령어 (관리자 전용)
            else if (commandName === '채널이름일괄변경') {
                const updateChannelNamesCommand = require('./commands/admin/updateChannelNames');
                return await updateChannelNamesCommand.execute(interaction);
            }
            
            // 필수채널생성 명령어 (관리자 전용)
            else if (commandName === '필수채널생성') {
                const createRequiredChannelsCommand = require('./commands/admin/createRequiredChannels');
                return await createRequiredChannelsCommand.execute(interaction);
            }
            
            // 누락된 명령어들 추가
            else if (commandName === '핑') {
                const ping = Math.round(interaction.client.ws.ping);
                return await interaction.reply({
                    content: `🏓 퐁! 지연시간: ${ping}ms`,
                    flags: 64
                });
            }
            
            else if (commandName === '강화') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === '강화랭킹') {
                const enhancementRankingCommand = require('./commands/game/enhancementRanking');
                return await enhancementRankingCommand.execute(interaction);
            }
            
            else if (commandName === '강화통계') {
                const enhancementStatsCommand = require('./commands/game/enhancementStats');
                return await enhancementStatsCommand.execute(interaction);
            }
            
            else if (commandName === '결투정보') {
                const duelInfoCommand = require('./commands/game/duelInfo');
                return await duelInfoCommand.execute(interaction);
            }
            
            else if (commandName === '내전투력') {
                const combatPowerCommand = require('./commands/game/combatPower');
                return await combatPowerCommand.execute(interaction);
            }
            
            else if (commandName === '내티켓') {
                const myTicketsCommand = require('./commands/game/myTickets');
                return await myTicketsCommand.execute(interaction);
            }
            
            else if (commandName === '조각융합') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === '융합수동') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === '내조각') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === '융합랭킹') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === '보스') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === '보스소환') {
                delete require.cache[require.resolve('./commands/admin/bossSpawn')];
                const bossSpawnCommand = require('./commands/admin/bossSpawn');
                return await bossSpawnCommand.execute(interaction);
            }
            
            else if (commandName === '보스디버그') {
                const bossDebugCommand = require('./commands/admin/bossDebug');
                return await bossDebugCommand.execute(interaction);
            }
            
            else if (commandName === '주식복구') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === '전투력수정') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === 'ip관리') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === '데이터검사') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === '백업복원') {
                return await handleInteraction(interaction);
            }
            
            else if (commandName === 'db테스트') {
                const dbTestCommand = require('./commands/test/dbTest');
                return await dbTestCommand.execute(interaction);
            }
        }
        
        // 버튼 및 셀렉트 메뉴 처리
        else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            // 회원가입 버튼 처리
            if (interaction.isButton() && interaction.customId === 'start_registration') {
                try {
                    console.log('[회원가입] 버튼 클릭됨');
                    const registerCommand = require('./commands/utility/register');
                    console.log('[회원가입] register 모듈 로드 완료');
                    return await registerCommand.execute(interaction);
                } catch (error) {
                    console.error('[회원가입] 오류 발생:', error);
                    return await interaction.reply({
                        content: '❌ 회원가입 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
                        flags: 64
                    });
                }
            }
            
            // 회원가입 관련 처리
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'registration_email_modal' || 
                    interaction.customId === 'verification_code_modal') {
                    const registerCommand = require('./commands/utility/register');
                    if (interaction.customId === 'registration_email_modal') {
                        return await registerCommand.handleModal(interaction);
                    } else {
                        return await registerCommand.handleCodeVerification(interaction);
                    }
                }
                
                // 공지작성 모달 처리
                else if (interaction.customId.startsWith('announcement_')) {
                    const noticeSystem = require('./systems/noticeSystem');
                    const template = interaction.customId.replace('announcement_', '');
                    
                    const title = interaction.fields.getTextInputValue('announcement_title');
                    const content = interaction.fields.getTextInputValue('announcement_content');
                    const footer = interaction.fields.getTextInputValue('announcement_footer') || '김헌터 운영팀';
                    const image = interaction.fields.getTextInputValue('announcement_image');
                    const color = interaction.fields.getTextInputValue('announcement_color') || '#0099ff';
                    
                    const { EmbedBuilder } = require('discord.js');
                    const embed = new EmbedBuilder()
                        .setTitle(title)
                        .setDescription(content)
                        .setColor(color)
                        .setFooter({ text: footer })
                        .setTimestamp();
                    
                    if (image) {
                        embed.setImage(image);
                    }
                    
                    const noticeId = noticeSystem.saveNotice({
                        title,
                        content,
                        template,
                        embed,
                        createdBy: interaction.user.id
                    });
                    
                    // 재출 버튼 추가
                    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                    const resubmitButton = new ButtonBuilder()
                        .setCustomId(`announcement_resubmit_${template}`)
                        .setLabel('📝 재작성')
                        .setStyle(ButtonStyle.Secondary);
                    
                    const sendButton = new ButtonBuilder()
                        .setCustomId(`announcement_send_${noticeId}`)
                        .setLabel('📤 바로 발송')
                        .setStyle(ButtonStyle.Primary);
                    
                    const row = new ActionRowBuilder()
                        .addComponents(resubmitButton, sendButton);
                    
                    await interaction.reply({
                        content: `✅ 공지가 저장되었습니다!\n**ID:** ${noticeId}\n\n미리보기:`,
                        embeds: [embed],
                        components: [row],
                        flags: 64
                    });
                }
            } else if (interaction.isButton() && interaction.customId.startsWith('verify_email_')) {
                try {
                    console.log('[회원가입] 인증 버튼 클릭됨:', interaction.customId);
                    const registerCommand = require('./commands/utility/register');
                    return await registerCommand.handleVerification(interaction);
                } catch (error) {
                    console.error('[회원가입] 인증 처리 오류:', error);
                    return await interaction.reply({
                        content: '❌ 인증 처리 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
                        flags: 64
                    });
                }
            }
            // 공지 재작성 버튼 처리
            else if (interaction.isButton() && interaction.customId.startsWith('announcement_resubmit_')) {
                const template = interaction.customId.replace('announcement_resubmit_', '');
                const { createAnnouncementModal } = require('./handlers/admin/createAnnouncementModal');
                const modal = createAnnouncementModal(template);
                await interaction.showModal(modal);
            }
            // 공지 바로 발송 버튼 처리
            else if (interaction.isButton() && interaction.customId.startsWith('announcement_send_')) {
                const noticeId = interaction.customId.replace('announcement_send_', '');
                const noticeSystem = require('./systems/noticeSystem');
                
                // 공지 찾기
                const notice = noticeSystem.getNotice(noticeId);
                if (!notice) {
                    return await interaction.reply({
                        content: '❌ 공지를 찾을 수 없습니다.',
                        flags: 64
                    });
                }
                
                // 현재 채널에 발송
                try {
                    await interaction.channel.send({
                        embeds: [notice.embed]
                    });
                    
                    await interaction.reply({
                        content: '✅ 공지가 현재 채널에 발송되었습니다!',
                        flags: 64
                    });
                } catch (error) {
                    console.error('공지 발송 오류:', error);
                    await interaction.reply({
                        content: '❌ 공지 발송 중 오류가 발생했습니다.',
                        flags: 64
                    });
                }
            }
            // main_menu 처리 (StringSelectMenu일 때)
            else if (interaction.customId === 'main_menu' && interaction.isStringSelectMenu()) {
                const selectedValue = interaction.values[0];
                
                // 선택된 값에 따라 적절한 customId로 변환하여 핸들러로 전달
                switch (selectedValue) {
                    case 'profile':
                        interaction.customId = 'profile';
                        break;
                    case 'emblem':
                        interaction.customId = 'emblem';
                        break;
                    case 'minigame_menu':
                        interaction.customId = 'minigame_menu';
                        break;
                    case 'pvp':
                        interaction.customId = 'pvp_menu';
                        break;
                    case 'dungeon':
                        interaction.customId = 'dungeon';
                        break;
                    case 'boss':
                        interaction.customId = 'boss_raid';
                        break;
                    case 'shop':
                        interaction.customId = 'shop';
                        break;
                    case 'inventory':
                        interaction.customId = 'inventory';
                        break;
                    case 'community':
                        interaction.customId = 'community';
                        break;
                    case 'stats':
                        interaction.customId = 'stats';
                        break;
                    case 'daily':
                        interaction.customId = 'daily';
                        break;
                    case 'admin_panel':
                        interaction.customId = 'admin_panel';
                        break;
                    case 'hunting':
                        interaction.customId = 'hunting';
                        break;
                    case 'market_prices':
                        interaction.customId = 'market_prices';
                        break;
                    case 'stocks':
                        interaction.customId = 'stock_market';
                        break;
                    case 'artifacts':
                        const { showExplorationMenu } = require('./handlers/economy/artifactExploration');
                        return await showExplorationMenu(interaction, interaction.user.id);
                    case 'fragments':
                        interaction.customId = 'fragment_menu';
                        break;
                    case 'fusion':
                        interaction.customId = 'fragment_menu';
                        break;
                    case 'work':
                        interaction.customId = 'work';
                        break;
                    case 'ranking':
                        interaction.customId = 'ranking';
                        break;
                    case 'enhance':
                        interaction.customId = 'enhance';
                        break;
                    default:
                        if (!interaction.replied && !interaction.deferred) {
                            return await interaction.reply({ 
                                content: '❌ 올바른 메뉴를 선택해주세요.', 
                                flags: 64 
                            });
                        }
                        return;
                }
                
                // 핸들러로 전달
                return await handleInteraction(interaction);
            }
            
            // 백업 버튼 처리
            else if (interaction.customId.startsWith('backup_')) {
                const backupCommand = require('./commands/backup');
                if (backupCommand.handleButton) {
                    return await backupCommand.handleButton(interaction);
                }
            }
            
            // 명령어 관리 버튼 처리
            else if (interaction.customId === 'check_commands' || interaction.customId === 'refresh_commands') {
                const commandRegisterCommand = require('./commands/admin/commandRegister');
                if (commandRegisterCommand.handleButton) {
                    return await commandRegisterCommand.handleButton(interaction);
                }
            }
            
            // 유물 탐사 버튼 처리
            else if (interaction.customId.startsWith('artifact_') || 
                     interaction.customId.startsWith('explore_') || 
                     interaction.customId.startsWith('company_') || 
                     interaction.customId.startsWith('pickaxe_') || 
                     (interaction.customId.startsWith('ranking_') && 
                      (interaction.customId.includes('earnings') || 
                       interaction.customId.includes('found') || 
                       interaction.customId.includes('mythic'))) ||
                     interaction.customId.startsWith('mine_')) {
                const { handleArtifactInteraction } = require('./handlers/economy/artifactExploration');
                return await handleArtifactInteraction(interaction);
            }
            
            // main_menu 버튼 처리
            else if (interaction.customId === 'main_menu' && interaction.isButton()) {
                const user = await getUser(interaction.user.id);
                if (!user || !user.registered) {
                    return await interaction.editReply({ 
                        content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
                        embeds: [],
                        components: []
                    });
                }
                
                const adminStatus = isAdmin(interaction.user.id);
                
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🎮 김헌터 메인 메뉴')
                    .setDescription(`${user.nickname}님, 환영합니다!\n원하는 메뉴를 선택해주세요.`)
                    .addFields(
                        { name: '💰 보유 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                        { name: '📊 레벨', value: `Lv.${user.level}`, inline: true },
                        { name: '⚔️ 전투력', value: `${calculateCombatPower(user)}`, inline: true }
                    )
                    .setFooter({ text: '아래 드롭다운 메뉴에서 원하는 기능을 선택하세요!' })
                    .setTimestamp();
                
                const selectMenu = createMainMenu(user, adminStatus);
                const row = new ActionRowBuilder().addComponents(selectMenu);
                
                return await interaction.editReply({
                    embeds: [embed],
                    components: [row]
                });
            }
            
            // 사전강화 버튼 처리
            else if (interaction.customId && interaction.customId.includes('prelaunch')) {
                const { handlePrelaunchInteraction } = require('./systems/prelaunchEnhance');
                return await handlePrelaunchInteraction(interaction);
            }
            // 월드 보스 버튼은 handlers/index.js에서 처리하므로 여기서는 제거
            // 댕댕봇 구출 버튼 처리
            else if (interaction.customId && (interaction.customId === 'dogbot_attack' || interaction.customId === 'dogbot_ranking' || interaction.customId === 'dogbot_status')) {
                console.log(`[인터랙션] 댕댕봇 구출 버튼 처리: ${interaction.customId}`);
                const { handleDogBotRescueInteraction } = require('./handlers/dogBotRescueHandler');
                return await handleDogBotRescueInteraction(interaction);
            }
            // optimize_equipment와 equip_category는 여기서 직접 처리
            else if (interaction.customId === 'optimize_equipment') {
                const { handleCharacterInteraction } = require('./handlers/character');
                return await handleCharacterInteraction(interaction);
            }
            else if (interaction.customId === 'equip_category') {
                const { handleCharacterInteraction } = require('./handlers/character');
                return await handleCharacterInteraction(interaction);
            }
            // 나머지 인터랙션은 핸들러로 전달
            else {
                return await handleInteraction(interaction);
            }
        }
        
    } catch (error) {
        console.error('인터랙션 처리 오류:', error);
        
        // Unknown interaction 오류는 무시
        if (error.code === 10062) {
            return;
        }
        
        const errorMessage = '❌ 처리 중 오류가 발생했습니다.\n문제가 계속되면 `/버그발견` 명령어로 신고해주세요!';
        
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: errorMessage, embeds: [], components: [] });
            } else {
                await interaction.reply({ content: errorMessage, flags: 64 });
            }
        } catch (replyError) {
            // 응답 실패도 무시
            console.error('오류 응답 실패:', replyError);
        }
    }
}

// 전투력 계산은 통합 함수 사용 - handlers/common/combatPower.js

module.exports = {
    handleMainInteraction
};