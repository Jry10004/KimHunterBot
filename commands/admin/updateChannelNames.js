const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../../handlers/common/utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('채널이름일괄변경')
        .setDescription('[관리자] 모든 채널 이름을 새로운 형식으로 업데이트합니다')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // 관리자 권한 확인
        if (!isAdmin(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;
            const channels = await guild.channels.fetch();
            
            // 채널 이름 매핑
            const channelNameMap = {
                // 기본 채널들
                '회원가입': '📝│회원가입',
                '주식거래소': '📈│주식거래소',
                '상점': '🛒│상점',
                '공지사항': '📢│공지사항',
                '보스레이드': '👹│보스레이드',
                '댕댕봇-구출': '🐕│댕댕봇-구출',
                'pvp-대기실': '⚔️│PVP-대기실',
                'pvp대기실': '⚔️│PVP-대기실',
                '던전탐험': '🏰│던전탐험',
                '미니게임': '🎮│미니게임',
                '랭킹': '🏆│랭킹',
                '도움말': '❓│도움말',
                '버그리포트': '🐛│버그리포트',
                '건의사항': '💡│건의사항',
                '일반': '💬│일반',
                '봇-명령어': '🤖│봇-명령어',
                'bot-commands': '🤖│봇-명령어',
                '광산': '⛏️│광산',
                '낚시': '🎣│낚시',
                '사냥터': '🏹│사냥터',
                '강화': '🔨│강화',
                '거래소': '💰│거래소',
                '길드': '⚔️│길드',
                '이벤트': '🎉│이벤트',
                '업데이트': '📢│업데이트',
                // 추가 매핑
                '핫플-채팅': '🔥│핫플채팅',
                '핫플채팅': '🔥│핫플채팅',
                '클립과-하이라이트': '🎬│하이라이트',
                '하이라이트': '🎬│하이라이트',
                'join': '📝│가입채널',
                '가입채널': '📝│가입채널',
                'event': '🎉│이벤트',
                'test_bot': '🧪│테스트봇',
                'test-bot': '🧪│테스트봇',
                '테스트봇': '🧪│테스트봇',
                'bug-report': '🐛│버그제보',
                '버그제보': '🐛│버그제보',
                'emblem': '💎│엠블럼상점',
                '엠블럼': '💎│엠블럼상점',
                'boss': '👹│보스레이드',
                'count': '🔢│카운팅',
                '카운팅': '🔢│카운팅',
                '🎮-대기실': '🎮│대기실',
                // 일반적인 채널 이름들
                'announcements': '📢│공지사항',
                'general': '💬│일반',
                'welcome': '👋│환영',
                'rules': '📜│규칙',
                'roles': '🎭│역할',
                'tickets': '🎫│티켓',
                'staff': '👮│스태프',
                'logs': '📋│로그',
                'voice': '🎤│음성',
                'music': '🎵│음악',
                'memes': '😂│밈',
                'art': '🎨│아트',
                'screenshots': '📸│스크린샷',
                'suggestions': '💡│건의사항',
                'bugs': '🐛│버그리포트',
                'support': '🆘│지원',
                'partners': '🤝│파트너',
                'giveaways': '🎁│경품',
                'events': '🎉│이벤트',
                'news': '📰│뉴스',
                'updates': '🔄│업데이트',
                'patch-notes': '📝│패치노트',
                'dev-log': '👨‍💻│개발로그',
                'community': '👥│커뮤니티',
                'off-topic': '💭│자유토크',
                'bot-spam': '🤖│봇-명령어',
                'counting': '🔢│카운팅',
                'quotes': '💬│명언',
                'confession': '🤫│고백',
                'debate': '💭│토론',
                'polls': '📊│투표',
                'qna': '❓│질문답변',
                'showcase': '🌟│쇼케이스',
                'resources': '📚│자료실',
                'tutorials': '📖│튜토리얼',
                'guides': '📘│가이드'
            };

            let updatedChannels = [];
            let skippedChannels = [];
            let errors = [];

            for (const [channelId, channel] of channels) {
                // 텍스트 채널만 처리
                if (channel.type !== 0) continue;
                
                // 카테고리는 제외
                const lowerName = channel.name.toLowerCase();

                // 이미 새 형식인 경우 스킵
                if (channel.name.includes('│')) {
                    skippedChannels.push(`${channel.name} (이미 변경됨)`);
                    continue;
                }

                // 매핑에서 새 이름 찾기
                let newName = null;
                for (const [oldPattern, newPattern] of Object.entries(channelNameMap)) {
                    if (channel.name.toLowerCase().includes(oldPattern.toLowerCase())) {
                        newName = newPattern;
                        break;
                    }
                }

                // 틱택토 채널 특별 처리
                if (channel.name.includes('틱택토') && channel.name.includes('vs')) {
                    const players = channel.name.match(/(.+?)\s*vs\s*(.+)/);
                    if (players) {
                        newName = `🎯│틱택토│${players[1].trim()} vs ${players[2].trim()}`;
                    }
                }

                // PVP 채널 특별 처리
                if (channel.name.includes('pvp') && channel.name.includes('vs')) {
                    const players = channel.name.match(/(.+?)\s*vs\s*(.+)/);
                    if (players) {
                        newName = `⚔️│PVP│${players[1].trim()} vs ${players[2].trim()}`;
                    }
                }

                // 새 이름이 있으면 변경
                if (newName && newName !== channel.name) {
                    try {
                        await channel.edit({ name: newName });
                        updatedChannels.push(`${channel.name} → ${newName}`);
                    } catch (error) {
                        errors.push(`${channel.name}: ${error.message}`);
                    }
                } else if (!newName) {
                    skippedChannels.push(`${channel.name} (매핑 없음)`);
                }
            }

            // 결과 임베드 생성
            const resultEmbed = new EmbedBuilder()
                .setTitle('📝 채널 이름 일괄 변경 결과')
                .setColor('#2196F3')
                .setTimestamp();

            if (updatedChannels.length > 0) {
                resultEmbed.addFields({
                    name: `✅ 변경된 채널 (${updatedChannels.length}개)`,
                    value: updatedChannels.slice(0, 10).join('\n') + 
                           (updatedChannels.length > 10 ? `\n... 외 ${updatedChannels.length - 10}개` : ''),
                    inline: false
                });
            }

            if (skippedChannels.length > 0) {
                resultEmbed.addFields({
                    name: `⏭️ 스킵된 채널 (${skippedChannels.length}개)`,
                    value: skippedChannels.slice(0, 10).join('\n') + 
                           (skippedChannels.length > 10 ? `\n... 외 ${skippedChannels.length - 10}개` : ''),
                    inline: false
                });
            }

            if (errors.length > 0) {
                resultEmbed.addFields({
                    name: `❌ 오류 발생 (${errors.length}개)`,
                    value: errors.slice(0, 5).join('\n') + 
                           (errors.length > 5 ? `\n... 외 ${errors.length - 5}개` : ''),
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [resultEmbed] });

        } catch (error) {
            console.error('채널 이름 일괄 변경 오류:', error);
            await interaction.editReply({
                content: '❌ 채널 이름 변경 중 오류가 발생했습니다.'
            });
        }
    }
};