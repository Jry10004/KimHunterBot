const { EmbedBuilder } = require('discord.js');
const stateManager = require('./dogBotStateManager');
const { DOGBOT_RESCUE_EVENT, getCurrentFloor } = require('../data/dogBotRescueEvent');

class DogBotHostageSystem {
    constructor() {
        this.hostageInterval = null;
        this.activeHostages = new Map(); // userId -> { startTime, responded, timeoutId }
        this.isHostageSystemRunning = false; // 중복 실행 방지
    }

    // 인질 시스템 시작
    startHostageSystem(client) {
        // 이미 실행 중이면 무시
        if (this.isHostageSystemRunning) {
            console.log('⚠️ 인질 시스템이 이미 실행 중입니다.');
            return;
        }

        // 기존 인터벌 정리
        if (this.hostageInterval) {
            clearInterval(this.hostageInterval);
            this.hostageInterval = null;
        }

        this.isHostageSystemRunning = true;

        // 즉시 한 번 체크
        this.checkAndCreateHostage(client);

        // 12시간마다 체크
        this.hostageInterval = setInterval(() => {
            this.checkAndCreateHostage(client);
        }, DOGBOT_RESCUE_EVENT.hostage.checkInterval);

        console.log('✅ 댕댕봇 인질 시스템 시작 (12시간마다)');
    }

    // 인질 시스템 중지
    stopHostageSystem() {
        if (this.hostageInterval) {
            clearInterval(this.hostageInterval);
            this.hostageInterval = null;
        }

        // 모든 타임아웃 제거
        for (const [userId, data] of this.activeHostages) {
            if (data.timeoutId) {
                clearTimeout(data.timeoutId);
            }
        }
        this.activeHostages.clear();
        
        this.isHostageSystemRunning = false;

        console.log('⏹️ 댕댕봇 인질 시스템 중지');
    }

    // 인질 생성 체크
    async checkAndCreateHostage(client) {
        try {
            // 이벤트 활성화 체크
            if (!stateManager.state || !stateManager.state.status || !stateManager.state.status.isActive) {
                return;
            }

            // 이미 구출 완료된 경우
            if (stateManager.state.status.rescueComplete) {
                this.stopHostageSystem();
                return;
            }

            // 수면 시간 체크 (오전 12시 ~ 9시)
            const now = new Date();
            const hour = now.getHours();
            if (hour >= DOGBOT_RESCUE_EVENT.hostage.sleepStartHour && hour < DOGBOT_RESCUE_EVENT.hostage.sleepEndHour) {
                console.log('💤 수면 시간입니다. 인질 시스템을 건너뜁니다.');
                return;
            }

            // 참여자가 없으면 패스
            const participants = stateManager.state.statistics.participants;
            if (!participants || participants.length === 0) {
                return;
            }

            // 이미 활성 인질이 있으면 패스
            if (this.activeHostages.size > 0) {
                return;
            }

            // 랜덤 참여자 선택
            const randomUser = participants[Math.floor(Math.random() * participants.length)];

            // 채널 가져오기
            const channel = await client.channels.fetch(DOGBOT_RESCUE_EVENT.hostage.channelId);
            if (!channel) {
                console.error('❌ 인질 알림 채널을 찾을 수 없습니다.');
                return;
            }

            // 재미있는 납치 시나리오 랜덤 선택
            const scenarios = [
                {
                    title: '🧑‍💻 개발자가 당신을 노리고 있습니다!',
                    description: '개발자가 커피를 들고 접근하고 있습니다!',
                    action: '"야근하러 가자..."라고 속삭입니다',
                    escape: '빠르게 "퇴근!"이라고 외치세요!'
                },
                {
                    title: '🐛 버그의 습격!',
                    description: 'NullPointerException이 당신을 덮치려 합니다!',
                    action: 'Cannot read property of undefined...',
                    escape: 'try-catch로 막아내세요!'
                },
                {
                    title: '☕ 강제 커피타임!',
                    description: '개발자가 당신을 카페인 중독자로 만들려고 합니다!',
                    action: '"하루 10잔은 기본이지..."',
                    escape: '디카페인을 외치며 도망치세요!'
                },
                {
                    title: '📚 스택오버플로우의 미로!',
                    description: '끝없는 질문의 늪에 빠지려고 합니다!',
                    action: '"이 오류 본 적 있어?"',
                    escape: '"구글링 하세요!"라고 답하세요!'
                },
                {
                    title: '🖥️ 무한 디버깅의 저주!',
                    description: '개발자가 당신을 디버깅 지옥으로 끌고 가려 합니다!',
                    action: 'console.log를 999개 찍는 중...',
                    escape: '브레이크포인트를 걸어 탈출하세요!'
                },
                {
                    title: '🌙 야근의 그림자!',
                    description: '개발자가 당신을 24시간 코딩 마라톤에 참여시키려 합니다!',
                    action: '"배포는 금요일 저녁에..."',
                    escape: '"월요일에 하죠!"라고 외치세요!'
                }
            ];

            const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

            // 인질 메시지 생성
            const hostageEmbed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle(scenario.title)
                .setDescription(
                    `<@${randomUser}>님!\n\n` +
                    `**${scenario.description}**\n` +
                    `💬 개발자: *"${scenario.action}"*\n\n` +
                    `**🏃 탈출 방법**\n` +
                    `10분 내에 아무 메시지나 입력해서 ${scenario.escape}\n\n` +
                    `⚠️ **실패 시**\n` +
                    `개발자가 기뻐하며 디버그 타워를 **${DOGBOT_RESCUE_EVENT.hostage.healAmount.toLocaleString()} HP** 수리합니다!`
                )
                .addFields({
                    name: '⏰ 제한 시간',
                    value: '10분',
                    inline: true
                }, {
                    name: '💬 필요 행동',
                    value: '아무 메시지 입력',
                    inline: true
                }, {
                    name: '🎁 성공 보상',
                    value: '즉시 공격 가능',
                    inline: true
                })
                .setFooter({ text: '💻 개발자의 마수에서 벗어나세요!' })
                .setTimestamp();

            const message = await channel.send({
                content: `<@${randomUser}> 🚨 **개발자가 당신을 노리고 있습니다!**`,
                embeds: [hostageEmbed]
            });

            // 인질 정보 저장
            const timeoutId = setTimeout(() => {
                this.handleHostageTimeout(client, randomUser);
            }, DOGBOT_RESCUE_EVENT.hostage.responseTime);

            this.activeHostages.set(randomUser, {
                startTime: Date.now(),
                responded: false,
                timeoutId: timeoutId,
                messageId: message.id
            });

            console.log(`🚨 ${randomUser}님이 인질로 지정되었습니다.`);

        } catch (error) {
            console.error('❌ 인질 생성 실패:', error);
        }
    }

    // 인질 타임아웃 처리
    async handleHostageTimeout(client, userId) {
        const hostageData = this.activeHostages.get(userId);
        if (!hostageData || hostageData.responded) {
            return;
        }

        try {
            // HP 회복
            const currentFloor = getCurrentFloor();
            const floorNum = stateManager.state.status.currentFloor;
            const healAmount = DOGBOT_RESCUE_EVENT.hostage.healAmount;
            const oldHP = currentFloor.currentHP;
            const newHP = Math.min(oldHP + healAmount, currentFloor.maxHP);
            
            stateManager.updateFloorHP(floorNum, newHP);

            // 채널에 알림
            const channel = await client.channels.fetch(DOGBOT_RESCUE_EVENT.hostage.channelId);
            if (channel) {
                // 실패 시나리오 메시지
                const failMessages = [
                    '개발자가 당신을 야근의 늪으로 끌고 갔습니다... ☕',
                    '버그가 당신을 삼켜버렸습니다... 🐛',
                    '무한 루프에 갇혀버렸습니다... while(true) { }',
                    '스택오버플로우에 빠져 나올 수 없게 되었습니다... 📚',
                    '개발자가 당신에게 레거시 코드 유지보수를 시켰습니다... 😱',
                    'git merge conflict 지옥에 빠졌습니다... 🔥'
                ];

                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('💀 탈출 실패!')
                    .setDescription(
                        `<@${userId}>님이 개발자의 마수에서 벗어나지 못했습니다!\n\n` +
                        `**${failMessages[Math.floor(Math.random() * failMessages.length)]}**\n\n` +
                        `💻 개발자: *"후후... 덕분에 버그를 더 강화할 수 있게 됐어!"*\n\n` +
                        `**디버그 타워 HP +${healAmount.toLocaleString()}** 회복!`
                    )
                    .addFields({
                        name: '이전 HP',
                        value: oldHP.toLocaleString(),
                        inline: true
                    }, {
                        name: '➡️',
                        value: '수리됨',
                        inline: true
                    }, {
                        name: '현재 HP',
                        value: `${newHP.toLocaleString()} / ${currentFloor.maxHP.toLocaleString()}`,
                        inline: true
                    })
                    .setFooter({ text: '💡 팁: 다음엔 빠르게 응답해서 개발자를 막아주세요!' })
                    .setTimestamp();

                await channel.send({ embeds: [timeoutEmbed] });
            }

            console.log(`💀 ${userId}님 인질 타임아웃 - HP ${healAmount} 회복`);

        } catch (error) {
            console.error('❌ 타임아웃 처리 실패:', error);
        }

        // 인질 해제
        this.activeHostages.delete(userId);
    }

    // 메시지 처리 (인질 응답)
    async handleMessage(message) {
        if (message.author.bot) return;
        if (message.channel.id !== DOGBOT_RESCUE_EVENT.hostage.channelId) return;

        const userId = message.author.id;
        const hostageData = this.activeHostages.get(userId);

        if (hostageData && !hostageData.responded) {
            hostageData.responded = true;

            // 타임아웃 취소
            if (hostageData.timeoutId) {
                clearTimeout(hostageData.timeoutId);
            }

            // 응답 시간 계산
            const responseTime = Math.floor((Date.now() - hostageData.startTime) / 1000);

            // 성공 응답 메시지 랜덤
            const successResponses = [
                { user: '퇴근!', dev: '"아니... 아직 할 일이..."' },
                { user: 'Ctrl+Z!', dev: '"내 코드가 사라져...!"' },
                { user: '커피 다 떨어졌어요!', dev: '"뭐라고?! 편의점 가야해!"' },
                { user: 'git push --force', dev: '"으악! 내 커밋이!"' },
                { user: 'rm -rf /', dev: '"위험해! 하지마!"' },
                { user: '주석 다 지웠어요!', dev: '"내 소중한 주석들이...!"' }
            ];

            const response = successResponses[Math.floor(Math.random() * successResponses.length)];

            // 빠른 응답 보너스 메시지
            let speedBonus = '';
            if (responseTime < 10) {
                speedBonus = '\n🏃 **초고속 탈출!** 개발자가 당황했습니다!';
            } else if (responseTime < 30) {
                speedBonus = '\n⚡ **빠른 탈출!** 개발자가 놀랐습니다!';
            }

            // 성공 메시지
            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ 탈출 성공!')
                .setDescription(
                    `<@${userId}>님이 개발자의 마수에서 벗어났습니다!\n\n` +
                    `💬 당신: *"${response.user}"*\n` +
                    `💻 개발자: *${response.dev}*\n\n` +
                    `⏱️ 응답 시간: **${responseTime}초**${speedBonus}\n\n` +
                    `🎁 **보상**: 공격 쿨다운이 초기화되었습니다!\n` +
                    `⚔️ 지금 바로 디버그 타워를 공격할 수 있습니다!`
                )
                .setFooter({ text: '🎉 훌륭한 탈출이었습니다!' })
                .setTimestamp();

            await message.channel.send({ embeds: [successEmbed] });

            // 쿨다운 제거
            const { attackCooldowns } = require('../handlers/dogBotRescueHandler');
            if (attackCooldowns) {
                attackCooldowns.delete(userId);
            }

            // 인질 해제
            this.activeHostages.delete(userId);

            console.log(`✅ ${userId}님 인질 성공 - 응답 시간: ${responseTime}초`);
        }
    }
}

// 싱글톤 인스턴스
const hostageSystem = new DogBotHostageSystem();

module.exports = hostageSystem;