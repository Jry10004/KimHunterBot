const { handleCharacterInteraction } = require('./character');
const { handleMinigameInteraction, handleMinigameModal } = require('./minigames');
const { handlePVPInteraction } = require('./pvp');
const { handleEconomyInteraction, handleEconomyModal } = require('./economy');
const { handleDailyInteraction } = require('./daily');
const { handleAdminInteraction, handleAdminModal, isAdmin } = require('./admin');
const { handleEventInteraction } = require('./events');
const { handleBossRaidInteraction } = require('./raid/bossRaid');
const { handleDungeonInteraction } = require('./dungeon');
const { handleEnhanceInteraction } = require('./enhance/enhanceSystem');

// 메인 인터랙션 라우터
async function handleInteraction(interaction) {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isUserSelectMenu()) {
        return;
    }

    const customId = interaction.customId;
    console.log('[Handler Router] Processing interaction:', customId);

    // 모달 처리
    if (interaction.isModalSubmit()) {
        return await handleModalSubmit(interaction);
    }
    

    // 회원가입 처리
    if (customId === 'register') {
        const registerCommand = require('../commands/utility/register');
        return await registerCommand.execute(interaction);
    }
    
    // 이메일 인증 버튼 처리
    else if (customId.startsWith('verify_email_')) {
        const registerCommand = require('../commands/utility/register');
        return await registerCommand.handleVerification(interaction);
    }
    
    // 엠블럼 상점 특별 처리
    else if (customId === 'emblem_shop_category' || customId === 'emblem_shop_refresh' || 
        customId === 'emblem_shop_back') {
        const { handleEmblemShopInteraction } = require('../systems/emblemShop');
        const { getUser } = require('./common/utils');
        const User = require('../models/User');
        
        // saveUser 함수 정의 - 버전 충돌 시 재시도
        const saveUser = async (user) => {
            let retries = 3;
            while (retries > 0) {
                try {
                    await user.save();
                    return;
                } catch (error) {
                    if (error.name === 'VersionError' && retries > 1) {
                        console.log(`[saveUser] 엠블럼샵 버전 충돌 감지, 재시도... (남은 시도: ${retries - 1})`);
                        // 최신 데이터 다시 로드
                        const freshUser = await User.findById(user._id);
                        if (freshUser) {
                            // 필요한 필드 업데이트
                            user.inventory = freshUser.inventory;
                            user.gold = freshUser.gold;
                            user.emblem = freshUser.emblem;
                        }
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, 100)); // 잠시 대기
                    } else {
                        throw error;
                    }
                }
            }
        };
        
        return await handleEmblemShopInteraction(interaction, getUser, saveUser);
    }
    
    // 장비 상점 특별 처리
    else if (customId === 'shop_slot_select' || customId === 'shop_refresh' || customId.startsWith('shop_refresh') || 
        customId.startsWith('shop_continue') || customId.startsWith('shop_back') ||
        customId.startsWith('gacha_single_') || customId.startsWith('gacha_multi_') ||
        customId.startsWith('retry_multi_') || customId === 'save_all_temp' ||
        customId === 'sell_menu' || customId === 'sell_selected' || customId === 'sell_all_trash' ||
        customId === 'sell_temp_items' || customId.startsWith('item_sell_') ||
        customId === 'sell_prev' || customId === 'sell_next' || customId === 'sell_item_select' ||
        customId === 'view_temp_items' || customId === 'temp_item_select' ||
        customId.includes('save_temp_item_') || customId.includes('sell_temp_item_') ||
        customId === 'back_to_temp_list' || customId === 'back_to_sell_menu' ||
        customId === 'temp_prev_page' || customId === 'temp_next_page' ||
        customId === 'confirm_sell_temp' || customId === 'cancel_sell_temp' ||
        customId === 'sell_all_temp' || customId === 'confirm_sell_all_temp' || 
        customId === 'cancel_sell_all_temp' || customId.startsWith('add_to_cart_') ||
        customId === 'view_sell_cart' || customId === 'clear_sell_cart' ||
        customId === 'execute_sell_cart' || customId === 'sell_menu' ||
        customId === 'continue_sell' || customId === 'sell_single_temp' ||
        customId.startsWith('sell_current_item_') || customId === 'sell_all_multi_temp' ||
        customId === 'save_all_multi_temp') {
        const { handleShopInteraction } = require('../systems/shop');
        const { getUser } = require('./common/utils');
        const User = require('../models/User');
        
        // saveUser 함수 정의 - 버전 충돌 시 재시도
        const saveUser = async (user) => {
            let retries = 3;
            while (retries > 0) {
                try {
                    await user.save();
                    return;
                } catch (error) {
                    if (error.name === 'VersionError' && retries > 1) {
                        console.log(`[saveUser] 버전 충돌 감지, 재시도... (남은 시도: ${retries - 1})`);
                        // 최신 데이터 다시 로드
                        const freshUser = await User.findById(user._id);
                        if (freshUser) {
                            // 인벤토리 병합
                            user.inventory = freshUser.inventory;
                            user.gold = freshUser.gold;
                            user.shopLevels = freshUser.shopLevels;
                        }
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, 100)); // 잠시 대기
                    } else {
                        throw error;
                    }
                }
            }
        };
        
        return await handleShopInteraction(interaction, getUser, saveUser);
    }
    
    // 캐릭터 관련 처리
    else if (customId.includes('profile') || customId.includes('inventory') || 
        customId.includes('equipment') || customId.includes('emblem') ||
        customId.includes('stat_') || customId === 'stat_distribution' ||
        customId === 'equip_category' || customId === 'equip_slot_select' ||
        customId.startsWith('equip_item_') || customId === 'optimize_equipment' ||
        customId === 'unequip_all' || customId.startsWith('item_') ||
        customId === 'emblem' || customId === 'emblem_shop' || customId === 'emblem_enhance' ||
        customId === 'emblem_enhance_try' || customId === 'emblem_enhance_confirm' ||
        customId === 'emblem_enhance_info' || customId === 'emblem_enhance_ranking' ||
        customId.startsWith('buy_emblem_') || customId === 'emblem_shop_category' ||
        customId === 'emblem_shop_refresh' || customId === 'emblem_shop_back') {
        return await handleCharacterInteraction(interaction);
    }
    
    // 미니게임 관련 처리
    else if (customId === 'monster_battle' || customId.includes('monster_')) {
        const { handleMonsterBattleInteraction } = require('./minigames/monsterBattle');
        return await handleMonsterBattleInteraction(interaction);
    }
    else if (customId === 'mushroom_game' || customId.includes('mushroom_')) {
        const { handleMushroomInteraction } = require('./minigames/mushroomGame');
        return await handleMushroomInteraction(interaction);
    }
    else if (customId === 'slot_machine' || customId.includes('slot_') || customId.includes('auto_')) {
        const { handleSlotMachineInteraction } = require('./minigames/slotMachine');
        return await handleSlotMachineInteraction(interaction);
    }
    else if (customId === 'rock_paper_scissors' || customId.includes('rps_')) {
        const { handleRPSInteraction } = require('./minigames/rockPaperScissors');
        return await handleRPSInteraction(interaction);
    }
    else if (customId === 'word_games' || customId.includes('wordchain_') || customId.includes('chosung_') || 
             customId.includes('word_')) {
        const { handleWordGamesInteraction } = require('./minigames/wordGames');
        return await handleWordGamesInteraction(interaction);
    }
    else if (customId === 'tictactoe_game') {
        try {
            // 틱택토 게임 시작 - 메인 메뉴 표시
            console.log('[Interaction] TicTacToe game button clicked');
            const { showTicTacToeMenu } = require('./minigame/tictactoe');
            return await showTicTacToeMenu(interaction);
        } catch (error) {
            console.error('[Interaction] TicTacToe error:', error);
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({ 
                    content: '❌ 틱택토 게임을 시작하는 중 오류가 발생했습니다.', 
                    flags: 64 
                });
            }
        }
    }
    else if (customId.includes('tictactoe_')) {
        const { handleTicTacToeButton } = require('./minigame/tictactoe');
        return await handleTicTacToeButton(interaction);
    }
    else if (customId === 'minigame_menu') {
        const { handleMinigameInteraction } = require('./minigames/index');
        return await handleMinigameInteraction(interaction);
    }
    
    // PVP 관련 처리
    else if (customId.includes('pvp') || customId.includes('matchmaking') ||
             customId.includes('duel')) {
        return await handlePVPInteraction(interaction);
    }
    
    // 경제 관련 처리
    else if (customId.includes('stock') || customId.includes('artifact') ||
             customId.includes('fragment') || customId.includes('shop') ||
             customId === 'stocks' || customId === 'artifacts' || 
             customId === 'fragments' || customId.includes('exploration') ||
             customId.startsWith('random_') || customId === 'sector_select' ||
             customId.includes('mine_')) {
        return await handleEconomyInteraction(interaction);
    }
    
    // 보스 레이드 관련 처리
    else if (customId === 'boss_raid' || customId === 'boss_raid_menu' || customId === 'boss_raid_ranking') {
        return await handleBossRaidInteraction(interaction);
    }
    
    // 보스 장신구 상점 처리
    else if (customId === 'boss_token_shop' || customId.includes('accessory_shop_') || customId.includes('accessory_buy_') || customId.includes('accessory_set_')) {
        const { handleAccessoryShopInteraction } = require('./raid/bossAccessoryShop');
        return await handleAccessoryShopInteraction(interaction);
    }
    
    // 장신구 인벤토리 처리
    else if (customId === 'accessory_inventory' || customId === 'accessory_select' || customId.includes('accessory_inv_') || customId.includes('replace_accessory_') || customId === 'unequip_all_accessories') {
        const { handleAccessoryInventoryInteraction } = require('./raid/accessoryInventory');
        return await handleAccessoryInventoryInteraction(interaction);
    }
    
    // 조각 교환소 처리
    else if (customId.includes('fragment_exchange') || customId.includes('fragment_synthesis') || customId === 'fragment_inventory') {
        const { handleFragmentExchangeInteraction } = require('./raid/fragmentExchange');
        return await handleFragmentExchangeInteraction(interaction);
    }
    
    // 던전 관련 처리
    else if (customId === 'dungeon' || customId.includes('dungeon:')) {
        return await handleDungeonInteraction(interaction);
    }
    
    // 강화 시스템 관련 처리
    else if (customId === 'enhance' || customId.includes('enhance_')) {
        return await handleEnhanceInteraction(interaction);
    }
    
    // 일일 활동 관련 처리
    else if (customId.includes('attendance') || customId.includes('hunting') ||
             customId.includes('exercise') || customId.includes('quest') ||
             customId === 'work' || customId === 'daily' ||
             customId.includes('claim_daily') || customId.includes('hunt_area') ||
             customId.includes('appraisal') || customId.includes('appraise') || 
             customId.includes('appraiser') || customId.includes('tournament') || 
             customId.includes('warehouse') || customId.includes('certificate') || 
             customId.includes('strategy') || customId.includes('market_') || 
             customId === 'market_prices' || customId === 'market_type_select' ||
             customId === 'market_category_select' || customId.includes('daily_missions') ||
             customId.includes('weekly_missions') || customId.includes('mission_reward')) {
        return await handleDailyInteraction(interaction);
    }
    
    // 관리자 관련 처리
    else if (customId.includes('admin')) {
        return await handleAdminInteraction(interaction);
    }
    
    // 이벤트 관련 처리
    else if (customId.includes('event')) {
        return await handleEventInteraction(interaction);
    }
    
    // 댕댕봇 구출 이벤트 처리
    else if (customId.includes('dogbot_')) {
        const { handleDogBotRescueInteraction } = require('./dogBotRescueHandler');
        return await handleDogBotRescueInteraction(interaction);
    }
    
    // 베팅 관련 처리
    else if (customId.includes('betting_') || customId.includes('spectator_bet_')) {
        const { handleBettingInteraction } = require('./spectatorBetting');
        const { getUser } = require('./common/utils');
        const user = await getUser(interaction.user.id);
        return await handleBettingInteraction(interaction, user);
    }
    
    // 낚시 관련 처리 (경제 시스템)
    else if (customId.includes('fishing_')) {
        const { handleFishingInteraction } = require('./economy/fishing');
        const { getUser } = require('./common/utils');
        const user = await getUser(interaction.user.id);
        return await handleFishingInteraction(interaction, user);
    }
    
    // 매크로 리셋 확인 버튼
    else if (customId === 'macro_reset_confirm' || customId === 'macro_reset_cancel') {
        const antiMacro = require('../systems/antiMacro');
        
        if (customId === 'macro_reset_confirm') {
            // 전체 데이터 초기화
            antiMacro.ANTI_MACRO.userPatterns.clear();
            antiMacro.ANTI_MACRO.activeVerifications.clear();
            antiMacro.ANTI_MACRO.penaltyHistory.clear();
            antiMacro.ANTI_MACRO.temporaryExemptions.clear();
            
            // 관리자는 다시 화이트리스트에 추가
            const ADMIN_IDS = ['424480594542592009', '295980447849250817', '532128778175619084', '592659577384730645'];
            ADMIN_IDS.forEach(adminId => {
                antiMacro.addToWhitelist(adminId);
            });
            
            await interaction.update({
                content: '✅ 모든 매크로 감지 기록이 초기화되었습니다.',
                embeds: [],
                components: []
            });
        } else {
            await interaction.update({
                content: '❌ 초기화가 취소되었습니다.',
                embeds: [],
                components: []
            });
        }
        return true;
    }
    
    // 사전강화 관련 처리
    else if (customId.includes('prelaunch')) {
        console.log('[Handler Router] Routing to prelaunch handler from handlers/index.js');
        try {
            const { handlePrelaunchInteraction } = require('../systems/prelaunchEnhance');
            await handlePrelaunchInteraction(interaction);
            return true;
        } catch (error) {
            console.error('[Handler Router] Prelaunch handler error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ 처리 중 오류가 발생했습니다.\n문제가 계속되면 `/버그발견` 명령어로 신고해주세요!', flags: 64 });
            }
            return false;
        }
    }
    
    // 드롭다운 메뉴 처리
    else if (interaction.isStringSelectMenu()) {
        // 경제 시스템 관련 드롭다운은 직접 처리
        if (customId === 'shop_category_select') {
            return await handleEconomyInteraction(interaction);
        }
        return await handleSelectMenu(interaction);
    }
    
    // 처리되지 않은 인터랙션
    console.log('[Handler Router] Unhandled interaction:', customId);
    return false;
}

// 모달 제출 처리
async function handleModalSubmit(interaction) {
    const customId = interaction.customId;
    
    // 회원가입 모달 처리
    if (customId === 'registration_email_modal') {
        const registerCommand = require('../commands/utility/register');
        return await registerCommand.handleModal(interaction);
    }
    
    // 인증 코드 모달 처리
    else if (customId === 'verification_code_modal') {
        const registerCommand = require('../commands/utility/register');
        return await registerCommand.handleCodeVerification(interaction);
    }
    
    // 캐릭터 모달 (스탯 분배)
    else if (customId === 'stat_custom_modal') {
        return await handleCharacterInteraction(interaction);
    }
    
    // 미니게임 모달
    else if (customId.includes('oddeven') || customId.includes('slot_bet') ||
        customId.includes('racing_bet') || customId.includes('rps_bet') ||
        customId.includes('dice_bet') || customId.includes('blackjack_bet') ||
        customId.includes('roulette_bet')) {
        return await handleMinigameModal(interaction);
    }
    
    // 경제 모달
    else if (customId.includes('stock') || customId.includes('exploration_modal')) {
        return await handleEconomyModal(interaction);
    }
    
    // 관리자 모달
    else if (customId.includes('admin')) {
        return await handleAdminModal(interaction);
    }
    
    // 운동 모달
    else if (customId.includes('exercise_time_')) {
        const { handleExerciseModal } = require('./daily/exercise');
        return await handleExerciseModal(interaction);
    }
}

// 드롭다운 메뉴 처리
async function handleSelectMenu(interaction) {
    const customId = interaction.customId;
    const value = interaction.values[0];
    
    // 메인 메뉴
    if (customId === 'main_menu') {
        // 각 카테고리로 라우팅
        if (value === 'profile' || value === 'inventory' || 
            value === 'equipment' || value === 'emblem') {
            // customId 설정
            interaction.customId = value;
            return await handleCharacterInteraction(interaction);
        }
        else if (value === 'minigame') {
            const { handleMinigameInteraction } = require('./minigames/index');
            return await handleMinigameInteraction(interaction);
        }
        else if (value === 'pvp') {
            interaction.customId = 'pvp_menu';
            return await handlePVPInteraction(interaction);
        }
        else if (value === 'stocks' || value === 'artifacts' || 
                 value === 'fragments' || value === 'shop') {
            // customId 설정
            if (value === 'stocks') {
                interaction.customId = 'stock_market';
            } else if (value === 'artifacts') {
                interaction.customId = 'artifact_exploration';
            } else if (value === 'fragments') {
                interaction.customId = 'fragment_menu';
            } else if (value === 'shop') {
                interaction.customId = 'shop';
            }
            return await handleEconomyInteraction(interaction);
        }
        else if (value === 'daily' || value === 'hunting' || 
                 value === 'work' || value === 'quest') {
            return await handleDailyInteraction(interaction);
        }
        else if (value === 'admin_panel' && isAdmin(interaction.user.id)) {
            return await handleAdminInteraction(interaction);
        }
        else if (value === 'dungeon') {
            return await handleDungeonInteraction(interaction);
        }
        else if (value === 'boss') {
            // boss_raid customId로 변환
            interaction.customId = 'boss_raid';
            return await handleBossRaidInteraction(interaction);
        }
        else if (value === 'enhance') {
            interaction.customId = 'enhance';
            return await handleEnhanceInteraction(interaction);
        }
        else if (value === 'ranking') {
            // 랭킹 기능은 아직 핸들러가 없으므로 임시 메시지
            await interaction.deferUpdate();
            return await interaction.editReply({
                content: '🏅 랭킹 시스템은 준비 중입니다!',
                embeds: [],
                components: []
            });
        }
    }
    
    // 기타 드롭다운 메뉴들
    else if (customId === 'shop_category_select' || customId === 'shop_item_select') {
        return await handleEconomyInteraction(interaction);
    }
    else if (customId === 'exercise_select') {
        return await handleDailyInteraction(interaction);
    }
    else if (customId === 'equip_slot_select' || customId.startsWith('equip_item_') ||
             customId === 'inventory_item_select') {
        return await handleCharacterInteraction(interaction);
    }
}

// 메인 메뉴로 돌아가기 처리
async function handleMainMenu(interaction) {
    // 이 함수는 index.js에서 구현
    // 여기서는 플레이스홀더만 제공
    return;
}

module.exports = {
    handleInteraction,
    handleModalSubmit,
    handleSelectMenu
};