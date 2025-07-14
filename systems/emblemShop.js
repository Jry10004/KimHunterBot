const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Emblem data with updated descriptions
const EMBLEMS = {
    warrior: {
        name: '전사',
        emoji: '⚔️',
        color: '#ff0000',
        description: '초보전사 → 튼튼한 기사 → 용맹한 검사 → 맹렬한 전사 → 전설의 기사',
        emblems: [
            { name: '초보전사', price: 300000, level: 20, roleName: '초보전사' },
            { name: '튼튼한 기사', price: 500000, level: 35, roleName: '튼튼한 기사' },
            { name: '용맹한 검사', price: 1500000, level: 50, roleName: '용맹한 검사' },
            { name: '맹렬한 전사', price: 3000000, level: 65, roleName: '맹렬한 전사' },
            { name: '전설의 기사', price: 10000000, level: 80, roleName: '전설의 기사' }
        ]
    },
    archer: {
        name: '궁수',
        emoji: '🏹',
        color: '#00ff00',
        description: '마을사냥꾼 → 숲의 궁수 → 바람 사수 → 정확한 사격수 → 전설의 명궁',
        emblems: [
            { name: '마을사냥꾼', price: 300000, level: 20, roleName: '마을사냥꾼' },
            { name: '숲의 궁수', price: 500000, level: 35, roleName: '숲의 궁수' },
            { name: '바람 사수', price: 1500000, level: 50, roleName: '바람 사수' },
            { name: '정확한 사격수', price: 3000000, level: 65, roleName: '정확한 사격수' },
            { name: '전설의 명궁', price: 10000000, level: 80, roleName: '전설의 명궁' }
        ]
    },
    defender: {
        name: '수호자',
        emoji: '🛡️',
        color: '#808080',
        description: '초보 수호자 → 철벽 방패병 → 불굴의 수호자 → 강철 파수꾼 → 전설의 철벽',
        emblems: [
            { name: '초보 수호자', price: 300000, level: 20, roleName: '초보 수호자' },
            { name: '철벽 방패병', price: 500000, level: 35, roleName: '철벽 방패병' },
            { name: '불굴의 수호자', price: 1500000, level: 50, roleName: '불굴의 수호자' },
            { name: '강철 파수꾼', price: 3000000, level: 65, roleName: '강철 파수꾼' },
            { name: '전설의 철벽', price: 10000000, level: 80, roleName: '전설의 철벽' }
        ]
    },
    wizard: {
        name: '마법사',
        emoji: '🧙',
        color: '#0066ff',
        description: '견습 마법사 → 원소 술사 → 신비한 현자 → 대마법사 → 전설의 아크메이지',
        emblems: [
            { name: '견습 마법사', price: 300000, level: 20, roleName: '견습 마법사' },
            { name: '원소 술사', price: 500000, level: 35, roleName: '원소 술사' },
            { name: '신비한 현자', price: 1500000, level: 50, roleName: '신비한 현자' },
            { name: '대마법사', price: 3000000, level: 65, roleName: '대마법사' },
            { name: '전설의 아크메이지', price: 10000000, level: 80, roleName: '전설의 아크메이지' }
        ]
    },
    rogue: {
        name: '도적',
        emoji: '🗡️',
        color: '#800080',
        description: '떠돌이 도적 → 운 좋은 도둑 → 행운의 닌자 → 복 많은 도적 → 전설의 행운아',
        emblems: [
            { name: '떠돌이 도적', price: 300000, level: 20, roleName: '떠돌이 도적' },
            { name: '운 좋은 도둑', price: 500000, level: 35, roleName: '운 좋은 도둑' },
            { name: '행운의 닌자', price: 1500000, level: 50, roleName: '행운의 닌자' },
            { name: '복 많은 도적', price: 3000000, level: 65, roleName: '복 많은 도적' },
            { name: '전설의 행운아', price: 10000000, level: 80, roleName: '전설의 행운아' }
        ]
    }
};

// Store permanent message IDs
const permanentMessageIds = new Map();
const MESSAGE_IDS_FILE = path.join(__dirname, '..', 'data', 'emblemShopMessages.json');

// Load saved message IDs
function loadMessageIds() {
    try {
        if (fs.existsSync(MESSAGE_IDS_FILE)) {
            const data = JSON.parse(fs.readFileSync(MESSAGE_IDS_FILE, 'utf8'));
            Object.entries(data).forEach(([channelId, messageId]) => {
                permanentMessageIds.set(channelId, messageId);
            });
            console.log('✅ 엠블럼 상점 메시지 ID 로드 완료');
        }
    } catch (error) {
        console.error('엠블럼 상점 메시지 ID 로드 실패:', error);
    }
}

// Save message IDs to file
function saveMessageIds() {
    try {
        const data = {};
        permanentMessageIds.forEach((messageId, channelId) => {
            data[channelId] = messageId;
        });
        
        // data 디렉토리가 없으면 생성
        const dataDir = path.dirname(MESSAGE_IDS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(MESSAGE_IDS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('엠블럼 상점 메시지 ID 저장 실패:', error);
    }
}

// Load message IDs on startup
loadMessageIds();

// Create the emblem shop embed
function createEmblemShopEmbed() {
    const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('🏆 엠블럼 상점')
        .setDescription(
            '**레벨 20 이상**부터 엠블럼을 구매할 수 있습니다!\n\n' +
            '엠블럼을 구매하면 특별한 칭호 역할을 받게 됩니다.\n' +
            '**⚠️ 엠블럼은 한 번 선택하면 변경할 수 없습니다!**\n\n' +
            '**엠블럼 진화 경로:**'
        )
        .addFields(
            Object.values(EMBLEMS).map(category => ({
                name: `${category.emoji} ${category.name} 계열`,
                value: category.description,
                inline: false
            }))
        )
        .setFooter({ text: '원하는 계열을 선택하여 엠블럼을 구매하세요!' })
        .setTimestamp();

    return embed;
}

// Create the select menu for emblem categories
function createEmblemSelectMenu() {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('emblem_shop_category')
        .setPlaceholder('엠블럼 계열을 선택하세요')
        .addOptions(
            Object.entries(EMBLEMS).map(([key, category]) => ({
                label: `${category.name} 계열`,
                description: category.emblems[0].name + ' → ' + category.emblems[category.emblems.length - 1].name,
                value: key,
                emoji: category.emoji
            }))
        );

    return new ActionRowBuilder().addComponents(selectMenu);
}

// Create refresh button
function createRefreshButton() {
    const refreshButton = new ButtonBuilder()
        .setCustomId('emblem_shop_refresh')
        .setLabel('새로고침')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄');
    
    const enhanceButton = new ButtonBuilder()
        .setCustomId('emblem_enhance')
        .setLabel('엠블럼 강화')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔨');

    return new ActionRowBuilder().addComponents(refreshButton, enhanceButton);
}

// Initialize or update the permanent emblem shop
async function initializeEmblemShop(client, channelId, forceNew = false) {
    try {
        const channel = await client.channels.fetch(channelId).catch(err => {
            console.error(`채널 ${channelId} 접근 권한 없음:`, err.message);
            return null;
        });
        
        if (!channel) {
            return null;
        }
        
        // 봇이 메시지 전송 권한이 있는지 확인
        if (!channel.permissionsFor(client.user).has(['SendMessages', 'ViewChannel'])) {
            console.error(`채널 ${channelId}에 메시지 전송 권한이 없습니다.`);
            return null;
        }

        const embed = createEmblemShopEmbed();
        const selectMenu = createEmblemSelectMenu();
        const refreshButton = createRefreshButton();

        // Check if we have a stored message ID for this channel
        const storedMessageId = permanentMessageIds.get(channelId);
        
        if (storedMessageId && !forceNew) {
            try {
                // Try to update existing message
                const existingMessage = await channel.messages.fetch(storedMessageId);
                await existingMessage.edit({
                    embeds: [embed],
                    components: [selectMenu, refreshButton]
                });
                console.log(`✅ 엠블럼 상점 메시지 업데이트 완료 (채널: ${channel.name})`);
                return existingMessage;
            } catch (error) {
                // Message not found, remove invalid ID
                console.log(`기존 메시지를 찾을 수 없어 새로 생성합니다. (채널: ${channel.name})`);
                permanentMessageIds.delete(channelId);
            }
        }
        
        // 채널의 최근 메시지 중에서 엠블럼 상점 메시지 찾기
        if (!forceNew) {
            try {
                const messages = await channel.messages.fetch({ limit: 50 });
                const shopMessage = messages.find(msg => 
                    msg.author.id === client.user.id && 
                    msg.embeds.length > 0 && 
                    msg.embeds[0].title === '🏆 엠블럼 상점'
                );
                
                if (shopMessage) {
                    console.log(`✅ 기존 엠블럼 상점 메시지 발견! 업데이트합니다. (채널: ${channel.name})`);
                    await shopMessage.edit({
                        embeds: [embed],
                        components: [selectMenu, refreshButton]
                    });
                    
                    // 발견한 메시지 ID 저장
                    permanentMessageIds.set(channelId, shopMessage.id);
                    saveMessageIds();
                    
                    return shopMessage;
                }
            } catch (error) {
                console.log('최근 메시지 검색 중 오류:', error.message);
            }
        }

        // Create new message
        const message = await channel.send({
            embeds: [embed],
            components: [selectMenu, refreshButton]
        });

        // Store the message ID
        permanentMessageIds.set(channelId, message.id);
        saveMessageIds(); // 파일에 저장
        console.log(`✅ 엠블럼 상점 메시지 생성 완료 (채널: ${channel.name}, ID: ${message.id})`);
        
        return message;
    } catch (error) {
        console.error(`엠블럼 상점 초기화 오류 (채널 ${channelId}):`, error);
        return null;
    }
}

// Initialize emblem shops in all designated channels
async function initializeAllEmblemShops(client) {
    const emblemChannelIds = ['1381614153399140412', '1388182808895291422'];
    
    for (const channelId of emblemChannelIds) {
        await initializeEmblemShop(client, channelId);
    }
}

// Handle emblem shop interactions
async function handleEmblemShopInteraction(interaction, getUser, saveUser) {
    try {
        // Safe defer handling
        if (!interaction.deferred && !interaction.replied) {
            try {
                await interaction.deferUpdate();
            } catch (error) {
                if (error.code === 10062) {
                    console.log('[엠블럼 상점] Interaction expired');
                    return;
                }
                console.error('[엠블럼 상점] Defer error:', error);
                return;
            }
        }
        
        if (interaction.customId === 'emblem_shop_refresh') {
            await initializeEmblemShop(interaction.client, interaction.channelId);
            return;
        }

        if (interaction.customId === 'emblem_shop_category') {
            const selectedCategory = interaction.values[0];
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.editReply({ 
                    content: '먼저 회원가입을 해주세요!', 
                    embeds: [],
                    components: []
                });
                return;
            }

        const category = EMBLEMS[selectedCategory];
        
        // 유저의 현재 엠블럼 상태 확인
        let userStatus = '';
        if (user.emblem) {
            const currentType = Object.keys(EMBLEMS).find(type => 
                EMBLEMS[type].emblems.some(e => e.name === user.emblem)
            );
            
            if (currentType !== selectedCategory) {
                userStatus = `\n⚠️ **현재 ${EMBLEMS[currentType].name} 계열 엠블럼을 보유중입니다.**\n` +
                           `**다른 계열로는 변경할 수 없습니다!**\n`;
            } else {
                userStatus = `\n✅ **현재 엠블럼: ${user.emblem}**\n`;
            }
        } else if (user.level < 20) {
            userStatus = `\n❌ **레벨 20 이상부터 엠블럼을 구매할 수 있습니다!** (현재: Lv.${user.level})\n`;
        }
        
        const categoryEmbed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle(`${category.emoji} ${category.name} 계열 엠블럼`)
            .setDescription(
                `**${category.name} 계열 진화 경로:**\n${category.description}\n` +
                userStatus + '\n' +
                '각 단계별 엠블럼 정보:'
            );

        // Add fields for each emblem in the category
        category.emblems.forEach((emblem, index) => {
            const isOwned = user.emblem === emblem.name;
            const levelReq = user.level >= emblem.level;
            const goldReq = user.gold >= emblem.price;
            
            let status = '';
            if (isOwned) {
                status = ' ✅ 보유중';
            } else if (!levelReq) {
                status = ' ❌ 레벨 부족';
            } else if (!goldReq) {
                status = ' ❌ 골드 부족';
            } else {
                // 구매 가능 여부 체크
                if (!user.emblem) {
                    // 첫 구매는 첫 번째 엠블럼만 가능
                    status = index === 0 ? ' ✅ 구매 가능' : ' ⏸️ 이전 단계 필요';
                } else {
                    const currentType = Object.keys(EMBLEMS).find(type => 
                        EMBLEMS[type].emblems.some(e => e.name === user.emblem)
                    );
                    if (currentType !== selectedCategory) {
                        status = ' 🚫 다른 계열';
                    } else {
                        const currentIndex = category.emblems.findIndex(e => e.name === user.emblem);
                        status = index === currentIndex + 1 ? ' ✅ 업그레이드 가능' : ' ⏸️ 순서대로 진행';
                    }
                }
            }
            
            categoryEmbed.addFields({
                name: `${index + 1}. ${emblem.name}${status}`,
                value: `레벨: ${emblem.level} | 가격: ${emblem.price.toLocaleString()} 골드`,
                inline: true
            });
        });

        // Create buttons for available purchases
        const buttons = [];
        
        if (user.emblem) {
            // Check if user can upgrade
            const currentType = Object.keys(EMBLEMS).find(type => 
                EMBLEMS[type].emblems.some(e => e.name === user.emblem)
            );
            
            if (currentType === selectedCategory) {
                const currentIndex = category.emblems.findIndex(e => e.name === user.emblem);
                if (currentIndex < category.emblems.length - 1) {
                    const nextEmblem = category.emblems[currentIndex + 1];
                    if (user.level >= nextEmblem.level && user.gold >= nextEmblem.price) {
                        buttons.push(
                            new ButtonBuilder()
                                .setCustomId(`buy_emblem_${selectedCategory}_${currentIndex + 1}`)
                                .setLabel(`${nextEmblem.name} 업그레이드`)
                                .setStyle(ButtonStyle.Success)
                                .setEmoji(category.emoji)
                        );
                    }
                }
            }
        } else {
            // First time purchase
            const firstEmblem = category.emblems[0];
            if (user.level >= firstEmblem.level && user.gold >= firstEmblem.price) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`buy_emblem_${selectedCategory}_0`)
                        .setLabel(`${firstEmblem.name} 구매`)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(category.emoji)
                );
            }
        }

        buttons.push(
            new ButtonBuilder()
                .setCustomId('emblem_shop_back')
                .setLabel('뒤로가기')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('◀️')
        );

        const actionRow = new ActionRowBuilder().addComponents(buttons);

        await interaction.editReply({
            embeds: [categoryEmbed],
            components: [actionRow]
        });
    }

    if (interaction.customId === 'emblem_shop_back') {
        
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            await interaction.editReply({ 
                content: '먼저 회원가입을 해주세요!', 
                embeds: [],
                components: []
            });
            return;
        }
        
        // 엠블럼 상점 메인 화면으로 돌아가기
        const shopEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 엠블럼 상점')
            .setDescription('엠블럼을 구매하여 특별한 칭호를 획득하세요!');
            
        if (user.emblem) {
            const currentType = Object.keys(EMBLEMS).find(type => 
                EMBLEMS[type].emblems.some(e => e.name === user.emblem)
            );
            shopEmbed.addFields({
                name: 'ℹ️ 현재 엠블럼',
                value: `${user.emblem} (${EMBLEMS[currentType]?.name || '알 수 없음'} 계열)`,
                inline: false
            });
        }
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('emblem_shop_category')
            .setPlaceholder('엠블럼 카테고리를 선택하세요')
            .addOptions([
                { label: '전사 계열', value: 'warrior', emoji: '⚔️', description: '힘 주스탯' },
                { label: '궁수 계열', value: 'archer', emoji: '🏹', description: '민첩 주스탯' },
                { label: '마법사 계열', value: 'mage', emoji: '🧿', description: '지능 주스탯' },
                { label: '수호자 계열', value: 'defender', emoji: '🛡️', description: '체력 주스탯' },
                { label: '도적 계열', value: 'thief', emoji: '🗡️', description: '행운 주스탯' }
            ]);
            
        const actionRow = new ActionRowBuilder().addComponents(selectMenu);
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('emblem')
                    .setLabel('◀️ 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        await interaction.editReply({
            embeds: [shopEmbed],
            components: [actionRow, backButton]
        });
    }
    } catch (error) {
        console.error('[엠블럼 상점] 오류 발생:', error);
        
        // 오류 발생 시 복구 옵션 제공
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ 엠블럼 상점 오류')
            .setDescription('엠블럼 상점 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.')
            .addFields({
                name: '🔧 해결 방법',
                value: '• 새로고침 버튼을 눌러 상점을 다시 불러오세요\n• 문제가 계속되면 관리자에게 문의하세요',
                inline: false
            })
            .setTimestamp();
        
        const recoveryButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('emblem_shop_refresh')
                    .setLabel('🔄 새로고침')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId('emblem')
                    .setLabel('🏠 메인 메뉴로')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        try {
            await interaction.editReply({
                embeds: [errorEmbed],
                components: [recoveryButtons]
            });
        } catch (replyError) {
            console.error('[엠블럼 상점] 오류 메시지 전송 실패:', replyError);
            
            // 오류 메시지도 실패하면 자동 새로고침 시도
            setTimeout(async () => {
                try {
                    await initializeEmblemShop(interaction.client, interaction.channelId);
                    console.log('[엠블럼 상점] 자동 복구 완료');
                } catch (refreshError) {
                    console.error('[엠블럼 상점] 자동 복구 실패:', refreshError);
                }
            }, 2000);
        }
    }
}

module.exports = {
    EMBLEMS,
    createEmblemShopEmbed,
    createEmblemSelectMenu,
    initializeEmblemShop,
    initializeAllEmblemShops,
    handleEmblemShopInteraction,
    permanentMessageIds
};