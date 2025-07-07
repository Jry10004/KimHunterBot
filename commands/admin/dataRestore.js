const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const User = require('../models/User');
const { backupUserData, restoreUserData, validateUserData } = require('../database/dataProtection');

// 관리자 ID 목록
const ADMIN_IDS = [
    '424480594542592009',   // 요리
    '295980447849250817',   // 하연94
    '592659577384730645'    // 해물파전
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('데이터복구')
        .setDescription('[관리자 전용] 유저 데이터 백업 및 복구')
        .addSubcommand(subcommand =>
            subcommand
                .setName('백업')
                .setDescription('특정 유저의 데이터를 백업합니다')
                .addUserOption(option =>
                    option.setName('유저')
                        .setDescription('백업할 유저')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('복구')
                .setDescription('유저의 백업 데이터를 복구합니다')
                .addUserOption(option =>
                    option.setName('유저')
                        .setDescription('복구할 유저')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('검증')
                .setDescription('유저 데이터의 무결성을 검증합니다')
                .addUserOption(option =>
                    option.setName('유저')
                        .setDescription('검증할 유저')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('목록')
                .setDescription('특정 유저의 백업 목록을 확인합니다')
                .addUserOption(option =>
                    option.setName('유저')
                        .setDescription('백업 목록을 확인할 유저')
                        .setRequired(true))),

    async execute(interaction) {
        // 관리자 권한 확인
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('유저');

        switch (subcommand) {
            case '백업':
                await handleBackup(interaction, targetUser);
                break;
            case '복구':
                await handleRestore(interaction, targetUser);
                break;
            case '검증':
                await handleValidation(interaction, targetUser);
                break;
            case '목록':
                await handleListBackups(interaction, targetUser);
                break;
        }
    }
};

async function handleBackup(interaction, targetUser) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const backupPath = await backupUserData(targetUser.id);
        
        if (backupPath) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ 백업 완료')
                .setDescription(`${targetUser.username}님의 데이터가 성공적으로 백업되었습니다.`)
                .addFields(
                    { name: '백업 경로', value: `\`${path.basename(backupPath)}\``, inline: false },
                    { name: '백업 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                content: '❌ 백업 중 오류가 발생했습니다.',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('백업 오류:', error);
        await interaction.editReply({
            content: '❌ 백업 중 오류가 발생했습니다: ' + error.message,
            ephemeral: true
        });
    }
}

async function handleRestore(interaction, targetUser) {
    await interaction.deferReply({ ephemeral: true });

    try {
        // 백업 파일 목록 가져오기
        const backupDir = path.join(__dirname, '..', 'backups', 'users');
        const files = await fs.readdir(backupDir);
        const userBackups = files.filter(f => f.includes(`user_${targetUser.id}_`))
            .sort((a, b) => b.localeCompare(a)); // 최신순 정렬

        if (userBackups.length === 0) {
            return await interaction.editReply({
                content: '❌ 해당 유저의 백업 파일을 찾을 수 없습니다.',
                ephemeral: true
            });
        }

        // 백업 선택 메뉴 생성
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_backup')
            .setPlaceholder('복구할 백업을 선택하세요')
            .addOptions(
                userBackups.slice(0, 25).map(file => {
                    const timestamp = file.match(/user_\d+_(.+)\.json/)[1];
                    const date = new Date(timestamp.replace(/-/g, ':').replace('T', ' '));
                    return {
                        label: date.toLocaleString('ko-KR'),
                        value: file,
                        description: `백업 파일: ${file}`
                    };
                })
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
            content: `📁 ${targetUser.username}님의 백업 목록입니다. 복구할 백업을 선택하세요:`,
            components: [row]
        });

        // 선택 대기
        const filter = i => i.customId === 'select_backup' && i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            
            const selectedFile = i.values[0];
            const backupPath = path.join(backupDir, selectedFile);

            // 확인 버튼 추가
            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_restore')
                        .setLabel('복구 확인')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('⚠️'),
                    new ButtonBuilder()
                        .setCustomId('cancel_restore')
                        .setLabel('취소')
                        .setStyle(ButtonStyle.Secondary)
                );

            await i.editReply({
                content: `⚠️ **경고**: ${targetUser.username}님의 데이터를 선택한 백업으로 복구하시겠습니까?\n선택한 백업: \`${selectedFile}\`\n\n**현재 데이터는 덮어씌워집니다!**`,
                components: [confirmRow]
            });

            const buttonFilter = bi => ['confirm_restore', 'cancel_restore'].includes(bi.customId) && bi.user.id === interaction.user.id;
            const buttonCollector = interaction.channel.createMessageComponentCollector({ filter: buttonFilter, time: 30000 });

            buttonCollector.on('collect', async bi => {
                await bi.deferUpdate();

                if (bi.customId === 'confirm_restore') {
                    const success = await restoreUserData(targetUser.id, backupPath);
                    
                    if (success) {
                        const embed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('✅ 복구 완료')
                            .setDescription(`${targetUser.username}님의 데이터가 성공적으로 복구되었습니다.`)
                            .addFields(
                                { name: '복구된 백업', value: `\`${selectedFile}\``, inline: false },
                                { name: '복구 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
                            )
                            .setTimestamp();

                        await bi.editReply({ embeds: [embed], components: [] });
                    } else {
                        await bi.editReply({
                            content: '❌ 복구 중 오류가 발생했습니다.',
                            components: []
                        });
                    }
                } else {
                    await bi.editReply({
                        content: '복구가 취소되었습니다.',
                        components: []
                    });
                }

                buttonCollector.stop();
            });

            collector.stop();
        });
    } catch (error) {
        console.error('복구 오류:', error);
        await interaction.editReply({
            content: '❌ 복구 중 오류가 발생했습니다: ' + error.message,
            ephemeral: true
        });
    }
}

async function handleValidation(interaction, targetUser) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const user = await User.findOne({ discordId: targetUser.id });
        if (!user) {
            return await interaction.editReply({
                content: '❌ 해당 유저를 찾을 수 없습니다.',
                ephemeral: true
            });
        }

        // 데이터 무결성 검증
        const validationResult = await validateUserData(targetUser.id);
        const inventoryIssues = user.validateInventoryIntegrity();

        const embed = new EmbedBuilder()
            .setTitle('🔍 데이터 검증 결과')
            .setDescription(`${targetUser.username}님의 데이터 검증 결과입니다.`)
            .setTimestamp();

        if (validationResult.valid && inventoryIssues.length === 0) {
            embed.setColor('#00ff00');
            embed.addFields({ name: '✅ 검증 결과', value: '데이터에 문제가 없습니다.', inline: false });
        } else {
            embed.setColor('#ff0000');
            
            if (!validationResult.valid) {
                embed.addFields({
                    name: '❌ 일반 검증 문제',
                    value: validationResult.issues?.join('\n') || validationResult.reason,
                    inline: false
                });
            }
            
            if (inventoryIssues.length > 0) {
                embed.addFields({
                    name: '❌ 인벤토리 검증 문제',
                    value: inventoryIssues.join('\n'),
                    inline: false
                });
            }
        }

        // 추가 정보
        embed.addFields(
            { name: '레벨', value: `${user.level}`, inline: true },
            { name: '골드', value: `${user.gold.toLocaleString()}`, inline: true },
            { name: '인벤토리', value: `${user.inventory?.length || 0}개 아이템`, inline: true }
        );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('검증 오류:', error);
        await interaction.editReply({
            content: '❌ 검증 중 오류가 발생했습니다: ' + error.message,
            ephemeral: true
        });
    }
}

async function handleListBackups(interaction, targetUser) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const backupDir = path.join(__dirname, '..', 'backups', 'users');
        const files = await fs.readdir(backupDir);
        const userBackups = files.filter(f => f.includes(`user_${targetUser.id}_`))
            .sort((a, b) => b.localeCompare(a)); // 최신순 정렬

        if (userBackups.length === 0) {
            return await interaction.editReply({
                content: '❌ 해당 유저의 백업 파일을 찾을 수 없습니다.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📁 백업 목록')
            .setDescription(`${targetUser.username}님의 백업 파일 목록입니다.`)
            .setTimestamp();

        // 최근 10개만 표시
        const recentBackups = userBackups.slice(0, 10);
        const backupList = await Promise.all(recentBackups.map(async (file, index) => {
            const timestamp = file.match(/user_\d+_(.+)\.json/)[1];
            const date = new Date(timestamp.replace(/-/g, ':').replace('T', ' '));
            const filePath = path.join(backupDir, file);
            const stats = await fs.stat(filePath);
            const size = (stats.size / 1024).toFixed(2);
            
            return `${index + 1}. ${date.toLocaleString('ko-KR')} (${size}KB)`;
        }));

        embed.addFields({
            name: `총 ${userBackups.length}개의 백업`,
            value: backupList.join('\n') || '백업 없음',
            inline: false
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('목록 조회 오류:', error);
        await interaction.editReply({
            content: '❌ 백업 목록 조회 중 오류가 발생했습니다: ' + error.message,
            ephemeral: true
        });
    }
}