const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const dataManager = require('../systems/dataManager');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('데이터관리')
        .setDescription('🗄️ 게임 데이터 관리 (관리자 전용)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('상태')
                .setDescription('데이터 매니저 상태 확인'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('저장')
                .setDescription('모든 데이터 즉시 저장'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('백업')
                .setDescription('데이터 백업 생성'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('백업목록')
                .setDescription('백업 목록 확인'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('복원')
                .setDescription('백업에서 데이터 복원')
                .addStringOption(option =>
                    option.setName('백업명')
                        .setDescription('복원할 백업 이름')
                        .setRequired(true))),

    async execute(interaction) {
        // 관리자 권한 확인
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case '상태':
                await showDataStatus(interaction);
                break;
            case '저장':
                await saveAllData(interaction);
                break;
            case '백업':
                await createBackup(interaction);
                break;
            case '백업목록':
                await showBackupList(interaction);
                break;
            case '복원':
                await restoreBackup(interaction);
                break;
        }
    }
};

// 데이터 상태 표시
async function showDataStatus(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const stats = dataManager.getStats();
    const memoryUsage = process.memoryUsage();

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🗄️ 데이터 매니저 상태')
        .setDescription('현재 게임 데이터 관리 상태입니다.')
        .addFields(
            {
                name: '📊 등록된 데이터',
                value: `${stats.registeredData}개`,
                inline: true
            },
            {
                name: '💾 변경된 데이터',
                value: `${stats.dirtyData}개`,
                inline: true
            },
            {
                name: '💻 메모리 사용량',
                value: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                inline: true
            },
            {
                name: '📁 데이터 경로',
                value: `\`${stats.dataPath}\``,
                inline: false
            },
            {
                name: '📦 백업 경로',
                value: `\`${stats.backupPath}\``,
                inline: false
            }
        )
        .setTimestamp();

    // 개별 데이터 상태
    const dataStates = [];
    for (const [key, config] of dataManager.dataRegistry) {
        const isDirty = dataManager.isDirty.has(key);
        dataStates.push(`${isDirty ? '🟡' : '🟢'} ${key}`);
    }

    if (dataStates.length > 0) {
        embed.addFields({
            name: '📋 데이터 상태',
            value: dataStates.join('\n'),
            inline: false
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

// 모든 데이터 저장
async function saveAllData(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const startTime = Date.now();
        await dataManager.saveAllData();
        const elapsed = Date.now() - startTime;

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ 데이터 저장 완료')
            .setDescription(`모든 게임 데이터가 저장되었습니다.`)
            .addFields({
                name: '⏱️ 소요 시간',
                value: `${elapsed}ms`,
                inline: true
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('데이터 저장 오류:', error);
        await interaction.editReply({
            content: `❌ 데이터 저장 중 오류가 발생했습니다: ${error.message}`
        });
    }
}

// 백업 생성
async function createBackup(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const startTime = Date.now();
        await dataManager.createBackup();
        const elapsed = Date.now() - startTime;

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ 백업 생성 완료')
            .setDescription('게임 데이터 백업이 생성되었습니다.')
            .addFields({
                name: '⏱️ 소요 시간',
                value: `${elapsed}ms`,
                inline: true
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('백업 생성 오류:', error);
        await interaction.editReply({
            content: `❌ 백업 생성 중 오류가 발생했습니다: ${error.message}`
        });
    }
}

// 백업 목록 표시
async function showBackupList(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const backupPath = path.join(__dirname, '..', 'data', 'backups');
        const backups = await fs.readdir(backupPath);
        
        if (backups.length === 0) {
            return await interaction.editReply({
                content: '📦 생성된 백업이 없습니다.'
            });
        }

        // 최신순 정렬
        backups.sort().reverse();

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📦 백업 목록')
            .setDescription(`총 ${backups.length}개의 백업이 있습니다.`);

        // 최대 10개만 표시
        const displayBackups = backups.slice(0, 10);
        for (const backup of displayBackups) {
            const backupDir = path.join(backupPath, backup);
            const stats = await fs.stat(backupDir);
            
            embed.addFields({
                name: backup,
                value: `생성일: ${stats.birthtime.toLocaleString('ko-KR')}`,
                inline: false
            });
        }

        if (backups.length > 10) {
            embed.setFooter({ text: `... 외 ${backups.length - 10}개` });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('백업 목록 조회 오류:', error);
        await interaction.editReply({
            content: `❌ 백업 목록 조회 중 오류가 발생했습니다: ${error.message}`
        });
    }
}

// 백업 복원
async function restoreBackup(interaction) {
    const backupName = interaction.options.getString('백업명');
    
    await interaction.deferReply({ ephemeral: true });

    // 확인 버튼
    const confirmEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('⚠️ 백업 복원 확인')
        .setDescription(`정말로 \`${backupName}\` 백업을 복원하시겠습니까?\n\n**현재 데이터가 모두 덮어씌워집니다!**`)
        .setTimestamp();

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_restore')
                .setLabel('복원하기')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('cancel_restore')
                .setLabel('취소')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.editReply({
        embeds: [confirmEmbed],
        components: [buttons]
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 30000,
        max: 1
    });

    collector.on('collect', async i => {
        if (i.customId === 'confirm_restore') {
            await i.update({
                content: '🔄 백업 복원 중...',
                embeds: [],
                components: []
            });

            try {
                await dataManager.restoreFromBackup(backupName);
                
                const successEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ 백업 복원 완료')
                    .setDescription(`\`${backupName}\` 백업이 성공적으로 복원되었습니다.`)
                    .setTimestamp();

                await interaction.editReply({
                    content: null,
                    embeds: [successEmbed]
                });
            } catch (error) {
                console.error('백업 복원 오류:', error);
                await interaction.editReply({
                    content: `❌ 백업 복원 중 오류가 발생했습니다: ${error.message}`,
                    embeds: []
                });
            }
        } else {
            await i.update({
                content: '❌ 백업 복원이 취소되었습니다.',
                embeds: [],
                components: []
            });
        }
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            interaction.editReply({
                content: '⏰ 시간이 초과되어 백업 복원이 취소되었습니다.',
                embeds: [],
                components: []
            });
        }
    });
}