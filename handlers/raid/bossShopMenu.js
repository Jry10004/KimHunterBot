const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser } = require('../common/utils');

async function showBossShopMenu(interaction) {
    try {
        // defer 처리
        if (!interaction.deferred && !interaction.replied) {
            if (interaction.isButton() || interaction.isStringSelectMenu()) {
                await interaction.deferUpdate();
            } else {
                await interaction.deferReply();
            }
        }
        
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            return await interaction.editReply({ 
                content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
                embeds: [],
                components: []
            });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('👹 보스 상점')
            .setDescription('보스 토큰으로 다양한 아이템을 구매할 수 있습니다.')
            .addFields(
                { 
                    name: '🪙 보유 토큰', 
                    value: user.bossTokens && user.bossTokens.size > 0 
                        ? Array.from(user.bossTokens.entries())
                            .map(([tokenId, amount]) => `${getTokenEmoji(tokenId)} ${getTokenName(tokenId)}: ${amount}개`)
                            .join('\n')
                        : '보유한 토큰이 없습니다',
                    inline: false 
                }
            )
            .setFooter({ text: '원하는 상점을 선택하세요!' })
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('boss_accessory_shop')
                    .setLabel('💍 보스 장신구')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💎'),
                new ButtonBuilder()
                    .setCustomId('boss_token_exchange')
                    .setLabel('🔄 토큰 교환소')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🪙')
                    .setDisabled(true), // 개발중
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('[Boss Shop Menu] Error:', error);
        if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({ 
                content: '❌ 보스 상점 메뉴를 표시하는 중 오류가 발생했습니다.', 
                flags: 64 
            });
        }
    }
}

// 토큰 이모지 가져오기
function getTokenEmoji(tokenId) {
    const tokenEmojis = {
        'goblin_token': '🪙',
        'orc_token': '🪙',
        'dragon_token': '🐉',
        'demon_token': '👹',
        'lich_token': '💀'
    };
    return tokenEmojis[tokenId] || '🪙';
}

// 토큰 이름 가져오기
function getTokenName(tokenId) {
    const tokenNames = {
        'goblin_token': '고블린 토큰',
        'orc_token': '오크 토큰',
        'dragon_token': '드래곤 토큰',
        'demon_token': '악마 토큰',
        'lich_token': '리치 토큰'
    };
    return tokenNames[tokenId] || '알 수 없는 토큰';
}

// 보스 장신구 상점 처리
async function handleBossAccessoryShop(interaction) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const embed = new EmbedBuilder()
            .setColor('#8B4513')
            .setTitle('🚧 개발중입니다')
            .setDescription('보스 장신구 상점은 현재 개발중입니다.\n곧 만나보실 수 있습니다!')
            .setFooter({ text: '기대해주세요!' })
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('boss_shop_menu')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('[Boss Accessory Shop] Error:', error);
        return await interaction.editReply({
            content: '❌ 오류가 발생했습니다.',
            embeds: [],
            components: []
        });
    }
}

// 인터랙션 핸들러
async function handleBossShopInteraction(interaction) {
    const customId = interaction.customId;

    if (customId === 'boss_shop_menu') {
        return await showBossShopMenu(interaction);
    }
    else if (customId === 'boss_accessory_shop') {
        return await handleBossAccessoryShop(interaction);
    }
}

module.exports = {
    showBossShopMenu,
    handleBossShopInteraction
};