const randomItemData = require('../data/randomItemData');

class RandomItemGenerator {
    constructor() {
        this.data = randomItemData;
    }

    // 등급 결정
    determineRarity(gachaType) {
        const rates = this.data.gachaRates[gachaType].rates;
        const random = Math.random();
        let cumulative = 0;

        for (const [rarity, rate] of Object.entries(rates)) {
            cumulative += rate;
            if (random <= cumulative) {
                return rarity;
            }
        }
        return 'normal'; // 기본값
    }

    // 아이템 타입 결정
    determineItemType() {
        const types = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'shield', 'accessory'];
        return types[Math.floor(Math.random() * types.length)];
    }
    
    // 부위별 아이템 생성
    generateItemBySlot(slot, gachaType) {
        // 1. 등급 결정 (스탯용)
        const rarity = this.determineRarity(gachaType);
        
        // 2. 단어 선택 (각각 무작위 등급)
        const prefixRarity = this.determineWordRarity();
        const adjectiveRarity = this.determineWordRarity();
        const itemNameRarity = this.determineWordRarity();
        
        const prefix = this.selectWord(prefixRarity, 'prefix');
        const adjective = this.selectWord(adjectiveRarity, 'adjective');
        
        // 슬롯에 맞는 아이템 찾기 위해 여러 번 시도
        let itemName;
        let itemType;
        let attempts = 0;
        
        do {
            itemName = this.selectWord(itemNameRarity, 'items');
            itemType = this.data.determineItemCategory(itemName);
            attempts++;
            
            // 디버그 로그
            if (attempts <= 5 || attempts % 20 === 0) {
                console.log(`[generateItemBySlot] 시도 ${attempts}: 아이템="${itemName}", 타입="${itemType}", 슬롯="${slot}", 유효=${this.isValidItemForSlot(itemType, slot)}`);
            }
            
            // 100번 시도 후에도 못 찾으면 기본값 사용
            if (attempts > 100) {
                console.log(`[generateItemBySlot] 100번 시도 실패! 슬롯 ${slot}에 대한 기본값 사용`);
                if (slot === 'weapon') itemName = '검';
                else if (slot === 'armor') itemName = '갑옷';
                else if (slot === 'helmet') itemName = '투구';
                else if (slot === 'gloves') itemName = '장갑';
                else if (slot === 'boots') itemName = '신발';
                else if (slot === 'shield') itemName = '방패';
                else itemName = '반지';
                
                itemType = slot;
                break;
            }
        } while (!this.isValidItemForSlot(itemType, slot));
        
        // 4. 옵션 생성
        const options = this.generateOptions(rarity, itemType);
        
        // 5. 특수 조합 확인
        const specialCombo = this.checkSpecialCombo(prefix, adjective, itemName);
        
        // 6. 가격 계산
        const basePrice = {
            legendary: 1000000,
            unique: 100000,
            epic: 10000,
            rare: 1000,
            normal: 100,
            trash: 10
        };
        
        const optionMultiplier = options.reduce((sum, opt) => sum + opt.value, 0) / 10;
        const price = Math.floor(basePrice[rarity] * (1 + optionMultiplier));
        
        // 7. 아이템 점수 계산
        const itemScore = this.calculateItemScore(rarity, options, prefixRarity, adjectiveRarity, itemNameRarity, specialCombo);
        
        // 8. 아이템 객체 생성
        const item = {
            id: `random_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: `${prefix} ${adjective} ${itemName}`,
            type: itemType,
            rarity: rarity,
            color: this.data.rarityColors[rarity],
            emoji: this.data.rarityEmojis[rarity],
            stats: {},
            description: specialCombo ? specialCombo.message : this.generateDescription(rarity),
            price: price,
            specialCombo: specialCombo,
            sellPrice: Math.floor(price * 0.6),
            enhanceLevel: 0,
            score: itemScore,
            nameRarities: {
                prefix: prefixRarity,
                adjective: adjectiveRarity,
                itemName: itemNameRarity
            }
        };
        
        // stats 객체에 옵션 값 추가
        options.forEach(opt => {
            item.stats[opt.key] = opt.value;
        });
        
        // 특수 조합 스탯 추가
        if (specialCombo && specialCombo.stats) {
            item.specialStats = specialCombo.stats;
        }
        
        return item;
    }

    // 단어 선택
    selectWord(rarity, wordType) {
        const words = this.data.words[rarity][wordType];
        if (!words) {
            console.error(`No words found for rarity: ${rarity}, wordType: ${wordType}`);
            return '아이템';
        }
        return words[Math.floor(Math.random() * words.length)];
    }
    
    // 슬롯과 아이템 타입이 맞는지 확인
    isValidItemForSlot(itemType, slot) {
        if (slot === 'weapon') return itemType === 'weapon';
        if (slot === 'armor') return itemType === 'armor';
        if (slot === 'helmet') return itemType === 'helmet';
        if (slot === 'gloves') return itemType === 'gloves';
        if (slot === 'boots') return itemType === 'boots';
        if (slot === 'shield') return itemType === 'shield';
        if (slot === 'accessory') return itemType === 'accessory';
        return true;
    }

    // 옵션 생성
    generateOptions(rarity, itemType) {
        const options = [];
        const availableOptions = this.data.optionTypes[itemType];
        const ranges = this.data.optionRanges[rarity];
        
        // 망작은 특별 처리
        if (rarity === 'trash') {
            return [
                { name: "공격력", key: "attack", value: 4 },
                { name: "방어력", key: "defense", value: 4 },
                { name: "힘", key: "strength", value: 4 },
                { name: "민첩", key: "agility", value: 4 },
                { name: "지능", key: "intelligence", value: 4 },
                { name: "체력", key: "vitality", value: 4 }
            ];
        }

        // 옵션 개수 결정
        const countRange = this.data.optionCount[rarity];
        const optionCount = countRange.min === countRange.max ? 
            countRange.min : 
            Math.floor(Math.random() * (countRange.max - countRange.min + 1)) + countRange.min;

        // 중복 없이 옵션 선택
        const selectedOptions = [];
        const availableCopy = [...availableOptions];

        for (let i = 0; i < optionCount && availableCopy.length > 0; i++) {
            const index = Math.floor(Math.random() * availableCopy.length);
            const optionKey = availableCopy.splice(index, 1)[0];
            
            // 옵션 값 결정 (최소~최대 랜덤)
            const range = ranges[optionKey] || ranges.stats || { min: 1, max: 5 };
            const value = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
            
            // 옵션 이름 매핑
            const optionNames = {
                attack: "공격력",
                defense: "방어력",
                strength: "힘",
                agility: "민첩",
                intelligence: "지능",
                vitality: "체력",
                luck: "행운",
                hp: "추가HP",
                dodge: "회피력"
            };

            selectedOptions.push({
                name: optionNames[optionKey],
                key: optionKey,
                value: value
            });
        }

        return selectedOptions;
    }

    // 특수 조합 확인
    checkSpecialCombo(prefix, adjective, itemName) {
        for (const combo of this.data.specialCombinations) {
            const itemWords = [prefix, adjective, itemName];
            const hasAllWords = combo.words.every(word => 
                itemWords.some(itemWord => itemWord.includes(word))
            );
            
            if (hasAllWords) {
                return combo;
            }
        }
        return null;
    }

    // 각 단어별로 무작위 등급 결정
    determineWordRarity() {
        const rarities = ['legendary', 'unique', 'epic', 'rare', 'normal', 'trash'];
        return rarities[Math.floor(Math.random() * rarities.length)];
    }

    // 아이템 생성
    generateItem(gachaType) {
        // 1. 등급 결정 (스탯용)
        const rarity = this.determineRarity(gachaType);
        
        // 2. 아이템 타입 결정
        let itemType = this.determineItemType();
        
        // 3. 단어 선택 (각각 무작위 등급)
        const prefixRarity = this.determineWordRarity();
        const adjectiveRarity = this.determineWordRarity();
        const itemNameRarity = this.determineWordRarity();
        
        const prefix = this.selectWord(prefixRarity, 'prefix');
        const adjective = this.selectWord(adjectiveRarity, 'adjective');
        const itemName = this.selectWord(itemNameRarity, 'items');
        
        // 아이템 이름에 따라 타입 재결정
        itemType = this.data.determineItemCategory(itemName);
        
        // 4. 옵션 생성
        const options = this.generateOptions(rarity, itemType);
        
        // 5. 특수 조합 확인
        const specialCombo = this.checkSpecialCombo(prefix, adjective, itemName);
        
        // 6. 가격 계산 (등급과 옵션에 따라)
        const basePrice = {
            legendary: 1000000,
            unique: 100000,
            epic: 10000,
            rare: 1000,
            normal: 100,
            trash: 10
        };
        
        const optionMultiplier = options.reduce((sum, opt) => sum + opt.value, 0) / 10;
        const price = Math.floor(basePrice[rarity] * (1 + optionMultiplier));
        
        // 7. 아이템 점수 계산
        const itemScore = this.calculateItemScore(rarity, options, prefixRarity, adjectiveRarity, itemNameRarity, specialCombo);
        
        // 8. 아이템 객체 생성
        const item = {
            id: `random_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: `${prefix} ${adjective} ${itemName}`,
            type: itemType,
            rarity: rarity,
            color: this.data.rarityColors[rarity],
            emoji: this.data.rarityEmojis[rarity],
            stats: {},
            description: specialCombo ? specialCombo.message : this.generateDescription(rarity),
            price: price,
            specialCombo: specialCombo,
            sellPrice: Math.floor(price * 0.6), // 판매가는 구매가의 60%
            enhanceLevel: 0,
            score: itemScore,
            nameRarities: {
                prefix: prefixRarity,
                adjective: adjectiveRarity,
                itemName: itemNameRarity
            }
        };

        // stats 객체에 옵션 값 추가
        options.forEach(opt => {
            item.stats[opt.key] = opt.value;
        });

        // 특수 조합 스탯 추가
        if (specialCombo && specialCombo.stats) {
            item.specialStats = specialCombo.stats;
        }

        return item;
    }

    // 설명 생성
    generateDescription(rarity) {
        const descriptions = {
            legendary: "전설로만 전해지던 신화의 아이템입니다.",
            unique: "세상에 단 하나뿐인 희귀한 아이템입니다.",
            epic: "뛰어난 장인이 심혈을 기울여 만든 명품입니다.",
            rare: "흔치 않은 귀한 아이템입니다.",
            normal: "평범하지만 쓸만한 아이템입니다.",
            trash: "이게... 아이템이 맞나요?"
        };
        return descriptions[rarity];
    }

    // 아이템 정보 포맷팅
    formatItemInfo(item) {
        let info = `${item.emoji} **${item.name}**\n`;
        info += `등급: ${item.rarity.toUpperCase()}\n`;
        info += `종류: ${this.getItemTypeKorean(item.type)}\n`;
        info += `\n📊 **능력치**\n`;
        
        for (const [key, value] of Object.entries(item.stats)) {
            const statName = {
                attack: "⚔️ 공격력",
                defense: "🛡️ 방어력",
                strength: "💪 힘",
                agility: "🏃 민첩",
                intelligence: "🧠 지능",
                vitality: "❤️ 체력",
                luck: "🍀 행운",
                hp: "💖 추가HP",
                dodge: "💨 회피력"
            };
            info += `${statName[key]}: +${value}\n`;
        }
        
        if (item.specialCombo) {
            info += `\n✨ **특수 효과**: ${item.specialCombo.name}\n`;
            info += `${item.specialCombo.effect}\n`;
        }
        
        info += `\n💰 가격: ${item.price.toLocaleString()}G`;
        
        return info;
    }

    // 아이템 점수 계산
    calculateItemScore(statRarity, options, prefixRarity, adjectiveRarity, itemNameRarity, specialCombo) {
        // 점수 가중치
        const rarityScores = {
            legendary: 100,
            unique: 50,
            epic: 30,
            rare: 15,
            normal: 5,
            trash: 1
        };
        
        // 1. 실제 스탯 합계: 40% (기존 20% → 40%)
        const totalStats = options.reduce((sum, opt) => sum + opt.value, 0);
        const statSumScore = (totalStats / 10) * 0.4;
        
        // 2. 스탯 희귀도: 30% (기존 40% → 30%)
        const statRarityScore = rarityScores[statRarity] * 0.3;
        
        // 3. 이름 희귀도: 20% (기존 30% → 20%)
        const nameScore = ((rarityScores[prefixRarity] + rarityScores[adjectiveRarity] + rarityScores[itemNameRarity]) / 3) * 0.2;
        
        // 4. 특수 효과 보너스: 10% (유지)
        const specialBonus = specialCombo ? 50 * 0.1 : 0;
        
        // 총점 계산 (0~100점)
        const totalScore = Math.round(statSumScore + statRarityScore + nameScore + specialBonus);
        
        return Math.min(100, Math.max(0, totalScore));
    }

    // 아이템 타입 한글 변환
    getItemTypeKorean(type) {
        const types = {
            weapon: "무기",
            armor: "갑옷",
            helmet: "투구",
            gloves: "장갑",
            boots: "신발",
            shield: "방패",
            accessory: "장신구"
        };
        return types[type] || type;
    }

    // 커스텀 확률로 아이템 생성
    generateItemWithCustomRates(itemType, customRates) {
        // 커스텀 확률로 희귀도 결정
        const rand = Math.random();
        let cumulativeProbability = 0;
        let rarity = 'normal';
        
        for (const [rarityType, probability] of Object.entries(customRates)) {
            cumulativeProbability += probability;
            if (rand < cumulativeProbability) {
                rarity = rarityType;
                break;
            }
        }
        
        // 선택된 희귀도로 아이템 생성
        return this.generateItemByType(itemType, rarity);
    }

    // 특정 타입과 희귀도로 아이템 생성
    generateItemByType(itemType, rarity) {
        const wordList = this.data.words[rarity];
        
        // 1. 접두사 선택
        const prefix = wordList.prefix[Math.floor(Math.random() * wordList.prefix.length)];
        
        // 2. 형용사 선택
        const adjective = wordList.adjective[Math.floor(Math.random() * wordList.adjective.length)];
        
        // 3. 아이템 이름 선택
        const itemName = wordList.items[Math.floor(Math.random() * wordList.items.length)];
        
        // 4. 옵션 개수와 종류 결정
        const optionCount = Math.floor(Math.random() * (this.data.optionCount[rarity].max - this.data.optionCount[rarity].min + 1)) + this.data.optionCount[rarity].min;
        const availableOptions = this.data.optionTypes[itemType];
        const selectedOptions = this.selectRandomOptions(availableOptions, optionCount);
        
        // 5. 옵션 값 생성
        const options = selectedOptions.map(opt => ({
            key: opt,
            value: this.generateOptionValue(rarity, opt)
        }));
        
        // 6. 특수 조합 체크
        const specialCombo = this.checkSpecialCombo(prefix, adjective, itemName);
        
        // 7. 가격 계산
        const basePrice = {
            legendary: 1000000,
            unique: 100000,
            epic: 10000,
            rare: 1000,
            normal: 100,
            trash: 10
        };
        
        const optionMultiplier = options.reduce((sum, opt) => sum + opt.value, 0) / 10;
        const price = Math.floor(basePrice[rarity] * (1 + optionMultiplier));
        
        // 8. 아이템 객체 생성
        const item = {
            id: `random_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: `${prefix} ${adjective} ${itemName}`,
            type: itemType,
            rarity: rarity,
            color: this.data.rarityColors[rarity],
            emoji: this.data.rarityEmojis[rarity],
            stats: {},
            description: specialCombo ? specialCombo.message : this.generateDescription(rarity),
            price: price,
            specialCombo: specialCombo,
            sellPrice: Math.floor(price * 0.6),
            enhanceLevel: 0
        };
        
        // stats 객체에 옵션 값 추가
        options.forEach(opt => {
            item.stats[opt.key] = opt.value;
        });
        
        return item;
    }
    
    // 특정 슬롯에 맞는 아이템 생성
    generateItemBySlot(slot, gachaType = 'normal') {
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            // 일반 아이템 생성
            const item = this.generateItem(gachaType);
            
            // 생성된 아이템의 타입이 요청한 슬롯과 일치하는지 확인
            const itemType = this.data.determineItemCategory(item.name.split(' ').pop());
            
            console.log(`[generateItemBySlot] 시도 ${attempts}: 아이템="${item.name.split(' ').pop()}", 타입="${itemType}", 슬롯="${slot}", 유효=${itemType === slot}`);
            
            if (itemType === slot) {
                item.type = slot; // 타입을 명확히 설정
                return item;
            }
            
            // 20번마다 상태 출력
            if (attempts % 20 === 0) {
                console.log(`[generateItemBySlot] 시도 ${attempts}: 아직 적합한 아이템을 찾지 못함...`);
            }
        }
        
        // 100번 시도 후에도 못 찾으면 기본값 반환
        console.log(`[generateItemBySlot] ${maxAttempts}번 시도 실패! 슬롯 ${slot}에 대한 기본값 사용`);
        
        // 기본 아이템 생성
        const defaultItems = {
            weapon: { name: "기본 검", stats: { attack: 10 } },
            armor: { name: "기본 갑옷", stats: { defense: 10 } },
            helmet: { name: "기본 투구", stats: { defense: 5 } },
            gloves: { name: "기본 장갑", stats: { attack: 5 } },
            boots: { name: "기본 신발", stats: { agility: 5 } },
            shield: { name: "기본 방패", stats: { defense: 15 } },
            accessory: { name: "기본 장신구", stats: { luck: 5 } }
        };
        
        const defaultItem = defaultItems[slot] || defaultItems.weapon;
        const rarity = this.determineRarity(gachaType);
        
        return {
            id: `random_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: `${this.selectWord(rarity, 'prefix')} ${this.selectWord(rarity, 'adjective')} ${defaultItem.name}`,
            type: slot,
            rarity: rarity,
            color: this.data.rarityColors[rarity],
            emoji: this.data.rarityEmojis[rarity],
            stats: defaultItem.stats,
            description: this.generateDescription(rarity),
            price: 1000,
            sellPrice: 600,
            enhanceLevel: 0,
            score: Math.floor(Math.random() * 20) + 1
        };
    }
}

module.exports = new RandomItemGenerator();