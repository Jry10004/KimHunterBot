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
const { handleRankingInteraction } = require('./ranking');
const User = require('../models/User');

// 처리 중인 인터랙션 추적 (전역으로 관리)
const processingInteractions = new Map();

// 30초마다 오래된 엔트리 정리
let cleanupInterval = null;
const startCleanupInterval = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }
    
    cleanupInterval = setInterval(() => {
        try {
            const now = Date.now();
            for (const [id, timestamp] of processingInteractions.entries()) {
                if (now - timestamp > 30000) { // 30초 이상 지난 엔트리 삭제
                    processingInteractions.delete(id);
                }
            }
        } catch (error) {
            console.error('[Handler Router] Cleanup interval error:', error);
        }
    }, 30000);
};

// 안전하게 인터벌 시작
startCleanupInterval();

// 프로세스 종료 시 인터벌 정리
process.on('exit', () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }
});

// 메인 인터랙션 라우터
async function handleInteraction(interaction) {
    // Modal Submit은 별도 처리
    if (interaction.isModalSubmit?.()) {
        console.log('[Handler Router] Redirecting modal submit to handleModalSubmit');
        return await handleModalSubmit(interaction);
    }
    
    // 중복 방지를 위한 고유 키 생성
    const uniqueKey = `${interaction.id}_${Date.now()}`;
    
    // 이미 처리 중인지 확인
    if (processingInteractions.has(interaction.id)) {
        console.log('[Handler Router] Already processing interaction:', interaction.customId);
        return;
    }
    
    // 처리 중 표시 (타임스탬프 저장)
    processingInteractions.set(interaction.id, Date.now());
    
    // 3초 후 자동 삭제
    setTimeout(() => {
        processingInteractions.delete(interaction.id);
    }, 3000);
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isUserSelectMenu()) {
        return;
    }

    const customId = interaction.customId;
    
    // random_ 아이템 관련 인터랙션은 로그에서 제외
    if (!customId.includes('random_')) {
        console.log('[Handler Router] Processing interaction:', customId);
    }

    // 모달 처리
    if (interaction.isModalSubmit()) {
        console.log('[Handler Router] Modal submit 처리 전 - customId:', customId);
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
    
    // 관리자 장비 시스템은 최우선 처리 (캐릭터 핸들러보다 먼저)
    else if (customId.startsWith('admin_equip_')) {
        console.log('[Handler Router] Routing to admin equipment system:', customId);
        if (!isAdmin(interaction.user.id)) {
            try {
                if (!interaction.replied && !interaction.deferred) {
                    return await interaction.reply({ 
                        content: '❌ 관리자만 접근할 수 있습니다!', 
                        flags: 64 
                    });
                } else if (interaction.deferred) {
                    return await interaction.editReply({ 
                        content: '❌ 관리자만 접근할 수 있습니다!'
                    });
                }
            } catch (error) {
                if (error.code !== 10062 && error.code !== 40060) {
                    console.error('[Handler Router] Admin check reply error:', error);
                }
            }
            return;
        }
        return await handleAdminInteraction(interaction);
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
        customId.startsWith('gacha_hundred_') || customId.startsWith('retry_multi_') ||
        customId.startsWith('retry_hundred_') || customId === 'save_all_temp' ||
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
        customId === 'save_all_multi_temp' || customId === 'view_hundred_items' ||
        customId === 'hundred_prev' || customId === 'hundred_next' || customId === 'hundred_close' ||
        customId === 'view_legendary_items' || 
        // legendary_prev, legendary_next, back_to_hundred_summary는 컬렉터에서 처리
        // 카트 판매 관련 - sell_mode_cart만 여기서 처리, 나머지는 컬렉터에서 처리
        customId === 'sell_mode_cart') {
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
    
    // 낚시 관련 처리 (경제 시스템) - 캐릭터보다 먼저 체크
    else if (customId.includes('fishing_')) {
        const { handleFishingInteraction } = require('./economy/fishing');
        const { getUser } = require('./common/utils');
        const user = await getUser(interaction.user.id);
        return await handleFishingInteraction(interaction, user);
    }
    
    // 캐릭터 관련 처리 (exercise_inventory 제외)
    else if ((customId.includes('profile') || (customId.includes('inventory') && !customId.includes('exercise_inventory')) || 
        customId === 'equipment' || (customId.includes('emblem') && !customId.includes('admin_emblem')) ||
        customId.includes('stat_') || customId === 'stat_distribution' ||
        customId === 'equip_category' || customId === 'equip_slot_select' ||
        customId === 'accessory_slot_select' ||
        customId.startsWith('equip_item_') || customId === 'optimize_equipment' ||
        customId === 'unequip_all' || customId.startsWith('item_') ||
        customId === 'emblem' || customId === 'emblem_shop' || customId === 'emblem_enhance' ||
        customId === 'emblem_enhance_try' || customId === 'emblem_enhance_confirm' ||
        customId === 'emblem_enhance_info' || customId === 'emblem_enhance_ranking' ||
        customId.startsWith('buy_emblem_') || customId === 'emblem_shop_category' ||
        customId === 'emblem_shop_refresh' || customId === 'emblem_shop_back' ||
        customId.startsWith('equipment_') || customId.startsWith('equip_page_') ||
        customId.startsWith('unequip_')) && !customId.includes('fishing_')) {
        return await handleCharacterInteraction(interaction);
    }
    
    // PVP 관련 처리
    else if (customId === 'pvp_play_again') {
        console.log('[Handler] Processing pvp_play_again button');
        const pvpSystem = require('../systems/pvpSystem').getInstance();
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            try {
                if (!interaction.replied && !interaction.deferred) {
                    return await interaction.reply({ 
                        content: '❌ 회원가입이 필요합니다!', 
                        flags: 64 
                    });
                } else if (interaction.deferred) {
                    return await interaction.editReply({ 
                        content: '❌ 회원가입이 필요합니다!'
                    });
                }
            } catch (error) {
                if (error.code !== 10062 && error.code !== 40060) {
                    console.error('[Handler Router] PVP user check error:', error);
                }
            }
            return;
        }
        
        // 먼저 버튼 응답 처리
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferUpdate().catch(error => {
                if (error.code !== 10062 && error.code !== 40060) {
                    console.error('[Handler Router] PVP defer error:', error);
                }
            });
        }
        
        // 대기실 생성
        return await pvpSystem.createWaitingRoom(interaction, user);
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
    else if (customId === 'lol_inhouse' || customId.includes('lol_')) {
        const { handleLolInhouseInteraction } = require('./minigames/lolInhouse');
        return await handleLolInhouseInteraction(interaction);
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
    
    // 관리자 관련 처리 (경제보다 먼저 체크)
    else if (customId.includes('admin')) {
        console.log('[Handlers/Index] Admin interaction detected:', customId);
        const result = await handleAdminInteraction(interaction);
        console.log('[Handlers/Index] Admin interaction completed');
        return result;
    }
    
    // 보스 레이드 관련 처리
    else if (customId === 'boss_raid' || customId === 'boss_raid_menu' || customId === 'boss_raid_ranking') {
        return await handleBossRaidInteraction(interaction);
    }
    
    // 랭킹 관련 처리
    else if (customId === 'ranking' || customId === 'ranking_menu' || customId === 'ranking_category_select') {
        return await handleRankingInteraction(interaction);
    }
    
    // 보스 상점 메뉴 처리
    else if (customId === 'boss_shop_menu' || customId === 'boss_accessory_shop') {
        const { handleBossShopInteraction } = require('./raid/bossShopMenu');
        return await handleBossShopInteraction(interaction);
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
    
    // 통합 랭킹 시스템 처리
    else if (customId === 'ranking_menu' || customId === 'ranking_category_select') {
        return await handleRankingInteraction(interaction);
    }
    
    // 일일 활동 관련 처리 (exercise_gym_shop과 exercise_inventory 포함)
    else if (customId === 'exercise_gym_shop' || customId.includes('attendance') || customId.includes('hunting') ||
             customId.includes('exercise') || customId.includes('quest') ||
             customId === 'work' || customId === 'daily' ||
             customId.includes('claim_daily') || customId.includes('hunt_area') ||
             customId.includes('appraisal') || customId.includes('appraise') || 
             customId.includes('appraiser') || customId.includes('tournament') || 
             customId.includes('speed_hunt') ||
             customId.includes('warehouse') || customId.includes('certificate') || 
             customId.includes('strategy') || customId.includes('market_') || 
             customId === 'market_prices' || customId === 'market_type_select' ||
             customId === 'market_category_select' || customId.includes('daily_missions') ||
             customId.includes('weekly_missions') || customId.includes('mission_reward') ||
             customId.includes('locker_')) {
        console.log('[Handler Router] Routing to daily handler for customId:', customId);
        return await handleDailyInteraction(interaction);
    }
    
    // 경제 관련 처리 (daily 핸들러 이후에 처리)
    else if (customId.includes('stock') || customId.includes('artifact') ||
             customId.includes('fragment') || customId.includes('shop') ||
             customId === 'stocks' || customId === 'artifacts' || 
             customId === 'fragments' || customId.includes('exploration') ||
             customId.startsWith('random_') || customId === 'sector_select' ||
             customId.includes('mine_') ||
             // 새로운 판매 시스템 추가
             customId.includes('sell_mode_') || customId.includes('sell_grade_') ||
             customId.includes('grade_sell_') || customId.includes('quick_sell_') || 
             customId === 'sell_menu_back' || customId === 'sell_menu_return' || 
             customId === 'grade_sell_menu' || customId.includes('confirm_grade_sell_') ||
             customId.includes('quick_sell_page_') ||
             // 멀티 가챠 페이지네이션 추가
             customId === 'multi_next' || customId === 'multi_prev') {
        return await handleEconomyInteraction(interaction);
    }
    
    // 이벤트 관련 처리
    else if (customId.includes('event')) {
        return await handleEventInteraction(interaction);
    }
    
    // 베팅 관련 처리
    else if (customId.includes('betting_') || customId.includes('spectator_bet_')) {
        const { handleBettingInteraction } = require('./spectatorBetting');
        const { getUser } = require('./common/utils');
        const user = await getUser(interaction.user.id);
        return await handleBettingInteraction(interaction, user);
    }
    
    
    // 재료 제작 관련 처리 (비활성화)
    // else if (customId === 'material_crafting' || customId.includes('crafting_')) {
    //     const { showCraftingMenu, showCategoryRecipes, craftItem, showMaterialInventory } = require('../systems/materialCraftingSystem');
    //     
    //     if (customId === 'material_crafting') {
    //         return await showCraftingMenu(interaction, interaction.user.id);
    //     }
    //     else if (customId.startsWith('crafting_category_')) {
    //         const category = interaction.values[0];
    //         const userId = customId.split('_')[2];
    //         return await showCategoryRecipes(interaction, category, userId);
    //     }
    //     else if (customId.startsWith('crafting_recipe_')) {
    //         const parts = customId.split('_');
    //         const userId = parts[2];
    //         const category = parts[3];
    //         const recipeName = interaction.values[0];
    //         return await craftItem(interaction, category, recipeName, userId);
    //     }
    //     else if (customId.startsWith('crafting_inventory_')) {
    //         const userId = customId.split('_')[2];
    //         return await showMaterialInventory(interaction, userId);
    //     }
    // }
    // 
    // // 사냥 패스 관련 처리 (비활성화)
    // else if (customId === 'hunting_pass' || customId.includes('pass_')) {
    //     const { showHuntingPassMenu, claimPassReward } = require('../systems/huntingPassSystem');
    //     
    //     if (customId === 'hunting_pass') {
    //         return await showHuntingPassMenu(interaction, interaction.user.id);
    //     }
    //     else if (customId.startsWith('pass_rewards_')) {
    //         // 보상 목록 표시
    //         return await showPassRewards(interaction, interaction.user.id);
    //     }
    //     else if (customId.startsWith('pass_claim_')) {
    //         const parts = customId.split('_');
    //         const level = parseInt(parts[2]);
    //         const userId = parts[3];
    //         return await claimPassReward(interaction, userId, level);
    //     }
    //     else if (customId.startsWith('pass_buy_premium_')) {
    //         const userId = customId.split('_')[3];
    //         return await buyPremiumPass(interaction, userId);
    //     }
    // }
    
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
    
    // 월드 보스 관련 처리
    else if (customId === 'world_boss_join' || customId === 'world_boss_leave' || customId === 'world_boss_ready') {
        const worldBossSystem = require('../systems/worldBossSystem');
        if (customId === 'world_boss_join') {
            return await worldBossSystem.joinBossRaid(interaction);
        } else if (customId === 'world_boss_leave') {
            return await worldBossSystem.leaveBossRaid(interaction);
        } else if (customId === 'world_boss_ready') {
            return await worldBossSystem.setPlayerReady(interaction);
        }
    }
    
    // 사전강화 관련 처리 - 이벤트 종료로 비활성화
    // else if (customId.includes('prelaunch')) {
    //     console.log('[Handler Router] Routing to prelaunch handler from handlers/index.js');
    //     try {
    //         const { handlePrelaunchInteraction } = require('../systems/prelaunchEnhance');
    //         await handlePrelaunchInteraction(interaction);
    //         return true;
    //     } catch (error) {
    //         console.error('[Handler Router] Prelaunch handler error:', error);
    //         if (!interaction.replied && !interaction.deferred) {
    //             await interaction.reply({ content: '❌ 처리 중 오류가 발생했습니다.\n문제가 계속되면 `/버그발견` 명령어로 신고해주세요!', flags: 64 });
    //         }
    //         return false;
    //     }
    // }
    
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
        console.log('[handleModalSubmit] stat_custom_modal 처리 시작');
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
    
    // LOL 내전 모달
    else if (customId.includes('lol_join_modal_')) {
        const { handleLolInhouseModal } = require('./minigames/lolInhouse');
        return await handleLolInhouseModal(interaction);
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
        console.log(`[Main Menu] Selected value: ${value}`);
        
        // 각 카테고리로 라우팅
        if (value === 'profile' || value === 'inventory' || 
            value === 'equipment' || value === 'emblem') {
            // customId 설정
            interaction.customId = value;
            return await handleCharacterInteraction(interaction);
        }
        else if (value === 'minigame' || value === 'minigame_menu') {
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
                 value === 'work' || value === 'quest' || value === 'market_prices') {
            return await handleDailyInteraction(interaction);
        }
        else if (value === 'fishing') {
            console.log('[Handler Router] Processing fishing menu selection');
            const { handleFishingInteraction } = require('./economy/fishing');
            const { getUser } = require('./common/utils');
            const user = await getUser(interaction.user.id);
            console.log('[Handler Router] User data retrieved for fishing:', user ? 'Found' : 'Not Found');
            interaction.customId = 'fishing_menu';
            return await handleFishingInteraction(interaction, user);
        }
        else if (value === 'admin_panel' && isAdmin(interaction.user.id)) {
            return await handleAdminInteraction(interaction);
        }
        else if (value === 'dungeon') {
            return await handleDungeonInteraction(interaction);
        }
        else if (value === 'boss_shop') {
            // 보스 상점 메뉴 표시
            const { showBossShopMenu } = require('./raid/bossShopMenu');
            return await showBossShopMenu(interaction);
        }
        else if (value === 'enhance') {
            interaction.customId = 'enhance';
            return await handleEnhanceInteraction(interaction);
        }
        else if (value === 'ranking') {
            // 통합 랭킹 시스템
            return await handleRankingInteraction(interaction);
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
             customId === 'inventory_item_select' || customId === 'accessory_slot_select') {
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