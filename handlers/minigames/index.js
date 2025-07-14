const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const MinigameUI = require('../../utils/minigameUI');

// 미니게임 메인 메뉴 핸들러
async function handleMinigameInteraction(interaction) {
    const user = await User.findOne({ discordId: interaction.user.id });
    if (!user) {
        return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
    }

    const stats = {
        gold: user.gold,
        winRate: user.totalGames > 0 ? Math.round((user.totalWins / user.totalGames) * 100) : 0,
        totalGames: user.totalGames || 0
    };

    const embed = MinigameUI.createMainMenuEmbed(
        '🎮 미니게임 센터',
        '플레이하고 싶은 게임을 선택하세요!\n각 게임마다 다양한 보상이 준비되어 있습니다!',
        [
            ...MinigameUI.createStatsFields(stats),
            { name: '🎯 게임 종류', value: '7종', inline: true },
            { name: '🏆 총 승리', value: `${user.totalWins || 0}회`, inline: true },
            { name: '🎮 오늘 플레이', value: `${user.todayGames || 0}회`, inline: true }
        ]
    );

    const gameButtons1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('monster_battle')
                .setLabel('👾 몬스터 배틀')
                .setStyle(MinigameUI.ButtonStyles.MAIN_ACTION),
            new ButtonBuilder()
                .setCustomId('mushroom_game')
                .setLabel('🍄 독버섯 게임')
                .setStyle(MinigameUI.ButtonStyles.MAIN_ACTION),
            new ButtonBuilder()
                .setCustomId('slot_machine')
                .setLabel('🎰 슬롯머신')
                .setStyle(MinigameUI.ButtonStyles.MAIN_ACTION)
        );

    const gameButtons2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('rock_paper_scissors')
                .setLabel('✊ 가위바위보')
                .setStyle(MinigameUI.ButtonStyles.MAIN_ACTION),
            new ButtonBuilder()
                .setCustomId('word_games')
                .setLabel('🔤 워드게임')
                .setStyle(MinigameUI.ButtonStyles.MAIN_ACTION),
            new ButtonBuilder()
                .setCustomId('tictactoe_game')
                .setLabel('⭕ 틱택토')
                .setStyle(MinigameUI.ButtonStyles.MAIN_ACTION)
        );
    
    const gameButtons3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('lol_inhouse')
                .setLabel('🎮 LOL 내전')
                .setStyle(MinigameUI.ButtonStyles.MAIN_ACTION)
        );
    
    const navigationRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(MinigameUI.ButtonStyles.NAVIGATION)
        );

    await interaction.reply({
        embeds: [embed],
        components: [gameButtons1, gameButtons2, gameButtons3, navigationRow]
    });
}

module.exports = {
    handleMinigameInteraction
};