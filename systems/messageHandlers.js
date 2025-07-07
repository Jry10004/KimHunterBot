// 메시지 이벤트 핸들러 시스템
const { EmbedBuilder } = require('discord.js');
const path = require('path');
const antiMacro = require('./antiMacro');
const dogBotHostageSystem = require('./dogBotHostageSystem');

// 인기도 업데이트 함수 (외부에서 주입)
let updatePopularityFunction = null;

// 인기도 업데이트 함수 설정
function setUpdatePopularityFunction(func) {
    updatePopularityFunction = func;
}

// 테스트용 메시지 핸들러 (디버깅용)
async function handleDebugMessage(message) {
    console.log('[DEBUG messageCreate] 이벤트 트리거됨!');
    console.log(`[DEBUG] 작성자: ${message.author.username} (${message.author.id})`);
    console.log(`[DEBUG] 내용: ${message.content}`);
    console.log(`[DEBUG] 채널 타입: ${message.channel.type}`);
    console.log(`[DEBUG] 봇 여부: ${message.author.bot}`);
}

// 메시지 반응 추가 핸들러
async function handleMessageReactionAdd(reaction, user) {
    try {
        // 봇의 반응은 무시
        if (user.bot) return;
        
        // 부분적인 메시지인 경우 전체 메시지 가져오기
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('반응 fetch 오류:', error);
                return;
            }
        }
        
        // 메시지 작성자가 봇인 경우 무시
        if (reaction.message.author.bot) return;
        
        // 자기 자신의 메시지에 대한 반응 무시
        if (reaction.message.author.id === user.id) return;
        
        // 인기도 관련 이모지 확인
        const popularityEmojis = {
            '❤️': 1,    // 하트: +1
            '👍': 1,    // 따봉: +1
            '😢': -1,   // 슬픔: -1
            '😭': -1    // 대성통곡: -1 (추가)
        };
        
        const emojiName = reaction.emoji.name;
        if (!popularityEmojis.hasOwnProperty(emojiName)) return;
        
        if (!updatePopularityFunction) {
            console.error('updatePopularity 함수가 설정되지 않았습니다.');
            return;
        }
        
        const value = popularityEmojis[emojiName];
        const result = await updatePopularityFunction(
            reaction.message.author.id,
            emojiName,
            value,
            reaction.message.id,
            reaction.message.guild
        );
        
        // 결과 로그
        if (result.success) {
            console.log(`인기도 업데이트: ${reaction.message.author.tag} ${result.message}`);
        }
    } catch (error) {
        console.error('메시지 반응 처리 오류:', error);
    }
}

// 메시지 반응 제거 핸들러
async function handleMessageReactionRemove(reaction, user) {
    try {
        // 봇의 반응은 무시
        if (user.bot) return;
        
        // 부분적인 메시지인 경우 전체 메시지 가져오기
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('반응 fetch 오류:', error);
                return;
            }
        }
        
        // 메시지 작성자가 봇인 경우 무시
        if (reaction.message.author.bot) return;
        
        // 자기 자신의 메시지에 대한 반응 무시
        if (reaction.message.author.id === user.id) return;
        
        // 반응 제거 시 인기도 원복 (선택사항)
        // 필요한 경우 구현 가능
    } catch (error) {
        console.error('메시지 반응 제거 처리 오류:', error);
    }
}

// 제재 알림 전송
async function sendPenaltyNotification(message, userId, penalty) {
    const penaltyEmbed = new EmbedBuilder()
        .setTitle('🚨 매크로 제재 적용')
        .setDescription(`${penalty.message}\n\n제재 기간: ${penalty.duration === 'permanent' ? '영구' : `${penalty.duration / 60000}분`}`)
        .setColor('#FF0000')
        .setFooter({ text: '김헌터 보안 시스템' })
        .setTimestamp();
    
    try {
        await message.reply({
            embeds: [penaltyEmbed],
            allowedMentions: { repliedUser: false }
        });
    } catch (error) {
        console.error('제재 알림 전송 실패:', error);
    }
}

// 매크로 검증 및 댕댕봇 답변 처리
async function handleMacroVerificationMessage(message) {
    // 봇 메시지 무시
    if (message.author.bot) return;
    
    // 댕댕봇 인질 시스템 응답 처리
    await dogBotHostageSystem.handleMessage(message);
    
    // 모든 메시지에 대해 로그
    console.log(`[messageCreate] 메시지 받음 - 유저: ${message.author.id} (${message.author.username}), 내용: ${message.content}, 채널타입: ${message.channel.type}`);
    
    // 매크로 검증 응답 확인 (DM 포함 모든 메시지에서 처리)
    const userId = message.author.id;
    console.log(`[매크로 검증] 메시지 받음 - 유저: ${userId}, 내용: ${message.content}, 채널타입: ${message.channel.type}`);
    console.log(`[매크로 검증] 현재 활성 검증 목록:`, Array.from(antiMacro.ANTI_MACRO.activeVerifications.keys()));
    console.log(`[매크로 검증] 대상 유저 검증 존재 여부:`, antiMacro.ANTI_MACRO.activeVerifications.has(userId));
    
    if (antiMacro.ANTI_MACRO.activeVerifications.has(userId)) {
        const verification = antiMacro.ANTI_MACRO.activeVerifications.get(userId);
        console.log(`[매크로 검증] 활성 검증 발견 - 정답: ${verification.code}, 타입: ${verification.type}`);
        
        // DM이든 채널이든 상관없이 처리
        console.log(`[매크로 검증] 메시지 타입: ${message.channel.type === 1 ? 'DM' : '채널'}, 유저: ${userId}`);
        console.log(`[매크로 검증] CAPTCHA 검증 시도 - 유저: ${userId}, 입력: ${message.content}`);
        const result = await antiMacro.verifyCaptcha(userId, message.content);
        console.log('[매크로 검증] 검증 결과:', result);
        
        if (result.success) {
            // 검증 성공
            global.enhancingUsers.delete(userId);
            
            const policePath = path.join(__dirname, '..', 'resource', 'police.png');
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ 검증 성공!')
                .setDescription('**정상 사용자로 확인되었습니다!**\n\n✨ 이제 김헌터 봇을 계속 이용하실 수 있습니다.\n🛡️ 안전한 게임 환경을 위해 협조해 주셔서 감사합니다!')
                .setColor('#00FF00')
                .setThumbnail('attachment://police.png')
                .setFooter({ text: '김헌터 보안 시스템', iconURL: 'attachment://police.png' })
                .setTimestamp();
            
            // 검증 성공 메시지 전송
            try {
                await message.reply({
                    embeds: [successEmbed],
                    files: [{ attachment: policePath, name: 'police.png' }],
                    allowedMentions: { repliedUser: false }
                });
            } catch (error) {
                // DM이나 권한 문제로 응답 실패 시 로그만 남김
                console.log(`[매크로 검증] 성공 메시지 전송 실패 (유저: ${userId}):`, error.message);
            }
            
            // 검증이 채널에서 발생한 경우 원래 채널에도 알림
            if (result.channel && message.channel.type === 1) { // DM인 경우
                try {
                    await result.channel.send({
                        content: `✅ <@${userId}>님의 매크로 검증이 성공적으로 완료되었습니다!`,
                        allowedMentions: { users: [userId] }
                    });
                } catch (error) {
                    console.log(`[매크로 검증] 채널 알림 실패:`, error.message);
                }
            }
            
            return;
        } else if (result.reason === 'incorrect' && result.attemptsLeft > 0) {
            // 재시도 가능
            const retryEmbed = new EmbedBuilder()
                .setTitle('❌ 잘못된 답입니다')
                .setDescription(`**남은 시도 횟수: ${result.attemptsLeft}회**\n\n💡 팁:\n• 대소문자 구분 없이 입력하세요\n• 수학 문제의 경우 숫자만 입력하세요\n• 한글 자음은 순서대로 입력하세요`)
                .setColor('#FF6B6B')
                .setFooter({ text: '다시 시도해주세요!' });
            
            await message.reply({
                embeds: [retryEmbed],
                allowedMentions: { repliedUser: false }
            });
            
            return;
        } else if (result.reason === 'max_attempts') {
            // 최대 시도 횟수 초과
            global.enhancingUsers.delete(userId);
            
            const penaltyHistory = antiMacro.ANTI_MACRO.penaltyHistory.get(userId);
            const penalty = antiMacro.ANTI_MACRO.penaltyTiers[penaltyHistory.level - 1];
            await sendPenaltyNotification(message, userId, penalty);
            
            return;
        } else if (result.reason === 'timeout') {
            // 시간 초과
            global.enhancingUsers.delete(userId);
            
            await message.reply({
                content: '⏰ 매크로 검증 시간이 초과되었습니다. 제재가 적용됩니다.',
                allowedMentions: { repliedUser: false }
            });
            
            return;
        } else if (result.reason === 'already_processing') {
            // 이미 처리 중 - 무시
            return;
        }
    }
    
    // 댕댕봇 답변 처리
    const { checkDogBotAnswer } = require('../handlers/events');
    await checkDogBotAnswer(message);
}

module.exports = {
    setUpdatePopularityFunction,
    handleDebugMessage,
    handleMessageReactionAdd,
    handleMessageReactionRemove,
    handleMacroVerificationMessage
};