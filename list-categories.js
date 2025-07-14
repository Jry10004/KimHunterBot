const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

async function listCategories() {
    try {
        // 핫플레이스 성남방 서버
        const guild = client.guilds.cache.get('1371881456212639794');
        if (!guild) {
            console.error('❌ 서버를 찾을 수 없습니다!');
            return;
        }

        console.log('📋 서버의 모든 카테고리 목록:\n');

        // 카테고리 찾기
        const categories = guild.channels.cache.filter(ch => ch.type === ChannelType.GuildCategory);
        
        if (categories.size === 0) {
            console.log('⚠️ 카테고리가 없습니다.');
        } else {
            categories.forEach(category => {
                console.log(`📁 ${category.name} (ID: ${category.id})`);
                
                // 해당 카테고리의 채널들 표시
                const channelsInCategory = guild.channels.cache.filter(ch => ch.parentId === category.id);
                if (channelsInCategory.size > 0) {
                    channelsInCategory.forEach(ch => {
                        const typeEmoji = ch.type === ChannelType.GuildText ? '💬' : '🔊';
                        console.log(`   ${typeEmoji} ${ch.name}`);
                    });
                }
                console.log('');
            });
        }

        // 카테고리에 속하지 않은 채널들
        console.log('📌 카테고리에 속하지 않은 채널:');
        const uncategorized = guild.channels.cache.filter(ch => 
            !ch.parentId && ch.type !== ChannelType.GuildCategory
        );
        uncategorized.forEach(ch => {
            const typeEmoji = ch.type === ChannelType.GuildText ? '💬' : '🔊';
            console.log(`${typeEmoji} ${ch.name} (ID: ${ch.id})`);
        });

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        client.destroy();
        process.exit(0);
    }
}

client.once('ready', async () => {
    console.log(`${client.user.tag}으로 로그인했습니다!`);
    await listCategories();
});

client.login(process.env.BOT_TOKEN);