// 📰 뉴스 시스템
const EventEmitter = require('events');
const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../handlers/common/utils');

class NewsSystem extends EventEmitter {
    constructor() {
        super();
        this.newsQueue = [];
        this.newsHistory = [];
        this.breakingNews = [];
        this.newsChannels = new Set(); // 뉴스를 발행할 채널들
        this.scheduleInterval = null;
        this.isInitialized = false;
        this.client = null;
    }

    // 뉴스 카테고리
    NEWS_CATEGORIES = {
        ENHANCEMENT: {
            name: '강화',
            emoji: '⚔️',
            color: '#FFD700',
            priority: 2
        },
        RARE_DROP: {
            name: '희귀템',
            emoji: '💎',
            color: '#E91E63',
            priority: 3
        },
        BOSS_KILL: {
            name: '보스처치',
            emoji: '👹',
            color: '#9C27B0',
            priority: 3
        },
        ECONOMY: {
            name: '경제',
            emoji: '💰',
            color: '#4CAF50',
            priority: 1
        },
        PVP: {
            name: 'PVP',
            emoji: '⚔️',
            color: '#F44336',
            priority: 2
        },
        GUILD: {
            name: '길드',
            emoji: '🏛️',
            color: '#3F51B5',
            priority: 2
        },
        RECORD: {
            name: '신기록',
            emoji: '🏆',
            color: '#FF9800',
            priority: 3
        },
        MARKET: {
            name: '주식',
            emoji: '📈',
            color: '#00BCD4',
            priority: 1
        },
        SPECIAL: {
            name: '특별',
            emoji: '🌟',
            color: '#FFEB3B',
            priority: 4
        },
        ENTERTAINMENT: {
            name: '연예',
            emoji: '💕',
            color: '#FF69B4',
            priority: 2
        },
        CRIME: {
            name: '사건사고',
            emoji: '🚨',
            color: '#B71C1C',
            priority: 3
        },
        FINANCE: {
            name: '경제',
            emoji: '💰',
            color: '#4CAF50',
            priority: 2
        },
        BUSINESS: {
            name: '비즈니스',
            emoji: '💼',
            color: '#1976D2',
            priority: 2
        }
    };

    // 뉴스 템플릿
    NEWS_TEMPLATES = {
        // 강화 관련
        enhancement_success: {
            category: 'ENHANCEMENT',
            template: '{player}님이 {item}을(를) +{level} 강화에 성공했습니다!',
            breakingThreshold: 15, // +15 이상이면 속보
            marketImpact: {
                sectors: ['manufacturing'],
                impact: 0.02
            }
        },
        enhancement_destroy: {
            category: 'ENHANCEMENT',
            template: '💥 {player}님의 {item}이(가) +{level} 강화 도중 파괴되었습니다!',
            breakingThreshold: 20,
            marketImpact: {
                companies: ['STF', 'PTL'],
                impact: 0.03
            }
        },
        
        // 희귀 아이템 획득
        legendary_drop: {
            category: 'RARE_DROP',
            template: '🎉 {player}님이 {location}에서 전설 아이템 [{item}]을(를) 획득했습니다!',
            breaking: true,
            marketImpact: {
                sectors: ['retail', 'special'],
                impact: 0.05
            }
        },
        rare_material: {
            category: 'RARE_DROP',
            template: '{player}님이 희귀 재료 [{item}] x{amount}을(를) 획득했습니다!',
            breakingThreshold: 10, // 10개 이상이면 속보
            marketImpact: {
                companies: ['HMT', 'CRM'],
                impact: 0.02
            }
        },
        
        // 보스 처치
        boss_first_kill: {
            category: 'BOSS_KILL',
            template: '🏆 {player}님이 최초로 [{boss}] 보스를 처치했습니다!',
            breaking: true,
            marketImpact: {
                sectors: ['entertainment', 'manufacturing'],
                impact: 0.04
            }
        },
        boss_solo_kill: {
            category: 'BOSS_KILL',
            template: '💪 {player}님이 단독으로 [{boss}] 보스를 처치했습니다!',
            breaking: true,
            marketImpact: {
                companies: ['ADI', 'STF'],
                impact: 0.03
            }
        },
        
        // 경제 활동
        huge_transaction: {
            category: 'ECONOMY',
            template: '💸 {player}님이 {amount}G의 대규모 거래를 성사시켰습니다!',
            breakingThreshold: 10000000, // 1000만G 이상 속보
            marketImpact: {
                sectors: ['finance'],
                impact: 0.02
            }
        },
        market_manipulation: {
            category: 'ECONOMY',
            template: '📊 {player}님의 대량 매수로 {item} 시세가 {change}% 급등했습니다!',
            breakingThreshold: 50, // 50% 이상 변동 시 속보
            marketImpact: {
                companies: ['GIS', 'HBK'],
                impact: 0.04
            }
        },
        
        // PVP 관련
        pvp_streak: {
            category: 'PVP',
            template: '🔥 {player}님이 PVP {streak}연승을 달성했습니다!',
            breakingThreshold: 10,
            marketImpact: {
                sectors: ['entertainment'],
                impact: 0.01
            }
        },
        pvp_upset: {
            category: 'PVP',
            template: '😱 {winner}님이 랭킹 {rank}위 {loser}님을 격파했습니다!',
            breaking: true,
            marketImpact: {
                companies: ['KHE', 'HBC'],
                impact: 0.02
            }
        },
        
        // 길드 관련
        guild_level_up: {
            category: 'GUILD',
            template: '🎊 [{guild}] 길드가 레벨 {level}을 달성했습니다!',
            breakingThreshold: 50,
            marketImpact: {
                companies: ['GDF'],
                impact: 0.03
            }
        },
        guild_war_result: {
            category: 'GUILD',
            template: '⚔️ [{winner}] 길드가 [{loser}] 길드를 상대로 승리했습니다!',
            breaking: false,
            marketImpact: {
                sectors: ['finance', 'entertainment'],
                impact: 0.02
            }
        },
        
        // 신기록
        speed_record: {
            category: 'RECORD',
            template: '⚡ {player}님이 [{dungeon}] 던전을 {time}에 클리어! (신기록)',
            breaking: true,
            marketImpact: {
                companies: ['PRT', 'ADL'],
                impact: 0.02
            }
        },
        level_record: {
            category: 'RECORD',
            template: '📈 {player}님이 서버 최초로 레벨 {level}을 달성했습니다!',
            breaking: true,
            marketImpact: {
                sectors: ['special'],
                impact: 0.03
            }
        },
        
        // 범죄/스캔들 뉴스
        corporate_scandal: {
            category: 'CRIME',
            template: '🚨 속보: {title}',
            breaking: true,
            marketImpact: {
                sectors: ['all'],
                impact: -0.05
            }
        },
        
        // 사건사고 뉴스
        emergency_news: {
            category: 'CRIME',
            template: '⚠️ 긴급: {title}',
            breaking: true,
            marketImpact: {
                sectors: ['all'],
                impact: -0.03
            }
        },
        
        // 엔터테인먼트 뉴스
        entertainment_news: {
            category: 'ENTERTAINMENT',
            template: '🎭 화제: {title}',
            breaking: false,
            marketImpact: {
                sectors: ['entertainment'],
                impact: 0.02
            }
        },
        
        // 일반 속보
        breaking_news: {
            category: 'SPECIAL',
            template: '📢 속보: {title}',
            breaking: true,
            marketImpact: null
        }
    };

    // 정기 뉴스 템플릿
    SCHEDULED_NEWS = {
        morning: {
            time: 9,
            title: '🌅 김헌터 월드 아침 뉴스',
            segments: [
                'weather_report',
                'morning_gossip',
                'recent_breaking_news',
                'market_opening',
                'daily_events'
            ]
        },
        evening: {
            time: 18,
            title: '🌆 김헌터 월드 저녁 뉴스',
            segments: [
                'top_stories',
                'fake_news',
                'market_report',
                'crime_report',
                'pvp_rankings'
            ]
        },
        night: {
            time: 22,
            title: '🌙 김헌터 월드 심야 뉴스',
            segments: [
                'fake_news',
                'late_breaking_news',
                'market_closing',
                'daily_summary',
                'late_night_tips'
            ]
        }
    };

    // 뉴스 생성
    createNews(type, data) {
        const template = this.NEWS_TEMPLATES[type];
        if (!template) return null;

        const news = {
            id: Date.now().toString(),
            type: type,
            category: data.category || template.category, // data.category가 있으면 우선 사용
            content: data.content || this.formatTemplate(template.template, data), // data.content가 있으면 우선 사용
            data: data,
            timestamp: new Date(),
            isBreaking: false,
            marketImpact: template.marketImpact
        };

        // 속보 판단
        if (template.breaking) {
            news.isBreaking = true;
        } else if (template.breakingThreshold) {
            const value = data.level || data.amount || data.streak || data.rank || data.change || 0;
            if (value >= template.breakingThreshold) {
                news.isBreaking = true;
            }
        }

        return news;
    }

    // 템플릿 포맷팅
    formatTemplate(template, data) {
        let result = template;
        for (const [key, value] of Object.entries(data)) {
            result = result.replace(`{${key}}`, value);
        }
        return result;
    }

    // 뉴스 추가
    addNews(type, data) {
        console.log(`📰 뉴스 추가 시도: 타입=${type}, 데이터=`, data);
        
        const news = this.createNews(type, data);
        if (!news) {
            console.log('❌ 뉴스 생성 실패');
            return null;
        }

        console.log(`✅ 뉴스 생성 성공: ${news.content}, 속보여부=${news.isBreaking}, 카테고리=${news.category}`);

        if (news.isBreaking) {
            this.breakingNews.push(news);
            this.publishBreakingNews(news);
        } else {
            this.newsQueue.push(news);
        }

        // 시장 영향 이벤트 발생
        if (news.marketImpact) {
            this.emit('marketImpact', news.marketImpact);
        }

        // 히스토리에 추가 (최대 100개)
        this.newsHistory.unshift(news);
        if (this.newsHistory.length > 100) {
            this.newsHistory.pop();
        }

        return news;
    }

    // 속보 발행
    async publishBreakingNews(news) {
        console.log(`📢 속보 발행 시도: ${news.content}`);
        console.log(`📰 뉴스 카테고리: ${news.category}`);
        console.log(`📰 뉴스 타입: ${news.type}`);
        console.log(`📰 뉴스 severity: ${news.severity}`);
        
        if (!this.client) {
            console.log('❌ 디스코드 클라이언트가 설정되지 않았습니다!');
            return;
        }
        
        if (this.newsChannels.size === 0) {
            console.log('⚠️ 설정된 뉴스 채널이 없습니다!');
            // 하드코딩된 채널 재추가
            const hardcodedChannelId = '1389401523418693723';
            this.newsChannels.add(hardcodedChannelId);
            console.log(`📰 하드코딩된 채널 재추가: ${hardcodedChannelId}`);
        }
        
        // 카테고리가 없으면 기본값 설정
        if (!news.category) {
            news.category = 'SPECIAL';
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`📢 속보! ${this.NEWS_CATEGORIES[news.category]?.emoji || '📰'} ${this.NEWS_CATEGORIES[news.category]?.name || '뉴스'}`)
            .setDescription(`**${news.content}**`)
            .setTimestamp()
            .setFooter({ text: '김헌터 월드 뉴스 속보' });

        // 모든 뉴스 채널에 발송
        for (const channelId of this.newsChannels) {
            try {
                console.log(`📤 채널 ${channelId}로 속보 발송 시도...`);
                const channel = await this.client.channels.fetch(channelId);
                if (channel) {
                    console.log(`✅ 채널 객체 획득: ${channel.name} (${channel.id})`);
                    await channel.send({ embeds: [embed] });
                    console.log(`✅ 채널 ${channelId}로 속보 발송 성공!`);
                } else {
                    console.log(`❌ 채널 ${channelId}를 찾을 수 없습니다`);
                }
            } catch (error) {
                console.error(`❌ 속보 발송 실패 (채널: ${channelId}):`, error.message);
                console.error(`에러 상세:`, error);
            }
        }

        // 속보 이벤트 발생
        this.emit('breakingNews', news);
    }

    // 정기 뉴스 생성
    async generateScheduledNews(type) {
        const schedule = this.SCHEDULED_NEWS[type];
        if (!schedule) return;

        const embeds = [];
        
        // 메인 타이틀
        const mainEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(schedule.title)
            .setDescription(`${new Date().toLocaleString('ko-KR')} 방송`)
            .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723795/news.png');

        embeds.push(mainEmbed);

        // 각 세그먼트 생성
        for (const segment of schedule.segments) {
            const segmentEmbed = await this.generateSegment(segment);
            if (segmentEmbed) {
                embeds.push(segmentEmbed);
            }
        }

        // 모든 뉴스 채널에 발송
        for (const channelId of this.newsChannels) {
            try {
                const channel = await this.client.channels.fetch(channelId);
                if (channel) {
                    for (const embed of embeds) {
                        await channel.send({ embeds: [embed] });
                    }
                }
            } catch (error) {
                console.error(`정기 뉴스 발송 실패 (채널: ${channelId}):`, error);
            }
        }
    }

    // 뉴스 세그먼트 생성
    async generateSegment(type) {
        const weatherSystem = require('./weatherSystem');
        const timeSystem = require('./timeSystem');
        const { getAllCompanies } = require('../data/companiesData');
        const fakeNewsGenerator = require('./fakeNewsGenerator');
        const User = require('../models/User');

        switch(type) {
            case 'weather_report':
                const weather = weatherSystem.getCurrentWeatherInfo();
                const forecast = weatherSystem.getForecast();
                
                return new EmbedBuilder()
                    .setColor('#87CEEB')
                    .setTitle('🌤️ 오늘의 날씨')
                    .setDescription(`현재 날씨: ${weather.emoji} **${weather.name}**\n${weather.description}`)
                    .addFields({
                        name: '📅 날씨 예보',
                        value: forecast.map((w, i) => `${i+1}시간 후: ${w.emoji} ${w.name}`).join('\n')
                    });

            case 'market_opening':
                const companies = getAllCompanies();
                const companiesWithChange = companies.map(company => ({
                    ...company,
                    changePercent: ((company.currentPrice / company.basePrice - 1) * 100)
                }));
                const topGainers = companiesWithChange
                    .sort((a, b) => b.changePercent - a.changePercent)
                    .slice(0, 3);
                
                return new EmbedBuilder()
                    .setColor('#4CAF50')
                    .setTitle('📈 시장 개장')
                    .setDescription('오늘의 주목할 기업들')
                    .addFields(
                        topGainers.map(company => ({
                            name: `${company.emoji} ${company.name}`,
                            value: `${formatNumber(company.currentPrice)}G (${company.changePercent > 0 ? '+' : ''}${company.changePercent.toFixed(2)}%)`,
                            inline: true
                        }))
                    );

            case 'top_stories':
                const recentNews = this.newsHistory.slice(0, 5);
                if (recentNews.length === 0) return null;
                
                return new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('📰 오늘의 주요 뉴스')
                    .setDescription(recentNews.map((news, i) => 
                        `${i+1}. ${this.NEWS_CATEGORIES[news.category].emoji} ${news.content}`
                    ).join('\n\n'));

            case 'daily_events':
                const period = timeSystem.getCurrentPeriodInfo();
                const activities = timeSystem.getRecommendedActivities();
                
                return new EmbedBuilder()
                    .setColor('#9C27B0')
                    .setTitle('🎯 오늘의 추천 활동')
                    .setDescription(`현재 시간대: ${period.emoji} **${period.name}**`)
                    .addFields({
                        name: '추천 활동',
                        value: activities.join('\n')
                    });

            case 'fake_news':
                // 활성 유저 가져오기 (최근 24시간 내 활동)
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const activeUsers = await User.find({
                    lastActive: { $gte: oneDayAgo },
                    registered: true
                }).limit(20);
                
                if (activeUsers.length < 3) return null;
                
                // 가짜 뉴스 생성
                const fakeNews = fakeNewsGenerator.generateMultipleFakeNews(activeUsers, 3);
                
                // 외부 뉴스도 가져와서 변환 (80% 확률)
                let externalGameNews = [];
                if (Math.random() < 0.8) {
                    const externalNewsAdapter = require('./externalNewsAdapter');
                    externalGameNews = await externalNewsAdapter.convertToGameNews(activeUsers);
                    externalGameNews = externalGameNews.slice(0, 3); // 최대 3개
                }
                
                // 모든 뉴스 합치기
                const allNews = [...fakeNews];
                externalGameNews.forEach(news => {
                    allNews.push({
                        content: news.content,
                        severity: 'external',
                        impact: news.impact
                    });
                });
                
                if (allNews.length === 0) return null;
                
                const newsText = allNews.map((news, i) => {
                    const emoji = news.severity === 'external' ? '🌐' : 
                                 fakeNewsGenerator.getSeverityEmoji(news.severity);
                    return `${i+1}. ${emoji} ${news.content}`;
                }).join('\n\n');
                
                // 시장 영향 적용
                allNews.forEach(news => {
                    if (news.impact) {
                        this.emit('marketImpact', news.impact);
                    }
                });
                
                return new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🗞️ 오늘의 화제')
                    .setDescription(newsText)
                    .setFooter({ text: '* 본 내용은 게임 내 가상 뉴스입니다' });

            case 'morning_gossip':
                // 아침 가십 뉴스
                const morningUsers = await User.find({
                    lastActive: { $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
                    registered: true
                }).limit(10);
                
                if (morningUsers.length < 2) return null;
                
                const gossipNews = fakeNewsGenerator.generateMultipleFakeNews(morningUsers, 3);
                const gossipText = gossipNews
                    .filter(n => ['gossip', 'scandal', 'controversy'].includes(n.severity))
                    .map((news, i) => `${fakeNewsGenerator.getSeverityEmoji(news.severity)} ${news.content}`)
                    .join('\n\n');
                
                if (!gossipText) return null;
                
                return new EmbedBuilder()
                    .setColor('#FFB6C1')
                    .setTitle('☕ 모닝 가십')
                    .setDescription(gossipText || '오늘은 조용한 아침입니다.')
                    .setFooter({ text: '김헌터 월드 타블로이드' });

            case 'market_report':
                const marketCompanies = getAllCompanies();
                // 변동률 계산 추가
                const marketData = marketCompanies.map(company => ({
                    ...company,
                    changePercent: ((company.currentPrice / company.basePrice - 1) * 100)
                }));
                
                // 상승/하락 기업 분류
                const gainers = marketData.filter(c => c.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
                const losers = marketData.filter(c => c.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);
                
                const marketEmbed = new EmbedBuilder()
                    .setColor('#00BCD4')
                    .setTitle('📊 오늘의 시장 동향')
                    .setDescription('주요 기업들의 가격 변동 현황');
                
                if (gainers.length > 0) {
                    marketEmbed.addFields({
                        name: '📈 상승 TOP 3',
                        value: gainers.map(c => 
                            `${c.emoji} **${c.name}**: ${formatNumber(c.currentPrice)}G (+${c.changePercent.toFixed(2)}%)`
                        ).join('\n'),
                        inline: true
                    });
                }
                
                if (losers.length > 0) {
                    marketEmbed.addFields({
                        name: '📉 하락 TOP 3',
                        value: losers.map(c => 
                            `${c.emoji} **${c.name}**: ${formatNumber(c.currentPrice)}G (${c.changePercent.toFixed(2)}%)`
                        ).join('\n'),
                        inline: true
                    });
                }
                
                return marketEmbed;

            case 'market_closing':
                const closingCompanies = getAllCompanies();
                // 변동률 계산 추가
                const closingData = closingCompanies.map(company => ({
                    ...company,
                    changePercent: ((company.currentPrice / company.basePrice - 1) * 100),
                    changeAmount: company.currentPrice - company.basePrice
                }));
                
                // 거래량 상위 (랜덤 생성)
                const volumeTop = closingData
                    .map(c => ({
                        ...c,
                        volume: Math.floor(Math.random() * 1000000) + 100000
                    }))
                    .sort((a, b) => b.volume - a.volume)
                    .slice(0, 5);
                
                return new EmbedBuilder()
                    .setColor('#607D8B')
                    .setTitle('🌙 시장 마감')
                    .setDescription('오늘의 시장 마감 현황')
                    .addFields(
                        {
                            name: '📊 거래량 TOP 5',
                            value: volumeTop.map(c => 
                                `${c.emoji} **${c.name}**: ${formatNumber(c.volume)}주 거래`
                            ).join('\n')
                        },
                        {
                            name: '💰 시가총액 변동',
                            value: `전체 시장: ${closingData.reduce((sum, c) => sum + c.changeAmount * c.shares, 0) > 0 ? '+' : ''}${formatNumber(closingData.reduce((sum, c) => sum + c.changeAmount * c.shares, 0))}G`
                        }
                    );

            case 'pvp_rankings':
                // 실제 PVP 데이터 가져오기
                const PVPStats = require('../models/PVPStats');
                const topPvpers = await PVPStats.find()
                    .sort({ rating: -1 })
                    .limit(5)
                    .populate('userId', 'nickname');
                
                if (topPvpers.length === 0) {
                    return null;
                }
                
                const rankingsText = topPvpers.map((player, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏆';
                    return `${medal} **${index + 1}. ${player.userId?.nickname || '알 수 없음'}** - ${player.rating}점 (${player.wins}승 ${player.losses}패)`;
                }).join('\n');
                
                // 오늘의 PVP 통계
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayMatches = await PVPStats.aggregate([
                    { $unwind: '$matchHistory' },
                    { $match: { 'matchHistory.date': { $gte: today } } },
                    { $count: 'total' }
                ]);
                const matchCount = todayMatches[0]?.total || 0;
                
                const pvpEmbed = new EmbedBuilder()
                    .setColor('#F44336')
                    .setTitle('⚔️ PVP 랭킹')
                    .setDescription(`오늘의 PVP 상위 랭커 (오늘 ${matchCount}경기 진행)`)
                    .addFields({
                        name: '🏆 TOP 5',
                        value: rankingsText
                    });
                
                // 특별한 전투가 있었다면 추가
                if (topPvpers[0] && topPvpers[0].matchHistory.length > 0) {
                    const latestMatch = topPvpers[0].matchHistory[topPvpers[0].matchHistory.length - 1];
                    if (latestMatch.ratingChange > 30) {
                        pvpEmbed.addFields({
                            name: '💥 화제의 경기',
                            value: `${topPvpers[0].userId?.nickname}님이 대역전승으로 ${latestMatch.ratingChange}점 획득!`
                        });
                    }
                }
                
                return pvpEmbed;

            case 'daily_summary':
                // 일일 요약
                const todayNews = this.newsHistory.filter(n => {
                    const newsDate = new Date(n.timestamp);
                    const today = new Date();
                    return newsDate.toDateString() === today.toDateString();
                });
                
                return new EmbedBuilder()
                    .setColor('#3F51B5')
                    .setTitle('📋 오늘의 뉴스 요약')
                    .setDescription(`오늘 총 ${todayNews.length}건의 뉴스가 발행되었습니다.`)
                    .addFields({
                        name: '카테고리별 통계',
                        value: Object.entries(this.NEWS_CATEGORIES).map(([key, cat]) => {
                            const count = todayNews.filter(n => n.category === key).length;
                            return `${cat.emoji} ${cat.name}: ${count}건`;
                        }).join('\n')
                    });

            case 'late_night_tips':
                // 심야 팁
                const tips = [
                    '💡 새벽 시간대에는 희귀 몬스터 출현 확률이 증가합니다!',
                    '💡 마나 폭풍이 올 때는 마법 아이템 강화 성공률이 상승합니다.',
                    '💡 길드원들과 함께 사냥하면 경험치 보너스를 받을 수 있습니다.',
                    '💡 주식 시장은 날씨와 시간대에 따라 변동합니다.',
                    '💡 오로라가 뜨는 날에는 예언자 길드 주식이 오를 가능성이 높습니다.'
                ];
                
                return new EmbedBuilder()
                    .setColor('#9C27B0')
                    .setTitle('🌙 심야 꿀팁')
                    .setDescription(tips[Math.floor(Math.random() * tips.length)])
                    .setFooter({ text: '김헌터 월드 가이드' });

            case 'recent_breaking_news':
                // 최근 속보 모음
                const recentBreaking = this.breakingNews.slice(-3);
                if (recentBreaking.length === 0) {
                    // 속보가 없으면 가짜 뉴스 생성
                    const breakingUsers = await User.find({
                        lastActive: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
                        registered: true
                    }).limit(10);
                    
                    if (breakingUsers.length < 2) return null;
                    
                    const urgentNews = fakeNewsGenerator.generateFakeNews(breakingUsers);
                    return new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('📢 긴급 속보')
                        .setDescription(`${fakeNewsGenerator.getSeverityEmoji(urgentNews.severity)} ${urgentNews.content}`)
                        .setFooter({ text: '김헌터 월드 속보' });
                }
                
                const breakingText = recentBreaking.map((news, i) => {
                    const category = this.NEWS_CATEGORIES[news.category] || { emoji: '📰' };
                    return `${category.emoji} ${news.content}`;
                }).join('\n\n');
                
                return new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('📢 최근 속보')
                    .setDescription(breakingText);

            case 'crime_report':
                // 범죄 뉴스 (가짜 뉴스 생성)
                const crimeUsers = await User.find({
                    lastActive: { $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
                    registered: true
                }).limit(15);
                
                if (crimeUsers.length < 3) return null;
                
                const crimeNews = fakeNewsGenerator.generateMultipleFakeNews(crimeUsers, 2)
                    .filter(n => ['crime', 'scandal', 'controversy'].includes(n.severity));
                
                if (crimeNews.length === 0) {
                    // 범죄 뉴스가 없으면 직접 생성
                    const player1 = crimeUsers[Math.floor(Math.random() * crimeUsers.length)];
                    const player2 = crimeUsers[Math.floor(Math.random() * crimeUsers.length)];
                    const crimes = [
                        `🚨 ${player1.nickname}님이 헌터은행 시스템 해킹 시도 혐의로 수사 중`,
                        `⚖️ ${player2.nickname}님, 길드 자금 횡령 혐의로 재판 회부`,
                        `🔍 ${player1.nickname}님이 운영하는 포션가게에서 불법 물약 제조 적발`,
                        `💰 ${player2.nickname}님, 주식 시세조작 혐의로 긴급 체포`
                    ];
                    
                    return new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('🚔 사건사고')
                        .setDescription(crimes[Math.floor(Math.random() * crimes.length)])
                        .setFooter({ text: '김헌터 월드 사건뉴스' });
                }
                
                const crimeText = crimeNews.map((news, i) => 
                    `${fakeNewsGenerator.getSeverityEmoji(news.severity)} ${news.content}`
                ).join('\n\n');
                
                // 범죄 뉴스로 인한 시장 영향
                crimeNews.forEach(news => {
                    if (news.impact) {
                        this.emit('marketImpact', news.impact);
                    }
                });
                
                return new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('🚔 사건사고')
                    .setDescription(crimeText)
                    .setFooter({ text: '김헌터 월드 사건뉴스' });

            case 'late_breaking_news':
                // 심야 속보 (더 자극적인 뉴스)
                const lateUsers = await User.find({
                    lastActive: { $gte: new Date(Date.now() - 3 * 60 * 60 * 1000) },
                    registered: true
                }).limit(10);
                
                if (lateUsers.length < 2) return null;
                
                const lateNews = fakeNewsGenerator.generateMultipleFakeNews(lateUsers, 2);
                const player = lateUsers[Math.floor(Math.random() * lateUsers.length)];
                
                // 심야 특별 뉴스 추가
                const specialNews = [
                    `🌙 ${player.nickname}님이 전설의 달빛 던전에서 신화급 아이템 획득!`,
                    `👻 ${player.nickname}님, 유령 상인과의 거래로 저주받은 아이템 구매`,
                    `🔮 예언자 길드가 ${player.nickname}님을 차세대 영웅으로 지목`,
                    `💎 ${player.nickname}님이 은밀히 진행한 10억G 규모의 보석 거래 포착`
                ];
                
                const allLateNews = [
                    ...lateNews.map(n => `${fakeNewsGenerator.getSeverityEmoji(n.severity)} ${n.content}`),
                    specialNews[Math.floor(Math.random() * specialNews.length)]
                ];
                
                return new EmbedBuilder()
                    .setColor('#4B0082')
                    .setTitle('🌃 심야 특보')
                    .setDescription(allLateNews.join('\n\n'))
                    .setFooter({ text: '김헌터 월드 심야뉴스' });

            default:
                return null;
        }
    }

    // 이 메서드는 아래의 더 완전한 start 메서드로 대체됨
    // 삭제 예정

    // 뉴스 채널 추가
    addNewsChannel(channelId) {
        this.newsChannels.add(channelId);
    }

    // 뉴스 채널 제거
    removeNewsChannel(channelId) {
        this.newsChannels.delete(channelId);
    }

    // 최근 뉴스 가져오기
    getRecentNews(count = 10) {
        return this.newsHistory.slice(0, count);
    }

    // 카테고리별 뉴스 가져오기
    getNewsByCategory(category, count = 10) {
        return this.newsHistory
            .filter(news => news.category === category)
            .slice(0, count);
    }

    // 시스템 시작
    async start(client) {
        console.log('📰 뉴스 시스템 초기화 시작...');
        
        if (this.isInitialized) {
            console.log('⚠️ 뉴스 시스템이 이미 초기화되어 있습니다.');
            return;
        }
        
        this.client = client;
        this.isInitialized = true;
        console.log('✅ Discord 클라이언트 설정 완료');
        
        // 저장된 뉴스 채널 설정 불러오기
        await this.loadSavedChannels();
        
        // 정기 뉴스 스케줄러 시작
        this.startScheduler();
        console.log('✅ 정기 뉴스 스케줄러 시작 (9시, 18시, 22시)');
        
        // 랜덤 가짜 뉴스 생성기 시작
        this.startFakeNewsGenerator();
        
        console.log('📰 뉴스 시스템 시작 완료!');
        console.log(`📰 현재 설정된 뉴스 채널 수: ${this.newsChannels.size}`);
        if (this.newsChannels.size > 0) {
            console.log(`📰 뉴스 채널 ID들: ${Array.from(this.newsChannels).join(', ')}`);
        } else {
            console.log('⚠️ 설정된 뉴스 채널이 없습니다!');
        }
    }
    
    // 저장된 뉴스 채널 불러오기
    async loadSavedChannels() {
        try {
            // 하드코딩된 뉴스 채널 먼저 추가
            const hardcodedChannelId = '1389401523418693723';
            this.newsChannels.add(hardcodedChannelId);
            console.log(`📰 하드코딩된 뉴스 채널 추가: ${hardcodedChannelId}`);
            
            const ServerSettings = require('../models/ServerSettings');
            const settings = await ServerSettings.find({ newsChannelId: { $ne: null } });
            
            for (const setting of settings) {
                this.newsChannels.add(setting.newsChannelId);
                console.log(`📰 뉴스 채널 복원: ${setting.newsChannelId} (서버: ${setting.guildId})`);
            }
            
            if (this.newsChannels.size > 0) {
                console.log(`📰 총 ${this.newsChannels.size}개의 뉴스 채널이 복원되었습니다.`);
            }
        } catch (error) {
            console.error('뉴스 채널 설정 불러오기 오류:', error);
            // 오류가 발생해도 하드코딩된 채널은 유지
            const hardcodedChannelId = '1389401523418693723';
            this.newsChannels.add(hardcodedChannelId);
            console.log(`📰 오류 발생 후 하드코딩된 채널 재추가: ${hardcodedChannelId}`);
        }
    }

    // 정기 뉴스 스케줄러
    startScheduler() {
        // 매분마다 체크 (정확한 시간에 발송하기 위해)
        this.scheduleInterval = setInterval(() => {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            
            // 정각에만 실행
            if (minute === 0) {
                if (hour === 9) {
                    this.generateScheduledNews('morning');
                } else if (hour === 18) {
                    this.generateScheduledNews('evening');
                } else if (hour === 22) {
                    this.generateScheduledNews('night');
                }
            }
        }, 60000); // 1분마다
    }

    // 랜덤 가짜 뉴스 생성기
    startFakeNewsGenerator() {
        console.log('🎭 가짜 뉴스 생성기 시작...');
        
        // 1시간마다 가짜 뉴스 생성
        const generateRandomFakeNews = async () => {
            console.log(`🔄 가짜 뉴스 생성 시도... (뉴스 채널 수: ${this.newsChannels.size})`);
            if (this.newsChannels.size === 0) {
                console.log('⚠️ 뉴스 채널이 설정되지 않아 가짜 뉴스 생성을 건너뜁니다.');
                return;
            }
            
            try {
                const User = require('../models/User');
                const fakeNewsGenerator = require('./fakeNewsGenerator');
                const externalNewsAdapter = require('./externalNewsAdapter');
                
                // 최근 활동 유저 가져오기
                const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
                console.log(`🔍 ${threeHoursAgo.toISOString()} 이후 활동한 유저 검색 중...`);
                
                const activeUsers = await User.find({
                    lastActive: { $gte: threeHoursAgo },
                    registered: true
                }).limit(20);
                
                console.log(`✅ 활성 유저 ${activeUsers.length}명 발견`);
                
                if (activeUsers.length < 1) {
                    console.log(`⚠️ 활성 유저가 부족합니다 (현재: ${activeUsers.length}명, 필요: 1명 이상)`);
                    return;
                }
                
                // 각 카테고리별로 정확히 1개씩 뉴스 생성
                const newsToSend = [];
                
                // 1. 시장/경제 뉴스 (FINANCE 또는 BUSINESS 카테고리)
                const marketNews = fakeNewsGenerator.generateFakeNews(
                    activeUsers, 
                    ['FINANCE', 'BUSINESS']
                );
                if (marketNews) {
                    console.log(`💰 시장 뉴스 생성: ${marketNews.content}`);
                    newsToSend.push(marketNews);
                }
                
                // 2. 연애/스캔들 뉴스 (ENTERTAINMENT 카테고리)
                const entertainmentNews = fakeNewsGenerator.generateFakeNews(
                    activeUsers,
                    ['ENTERTAINMENT']
                );
                if (entertainmentNews) {
                    console.log(`🎭 연예 뉴스 생성: ${entertainmentNews.content}`);
                    newsToSend.push(entertainmentNews);
                }
                
                // 3. 사건사고 뉴스 (CRIME 카테고리)
                const crimeNews = fakeNewsGenerator.generateFakeNews(
                    activeUsers,
                    ['CRIME']
                );
                if (crimeNews) {
                    console.log(`🚨 사건 뉴스 생성: ${crimeNews.content}`);
                    newsToSend.push(crimeNews);
                }
                
                // 외부 뉴스 추가 (각 카테고리 1개씩 시도)
                try {
                    const externalGameNews = await externalNewsAdapter.convertToGameNews(activeUsers);
                    if (externalGameNews.length > 0) {
                        // 경제 뉴스가 없으면 외부에서 추가
                        if (newsToSend.filter(n => ['business', 'economy'].includes(n.severity)).length === 0) {
                            const economyNews = externalGameNews.find(n => n.category === 'ECONOMY');
                            if (economyNews) {
                                newsToSend.push({
                                    content: economyNews.content,
                                    severity: 'business',
                                    impact: economyNews.impact,
                                    company: economyNews.company,
                                    companyId: economyNews.companyId
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error('외부 뉴스 가져오기 실패:', error);
                }
                
                // 각 뉴스를 속보로 발송 (5초 간격)
                for (let i = 0; i < newsToSend.length; i++) {
                    const news = newsToSend[i];
                    
                    // 5초 지연
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                    
                    const breakingNews = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
                        type: news.severity === 'external' ? 'external_news' : 'fake_news',
                        category: this.getCategoryBySeverity(news.severity),
                        content: news.content,
                        timestamp: new Date(),
                        isBreaking: true,
                        marketImpact: news.impact
                    };
                    
                    this.breakingNews.push(breakingNews);
                    this.newsHistory.unshift(breakingNews);
                    
                    // 속보 발송
                    await this.publishBreakingNews(breakingNews);
                    
                    // 시장 영향
                    if (news.impact) {
                        this.emit('marketImpact', news.impact);
                    }
                }
            } catch (error) {
                console.error('가짜 뉴스 생성 오류:', error);
            }
            
            // 다음 생성 시간 설정 (정확히 1시간 후)
            const nextDelay = 60 * 60 * 1000; // 1시간
            this.fakeNewsTimeout = setTimeout(generateRandomFakeNews, nextDelay);
        };
        
        // 즉시 한번 실행 (내부에서 재귀적으로 setTimeout 호출함)
        generateRandomFakeNews();
    }

    // 클라이언트 설정
    setClient(client) {
        this.client = client;
        console.log('📰 뉴스 시스템 클라이언트 설정 완료');
    }

    // 심각도로 카테고리 결정
    getCategoryBySeverity(severity) {
        const severityMap = {
            'scandal': 'ENTERTAINMENT',  // 스캔들 → 연예
            'crime': 'CRIME',            // 범죄 → 사건사고
            'gossip': 'ENTERTAINMENT',   // 가십 → 연예
            'controversy': 'SPECIAL',     // 논란 → 특별
            'business': 'FINANCE',       // 비즈니스 → 경제
            'sports': 'PVP',            // 스포츠 → PVP
            'heartwarming': 'GUILD',     // 훈훈한 → 길드
            'economy': 'FINANCE',        // 경제 → 경제
            'celebration': 'GUILD',      // 축하 → 길드
            'external': 'MARKET',        // 외부 뉴스 → 시장
            'finance': 'FINANCE',        // 금융 → 경제
            'market': 'MARKET'           // 시장 → 시장
        };
        return severityMap[severity] || 'SPECIAL';
    }

    // 시스템 종료
    stop() {
        if (this.scheduleInterval) {
            clearInterval(this.scheduleInterval);
            this.scheduleInterval = null;
        }
        
        if (this.fakeNewsTimeout) {
            clearTimeout(this.fakeNewsTimeout);
            this.fakeNewsTimeout = null;
        }
        
        this.isInitialized = false;
        console.log('📰 뉴스 시스템 종료됨');
    }
}

// 싱글톤 인스턴스
const newsSystem = new NewsSystem();

module.exports = newsSystem;