const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Jimp = require('jimp');

// 상태 파일 경로
const COUNTDOWN_STATE_PATH = path.join(__dirname, '..', 'countdownState.json');

// 오픈 카운트다운 상태
let openCountdown = {
    isActive: false,
    launchTime: null,
    channelId: null,
    messageId: null,
    startTime: null,
    interval: null,
    totalTime: null
};

function loadCountdownState() {
    try {
        if (fs.existsSync(COUNTDOWN_STATE_PATH)) {
            const data = fs.readFileSync(COUNTDOWN_STATE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('카운트다운 상태 로드 오류:', error);
    }
    return {
        isActive: false,
        launchTime: null,
        channelId: null,
        messageId: null,
        startTime: null
    };
}

function saveCountdownState() {
    const stateToSave = {
        isActive: openCountdown.isActive,
        launchTime: openCountdown.launchTime,
        channelId: openCountdown.channelId,
        messageId: openCountdown.messageId,
        startTime: openCountdown.startTime
    };
    try {
        fs.writeFileSync(COUNTDOWN_STATE_PATH, JSON.stringify(stateToSave, null, 2));
    } catch (error) {
        console.error('카운트다운 상태 저장 오류:', error);
    }
}

function isCountdownActive() {
    return openCountdown.isActive;
}

function getCountdownMessage(targetTime) {
    const now = Date.now();
    const remaining = targetTime - now;
    
    if (remaining <= 0) {
        return { text: '🎉 오픈!', isComplete: true };
    }
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    if (days > 0) {
        return { text: `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`, isComplete: false };
    } else if (hours > 0) {
        return { text: `${hours}시간 ${minutes}분 ${seconds}초`, isComplete: false };
    } else if (minutes > 0) {
        return { text: `${minutes}분 ${seconds}초`, isComplete: false };
    } else {
        return { text: `${seconds}초`, isComplete: false };
    }
}

async function createCountdownEmbed(targetTime) {
    const countdown = getCountdownMessage(targetTime);
    const progressPercentage = Math.max(0, Math.min(100, 
        ((openCountdown.totalTime - (targetTime - Date.now())) / openCountdown.totalTime) * 100
    ));
    
    const embed = new EmbedBuilder()
        .setColor(countdown.isComplete ? '#00FF00' : '#FF0000')
        .setTitle(countdown.isComplete ? '🎉 **서버 오픈!** 🎉' : '⏰ **서버 오픈 카운트다운**')
        .setDescription(countdown.isComplete ? 
            '**서버가 오픈되었습니다!**\n\n🎊 모든 기능이 활성화되었습니다!\n✨ 즐거운 시간 되세요!' :
            `남은 시간: **${countdown.text}**`
        );
    
    if (!countdown.isComplete) {
        // 프로그레스 바 생성
        const barLength = 20;
        const filledLength = Math.floor((progressPercentage / 100) * barLength);
        const emptyLength = barLength - filledLength;
        const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
        
        embed.addFields(
            { name: '진행률', value: `\`[${progressBar}]\` ${progressPercentage.toFixed(1)}%`, inline: false },
            { name: '오픈 예정 시간', value: `<t:${Math.floor(targetTime/1000)}:F>`, inline: false }
        );
    }
    
    embed.setFooter({ text: '정시에 오픈됩니다!' })
        .setTimestamp();
    
    return embed;
}

// 애니메이션 카운트다운 생성
async function createAnimatedCountdown(timeLeft) {
    try {
        const width = 800;
        const height = 400;
        const image = new Jimp(width, height, '#1a1a1a');
        
        // 폰트 로드
        const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        
        // 배경 그라데이션 효과
        for (let y = 0; y < height; y++) {
            const opacity = Math.floor((y / height) * 50);
            for (let x = 0; x < width; x++) {
                const color = Jimp.rgbaToInt(26 + opacity, 26 + opacity, 26 + opacity, 255);
                image.setPixelColor(color, x, y);
            }
        }
        
        // 시간 계산
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        let timeText = '';
        if (days > 0) {
            timeText = `${days}일 ${hours}시간 ${minutes}분`;
        } else if (hours > 0) {
            timeText = `${hours}시간 ${minutes}분 ${seconds}초`;
        } else if (minutes > 0) {
            timeText = `${minutes}분 ${seconds}초`;
        } else {
            timeText = `${seconds}초`;
        }
        
        // 텍스트 그리기
        image.print(font, 0, height/2 - 100, {
            text: '서버 오픈까지',
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, width, height);
        
        image.print(font, 0, height/2, {
            text: timeText,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, width, height);
        
        // 진행률 바
        const progress = openCountdown.totalTime ? 
            ((openCountdown.totalTime - timeLeft) / openCountdown.totalTime) : 0;
        const barWidth = width - 100;
        const barHeight = 30;
        const barX = 50;
        const barY = height - 80;
        
        // 바 배경
        for (let x = barX; x < barX + barWidth; x++) {
            for (let y = barY; y < barY + barHeight; y++) {
                image.setPixelColor(Jimp.rgbaToInt(60, 60, 60, 255), x, y);
            }
        }
        
        // 진행 바
        const progressWidth = Math.floor(barWidth * progress);
        for (let x = barX; x < barX + progressWidth; x++) {
            for (let y = barY; y < barY + barHeight; y++) {
                const gradient = Math.floor(255 * (x - barX) / progressWidth);
                image.setPixelColor(Jimp.rgbaToInt(255 - gradient, gradient, 100, 255), x, y);
            }
        }
        
        const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
        return new AttachmentBuilder(buffer, { name: 'countdown.png' });
    } catch (error) {
        console.error('카운트다운 이미지 생성 오류:', error);
        return null;
    }
}

// 축하 이미지 생성
async function createCelebrationImage() {
    try {
        const width = 800;
        const height = 400;
        const image = new Jimp(width, height, '#FFD700');
        
        const font = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
        const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
        
        // 방사형 그라데이션 배경
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                const ratio = distance / maxRadius;
                const r = Math.floor(255 - (255 - 255) * ratio);
                const g = Math.floor(215 - (215 - 100) * ratio);
                const b = Math.floor(0 + (255 - 0) * ratio);
                image.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
            }
        }
        
        // 텍스트 그리기
        image.print(font, 0, height/2 - 50, {
            text: '🎉 서버 오픈! 🎉',
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, width, height);
        
        image.print(smallFont, 0, height/2 + 50, {
            text: '환영합니다!',
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, width, height);
        
        const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
        return new AttachmentBuilder(buffer, { name: 'celebration.png' });
    } catch (error) {
        console.error('축하 이미지 생성 오류:', error);
        return null;
    }
}

module.exports = {
    openCountdown,
    loadCountdownState,
    saveCountdownState,
    isCountdownActive,
    getCountdownMessage,
    createCountdownEmbed,
    createAnimatedCountdown,
    createCelebrationImage,
    COUNTDOWN_STATE_PATH
};