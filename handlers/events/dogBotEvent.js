const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

// 댕댕봇 이벤트 시스템
const dogBotEvent = {
    active: false,
    currentProblem: null,
    currentChannel: null,
    currentUser: null,
    timeout: null,
    nextEventTime: null,
    problemCount: 0,
    spawnTime: null, // 댕댕봇이 출현한 시간
    rememberedChannel: null, // 댕댕봇이 기억하는 최신 채널 (1개만)
    glitchLevel: 0, // 글리치 레벨 (0: 정상, 1-5: 점점 심해짐)
    kidnapWarningCount: 0, // 납치 경고 횟수
    rescuerRewardTimer: null, // 댕댕봇 구출자 보상 타이머
    rescuerRewardGiven: false // 구출자 보상 지급 여부
};

// 글리치 텍스트 생성
function glitchText(text, level = 1) {
    if (level === 0) return text;
    
    const glitchChars = ['̸', '̷', '̶', '̵', '̴', '̳', '̲', '̱', '̰', '̯', '̮', '̭', '̬', '̫', '̪', '̩', '̨', '̧', '̦', '̥', '̤', '̣', '̢', '̡', '̠'];
    const zalgoChars = ['̈', '̊', '̋', '̌', '̍', '̎', '̏', '̐', '̑', '̒', '̓', '̔', '̕', '̖', '̗', '̘', '̙', '̚', '̛', '̜', '̝', '̞', '̟'];
    const corruptChars = ['?', '!', '#', '@', '&', '*', '/', '\\', '|', '_', '~'];
    
    let result = '';
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        
        // 레벨에 따라 글리치 강도 조절
        if (Math.random() < level * 0.15) {
            // 문자 변형
            if (Math.random() < 0.3) {
                char = corruptChars[Math.floor(Math.random() * corruptChars.length)];
            }
            // 글리치 효과 추가
            const effectCount = Math.floor(Math.random() * level);
            for (let j = 0; j < effectCount; j++) {
                if (Math.random() < 0.5) {
                    char += glitchChars[Math.floor(Math.random() * glitchChars.length)];
                } else {
                    char += zalgoChars[Math.floor(Math.random() * zalgoChars.length)];
                }
            }
        }
        result += char;
    }
    return result;
}

// 납치 관련 메시지 생성
function getKidnapMessage(level) {
    const messages = {
        1: [
            "어... 뭔가 이상한 느낌이 들어멍...",
            "갑자기 춥네멍... 🥶",
            "누가 날 지켜보는 것 같아멍...",
            "뒤에서 발자국 소리가... 아니야, 신경쓰지 마멍!"
        ],
        2: [
            "도..도와줘멍... 누군가 날 쫓아와멍!",
            "S.O.S... 아니 아니야! 문제 맞춰줘멍!",
            "여기가... 여기가 어디멍? 😰",
            "빨리... 빨리 답을 말해줘멍... 시간이 없어..."
        ],
        3: [
            "살려줘멍!! 누군가 날 잡으려고 해!!!",
            "도망쳐야... 아니 문제를... 으악!",
            "이상한 사람들이... 날... 잡으려고...",
            "HELP ME!! 제발... 구해줘멍..."
        ],
        4: [
            "안돼!!! 놓아줘!!! 가지 싫어멍!!!",
            "마지막으로... 문제 하나만... 제발...",
            "친구들아... 꼭 날 찾아줘멍... 😭",
            "으아악!!! 누가 날 끌고 가려고... 놔줘!!!"
        ],
        5: [
            "잡혔어멍... 이제... 안녕...",
            "꼭... 꼭 구하러 와줘멍... 기다릴게...",
            "어두워... 무서워... 구해줘...",
            "마지막 메시지멍... 잊지 말아줘..."
        ]
    };
    
    const levelMessages = messages[level] || messages[1];
    return levelMessages[Math.floor(Math.random() * levelMessages.length)];
}

// 댕댕봇 수학 문제 생성 (글리치 효과 포함)
function generateMathProblem() {
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    let a, b, answer;
    
    switch(operation) {
        case '+':
            a = Math.floor(Math.random() * 50) + 1;
            b = Math.floor(Math.random() * 50) + 1;
            answer = a + b;
            break;
        case '-':
            a = Math.floor(Math.random() * 50) + 20;
            b = Math.floor(Math.random() * a);
            answer = a - b;
            break;
        case '*':
            a = Math.floor(Math.random() * 15) + 1;
            b = Math.floor(Math.random() * 15) + 1;
            answer = a * b;
            break;
    }
    
    // 글리치 레벨이 높을수록 잘못된 답을 말할 확률 증가
    let displayAnswer = answer;
    if (dogBotEvent.glitchLevel > 0 && Math.random() < dogBotEvent.glitchLevel * 0.2) {
        displayAnswer = answer + Math.floor(Math.random() * 5) - 2; // ±2 오차
        if (displayAnswer === answer) displayAnswer += 1; // 같으면 +1
    }
    
    return {
        question: `${a} ${operation} ${b}`,
        answer: answer,
        displayAnswer: displayAnswer,
        fakeAnswer: displayAnswer !== answer
    };
}

// 카운트다운 체크 함수
function isCountdownActive() {
    // 서버가 오픈되지 않았으면 항상 카운트다운 상태
    return !global.serverOpened;
}

// 댕댕봇 이벤트 시작
async function startDogBotEvent(client, forceChannelId = null) {
    if (!isCountdownActive() || dogBotEvent.active) return;
    
    // 채널 선택: 강제 지정된 채널 > 기억된 채널 > 기본 채널
    let channelId;
    if (forceChannelId) {
        channelId = forceChannelId;
        dogBotEvent.rememberedChannel = forceChannelId; // 새 채널 기억
    } else if (dogBotEvent.rememberedChannel) {
        channelId = dogBotEvent.rememberedChannel;
    } else {
        // 기억된 채널이 없으면 이벤트를 시작하지 않음
        console.log('댕댕봇이 기억하는 채널이 없습니다.');
        return;
    }
    
    const channel = client.channels.cache.get(channelId);
    
    if (!channel) {
        console.error('댕댕봇 이벤트 채널을 찾을 수 없습니다:', channelId);
        return;
    }
    
    const problem = generateMathProblem();
    
    dogBotEvent.active = true;
    dogBotEvent.currentProblem = problem;
    dogBotEvent.currentChannel = channel.id;
    dogBotEvent.problemCount++;
    dogBotEvent.spawnTime = Date.now(); // 출현 시간 기록
    dogBotEvent.rescuerRewardGiven = false;
    
    // 기존 타이머 정리
    if (dogBotEvent.rescuerRewardTimer) {
        clearTimeout(dogBotEvent.rescuerRewardTimer);
        dogBotEvent.rescuerRewardTimer = null;
    }
    
    // 1시간 후 댕댕봇 구출자에게 보상 지급
    dogBotEvent.rescuerRewardTimer = setTimeout(async () => {
        if (dogBotEvent.active && !dogBotEvent.rescuerRewardGiven) {
            const User = require('../../models/User');
            
            // 댕댕봇 구출자 칭호를 가진 유저 찾기
            const rescuer = await User.findOne({ titles: '댕댕봇 구출자' });
            
            if (rescuer) {
                // 보상 지급
                const goldReward = 50000;
                const expReward = 10000;
                rescuer.gold = (rescuer.gold || 0) + goldReward;
                rescuer.exp = (rescuer.exp || 0) + expReward;
                await rescuer.save();
                
                dogBotEvent.rescuerRewardGiven = true;
                
                // 채널에 알림
                if (channel && channel.send) {
                    const rewardEmbed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('🎖️ 댕댕봇 구출자 특별 보상!')
                        .setDescription(
                            `댕댕봇이 1시간 이상 머물렀습니다!\n` +
                            `**${rescuer.nickname}**님께 특별 보상이 지급됩니다!`
                        )
                        .addFields(
                            { name: '💰 골드', value: `+${goldReward.toLocaleString()}G`, inline: true },
                            { name: '⭐ 경험치', value: `+${expReward.toLocaleString()} EXP`, inline: true }
                        )
                        .setFooter({ text: '댕댕봇 구출자 전용 보상' })
                        .setTimestamp();
                    
                    await channel.send({ embeds: [rewardEmbed] });
                    
                    console.log(`🎖️ 댕댕봇 구출자 ${rescuer.nickname}에게 1시간 보상 지급 완료`);
                }
            }
        }
    }, 60 * 60 * 1000); // 1시간
    
    // 글리치 레벨 증가 (매 5번째 문제마다)
    if (dogBotEvent.problemCount % 5 === 0 && dogBotEvent.glitchLevel < 5) {
        dogBotEvent.glitchLevel++;
        dogBotEvent.kidnapWarningCount++;
    }
    
    // 다양한 등장 메시지 (글리치 레벨에 따라 변형)
    const normalGreetings = [
        { title: '🐕 귀여운 천사 댕댕봇이 나타났멍! 👼', desc: '멍멍! 첫 번째로 정답을 맞추면 **강화 +1~+20 보너스**를 주겠멍! 🦴\n빨리 맞춰줘멍~ 🥺' },
        { title: '🐶 못생긴 천사 댕댕봇이 들렸멍! 😇', desc: '왈왈! 못생겨도 착해멍! 문제 맞추면 **강화 +1~+20** 올려줄게멍!\n간식도 줘멍~ 🐾' },
        { title: '🐕‍🦺 상큼한 물주먹 댕댕봇 출동했멍! 💦', desc: '멍! 물주먹이지만 수학은 잘해멍!\n정답 맞추면 **강화 +1~+20** 상큼하게 줄게멍! 🌊' },
        { title: '🦮 안내견 댕댕봇이 왔멍! 🦯', desc: '끙끙! 길 잃은 문제를 찾아줄게멍!\n첫 정답자에게 **강화 +1~+20** 선물이멍! 🎁' },
        { title: '🐩 멋쟁이 댕댕봇 등장이멍! ✨', desc: '컹컹! 오늘도 멋진 문제 가져왔멍!\n**강화 +1~+20** 보너스도 멋있게 줄게멍! 💅' },
        { title: '🐕 배고픈 댕댕봇이 나타났멍! 🍖', desc: '꼬르륵... 문제 맞추면 **강화 +1~+20** 줄게멍!\n대신 간식도 달라멍~ 🥺' }
    ];
    
    let greeting = normalGreetings[Math.floor(Math.random() * normalGreetings.length)];
    
    // 글리치 레벨에 따라 메시지 변형
    if (dogBotEvent.glitchLevel > 0) {
        greeting.title = glitchText(greeting.title, dogBotEvent.glitchLevel);
        
        // 납치 메시지 추가
        const kidnapMsg = getKidnapMessage(dogBotEvent.glitchLevel);
        greeting.desc = greeting.desc + '\n\n' + glitchText(kidnapMsg, dogBotEvent.glitchLevel);
    }
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(greeting.title)
        .setDescription(greeting.desc)
        .setThumbnail('attachment://dog_bot.png')
        .addFields({
            name: '🧮 문제멍!',
            value: `\`\`\`${problem.question} = ?\`\`\``,
            inline: false
        })
        .setFooter({ text: '3분 안에 답을 입력해줘멍! 🐶' })
        .setTimestamp();
    
    // 프로필 이미지 첨부
    const dogBotImagePath = path.join(__dirname, '../../resource', 'dog_bot.png');
    const files = [];
    console.log('🐕 댕댕봇 이미지 경로:', dogBotImagePath);
    console.log('🐕 파일 존재 여부:', fs.existsSync(dogBotImagePath));
    
    if (fs.existsSync(dogBotImagePath)) {
        files.push(new AttachmentBuilder(dogBotImagePath, { name: 'dog_bot.png' }));
        console.log('🐕 이미지 파일 첨부 완료');
    }
    
    try {
        await channel.send({ embeds: [embed], files });
        
        // 3분 타임아웃
        dogBotEvent.timeout = setTimeout(() => {
            if (dogBotEvent.active && dogBotEvent.currentChannel === channel.id) {
                let timeoutMessage = '🐕 흑흑... 아무도 답을 안 알려줬멍... 😢\n댕댕이는 다른 곳으로 가볼게멍... 다음엔 꼭 맞춰줘멍! 🐾';
                
                // 글리치 효과 적용
                if (dogBotEvent.glitchLevel > 0) {
                    timeoutMessage = glitchText(timeoutMessage, dogBotEvent.glitchLevel);
                }
                
                channel.send(timeoutMessage);
                dogBotEvent.active = false;
                dogBotEvent.currentProblem = null;
                dogBotEvent.currentChannel = null;
                dogBotEvent.currentUser = null;
                dogBotEvent.spawnTime = null;
                
                // 구출자 보상 타이머 정리
                if (dogBotEvent.rescuerRewardTimer) {
                    clearTimeout(dogBotEvent.rescuerRewardTimer);
                    dogBotEvent.rescuerRewardTimer = null;
                }
            }
        }, 180000); // 3분 = 180초
    } catch (error) {
        console.error('댕댕봇 이벤트 오류:', error);
        dogBotEvent.active = false;
    }
}

// 댕댕봇 이벤트 스케줄러
function scheduleDogBotEvent(client) {
    if (!isCountdownActive()) {
        console.log('❌ 댕댕봇 스케줄러: 카운트다운이 비활성화 상태입니다.');
        return;
    }
    
    // 기본 채널 설정 (사전강화 이벤트 채널)
    if (!dogBotEvent.rememberedChannel) {
        dogBotEvent.rememberedChannel = '1386447256408035399'; // 사전강화 이벤트 채널
        console.log('🐕 댕댕봇 기본 채널 설정: 사전강화 이벤트 채널');
    }
    
    // 1시간에 5번 = 평균 12분마다, 랜덤하게 8-16분 사이
    const nextDelay = (8 + Math.random() * 8) * 60 * 1000;
    dogBotEvent.nextEventTime = Date.now() + nextDelay;
    
    console.log(`🐕 다음 댕댕봇 이벤트: ${Math.floor(nextDelay / 60000)}분 후`);
    
    setTimeout(() => {
        startDogBotEvent(client);
        scheduleDogBotEvent(client); // 다음 이벤트 스케줄
    }, nextDelay);
}

// 댕댕봇 채널 기억 함수 (최신 채널 1개만 기억)
function rememberDogChannel(channelId) {
    dogBotEvent.rememberedChannel = channelId;
    console.log(`🐕 댕댕봇이 새로운 채널을 기억했습니다: ${channelId}`);
}

// 댕댕봇 정답 확인
async function checkDogBotAnswer(message) {
    if (!dogBotEvent.active || 
        message.channel.id !== dogBotEvent.currentChannel ||
        !dogBotEvent.currentProblem) {
        return false;
    }
    
    const answer = parseInt(message.content);
    if (isNaN(answer)) return false;
    
    if (answer === dogBotEvent.currentProblem.answer) {
        // 정답!
        clearTimeout(dogBotEvent.timeout);
        
        // 보너스 강화 수치 (1~20)
        const bonusLevel = Math.floor(Math.random() * 20) + 1;
        
        // 응답 시간 계산
        const responseTime = ((Date.now() - dogBotEvent.spawnTime) / 1000).toFixed(1);
        
        // 다양한 축하 메시지
        const congratulations = [
            `🎉 멍멍! ${message.author}님이 ${responseTime}초 만에 정답을 맞췄멍! **강화 +${bonusLevel}** 보너스를 받았멍! 🦴`,
            `🐶 왈왈! ${message.author}님 대단해멍! ${responseTime}초 만에 맞췄멍! **강화 +${bonusLevel}** 선물이멍! 🎁`,
            `🐕 컹컹! ${message.author}님이 ${responseTime}초 만에 정답이멍! **강화 +${bonusLevel}** 보너스 챙겨가멍! 💝`,
            `🦮 멍멍! ${message.author}님 천재멍! ${responseTime}초 만에 맞췄멍! **강화 +${bonusLevel}** 받아가멍! 🏆`
        ];
        
        let randomCongrats = congratulations[Math.floor(Math.random() * congratulations.length)];
        
        // 글리치 효과 적용
        if (dogBotEvent.glitchLevel > 0) {
            randomCongrats = glitchText(randomCongrats, dogBotEvent.glitchLevel);
        }
        
        await message.channel.send(randomCongrats);
        
        // 사전강화 이벤트 보너스 적용
        if (global.prelaunchEventData) {
            const userId = message.author.id;
            if (!global.prelaunchEventData[userId]) {
                global.prelaunchEventData[userId] = {
                    nickname: message.author.username,
                    points: 0,
                    currentLevel: 0,
                    currentItem: null,
                    totalEnhanced: 0,
                    dogBotBonus: 0,
                    lastDaily: null
                };
            }
            
            // 현재 아이템이 있으면 강화 레벨 증가
            if (global.prelaunchEventData[userId].currentItem) {
                const oldLevel = global.prelaunchEventData[userId].currentLevel;
                global.prelaunchEventData[userId].currentLevel = Math.min(
                    global.prelaunchEventData[userId].currentLevel + bonusLevel,
                    999
                );
                global.prelaunchEventData[userId].dogBotBonus += bonusLevel;
                
                const actualBonus = global.prelaunchEventData[userId].currentLevel - oldLevel;
                
                let enhanceMessage = 
                    `🐕 **${message.author.username}**님의 **${global.prelaunchEventData[userId].currentItem.name}**이(가) ` +
                    `+${oldLevel} → **+${global.prelaunchEventData[userId].currentLevel}**로 강화되었멍! (+${actualBonus}) 🎊`;
                
                // 글리치 효과 적용
                if (dogBotEvent.glitchLevel > 0) {
                    enhanceMessage = glitchText(enhanceMessage, dogBotEvent.glitchLevel);
                }
                
                await message.channel.send(enhanceMessage);
                
                // 데이터 저장
                const { savePrelaunchData } = require('./prelaunchEvent');
                savePrelaunchData();
            } else {
                let noItemMessage = 
                    `🐕 ${message.author.username}님은 강화 중인 아이템이 없어서 보너스를 받을 수 없멍... 😢\n` +
                    `/사전강화 명령어로 아이템을 강화해보라멍!`;
                
                // 글리치 효과 적용
                if (dogBotEvent.glitchLevel > 0) {
                    noItemMessage = glitchText(noItemMessage, dogBotEvent.glitchLevel);
                }
                
                await message.channel.send(noItemMessage);
            }
        }
        
        dogBotEvent.active = false;
        dogBotEvent.currentProblem = null;
        dogBotEvent.currentChannel = null;
        dogBotEvent.currentUser = null;
        dogBotEvent.spawnTime = null;
        
        // 구출자 보상 타이머 정리
        if (dogBotEvent.rescuerRewardTimer) {
            clearTimeout(dogBotEvent.rescuerRewardTimer);
            dogBotEvent.rescuerRewardTimer = null;
        }
        
        return true;
    }
    
    return false;
}

// 강제 트리거 함수 (개발자 전용)
async function triggerDogBotEvent(client, channelId) {
    console.log(`🐕 댕댕봇 이벤트 강제 트리거: 채널 ${channelId}`);
    await startDogBotEvent(client, channelId);
}

module.exports = {
    dogBotEvent,
    scheduleDogBotEvent,
    rememberDogChannel,
    checkDogBotAnswer,
    triggerDogBotEvent,
    startDogBotEvent
};