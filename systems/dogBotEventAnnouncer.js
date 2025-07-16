const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const stateManager = require('./dogBotStateManager');
const { DOGBOT_RESCUE_EVENT, getCurrentFloor, getHPPercentage, createProgressBar } = require('../data/dogBotRescueEvent');

class DogBotEventAnnouncer {
    constructor() {
        this.announcementInterval = null;
        this.announcementChannelId = process.env.DOGBOT_CHANNEL_ID || process.env.EVENT_CHANNEL_ID || '1386447256408035399';
        this.intervalTime = 20 * 60 * 1000; // 20분
        this.isAnnouncementRunning = false; // 중복 실행 방지
        this.lastAnnouncementTime = 0; // 마지막 공지 시간
        console.log('[DogBotEventAnnouncer] 인스턴스 생성됨, 채널 ID:', this.announcementChannelId);
    }

    // 공지 시작
    startAnnouncements(client) {
        // 이미 실행 중이면 무시
        if (this.isAnnouncementRunning) {
            console.log('⚠️ 자동 공지가 이미 실행 중입니다.');
            return;
        }

        // 기존 인터벌 정리 (이중 안전장치)
        if (this.announcementInterval) {
            console.log('🔄 기존 공지 인터벌 정리');
            clearInterval(this.announcementInterval);
            this.announcementInterval = null;
        }

        this.isAnnouncementRunning = true;
        this.client = client;  // 클라이언트 저장

        // 즉시 한 번 공지
        this.sendEventAnnouncement(client);

        // 20분마다 공지
        this.announcementInterval = setInterval(() => {
            if (!this.isAnnouncementRunning) {
                console.log('⚠️ 공지 시스템이 중지되어 인터벌 제거');
                clearInterval(this.announcementInterval);
                return;
            }
            console.log(`[공지] 20분 인터벌 실행 - ${new Date().toLocaleTimeString()}`);
            this.sendEventAnnouncement(client);
        }, this.intervalTime);

        console.log(`✅ 댕댕봇 구출 이벤트 자동 공지 시작 (20분 간격: ${this.intervalTime}ms)`);
    }

    // 공지 중지
    stopAnnouncements() {
        if (this.announcementInterval) {
            clearInterval(this.announcementInterval);
            this.announcementInterval = null;
        }
        this.isAnnouncementRunning = false;
        console.log('⏹️ 댕댕봇 구출 이벤트 자동 공지 중지');
    }

    // 이벤트 공지 발송
    async sendEventAnnouncement(client) {
        try {
            // 최소 공지 간격 체크 (5분)
            const now = Date.now();
            const timeSinceLastAnnouncement = now - this.lastAnnouncementTime;
            
            if (this.lastAnnouncementTime > 0 && timeSinceLastAnnouncement < 5 * 60 * 1000) {
                console.log(`⚠️ 공지 간격이 너무 짧습니다. (${Math.floor(timeSinceLastAnnouncement/1000)}초 경과) 스킵합니다.`);
                return;
            }

            // 이벤트가 활성화되어 있는지 확인
            if (!stateManager.state || !stateManager.state.status || !stateManager.state.status.isActive) {
                console.log('❌ 댕댕봇 구출 이벤트가 비활성화 상태입니다.');
                this.stopAnnouncements();
                return;
            }

            // 이미 구출 완료된 경우
            if (stateManager.state.status.rescueComplete) {
                console.log('🎉 댕댕봇이 이미 구출되었습니다.');
                this.stopAnnouncements();
                return;
            }

            // 채널 가져오기
            const channel = await client.channels.fetch(this.announcementChannelId);
            if (!channel) {
                console.error('❌ 공지 채널을 찾을 수 없습니다:', this.announcementChannelId);
                return;
            }

            // 현재 상태 계산
            const currentFloor = getCurrentFloor();
            const floorNum = stateManager.state.status.currentFloor;
            const hpPercentage = getHPPercentage(currentFloor);
            const progressBar = createProgressBar(hpPercentage);
            const participants = stateManager.state.statistics.participants.length;
            const totalDamage = stateManager.state.statistics.totalDamage;

            // 첫 번째 임베드: 시작 공지 스타일
            const startEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🚨 긴급 속보! 댕댕봇 납치 사건!')
                .setDescription(
                    '**📢 속보! 댕댕봇이 납치되었습니다!**\n' +
                    '개발자가 댕댕봇을 **5층 디버그 타워**에 가뒀습니다!\n\n' +
                    '📝 현장에서 발견된 메모:\n' +
                    '*"유저들이 너무 똑똑해져서... 버그를 너무 빨리 찾아내..."*\n' +
                    '*"나도 좀 쉬고 싶다... 제발..."*\n\n' +
                    `**🏰 현재 ${floorNum}층: ${currentFloor.emoji} ${currentFloor.name}**\n` +
                    `${progressBar}\n` +
                    `체력: ${(currentFloor.currentHP || 0).toLocaleString()} / ${currentFloor.maxHP.toLocaleString()} HP`
                )
                .addFields(
                    {
                        name: '⚠️ 참여 조건',
                        value: '• **회원가입 필수** (#join 채널)\n• 사전강화 무기 자동 연동\n• 10분마다 1회 공격 가능',
                        inline: true
                    },
                    {
                        name: '⚔️ 전투 정보',
                        value: '• 기본 데미지: 100-200\n• 사전강화 무기 추가뎀\n• 크리티컬 확률: 10%',
                        inline: true
                    },
                    {
                        name: '📊 진행 상황',
                        value: `• 진행도: **${floorNum}/5층**\n• 참여자: **${participants}명**\n• 총 데미지: **${totalDamage.toLocaleString()}**`,
                        inline: true
                    }
                )
                .addFields(
                    {
                        name: '🎁 이벤트 보상',
                        value: '• 공격왕: **댕댕봇 구출자** 칭호\n• 댕댕봇 구출자 칭호: 댕댕봇 1시간 서버에 머물시 댕댕봇 보상 획득',
                        inline: false
                    },
                    {
                        name: '💡 참여 방법',
                        value: '**아래 ⚔️ 공격하기 버튼을 눌러 몬스터를 공격하세요!**\n`/댕댕봇납치` 명령어로 언제든지 현황을 확인할 수 있습니다.',
                        inline: false
                    }
                )
                .setFooter({ text: '🐕 댕댕봇을 구해주세요! • 20분마다 자동 공지' })
                .setTimestamp();

            // 첫 번째 메시지 전송 (버튼 없이)
            await channel.send({
                content: '🚨 **댕댕봇이 위험합니다!** 🚨',
                embeds: [startEmbed]
            });

            // 잠시 대기 (1초)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 상황별 부제목 생성
            let subtitle = '';
            if (participants === 0) {
                subtitle = '😢 아직 아무도 참여하지 않았습니다! 첫 영웅이 되어주세요!';
            } else if (hpPercentage <= 10) {
                subtitle = '⚠️ **최후의 순간!** 마지막 일격을 가해주세요!';
            } else if (hpPercentage <= 30) {
                subtitle = '🔥 **보스가 약해졌습니다!** 조금만 더 힘내주세요!';
            } else if (stateManager.state.statistics.attackLog.length > 0) {
                // 모든 lastAttackTime 중에서 가장 최근 시간 찾기
                const lastAttackTimes = Object.values(stateManager.state.statistics.lastAttackTime || {});
                const mostRecentAttack = lastAttackTimes.length > 0 ? Math.max(...lastAttackTimes) : 0;
                
                // attackLog의 마지막 항목과 비교하여 더 최근 것 사용
                const lastLogAttack = stateManager.state.statistics.attackLog[stateManager.state.statistics.attackLog.length - 1];
                const lastAttackTime = Math.max(mostRecentAttack, lastLogAttack ? lastLogAttack.timestamp : 0);
                
                const minutesAgo = Math.floor((Date.now() - lastAttackTime) / 1000 / 60);
                if (minutesAgo >= 10) {
                    subtitle = `⏰ ${minutesAgo}분 동안 공격이 없었습니다! 댕댕봇이 기다리고 있어요!`;
                } else {
                    const cheers = [
                        '🐕 댕댕봇이 응원하고 있습니다!',
                        '💪 함께라면 할 수 있어요!',
                        '🌟 여러분이 희망입니다!',
                        '🎯 정확한 타격을 노려주세요!',
                        '🔥 뜨거운 열정을 보여주세요!'
                    ];
                    subtitle = cheers[Math.floor(Math.random() * cheers.length)];
                }
            } else {
                subtitle = '🎯 첫 공격의 영예를 차지하세요!';
            }
            
            // 보스 대사 선택
            let bossQuote = '';
            if (hpPercentage > 70) {
                bossQuote = DOGBOT_RESCUE_EVENT.messages.developerQuotes.high[Math.floor(Math.random() * DOGBOT_RESCUE_EVENT.messages.developerQuotes.high.length)];
            } else if (hpPercentage > 30) {
                bossQuote = DOGBOT_RESCUE_EVENT.messages.developerQuotes.medium[Math.floor(Math.random() * DOGBOT_RESCUE_EVENT.messages.developerQuotes.medium.length)];
            } else {
                bossQuote = DOGBOT_RESCUE_EVENT.messages.developerQuotes.low[Math.floor(Math.random() * DOGBOT_RESCUE_EVENT.messages.developerQuotes.low.length)];
            }

            // 이벤트 임베드 생성 (통합 스타일)
            const embed = new EmbedBuilder()
                .setColor(hpPercentage <= 30 ? '#FF0000' : '#FF6B6B')
                .setTitle('🚨 댕댕봇 구출 이벤트 진행중!')
                .setDescription(
                    `**📢 ${floorNum}층에서 전투가 진행중입니다!**\n` +
                    `${subtitle}\n\n` +
                    `**🏰 현재 ${floorNum}층: ${currentFloor.emoji} ${currentFloor.name}**\n` +
                    `${progressBar}\n` +
                    `체력: ${(currentFloor.currentHP || 0).toLocaleString()} / ${currentFloor.maxHP.toLocaleString()} HP\n\n` +
                    `💬 *"${bossQuote}"*`
                )
                .addFields(
                    {
                        name: '📊 전투 현황',
                        value: `• 진행도: **${floorNum}/5층**\n• 참여자: **${participants}명**\n• 총 데미지: **${totalDamage.toLocaleString()}**`,
                        inline: true
                    },
                    {
                        name: '⚔️ 전투 정보',
                        value: `• 10분 쿨다운\n• 기본뎀: 100-200\n• 사전강화 추가뎀`,
                        inline: true
                    },
                    {
                        name: '🏆 현재 MVP (딜량)',
                        value: stateManager.state.statistics.mvp.userId ? 
                            `<@${stateManager.state.statistics.mvp.userId}>\n${stateManager.state.statistics.mvp.damage.toLocaleString()} 데미지` : 
                            '아직 없음',
                        inline: true
                    }
                );
            
            // 공격 횟수 1등 정보 추가
            const attackRanking = Object.entries(stateManager.state.statistics.userAttackCount || {})
                .sort((a, b) => b[1] - a[1]);
            
            if (attackRanking.length > 0 && attackRanking[0][1] > 0) {
                embed.addFields({
                    name: '⚔️ 공격왕 (횟수)',
                    value: `<@${attackRanking[0][0]}>\n${attackRanking[0][1]}회 공격`,
                    inline: true
                });
            }
            
            embed.addFields(
                {
                    name: '🎁 이벤트 보상',
                    value: '• 딜량 MVP: 골드+경험치\n• 공격왕: **댕댕봇 구출자** 칭호\n• 구출자 1시간 보상: 50,000G + 10,000 EXP',
                    inline: false
                },
                {
                    name: '💡 참여 방법',
                    value: '**아래 ⚔️ 공격하기 버튼을 눌러 몬스터를 공격하세요!**\n`/댕댕봇납치` 명령어로 언제든지 현황을 확인할 수 있습니다.',
                    inline: false
                }
            )
                .setFooter({ text: '🐕 댕댕봇을 구해주세요! • 20분마다 자동 공지' })
                .setTimestamp();


            // 버튼 생성 (두 번째 임베드용)
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('dogbot_attack')
                        .setLabel('⚔️ 공격하기')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('dogbot_status')
                        .setLabel('📊 현황 보기')
                        .setStyle(ButtonStyle.Secondary)
                );

            // 두 번째 메시지 전송
            await channel.send({
                embeds: [embed],
                components: [actionRow]
            });

            // 마지막 공지 시간 업데이트
            this.lastAnnouncementTime = Date.now();
            
            const currentTime = new Date().toLocaleTimeString();
            console.log(`📢 댕댕봇 구출 이벤트 공지 2개 발송 완료 (${floorNum}층) - ${currentTime}`);

        } catch (error) {
            console.error('❌ 댕댕봇 이벤트 공지 발송 실패:', error);
        }
    }

    // 이벤트 완료 공지
    async sendCompletionAnnouncement(client, stats) {
        try {
            const channel = await client.channels.fetch(this.announcementChannelId);
            if (!channel) {
                console.error('❌ 공지 채널을 찾을 수 없습니다:', this.announcementChannelId);
                return;
            }

            const User = require('../models/User');
            
            // MVP 정보
            const mvpUser = await User.findOne({ discordId: stats.mvp.userId });
            const mvpName = mvpUser?.nickname || '알 수 없음';
            
            // 공격왕 정보
            let attackMVPName = '';
            let attackMVPCount = 0;
            let titleMessage = '';
            
            const attackRanking = Object.entries(stats.userAttackCount || {})
                .sort((a, b) => b[1] - a[1]);
            
            if (attackRanking.length > 0 && attackRanking[0][1] > 0) {
                const attackMVPUser = await User.findOne({ discordId: attackRanking[0][0] });
                attackMVPName = attackMVPUser?.nickname || '알 수 없음';
                attackMVPCount = attackRanking[0][1];
                titleMessage = '\n🎖️ **댕댕봇 구출자** 칭호 획득!';
            }

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎊 긴급 속보! 댕댕봇 구출 성공!')
                .setDescription(
                    '**📢 속보! 댕댕봇이 구출되었습니다!**\n\n' +
                    '🐕 *"멍멍! 구해줘서 정말 고마워멍! 이제 다시 수학 문제를 낼 수 있어멍! 왈왈!"*\n\n' +
                    '💬 개발자의 한마디:\n' +
                    '*"이런... 결국 댕댕봇을 빼앗겼군... 다음엔 더 많은 버그를 준비하겠어..."*'
                )
                .addFields(
                    {
                        name: '📊 최종 통계',
                        value: `⏱️ 소요 시간: **${stats.totalTime}분**\n` +
                               `👥 참여자: **${stats.participants}명**\n` +
                               `⚔️ 총 공격: **${stats.totalAttacks}회**\n` +
                               `💥 총 데미지: **${stats.totalDamage.toLocaleString()}**`,
                        inline: true
                    },
                    {
                        name: '🏆 MVP (딜량)',
                        value: `**${mvpName}**\n${stats.mvp.damage.toLocaleString()} 데미지`,
                        inline: true
                    }
                );

            // 공격왕 필드 추가
            if (attackMVPName) {
                embed.addFields({
                    name: '⚔️ 공격왕 (횟수)',
                    value: `**${attackMVPName}**\n${attackMVPCount}회 공격${titleMessage}`,
                    inline: true
                });
            }

            embed.setImage('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723787/dogbot.png')
                .setFooter({ text: '댕댕봇 구출 작전 종료 • 모두 수고하셨습니다!' })
                .setTimestamp();

            await channel.send({
                content: '🎉 **댕댕봇 구출 작전 성공!** 🎉',
                embeds: [embed]
            });

            console.log('📢 댕댕봇 구출 완료 공지 발송 완료');

        } catch (error) {
            console.error('❌ 댕댕봇 구출 완료 공지 발송 실패:', error);
        }
    }
}

// 싱글톤 인스턴스 (전역으로 하나만 생성)
if (!global.dogBotAnnouncer) {
    global.dogBotAnnouncer = new DogBotEventAnnouncer();
}

module.exports = global.dogBotAnnouncer;