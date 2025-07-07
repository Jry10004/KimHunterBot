// 차트 API 시스템 (Alpha Vantage 스타일)

// 실제 주식 심볼을 게임 아이템에 매핑
const ITEM_TO_STOCK_MAPPING = {
    // 일반 재료
    'slime_jelly': { symbol: 'AAPL', name: '슬라임 젤리' },
    'rabbit_foot': { symbol: 'GOOGL', name: '토끼발' },
    'mushroom_spore': { symbol: 'MSFT', name: '버섯 포자' },
    'butterfly_dust': { symbol: 'AMZN', name: '나비 가루' },
    'wool_ball': { symbol: 'TSLA', name: '양털 뭉치' },
    
    // 희귀 재료
    'rainbow_flower': { symbol: 'META', name: '무지개 꽃잎' },
    'frog_tongue': { symbol: 'NVDA', name: '개구리 혓바닥' },
    'crystal_shard': { symbol: 'BTC-USD', name: '크리스탈 조각' },
    'dragon_scale': { symbol: 'ETH-USD', name: '용의 비늘' },
    'unicorn_hair': { symbol: 'GOLD', name: '유니콘 갈기' },
    
    // 변이 드롭
    'blazing_essence': { symbol: 'SPY', name: '불꽃 정수' },
    'frozen_crystal': { symbol: 'QQQ', name: '얼음 결정' },
    'venom_sac': { symbol: 'DIA', name: '맹독 주머니' },
    'thunder_core': { symbol: 'VTI', name: '천둥 핵' },
    'shadow_fragment': { symbol: 'GLD', name: '그림자 파편' },
    'holy_orb': { symbol: 'SLV', name: '성스러운 구슬' }
};

// 모의 API 응답 생성기 (실제 API 키가 없을 때 사용)
function generateMockData(symbol, interval = '1min') {
    const now = Date.now();
    const basePrice = Math.random() * 10000 + 1000;
    const data = {};
    
    // 시간대별 데이터 생성
    const intervals = interval === '1min' ? 60 : interval === '5min' ? 12 : 24;
    const timeStep = interval === '1min' ? 60000 : interval === '5min' ? 300000 : 3600000;
    
    for (let i = 0; i < intervals; i++) {
        const timestamp = new Date(now - (intervals - i) * timeStep);
        const timeKey = timestamp.toISOString().slice(0, 16).replace('T', ' ');
        
        const volatility = 0.02;
        const open = basePrice * (1 + (Math.random() - 0.5) * volatility);
        const close = open * (1 + (Math.random() - 0.5) * volatility);
        const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
        const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
        
        data[timeKey] = {
            '1. open': open.toFixed(2),
            '2. high': high.toFixed(2),
            '3. low': low.toFixed(2),
            '4. close': close.toFixed(2),
            '5. volume': Math.floor(Math.random() * 1000000)
        };
    }
    
    return {
        'Meta Data': {
            '1. Information': `Intraday (${interval}) open, high, low, close prices and volume`,
            '2. Symbol': symbol,
            '3. Last Refreshed': new Date().toISOString(),
            '4. Interval': interval,
            '5. Output Size': 'Compact',
            '6. Time Zone': 'US/Eastern'
        },
        [`Time Series (${interval})`]: data
    };
}

// 기술적 지표 계산
function calculateTechnicalIndicators(priceData) {
    const prices = Object.values(priceData).map(p => parseFloat(p['4. close']));
    
    // 이동평균선 (MA)
    const ma5 = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const ma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, prices.length);
    
    // RSI 계산 (간단한 버전)
    let gains = 0, losses = 0;
    for (let i = 1; i < Math.min(14, prices.length); i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgGain / (avgLoss || 1);
    const rsi = 100 - (100 / (1 + rs));
    
    // MACD
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // 볼린저 밴드
    const sma20 = ma20;
    const stdDev = calculateStdDev(prices.slice(-20), sma20);
    const upperBand = sma20 + (stdDev * 2);
    const lowerBand = sma20 - (stdDev * 2);
    
    return {
        ma5: ma5.toFixed(2),
        ma20: ma20.toFixed(2),
        rsi: rsi.toFixed(2),
        macd: macd.toFixed(2),
        bollingerBands: {
            upper: upperBand.toFixed(2),
            middle: sma20.toFixed(2),
            lower: lowerBand.toFixed(2)
        }
    };
}

// EMA 계산
function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
        ema = (prices[i] * k) + (ema * (1 - k));
    }
    
    return ema;
}

// 표준편차 계산
function calculateStdDev(prices, mean) {
    const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
    return Math.sqrt(avgSquaredDiff);
}

// 차트 생성 (ASCII 아트)
function generateAsciiChart(priceData, width = 50, height = 20) {
    const prices = Object.entries(priceData)
        .slice(-width)
        .map(([time, data]) => ({
            time: time.slice(11, 16),
            open: parseFloat(data['1. open']),
            high: parseFloat(data['2. high']),
            low: parseFloat(data['3. low']),
            close: parseFloat(data['4. close']),
            volume: parseInt(data['5. volume'])
        }));
    
    if (prices.length === 0) return 'No data available';
    
    const maxPrice = Math.max(...prices.map(p => p.high));
    const minPrice = Math.min(...prices.map(p => p.low));
    const priceRange = maxPrice - minPrice;
    
    // 차트 그리드 생성
    const chart = Array(height).fill(null).map(() => Array(width).fill(' '));
    
    // 가격 데이터 플롯
    prices.forEach((price, x) => {
        if (x >= width) return;
        
        // 캔들스틱 그리기
        const openY = Math.floor((1 - (price.open - minPrice) / priceRange) * (height - 1));
        const closeY = Math.floor((1 - (price.close - minPrice) / priceRange) * (height - 1));
        const highY = Math.floor((1 - (price.high - minPrice) / priceRange) * (height - 1));
        const lowY = Math.floor((1 - (price.low - minPrice) / priceRange) * (height - 1));
        
        // 심지 그리기
        for (let y = highY; y <= lowY; y++) {
            if (y >= 0 && y < height) {
                chart[y][x] = '│';
            }
        }
        
        // 몸통 그리기
        const bodyTop = Math.min(openY, closeY);
        const bodyBottom = Math.max(openY, closeY);
        const isGreen = price.close > price.open;
        
        for (let y = bodyTop; y <= bodyBottom; y++) {
            if (y >= 0 && y < height) {
                chart[y][x] = isGreen ? '█' : '░';
            }
        }
    });
    
    // 차트를 문자열로 변환
    let result = '';
    
    // Y축 레이블
    for (let y = 0; y < height; y++) {
        const price = maxPrice - (y / (height - 1)) * priceRange;
        result += `${price.toFixed(0).padStart(6)} │`;
        result += chart[y].join('');
        result += '\n';
    }
    
    // X축
    result += '       └' + '─'.repeat(width) + '\n';
    result += '        ';
    
    // 시간 레이블 (처음, 중간, 끝)
    if (prices.length > 0) {
        result += prices[0].time.padEnd(Math.floor(width / 2) - 2);
        result += prices[Math.floor(prices.length / 2)].time.padEnd(Math.floor(width / 2) - 3);
        result += prices[prices.length - 1].time;
    }
    
    return result;
}

// 마켓 뎁스 차트 (호가창)
function generateMarketDepth(symbol) {
    const spread = 0.001; // 0.1% 스프레드
    const currentPrice = Math.random() * 10000 + 1000;
    
    const bids = [];
    const asks = [];
    
    // 매수 호가
    for (let i = 0; i < 10; i++) {
        const price = currentPrice * (1 - spread * (i + 1));
        const volume = Math.floor(Math.random() * 1000 * (10 - i));
        bids.push({ price: price.toFixed(2), volume });
    }
    
    // 매도 호가
    for (let i = 0; i < 10; i++) {
        const price = currentPrice * (1 + spread * (i + 1));
        const volume = Math.floor(Math.random() * 1000 * (10 - i));
        asks.push({ price: price.toFixed(2), volume });
    }
    
    return { bids, asks, currentPrice: currentPrice.toFixed(2) };
}

// 실시간 시세 스트림 시뮬레이션
class PriceStream {
    constructor(symbol) {
        this.symbol = symbol;
        this.basePrice = Math.random() * 10000 + 1000;
        this.subscribers = [];
    }
    
    subscribe(callback) {
        this.subscribers.push(callback);
    }
    
    start() {
        setInterval(() => {
            const change = (Math.random() - 0.5) * 0.002; // 0.2% 변동
            this.basePrice *= (1 + change);
            
            const tick = {
                symbol: this.symbol,
                price: this.basePrice.toFixed(2),
                volume: Math.floor(Math.random() * 10000),
                timestamp: new Date().toISOString(),
                change: (change * 100).toFixed(2)
            };
            
            this.subscribers.forEach(cb => cb(tick));
        }, 1000);
    }
}

// TradingView 스타일 차트 데이터 포맷
function formatTradingViewData(itemId) {
    const mapping = ITEM_TO_STOCK_MAPPING[itemId];
    if (!mapping) return null;
    
    const data = generateMockData(mapping.symbol, '5min');
    const timeSeries = data['Time Series (5min)'];
    const indicators = calculateTechnicalIndicators(timeSeries);
    
    // 최신 가격
    const latestTime = Object.keys(timeSeries)[0];
    const latestData = timeSeries[latestTime];
    const currentPrice = parseFloat(latestData['4. close']);
    const prevClose = parseFloat(Object.values(timeSeries)[1]['4. close']);
    const change = currentPrice - prevClose;
    const changePercent = (change / prevClose) * 100;
    
    return {
        symbol: mapping.symbol,
        name: mapping.name,
        currentPrice: currentPrice.toFixed(2),
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(2),
        high: parseFloat(latestData['2. high']).toFixed(2),
        low: parseFloat(latestData['3. low']).toFixed(2),
        volume: parseInt(latestData['5. volume']).toLocaleString(),
        indicators,
        chart: generateAsciiChart(timeSeries, 40, 15),
        marketDepth: generateMarketDepth(mapping.symbol),
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    ITEM_TO_STOCK_MAPPING,
    generateMockData,
    calculateTechnicalIndicators,
    generateAsciiChart,
    generateMarketDepth,
    PriceStream,
    formatTradingViewData
};