const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { isAdmin } = require('../../handlers/common/utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('필수채널생성')
        .setDescription('[관리자] 봇 운영에 필요한 필수 채널들을 생성합니다')
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
            
            // 필수 채널 목록
            const requiredChannels = [
                { name: '📝│회원가입', category: '🏛️ 정보', topic: '김헌터 회원가입 | 🎮 게임 시작하기' },
                { name: '📢│공지사항', category: '🏛️ 정보', topic: '김헌터 공식 공지 | 🔔 알림 ON 권장' },
                { name: '📜│규칙', category: '🏛️ 정보', topic: '서버 규칙과 가이드라인' },
                { name: '❓│도움말', category: '🏛️ 정보', topic: '봇 명령어와 사용법 안내' },
                
                { name: '💬│일반', category: '💭 커뮤니티', topic: '자유로운 대화 공간' },
                { name: '🔥│핫플채팅', category: '💭 커뮤니티', topic: '활발한 대화가 오가는 핫플레이스' },
                { name: '🎬│하이라이트', category: '💭 커뮤니티', topic: '멋진 순간들을 공유하세요' },
                { name: '📸│스크린샷', category: '💭 커뮤니티', topic: '게임 스크린샷 공유' },
                
                { name: '🛒│상점', category: '🎮 게임', topic: '아이템 & 엠블럼 구매 | 💎 24시간 영업' },
                { name: '💎│엠블럼상점', category: '🎮 게임', topic: '특별한 엠블럼 구매' },
                { name: '📈│주식거래소', category: '🎮 게임', topic: '주식 매매 | 📊 실시간 시세' },
                { name: '👹│보스레이드', category: '🎮 게임', topic: '월드보스 레이드 | ⏰ 출현: 매일 정각' },
                { name: '🏰│던전탐험', category: '🎮 게임', topic: '던전을 탐험하고 보상을 획득하세요' },
                { name: '⚔️│PVP-대기실', category: '🎮 게임', topic: 'PVP 매칭 대기실' },
                { name: '🎮│미니게임', category: '🎮 게임', topic: '다양한 미니게임을 즐기세요' },
                { name: '🏆│랭킹', category: '🎮 게임', topic: '실시간 랭킹 확인' },
                
                { name: '⛏️│광산', category: '🌍 활동', topic: '광물을 캐서 자원을 획득하세요' },
                { name: '🎣│낚시', category: '🌍 활동', topic: '낚시로 물고기와 보물을 낚으세요' },
                { name: '🏹│사냥터', category: '🌍 활동', topic: '몬스터를 사냥하고 경험치를 획득하세요' },
                { name: '🔨│강화', category: '🌍 활동', topic: '장비를 강화하여 더 강해지세요' },
                
                { name: '🐛│버그제보', category: '🆘 지원', topic: '버그를 발견하면 제보해주세요' },
                { name: '💡│건의사항', category: '🆘 지원', topic: '개선 아이디어를 제안해주세요' },
                { name: '🎫│티켓', category: '🆘 지원', topic: '1:1 문의 및 지원' },
                
                { name: '🎉│이벤트', category: '📢 소식', topic: '진행중인 이벤트 정보' },
                { name: '📰│뉴스', category: '📢 소식', topic: '김헌터 최신 소식' },
                { name: '🔄│업데이트', category: '📢 소식', topic: '게임 업데이트 내역' },
                
                { name: '🧪│테스트봇', category: '🔧 개발', topic: '봇 테스트 전용 채널' },
                { name: '📋│로그', category: '🔧 개발', topic: '시스템 로그' }
            ];
            
            // 카테고리별로 그룹화
            const categories = {};
            requiredChannels.forEach(ch => {
                if (!categories[ch.category]) {
                    categories[ch.category] = [];
                }
                categories[ch.category].push(ch);
            });
            
            let createdChannels = [];
            let existingChannels = [];
            let errors = [];
            
            // 카테고리 생성/확인 및 채널 생성
            for (const [categoryName, channelsInCategory] of Object.entries(categories)) {
                // 카테고리 찾기 또는 생성
                let category = channels.find(ch => ch.type === ChannelType.GuildCategory && ch.name === categoryName);
                
                if (!category) {
                    try {
                        category = await guild.channels.create({
                            name: categoryName,
                            type: ChannelType.GuildCategory
                        });
                    } catch (error) {
                        errors.push(`카테고리 ${categoryName} 생성 실패: ${error.message}`);
                        continue;
                    }
                }
                
                // 해당 카테고리의 채널들 생성
                for (const channelInfo of channelsInCategory) {
                    // 이미 존재하는지 확인
                    const existing = channels.find(ch => ch.name === channelInfo.name);
                    if (existing) {
                        existingChannels.push(channelInfo.name);
                        continue;
                    }
                    
                    try {
                        await guild.channels.create({
                            name: channelInfo.name,
                            type: ChannelType.GuildText,
                            parent: category.id,
                            topic: channelInfo.topic
                        });
                        createdChannels.push(channelInfo.name);
                    } catch (error) {
                        errors.push(`${channelInfo.name}: ${error.message}`);
                    }
                }
            }
            
            // 결과 임베드 생성
            const resultEmbed = new EmbedBuilder()
                .setTitle('🏗️ 필수 채널 생성 결과')
                .setColor('#4CAF50')
                .setTimestamp();
            
            if (createdChannels.length > 0) {
                resultEmbed.addFields({
                    name: `✅ 생성된 채널 (${createdChannels.length}개)`,
                    value: createdChannels.slice(0, 10).join('\n') + 
                           (createdChannels.length > 10 ? `\n... 외 ${createdChannels.length - 10}개` : ''),
                    inline: false
                });
            }
            
            if (existingChannels.length > 0) {
                resultEmbed.addFields({
                    name: `ℹ️ 이미 존재하는 채널 (${existingChannels.length}개)`,
                    value: existingChannels.slice(0, 10).join('\n') + 
                           (existingChannels.length > 10 ? `\n... 외 ${existingChannels.length - 10}개` : ''),
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
            console.error('필수 채널 생성 오류:', error);
            await interaction.editReply({
                content: '❌ 채널 생성 중 오류가 발생했습니다.'
            });
        }
    }
};