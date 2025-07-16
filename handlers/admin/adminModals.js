const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { isAdmin } = require('./adminSystem');
const MissionHelper = require('../../utils/missionHelper');

// 레벨/경험치 설정 처리
async function handleLevelModal(interaction) {
    if (!isAdmin(interaction.user.id)) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 관리자만 사용할 수 있습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 관리자만 사용할 수 있습니다!', 
                flags: 64 
            });
        }
    }

    const targetUserId = interaction.fields.getTextInputValue('target_user_id');
    const level = parseInt(interaction.fields.getTextInputValue('level'));
    const exp = parseInt(interaction.fields.getTextInputValue('exp') || '0');

    if (isNaN(level) || level < 1 || level > 999) {
        return await interaction.reply({ 
            content: '❌ 레벨은 1-999 사이여야 합니다!', 
            flags: 64 
        });
    }

    const targetUser = await User.findOne({ discordId: targetUserId });
    if (!targetUser) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 해당 유저를 찾을 수 없습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 해당 유저를 찾을 수 없습니다!', 
                flags: 64 
            });
        }
    }

    // 레벨 설정
    targetUser.level = level;
    targetUser.exp = exp;
    await targetUser.save();

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 레벨 설정 완료')
        .setDescription(`**${targetUser.username}**님의 레벨을 설정했습니다.`)
        .addFields(
            { name: '📊 레벨', value: `Lv.${level}`, inline: true },
            { name: '⭐ 경험치', value: `${exp} EXP`, inline: true }
        )
        .setFooter({ text: `관리자: ${interaction.user.username}` })
        .setTimestamp();

    // 이미 defer된 경우 editReply 사용
    if (interaction.deferred) {
        return await interaction.editReply({
            embeds: [embed]
        });
    } else {
        return await interaction.reply({
            embeds: [embed],
            flags: 64
        });
    }
}

// 골드 지급 처리
async function handleGoldModal(interaction) {
    if (!isAdmin(interaction.user.id)) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 관리자만 사용할 수 있습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 관리자만 사용할 수 있습니다!', 
                flags: 64 
            });
        }
    }

    const targetUserId = interaction.fields.getTextInputValue('target_user_id');
    const amount = parseInt(interaction.fields.getTextInputValue('amount'));
    const reason = interaction.fields.getTextInputValue('reason') || '관리자 지급';

    if (isNaN(amount)) {
        return await interaction.reply({ 
            content: '❌ 올바른 수량을 입력해주세요!', 
            flags: 64 
        });
    }

    const targetUser = await User.findOne({ discordId: targetUserId });
    if (!targetUser) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 해당 유저를 찾을 수 없습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 해당 유저를 찾을 수 없습니다!', 
                flags: 64 
            });
        }
    }

    // 골드 지급
    targetUser.gold += amount;
    if (targetUser.gold < 0) targetUser.gold = 0;
    await targetUser.save();
    
    // 골드 획득 미션 업데이트 (양수일 때만)
    if (amount > 0) {
        await MissionHelper.updateGoldEarned(targetUserId, amount);
    }

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 골드 지급 완료')
        .setDescription(`**${targetUser.username}**님에게 골드를 지급했습니다.`)
        .addFields(
            { name: '💰 지급액', value: `${amount >= 0 ? '+' : ''}${formatNumber(amount)}G`, inline: true },
            { name: '💎 현재 골드', value: `${formatNumber(targetUser.gold)}G`, inline: true },
            { name: '📝 사유', value: reason, inline: false }
        )
        .setFooter({ text: `관리자: ${interaction.user.username}` })
        .setTimestamp();

    // 이미 defer된 경우 editReply 사용
    if (interaction.deferred) {
        return await interaction.editReply({
            embeds: [embed]
        });
    } else {
        return await interaction.reply({
            embeds: [embed],
            flags: 64
        });
    }
}

// 아이템 지급 처리
async function handleItemModal(interaction) {
    if (!isAdmin(interaction.user.id)) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 관리자만 사용할 수 있습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 관리자만 사용할 수 있습니다!', 
                flags: 64 
            });
        }
    }

    const targetUserId = interaction.fields.getTextInputValue('target_user_id');
    const itemName = interaction.fields.getTextInputValue('item_name');
    const quantity = parseInt(interaction.fields.getTextInputValue('quantity'));

    if (isNaN(quantity) || quantity < 1) {
        return await interaction.reply({ 
            content: '❌ 올바른 수량을 입력해주세요!', 
            flags: 64 
        });
    }

    const targetUser = await User.findOne({ discordId: targetUserId });
    if (!targetUser) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 해당 유저를 찾을 수 없습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 해당 유저를 찾을 수 없습니다!', 
                flags: 64 
            });
        }
    }

    // 아이템 지급
    targetUser.inventory.push({
        name: itemName,
        quantity: quantity,
        category: 'admin_gift',
        obtainedAt: new Date(),
        giftedBy: interaction.user.username
    });
    await targetUser.save();

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 아이템 지급 완료')
        .setDescription(`**${targetUser.username}**님에게 아이템을 지급했습니다.`)
        .addFields(
            { name: '🎁 아이템', value: itemName, inline: true },
            { name: '📦 수량', value: `x${quantity}`, inline: true }
        )
        .setFooter({ text: `관리자: ${interaction.user.username}` })
        .setTimestamp();

    // 이미 defer된 경우 editReply 사용
    if (interaction.deferred) {
        return await interaction.editReply({
            embeds: [embed]
        });
    } else {
        return await interaction.reply({
            embeds: [embed],
            flags: 64
        });
    }
}

// 공지 발송 처리
async function handleAnnouncementModal(interaction) {
    if (!isAdmin(interaction.user.id)) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 관리자만 사용할 수 있습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 관리자만 사용할 수 있습니다!', 
                flags: 64 
            });
        }
    }

    const title = interaction.fields.getTextInputValue('announcement_title');
    const content = interaction.fields.getTextInputValue('announcement_content');
    const channelId = interaction.fields.getTextInputValue('channel_id') || interaction.channelId;

    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
        return await interaction.reply({ 
            content: '❌ 채널을 찾을 수 없습니다!', 
            flags: 64 
        });
    }

    const announcementEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle(`📢 ${title}`)
        .setDescription(content)
        .setFooter({ text: '김헌터 운영팀' })
        .setTimestamp();

    await channel.send({ embeds: [announcementEmbed] });

    const confirmEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 공지 발송 완료')
        .setDescription(`<#${channelId}>에 공지를 발송했습니다.`)
        .addFields(
            { name: '📋 제목', value: title, inline: false },
            { name: '📝 내용', value: content.substring(0, 1000), inline: false }
        );

    return await interaction.reply({
        embeds: [confirmEmbed],
        flags: 64
    });
}

// 유저 초기화 처리
async function handleResetModal(interaction) {
    if (!isAdmin(interaction.user.id)) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 관리자만 사용할 수 있습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 관리자만 사용할 수 있습니다!', 
                flags: 64 
            });
        }
    }

    const targetUserId = interaction.fields.getTextInputValue('target_user_id');
    const confirmText = interaction.fields.getTextInputValue('confirm_text');

    if (confirmText !== 'RESET') {
        return await interaction.reply({ 
            content: '❌ 확인 문구가 일치하지 않습니다!', 
            flags: 64 
        });
    }

    const targetUser = await User.findOne({ discordId: targetUserId });
    if (!targetUser) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 해당 유저를 찾을 수 없습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 해당 유저를 찾을 수 없습니다!', 
                flags: 64 
            });
        }
    }

    // 유저 데이터 초기화
    const username = targetUser.username;
    const nickname = targetUser.nickname;
    
    await User.deleteOne({ discordId: targetUserId });

    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🔄 유저 초기화 완료')
        .setDescription(`**${username}** (${nickname})님의 모든 데이터가 초기화되었습니다.`)
        .setFooter({ text: `관리자: ${interaction.user.username}` })
        .setTimestamp();

    // 이미 defer된 경우 editReply 사용
    if (interaction.deferred) {
        return await interaction.editReply({
            embeds: [embed]
        });
    } else {
        return await interaction.reply({
            embeds: [embed],
            flags: 64
        });
    }
}

// 엠블럼 지급 모달
async function showEmblemGiveModal(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
    
    // 이미 defer된 경우 오류 처리
    if (interaction.deferred || interaction.replied) {
        console.error('[AdminModals] Cannot show modal - interaction already deferred/replied');
        return;
    }
    
    const modal = new ModalBuilder()
        .setCustomId('admin_emblem_give_modal')
        .setTitle('엠블럼 지급');

    const userIdInput = new TextInputBuilder()
        .setCustomId('target_user_id')
        .setLabel('유저 ID')
        .setPlaceholder('Discord 유저 ID를 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const emblemNameInput = new TextInputBuilder()
        .setCustomId('emblem_name')
        .setLabel('엠블럼 이름')
        .setPlaceholder('지급할 엠블럼 이름')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const emblemLevelInput = new TextInputBuilder()
        .setCustomId('emblem_level')
        .setLabel('엠블럼 레벨')
        .setPlaceholder('엠블럼 레벨 (기본: 1)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(emblemNameInput),
        new ActionRowBuilder().addComponents(emblemLevelInput)
    );

    await interaction.showModal(modal);
}

// 엠블럼 지급 처리
async function handleEmblemGiveModal(interaction) {
    if (!isAdmin(interaction.user.id)) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 관리자만 사용할 수 있습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 관리자만 사용할 수 있습니다!', 
                flags: 64 
            });
        }
    }

    const targetUserId = interaction.fields.getTextInputValue('target_user_id');
    const emblemName = interaction.fields.getTextInputValue('emblem_name');
    const emblemLevel = parseInt(interaction.fields.getTextInputValue('emblem_level') || '1');

    const targetUser = await User.findOne({ discordId: targetUserId });
    if (!targetUser) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '❌ 해당 유저를 찾을 수 없습니다!'
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 해당 유저를 찾을 수 없습니다!', 
                flags: 64 
            });
        }
    }

    // 엠블럼 지급
    targetUser.emblem = {
        name: emblemName,
        level: emblemLevel,
        exp: 0
    };
    await targetUser.save();

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 엠블럼 지급 완료')
        .setDescription(`**${targetUser.username || targetUserId}**님에게 엠블럼을 지급했습니다.`)
        .addFields(
            { name: '🏆 엠블럼', value: emblemName || '이름 없음', inline: true },
            { name: '📊 레벨', value: `Lv.${emblemLevel || 1}`, inline: true }
        )
        .setFooter({ text: `관리자: ${interaction.user.username}` })
        .setTimestamp();

    // 이미 defer된 경우 editReply 사용
    if (interaction.deferred) {
        return await interaction.editReply({
            embeds: [embed]
        });
    } else {
        return await interaction.reply({
            embeds: [embed],
            flags: 64
        });
    }
}

module.exports = {
    handleLevelModal,
    handleGoldModal,
    handleItemModal,
    handleAnnouncementModal,
    handleResetModal,
    showEmblemGiveModal,
    handleEmblemGiveModal
};