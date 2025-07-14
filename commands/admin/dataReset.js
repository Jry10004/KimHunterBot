const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const { isAdmin } = require('../../handlers/admin/adminSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('게임데이터초기화')
        .setDescription('🔧 [관리자 전용] 모든 게임 데이터를 초기화합니다'),
    
    async execute(interaction) {
        // 관리자 권한 체크
        if (!isAdmin(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!', 
                ephemeral: true 
            });
        }

        // 관리자 ID (424480594542592009)만 허용
        if (interaction.user.id !== '424480594542592009') {
            return interaction.reply({ 
                content: '❌ 이 명령어는 최고 관리자만 사용할 수 있습니다!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // 모든 유저 가져오기
            const allUsers = await User.find({});
            let processedCount = 0;
            let errorCount = 0;

            for (const user of allUsers) {
                try {
                    // 가입 정보와 닉네임은 유지
                    const keepData = {
                        discordId: user.discordId,
                        username: user.username,
                        nickname: user.nickname,
                        registered: user.registered,
                        registeredAt: user.registeredAt
                    };

                    // 게임 데이터 초기화
                    user.level = 1;
                    user.experience = 0;
                    user.gold = 10000; // 기본 골드
                    user.lastHunt = null;
                    user.lastWork = null;
                    user.lastDaily = null;
                    user.lastBossAttack = null;
                    user.achievements = [];
                    user.statistics = {
                        totalHunts: 0,
                        totalWorks: 0,
                        totalDamageDealt: 0,
                        totalGoldEarned: 0,
                        monstersKilled: 0,
                        bossesKilled: 0
                    };
                    // 사전강화 아이템을 제외한 인벤토리 초기화
                    if (user.prelaunchWeapon && user.inventory && user.inventory.length > 0) {
                        const prelaunchItems = user.inventory.filter(item => item.isPrelaunch || item.prelaunchEnhancement);
                        user.inventory = prelaunchItems;
                    } else {
                        user.inventory = [];
                    }
                    user.equipment = {
                        weapon: null,
                        armor: null,
                        accessory: null,
                        helmet: null,
                        gloves: null,
                        boots: null
                    };
                    user.stockPortfolio = {};
                    user.fragments = {
                        total: 0,
                        tier1: 0,
                        tier2: 0,
                        tier3: 0,
                        tier4: 0,
                        tier5: 0,
                        tier6: 0,
                        tier7: 0,
                        tier8: 0,
                        tier9: 0,
                        tier10: 0
                    };
                    user.artifacts = [];
                    user.pickaxe = {
                        type: 'basic',
                        durability: 100,
                        maxDurability: 100,
                        efficiency: 1
                    };
                    user.miningStats = {
                        totalMined: 0,
                        totalArtifacts: 0,
                        totalGoldEarned: 0,
                        lastMineTime: null
                    };
                    user.emblem = null;
                    user.emblemLevel = 0;
                    user.emblemExp = 0;
                    user.skills = {
                        combat: {
                            level: 1,
                            exp: 0,
                            totalExp: 0
                        },
                        mining: {
                            level: 1,
                            exp: 0,
                            totalExp: 0
                        },
                        trading: {
                            level: 1,
                            exp: 0,
                            totalExp: 0
                        }
                    };
                    user.questProgress = {};
                    user.dailyQuests = [];
                    user.weeklyQuests = [];
                    user.completedQuests = [];
                    user.titles = [];
                    user.activeTitle = null;
                    user.collections = {};
                    user.badges = [];
                    user.likes = 0;
                    user.likedBy = [];
                    user.newsStockAverage = 0;
                    user.newsStockCount = 0;
                    user.totalNewsStockValue = 0;
                    user.totalTradedNewsStock = 0;
                    user.popularityPoints = 0;
                    user.lastPopularityVote = null;
                    // user.prelaunchWeapon = null; // 사전강화 아이템은 유지
                    user.fishingLevel = 1;
                    user.fishingExp = 0;
                    user.fishingStats = {
                        totalFished: 0,
                        raresFished: 0,
                        epicsFished: 0,
                        legendariesFished: 0,
                        biggestFish: 0
                    };
                    user.bait = {
                        basic: 10,
                        advanced: 0,
                        premium: 0
                    };
                    user.fishingRod = 'basic';
                    user.lastFish = null;

                    await user.save();
                    processedCount++;
                } catch (userError) {
                    console.error(`유저 ${user.username} 초기화 실패:`, userError);
                    errorCount++;
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔧 게임 데이터 초기화 완료')
                .setDescription('모든 유저의 게임 데이터가 초기화되었습니다.')
                .addFields(
                    { name: '📊 처리 결과', value: `총 ${allUsers.length}명 중 ${processedCount}명 처리 완료`, inline: true },
                    { name: '❌ 오류', value: `${errorCount}명`, inline: true },
                    { name: '📝 유지된 데이터', value: '가입 정보, 닉네임, 사전강화 아이템', inline: false },
                    { name: '🗑️ 초기화된 데이터', value: '레벨, 골드, 인벤토리, 장비, 주식, 조각, 유물, 엠블럼 등 모든 게임 데이터', inline: false }
                )
                .setFooter({ text: `실행자: ${interaction.user.username}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('게임 데이터 초기화 중 오류:', error);
            await interaction.editReply({
                content: '❌ 게임 데이터 초기화 중 오류가 발생했습니다.',
                embeds: []
            });
        }
    }
};