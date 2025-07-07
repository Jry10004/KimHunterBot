// 차트 이미지 생성 서비스

// 실제 차트 서비스 URL 생성 (무료 서비스 활용)
const CHART_SERVICES = {
    // QuickChart.io - 무료 차트 생성 서비스
    quickchart: {
        baseUrl: 'https://quickchart.io/chart',
        createChartUrl: (data) => {
            const chartConfig = {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: data.name,
                        data: data.prices,
                        borderColor: data.trend > 0 ? '#26a69a' : '#ef5350',
                        backgroundColor: data.trend > 0 ? 'rgba(38, 166, 154, 0.1)' : 'rgba(239, 83, 80, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: `${data.name || '종목'} (${data.symbol || 'ITEM'})`,
                            color: '#ffffff',
                            font: {
                                size: 16
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#ffffff'
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#ffffff',
                                callback: function(value) {
                                    return value.toLocaleString() + 'G';
                                }
                            }
                        }
                    },
                    backgroundColor: '#1e1e1e'
                }
            };

            // 직접 URL 형식 사용 (더 짧음)
            const prices = data.prices.slice(-7).map(p => {
                if (p === undefined || p === null || isNaN(p)) {
                    return 100000;
                }
                return Math.floor(p);
            });
            const labels = [1,2,3,4,5,6,7];
            const color = data.trend > 0 ? '38,166,154' : '239,83,80';
            
            return `https://quickchart.io/chart?c={type:'line',data:{labels:[${labels}],datasets:[{data:[${prices.join(',')}],borderColor:'rgb(${color})'}]}}`;
        }
    },

    // TradingView 미니 위젯 (embed 형식)
    tradingview: {
        createMiniWidget: (symbol) => {
            // TradingView는 embed로만 사용 가능하므로 이미지 URL 대신 설명 제공
            return `https://www.tradingview.com/widgetembed/?symbol=${symbol}&interval=5&theme=dark`;
        }
    },

    // 캔들스틱 차트 (QuickChart)
    candlestick: {
        baseUrl: 'https://quickchart.io/chart',
        createChartUrl: (data) => {
            const chartConfig = {
                type: 'candlestick',
                data: {
                    datasets: [{
                        label: data.name,
                        data: data.candles.map(c => ({
                            x: c.time,
                            o: c.open,
                            h: c.high,
                            l: c.low,
                            c: c.close
                        }))
                    }]
                },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: `${data.name} - 5분봉 차트`,
                            color: '#ffffff',
                            font: { size: 16 }
                        },
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#ffffff' }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { 
                                color: '#ffffff',
                                callback: (value) => value.toLocaleString() + 'G'
                            }
                        }
                    }
                }
            };

            // URL 길이 최적화
            const simplifiedConfig = {
                type: 'line',
                data: {
                    labels: ['1', '2', '3', '4', '5', '6', '7'],
                    datasets: [{
                        data: data.candles.slice(-7).map(c => c.close),
                        borderColor: '#26a69a',
                        fill: false
                    }]
                }
            };
            return `${CHART_SERVICES.candlestick.baseUrl}?c=${encodeURIComponent(JSON.stringify(simplifiedConfig))}`;
        }
    }
};

// 실시간 차트 데이터 생성
function generateChartData(itemId, itemName, symbol, currentPrice, history) {
    const labels = [];
    const prices = [];
    const now = Date.now();
    
    // 최근 10개 데이터포인트 (URL 길이 최적화)
    for (let i = 9; i >= 0; i--) {
        const time = new Date(now - i * 60000); // 1분 간격
        // 시간:분 형식으로 표시
        const hours = time.getHours().toString().padStart(2, '0');
        const minutes = time.getMinutes().toString().padStart(2, '0');
        labels.push(`${hours}:${minutes}`);
        
        if (history && history[9 - i]) {
            prices.push(history[9 - i].price);
        } else {
            // 랜덤 가격 생성 (실시간 같은 효과)
            const variation = (Math.random() - 0.5) * 0.02; // ±2% 변동
            prices.push(Math.floor(currentPrice * (1 + variation)));
        }
    }
    
    const trend = prices[prices.length - 1] - prices[0];
    
    return {
        name: itemName || '알 수 없는 종목',
        symbol: symbol || 'UNKNOWN',
        labels: labels,
        prices: prices,
        trend: trend
    };
}

// 캔들스틱 데이터 생성
function generateCandleData(itemName, basePrice) {
    const candles = [];
    const now = Date.now();
    
    let lastClose = basePrice;
    
    for (let i = 19; i >= 0; i--) {
        const time = new Date(now - i * 300000); // 5분 간격
        const open = lastClose;
        const change = (Math.random() - 0.5) * 0.03; // ±3% 변동
        const close = Math.floor(open * (1 + change));
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        
        candles.push({
            time: time.toISOString(),
            open: open,
            high: Math.floor(high),
            low: Math.floor(low),
            close: close
        });
        
        lastClose = close;
    }
    
    return {
        name: itemName || '알 수 없는 종목',
        candles: candles
    };
}

// 차트 URL 생성 함수
function getChartImageUrl(itemId, itemName, symbol, currentPrice, history, chartType = 'line') {
    if (chartType === 'candlestick') {
        const candleData = generateCandleData(itemName, currentPrice);
        return CHART_SERVICES.candlestick.createChartUrl(candleData);
    } else {
        const chartData = generateChartData(itemId, itemName, symbol, currentPrice, history);
        return CHART_SERVICES.quickchart.createChartUrl(chartData);
    }
}

// 미리 생성된 GIF 차트 URL들 (예시)
const ANIMATED_CHARTS = {
    uptrend: 'https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723780/chart_uptrend.gif',
    downtrend: 'https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723781/chart_downtrend.gif',
    volatile: 'https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723782/chart_volatile.gif',
    stable: 'https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723783/chart_stable.gif'
};

// 시장 상황에 따른 애니메이션 차트 선택
function getAnimatedChartUrl(trend, volatility) {
    if (volatility > 50) {
        return ANIMATED_CHARTS.volatile;
    } else if (trend > 30) {
        return ANIMATED_CHARTS.uptrend;
    } else if (trend < -30) {
        return ANIMATED_CHARTS.downtrend;
    } else {
        return ANIMATED_CHARTS.stable;
    }
}

module.exports = {
    CHART_SERVICES,
    generateChartData,
    generateCandleData,
    getChartImageUrl,
    getAnimatedChartUrl,
    ANIMATED_CHARTS
};