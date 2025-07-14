const mongoose = require('mongoose');
const Stock = require('../models/Stock');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkStockData() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // Stock 컬렉션 확인
        const stockCount = await Stock.countDocuments();
        console.log(`\n📊 Stock 컬렉션 문서 수: ${stockCount}개`);
        
        if (stockCount === 0) {
            console.log('⚠️ Stock 컬렉션이 비어있습니다!');
            console.log('MarketPriceService 초기화가 실패했을 가능성이 있습니다.');
        } else {
            // 샘플 주식 데이터 출력
            const sampleStocks = await Stock.find().limit(5);
            console.log('\n📈 샘플 주식 데이터:');
            sampleStocks.forEach(stock => {
                console.log(`- ${stock.companyName}: ${stock.currentPrice}G (${stock.dailyChangePercent}%)`);
            });
            
            // 시장 통계
            const marketStats = await Stock.getMarketStats();
            console.log('\n📊 시장 통계:');
            console.log(`- 총 주식 수: ${marketStats.totalStocks}`);
            console.log(`- 총 시가총액: ${marketStats.totalMarketCap}`);
            console.log(`- 상승 종목: ${marketStats.gainers}`);
            console.log(`- 하락 종목: ${marketStats.losers}`);
        }
        
        // 연결 종료
        await mongoose.connection.close();
        console.log('\n✅ 검사 완료');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        process.exit(1);
    }
}

checkStockData();