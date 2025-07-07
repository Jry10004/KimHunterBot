const mongoose = require('mongoose');
const ArtifactCompany = require('../models/ArtifactCompany');
const Stock = require('../models/Stock');
const artifactData = require('../data/artifactExploration');
require('dotenv').config();

async function initializeCompanies() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');

        // 기존 데이터 삭제 (자동)
        const response = 'y'; // 자동으로 yes 선택

        if (response.toLowerCase() === 'y') {
            await ArtifactCompany.deleteMany({});
            await Stock.deleteMany({ companyType: 'exploration' });
            console.log('기존 데이터 삭제 완료');
        }

        // 탐사 회사 초기화
        for (const company of artifactData.companies) {
            // ArtifactCompany 생성
            const existingCompany = await ArtifactCompany.findOne({ companyId: company.id });
            
            if (!existingCompany) {
                await ArtifactCompany.create({
                    companyId: company.id,
                    name: company.name,
                    basePrice: company.basePrice,
                    currentPrice: company.basePrice,
                    specialty: company.specialty,
                    multiplier: company.multiplier,
                    totalArtifactsFound: 0,
                    totalRevenue: 0,
                    priceHistory: [{
                        price: company.basePrice,
                        timestamp: new Date()
                    }],
                    topExplorers: [],
                    dailyStats: {
                        artifactsFound: 0,
                        revenue: 0,
                        lastReset: new Date()
                    }
                });
                console.log(`✅ ${company.name} 탐사 회사 생성 완료`);
            }

            // Stock 생성 (주식 시장용)
            const existingStock = await Stock.findOne({ companyId: company.id });
            
            if (!existingStock) {
                await Stock.create({
                    companyId: company.id,
                    companyName: company.name,
                    companyType: 'exploration',
                    currentPrice: company.basePrice,
                    basePrice: company.basePrice,
                    shares: 100000,
                    dailyChange: 0,
                    dailyChangePercent: 0,
                    volume: 0,
                    priceHistory: [{
                        price: company.basePrice,
                        timestamp: new Date()
                    }],
                    news: [{
                        title: '탐사 회사 상장',
                        content: `${company.name}이(가) 주식 시장에 상장되었습니다!`,
                        impact: 0,
                        timestamp: new Date()
                    }],
                    holders: [],
                    marketCap: company.basePrice * 100000
                });
                console.log(`📈 ${company.name} 주식 생성 완료`);
            }
        }

        console.log('\n✨ 모든 탐사 회사 초기화 완료!');
        
        // 통계 출력
        const companyCount = await ArtifactCompany.countDocuments();
        const stockCount = await Stock.countDocuments({ companyType: 'exploration' });
        
        console.log(`\n📊 초기화 결과:`);
        console.log(`- 탐사 회사: ${companyCount}개`);
        console.log(`- 주식 종목: ${stockCount}개`);

    } catch (error) {
        console.error('초기화 중 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

// 스크립트 실행
initializeCompanies();