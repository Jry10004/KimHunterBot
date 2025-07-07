const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

// 사전강화 이벤트 설정
const PRELAUNCH_CONFIG = {
    channelId: '1386447256408035399',
    messageInterval: 20 * 60 * 1000, // 20분
    firstMessageDelay: 5000, // 5초
    eventImage: 'event_01.jpg',
    dataPath: path.join(__dirname, '../../prelaunchEventData.json')
};

// 사전강화 이벤트 안내 메시지 전송
async function sendPrelaunchEventMessage(client) {
    try {
        // 채널 존재 여부 먼저 확인
        let channel;
        try {
            channel = await client.channels.fetch(PRELAUNCH_CONFIG.channelId);
        } catch (fetchError) {
            if (fetchError.code === 50001) {
                console.log('📛 사전강화 이벤트 채널 접근 권한이 없습니다. 채널 ID를 확인하거나 봇의 권한을 확인해주세요.');
                return;
            }
            throw fetchError;
        }
        
        if (!channel) {
            console.log('사전강화 이벤트 채널을 찾을 수 없습니다.');
            return;
        }
        
        // 채널이 텍스트 채널인지 확인
        if (!channel.isTextBased()) {
            console.log('지정된 채널이 텍스트 채널이 아닙니다.');
            return;
        }
        
        const eventAttachment = new AttachmentBuilder(
            path.join(__dirname, '../../resource', PRELAUNCH_CONFIG.eventImage), 
            { name: PRELAUNCH_CONFIG.eventImage }
        );
        
        const eventEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎯 강화왕 김헌터 사전강화 이벤트')
            .setDescription('**🔥 오픈 전 특별 이벤트가 진행 중입니다! 🔥**\n\n정식 오픈까지 남은 시간 동안 가상 아이템을 강화하고 포인트를 획득하세요!\n\n💎 **포인트 1점 = 1골드로 정식 오픈 시 지급됩니다!**')
            .addFields(
                { 
                    name: '📌 이벤트 참여 방법', 
                    value: '1️⃣ `/사전강화` 명령어 입력\n2️⃣ 강화할 아이템 선택\n3️⃣ 강화 성공 시 포인트 획득!', 
                    inline: false 
                },
                { 
                    name: '💰 포인트 전환', 
                    value: '획득한 포인트는 1:1로 골드로 전환됩니다!\n예) 1,000P = 1,000 골드', 
                    inline: false 
                },
                { 
                    name: '🏆 최종 순위 보상 (2배 상향!)', 
                    value: '🥇 1등: **스타벅스 아메리카노** + 40만골드\n🥈 2등: 300,000 골드\n🥉 3등: 200,000 골드\n🎖️ 4~10등: 100,000 골드', 
                    inline: false 
                },
                {
                    name: '🐕 댕댕봇 이벤트',
                    value: '1시간에 5번 랜덤 출현!\n수학 문제를 맞추면 **강화 +1 보너스**',
                    inline: false
                },
                {
                    name: '⏰ 이벤트 기간',
                    value: '카운트다운이 끝날 때까지!',
                    inline: false
                }
            )
            .setImage('attachment://event_01.jpg')
            .setFooter({ text: '💡 지금 바로 참여하고 골드를 획득하세요!' })
            .setTimestamp();
        
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prelaunch_event_info')
                    .setLabel('🎮 이벤트 참여하기')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('prelaunch_leaderboard')
                    .setLabel('🏅 순위 확인')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await channel.send({ 
            embeds: [eventEmbed], 
            components: [actionRow],
            files: [eventAttachment]
        });
        
        console.log('📢 사전강화 이벤트 안내 메시지 전송 완료');
        
    } catch (error) {
        console.error('사전강화 이벤트 메시지 전송 오류:', error);
    }
}

// 사전강화 이벤트 시작
function startPrelaunchEvent(client) {
    // 첫 메시지는 5초 후 전송
    setTimeout(() => {
        sendPrelaunchEventMessage(client);
    }, PRELAUNCH_CONFIG.firstMessageDelay);
    
    // 이후 20분마다 전송
    setInterval(() => {
        sendPrelaunchEventMessage(client);
    }, PRELAUNCH_CONFIG.messageInterval);
    
    // 5분마다 사전강화 데이터 자동 저장
    setInterval(() => {
        if (global.prelaunchEventData && Object.keys(global.prelaunchEventData).length > 0) {
            savePrelaunchData();
            console.log('💾 사전강화 이벤트 데이터 자동 저장 완료');
        }
    }, 5 * 60 * 1000); // 5분
}

// 사전강화 데이터 저장
function savePrelaunchData() {
    try {
        const dataToSave = {
            eventEnded: global.prelaunchEventEnded || false,
            eventData: global.prelaunchEventData || {}
        };
        
        // 데이터 무결성 검증
        const criticalUsers = ['295980447849250817', '563406206362845224']; // 하연94, 클립
        for (const userId of criticalUsers) {
            if (dataToSave.eventData[userId]) {
                const user = dataToSave.eventData[userId];
                // 비정상적인 데이터 감지
                if (user.points < 0 || user.currentLevel < 0 || user.currentLevel > 999) {
                    console.error(`❌ 데이터 무결성 오류 감지: ${userId} - 저장 중단`);
                    return;
                }
            }
        }
        
        // 백업 생성 (시간별 폴더로 구분)
        if (fs.existsSync(PRELAUNCH_CONFIG.dataPath)) {
            const now = new Date();
            const dateFolder = `backups/${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const hourFolder = `${dateFolder}/${String(now.getHours()).padStart(2, '0')}시`;
            
            // 백업 폴더 생성
            if (!fs.existsSync('backups')) fs.mkdirSync('backups');
            if (!fs.existsSync(dateFolder)) fs.mkdirSync(dateFolder, { recursive: true });
            if (!fs.existsSync(hourFolder)) fs.mkdirSync(hourFolder, { recursive: true });
            
            const backupFileName = `${hourFolder}/prelaunchEventData_${Date.now()}.json`;
            fs.copyFileSync(PRELAUNCH_CONFIG.dataPath, backupFileName);
        }
        
        // 데이터 저장
        fs.writeFileSync(PRELAUNCH_CONFIG.dataPath, JSON.stringify(dataToSave, null, 2));
        
    } catch (error) {
        console.error('사전강화 데이터 저장 오류:', error);
    }
}

// 사전강화 데이터 로드
function loadPrelaunchData() {
    try {
        if (fs.existsSync(PRELAUNCH_CONFIG.dataPath)) {
            const data = fs.readFileSync(PRELAUNCH_CONFIG.dataPath, 'utf8');
            const parsedData = JSON.parse(data);
            
            // 새로운 데이터 구조 처리
            if (parsedData.eventEnded !== undefined) {
                global.prelaunchEventEnded = parsedData.eventEnded;
                const eventData = parsedData.eventData || {};
                
                // 데이터 마이그레이션: maxLevel을 999로 업데이트
                let updated = false;
                for (const userId in eventData) {
                    if (eventData[userId].currentItem && eventData[userId].currentItem.maxLevel !== 999) {
                        eventData[userId].currentItem.maxLevel = 999;
                        updated = true;
                    }
                }
                
                if (updated) {
                    console.log('📊 사전강화 데이터 마이그레이션: maxLevel을 999로 업데이트');
                }
                
                if (global.prelaunchEventEnded) {
                    console.log('📛 사전강화 이벤트가 이미 종료되었습니다.');
                }
                
                return parsedData;  // 전체 데이터 구조 반환
            } else {
                // 기존 데이터 구조 처리 (하위 호환성)
                let updated = false;
                for (const userId in parsedData) {
                    if (parsedData[userId].currentItem && parsedData[userId].currentItem.maxLevel !== 999) {
                        parsedData[userId].currentItem.maxLevel = 999;
                        updated = true;
                    }
                }
                
                if (updated) {
                    console.log('📊 사전강화 데이터 마이그레이션: maxLevel을 999로 업데이트');
                }
                
                return parsedData;
            }
        }
    } catch (error) {
        console.error('사전강화 데이터 로드 오류:', error);
    }
    return {};
}

// 사전강화 이벤트 버튼 처리
async function handlePrelaunchEventButton(interaction) {
    if (interaction.customId === 'prelaunch_event_info') {
        // 버튼 인터랙션은 먼저 deferUpdate
        await interaction.deferUpdate();
        
        // 사전강화 명령어 직접 실행
        const { showEnhanceMenu } = require('../../systems/prelaunchEnhance');
        
        // 유저 데이터 초기화
        if (!global.prelaunchEventData) {
            global.prelaunchEventData = {};
        }
        
        const userId = interaction.user.id;
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
        }
        
        // 아이템 선택 메뉴 표시
        const { showItemSelection } = require('../../systems/prelaunchEnhance');
        if (!global.prelaunchEventData[userId].currentItem) {
            return await showItemSelection(interaction);
        }
        
        return await showEnhanceMenu(interaction);
    } else if (interaction.customId === 'prelaunch_leaderboard') {
        // 순위 직접 표시
        const { showLeaderboard } = require('../../systems/prelaunchEnhance');
        
        // 순위 확인 시 defer 후 editReply 사용
        await interaction.deferReply({ flags: 64 });
        
        // showLeaderboard를 위한 래퍼 객체 생성
        const wrapperInteraction = {
            ...interaction,
            update: async (data) => {
                return await interaction.editReply(data);
            },
            client: interaction.client,
            user: interaction.user
        };
        
        return await showLeaderboard(wrapperInteraction);
    }
}

module.exports = {
    sendPrelaunchEventMessage,
    startPrelaunchEvent,
    savePrelaunchData,
    loadPrelaunchData,
    handlePrelaunchEventButton,
    PRELAUNCH_CONFIG
};