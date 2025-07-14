// 차트 이미지 생성 서비스

// 실제 차트 서비스 URL 생성 (무료 서비스 활용)
const CHART_SERVICES = {
    // QuickChart.io - 무료 차트 생성 서비스
    quickchart: {
        baseUrl: 'https://quickchart.io/chart',
        createChartUrl: (data) => {
            // 더 전문적인 차트 설정
            // 캔들스틱 데이터 생성
            const candleData = [];
            for (let i = 0; i < data.prices.length; i++) {
                const open = i === 0 ? data.prices[i] : data.prices[i-1];
                const close = data.prices[i];
                const high = Math.max(open, close) * (1 + Math.random() * 0.02);
                const low = Math.min(open, close) * (1 - Math.random() * 0.02);
                
                candleData.push({
                    x: data.labels[i],
                    o: open,
                    h: high,
                    l: low,
                    c: close
                });
            }
            
            const chartConfig = {
                type: 'candlestick',
                data: {
                    datasets: [{
                        label: data.name,
                        data: candleData
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                color: '#ffffff',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: `${data.name || '종목'} (${data.symbol || 'ITEM'})`,
                            color: '#ffffff',
                            font: {
                                size: 18,
                                weight: 'bold'
                            },
                            padding: 20
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: '#ddd',
                            borderWidth: 1,
                            cornerRadius: 4,
                            displayColors: true
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawBorder: true,
                                borderColor: 'rgba(255, 255, 255, 0.2)'
                            },
                            ticks: {
                                color: '#ffffff',
                                font: {
                                    size: 12
                                },
                                maxRotation: 45,
                                minRotation: 45
                            },
                            title: {
                                display: true,
                                text: '시간',
                                color: '#ffffff',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                drawBorder: true,
                                borderColor: 'rgba(255, 255, 255, 0.2)'
                            },
                            ticks: {
                                color: '#ffffff',
                                font: {
                                    size: 12
                                },
                                callback: function(value) {
                                    return value.toLocaleString() + 'G';
                                }
                            },
                            title: {
                                display: true,
                                text: '가격 (골드)',
                                color: '#ffffff',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            }
                        }
                    },
                    layout: {
                        padding: {
                            left: 10,
                            right: 10,
                            top: 10,
                            bottom: 10
                        }
                    },
                    backgroundColor: '#1e1e1e'
                }
            };

            // 전체 설정을 URL로 인코딩
            const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
            
            // URL이 너무 길면 간단한 버전 사용
            if (encodedConfig.length > 2000) {
                // 간소화된 버전
                const prices = data.prices.slice(-20).map(p => {
                    if (p === undefined || p === null || isNaN(p)) {
                        return 100000;
                    }
                    return Math.floor(p);
                });
                const labels = data.labels.slice(-20).map(label => `'${label}'`);
                const color = data.trend > 0 ? '38,166,154' : '239,83,80';
                const bgColor = data.trend > 0 ? '38,166,154,0.1' : '239,83,80,0.1';
                
                return `https://quickchart.io/chart?w=800&h=400&bkg=rgb(30,30,30)&c={type:'line',data:{labels:[${labels.join(',')}],datasets:[{label:'${data.name}',data:[${prices.join(',')}],borderColor:'rgb(${color})',backgroundColor:'rgba(${bgColor})',borderWidth:3,pointRadius:4,tension:0.4,fill:true}]},options:{plugins:{title:{display:true,text:'${data.name}',color:'white',font:{size:16}}},scales:{x:{ticks:{color:'white'}},y:{ticks:{color:'white'}}}}}`;
            }
            
            return `${this.baseUrl}?w=800&h=400&c=${encodedConfig}`;
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

// 실시간 차트 데이터 생성 (개선된 버전)
function generateChartData(itemId, itemName, symbol, currentPrice, history, chartPoints = 20) {
    const labels = [];
    const prices = [];
    const now = Date.now();
    
    // 히스토리가 있으면 실제 데이터 사용
    if (history && history.length > 0) {
        // 최근 chartPoints개의 데이터 사용
        const recentHistory = history.slice(-chartPoints);
        
        recentHistory.forEach(point => {
            const time = new Date(point.timestamp || now);
            // 날짜와 시간 형식으로 표시
            const month = (time.getMonth() + 1).toString().padStart(2, '0');
            const day = time.getDate().toString().padStart(2, '0');
            const hours = time.getHours().toString().padStart(2, '0');
            const minutes = time.getMinutes().toString().padStart(2, '0');
            
            // 오늘이면 시간만, 아니면 날짜도 표시
            const today = new Date();
            if (time.toDateString() === today.toDateString()) {
                labels.push(`${hours}:${minutes}`);
            } else {
                labels.push(`${month}/${day} ${hours}:${minutes}`);
            }
            
            prices.push(point.price || currentPrice);
        });
        
        // 부족한 데이터 채우기
        while (prices.length < chartPoints) {
            const lastPrice = prices.length > 0 ? prices[prices.length - 1] : currentPrice;
            const variation = (Math.random() - 0.5) * 0.02; // ±2% 변동
            prices.push(Math.floor(lastPrice * (1 + variation)));
            
            const time = new Date(now - (chartPoints - prices.length) * 60000);
            const hours = time.getHours().toString().padStart(2, '0');
            const minutes = time.getMinutes().toString().padStart(2, '0');
            labels.push(`${hours}:${minutes}`);
        }
    } else {
        // 히스토리가 없으면 시뮬레이션 데이터 생성
        let simulatedPrice = currentPrice;
        const volatility = 0.03; // 3% 변동성
        
        for (let i = chartPoints - 1; i >= 0; i--) {
            const time = new Date(now - i * 60000); // 1분 간격
            const hours = time.getHours().toString().padStart(2, '0');
            const minutes = time.getMinutes().toString().padStart(2, '0');
            labels.push(`${hours}:${minutes}`);
            
            // 트렌드가 있는 랜덤 워크
            const trendDirection = Math.random() > 0.5 ? 1 : -1;
            const change = (Math.random() * volatility) * trendDirection;
            simulatedPrice = Math.max(1, Math.floor(simulatedPrice * (1 + change)));
            prices.push(simulatedPrice);
        }
    }
    
    const trend = prices[prices.length - 1] - prices[0];
    const trendPercent = ((trend / prices[0]) * 100).toFixed(2);
    
    return {
        name: itemName || '알 수 없는 종목',
        symbol: symbol || 'UNKNOWN',
        labels: labels,
        prices: prices,
        trend: trend,
        trendPercent: trendPercent,
        min: Math.min(...prices),
        max: Math.max(...prices),
        current: prices[prices.length - 1]
    };
}

// 캔들스틱 데이터 생성 (개선된 버전)
function generateCandleData(itemName, basePrice, history) {
    const candles = [];
    const now = Date.now();
    
    if (history && history.length >= 4) {
        // 실제 히스토리에서 캔들 데이터 생성
        for (let i = 0; i < history.length - 3; i += 4) {
            const candlePrices = history.slice(i, i + 4).map(h => h.price);
            const open = candlePrices[0];
            const close = candlePrices[3];
            const high = Math.max(...candlePrices);
            const low = Math.min(...candlePrices);
            const time = new Date(history[i].timestamp);
            
            candles.push({
                time: time.toISOString(),
                open: open,
                high: high,
                low: low,
                close: close,
                volume: history.slice(i, i + 4).reduce((sum, h) => sum + (h.volume || 0), 0)
            });
        }
    } else {
        // 시뮬레이션 데이터 생성
        let lastClose = basePrice;
        let trend = Math.random() > 0.5 ? 1 : -1; // 전체적인 트렌드 방향
        
        for (let i = 19; i >= 0; i--) {
            const time = new Date(now - i * 300000); // 5분 간격
            const open = lastClose;
            
            // 트렌드를 반영한 변동
            const trendEffect = trend * Math.random() * 0.02;
            const randomEffect = (Math.random() - 0.5) * 0.02;
            const change = trendEffect + randomEffect;
            
            const close = Math.floor(open * (1 + change));
            const high = Math.max(open, close) * (1 + Math.random() * 0.015);
            const low = Math.min(open, close) * (1 - Math.random() * 0.015);
            const volume = Math.floor(Math.random() * 10000 + 1000);
            
            candles.push({
                time: time.toISOString(),
                open: open,
                high: Math.floor(high),
                low: Math.floor(low),
                close: close,
                volume: volume
            });
            
            lastClose = close;
            
            // 가끔 트렌드 반전
            if (Math.random() < 0.2) {
                trend *= -1;
            }
        }
    }
    
    return {
        name: itemName || '알 수 없는 종목',
        candles: candles
    };
}

// 차트 URL 생성 함수 (개선된 버전)
function getChartImageUrl(itemId, itemName, symbol, currentPrice, history, chartType = 'line', chartPoints = 20) {
    if (chartType === 'candlestick') {
        const candleData = generateCandleData(itemName, currentPrice, history);
        return CHART_SERVICES.candlestick.createChartUrl(candleData);
    } else {
        const chartData = generateChartData(itemId, itemName, symbol, currentPrice, history, chartPoints);
        return CHART_SERVICES.quickchart.createChartUrl(chartData);
    }
}

// 전문적인 차트 URL 생성 (더 많은 옵션)
function getProfessionalChartUrl(data) {
    const { name, symbol, prices, labels, currentPrice, changePercent, volume } = data;
    
    // 가격 변동에 따른 색상 설정
    const isPositive = parseFloat(changePercent) >= 0;
    const mainColor = isPositive ? '76,175,80' : '244,67,54'; // Material Design 색상
    const bgColor = isPositive ? '76,175,80,0.1' : '244,67,54,0.1';
    
    // 차트 설정
    // 캔들스틱 데이터 생성
    const candleData = [];
    for (let i = 0; i < prices.length; i++) {
        const open = i === 0 ? prices[i] : prices[i-1];
        const close = prices[i];
        const high = Math.max(open, close) * (1 + Math.random() * 0.02);
        const low = Math.min(open, close) * (1 - Math.random() * 0.02);
        
        candleData.push({
            x: labels[i],
            o: open,
            h: high,
            l: low,
            c: close
        });
    }
    
    const config = {
        type: 'candlestick',
        data: {
            datasets: [{
                label: `${name} (${symbol})`,
                data: candleData,
                borderColor: {
                    up: 'rgb(76,175,80)',
                    down: 'rgb(244,67,54)',
                    unchanged: 'rgb(158,158,158)'
                },
                backgroundColor: {
                    up: 'rgba(76,175,80,0.8)',
                    down: 'rgba(244,67,54,0.8)',
                    unchanged: 'rgba(158,158,158,0.8)'
                },
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                title: {
                    display: true,
                    text: [`${name} (${symbol})`, `현재가: ${currentPrice.toLocaleString()}G (${isPositive ? '+' : ''}${changePercent}%)`],
                    color: '#ffffff',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: 20
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: `rgb(${mainColor})`,
                    borderWidth: 2,
                    cornerRadius: 6,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `가격: ${context.parsed.y.toLocaleString()}G`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 11
                        },
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            // 큰 숫자는 K, M으로 표시
                            if (value >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'M';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'K';
                            }
                            return value.toLocaleString();
                        }
                    },
                    beginAtZero: false
                }
            },
            elements: {
                line: {
                    borderJoinStyle: 'round'
                }
            }
        }
    };
    
    // 거래량 정보가 있으면 추가
    if (volume) {
        config.options.plugins.subtitle = {
            display: true,
            text: `거래량: ${volume.toLocaleString()}`,
            color: 'rgba(255, 255, 255, 0.7)',
            font: {
                size: 12
            }
        };
    }
    
    // URL 생성
    const encodedConfig = encodeURIComponent(JSON.stringify(config));
    return `https://quickchart.io/chart?w=800&h=400&bkg=rgb(18,18,18)&c=${encodedConfig}`;
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
    getProfessionalChartUrl,
    getAnimatedChartUrl,
    ANIMATED_CHARTS
};