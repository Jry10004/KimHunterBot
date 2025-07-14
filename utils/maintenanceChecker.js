const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const MAINTENANCE_FILE = path.join(__dirname, '../data/maintenanceStatus.json');

// 점검 상태 확인
async function checkMaintenance(feature) {
    try {
        const data = await fs.readFile(MAINTENANCE_FILE, 'utf8');
        const status = JSON.parse(data);
        
        // 게임 전체 점검 확인
        if (status.game && status.game.active) {
            return status.game;
        }
        
        // 특정 기능 점검 확인
        if (status[feature] && status[feature].active) {
            return status[feature];
        }
        
        return null;
    } catch (error) {
        // 파일이 없으면 점검 중이 아님
        return null;
    }
}

// 점검 메시지 생성
function createMaintenanceEmbed(maintenanceInfo, featureName) {
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔧 점검 중')
        .setDescription(`**${featureName}** 기능이 현재 점검 중입니다.`)
        .addFields(
            { name: '점검 사유', value: maintenanceInfo.reason || '시스템 점검', inline: false }
        );
    
    if (maintenanceInfo.estimatedMinutes) {
        const startTime = new Date(maintenanceInfo.startTime).getTime();
        const estimatedEndTime = new Date(startTime + maintenanceInfo.estimatedMinutes * 60 * 1000);
        const remaining = Math.max(0, Math.floor((estimatedEndTime - Date.now()) / 1000 / 60));
        
        embed.addFields({
            name: '예상 남은 시간',
            value: remaining > 0 ? `약 ${remaining}분` : '곧 완료 예정',
            inline: true
        });
    }
    
    embed.setFooter({ text: '불편을 드려 죄송합니다.' })
        .setTimestamp();
    
    return embed;
}

// 점검 응답 헬퍼
async function replyWithMaintenance(interaction, feature, featureName) {
    const maintenanceInfo = await checkMaintenance(feature);
    
    if (maintenanceInfo) {
        const embed = createMaintenanceEmbed(maintenanceInfo, featureName);
        
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply({ embeds: [embed], components: [] });
        } else {
            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
    
    return false; // 점검 중이 아님
}

module.exports = {
    checkMaintenance,
    createMaintenanceEmbed,
    replyWithMaintenance
};