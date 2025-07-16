const randomItemData = require('../data/randomItemData');

class RandomItemGenerator {
    constructor() {
        this.data = randomItemData;
        // 스탯 선택 통계 추적
        this.statSelectionStats = {
            strength: 0,
            agility: 0,
            intelligence: 0,
            vitality: 0,
            luck: 0,
            attack: 0,
            defense: 0,
            hp: 0,
            dodge: 0
        };
        this.totalSelections = 0;
        
        // 등급별 통계 추적
        this.rarityStats = {
            legendary: {
                strength: 0,
                agility: 0,
                intelligence: 0,
                vitality: 0,
                luck: 0,
                attack: 0,
                defense: 0,
                hp: 0,
                dodge: 0,
                total: 0
            }
        };
    }

    // 등급 결정
    determineRarity(gachaType) {
        // gacha type이 유효한지 확인
        if (!this.data.gachaRates[gachaType]) {
            console.warn(`Invalid gacha type: ${gachaType}, falling back to beginner`);
            gachaType = 'beginner';
        }
        
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
    generateItemBySlot(slot, gachaType, userEmblemType = null) {
        // 방패 생성 시 로그
        if (slot === 'shield') {
            console.log(`[generateItemBySlot] 방패 아이템 생성 시작`);
        }
        
        // 1. 등급 결정 (스탯용)
        const rarity = this.determineRarity(gachaType);
        
        // 2. 단어 선택 (쓰레기 등급은 이름도 쓰레기로 통일)
        let prefixRarity, adjectiveRarity, itemNameRarity;
        
        if (rarity === 'trash') {
            // 쓰레기 등급은 이름도 모두 쓰레기로
            prefixRarity = 'trash';
            adjectiveRarity = 'trash';
            itemNameRarity = 'trash';
        } else {
            // 다른 등급은 각각 무작위
            prefixRarity = this.determineWordRarity();
            adjectiveRarity = this.determineWordRarity();
            itemNameRarity = this.determineWordRarity();
        }
        
        const prefix = this.selectWord(prefixRarity, 'prefix');
        const adjective = this.selectWord(adjectiveRarity, 'adjective');
        
        // 슬롯에 맞는 아이템 찾기
        let itemName;
        let itemType;
        
        // 악세사리 슬롯인 경우 악세사리 전용 아이템 리스트 사용
        if (slot === 'accessory') {
            const accessories = this.data.itemCategories.accessories;
            itemName = accessories[Math.floor(Math.random() * accessories.length)];
            itemType = 'accessory';
        } else {
            // 다른 슬롯은 기존 방식대로
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
                    const defaultNames = {
                        weapon: '검',
                        armor: '갑옷',
                        helmet: '투구',
                        gloves: '장갑',
                        boots: '신발',
                        shield: '방패',
                        accessory: '반지'
                    };
                    itemName = defaultNames[slot] || '장비';
                    itemType = slot;
                    
                    // 방패 기본값 사용 시 로그
                    if (slot === 'shield') {
                        console.log(`[generateItemBySlot] 방패 기본값 사용 - 데이터 확인 필요`);
                    }
                    break;
                }
            } while (!this.isValidItemForSlot(itemType, slot));
        }
        
        // 4. 옵션 생성
        const options = this.generateOptions(rarity, itemType, userEmblemType);
        
        // 방패 생성 완료 로그
        if (slot === 'shield') {
            console.log(`[generateItemBySlot] 방패 아이템 생성 완료:`, {
                name: `${prefix} ${adjective} ${itemName}`,
                type: itemType,
                rarity: rarity,
                options: options
            });
        }
        
        // 5. 특수 조합 확인
        const specialCombo = this.checkSpecialCombo(prefix, adjective, itemName);
        
        // 6. 가격 계산
        const basePrice = {
            legendary: 10000,   // 100000 → 10000
            unique: 1000,       // 10000 → 1000
            epic: 100,          // 1000 → 100
            rare: 100,          // 1000 → 100
            normal: 10,         // 100 → 10
            trash: 1            // 10 → 1
        };
        
        const optionMultiplier = options.reduce((sum, opt) => sum + opt.value, 0) / 10;
        const price = Math.floor(basePrice[rarity] * (1 + optionMultiplier));
        
        // 7. 아이템 객체 생성
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
            sellPrice: Math.floor(price * 0.3),
            enhanceLevel: 0,
            score: 0, // 나중에 계산
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
        
        // 직업 정보 없이 기본 점수 계산
        item.score = this.calculateItemScore(item);
        
        return item;
    }

    // 단어 선택
    selectWord(rarity, wordType) {
        // rarity가 유효한지 확인
        if (!this.data.words[rarity]) {
            console.warn(`Invalid rarity: ${rarity}, falling back to normal`);
            rarity = 'normal';
        }
        
        const words = this.data.words[rarity][wordType];
        if (!words || words.length === 0) {
            console.warn(`No words found for rarity: ${rarity}, wordType: ${wordType}`);
            // 기본값 반환
            if (wordType === 'prefix') return '기본';
            if (wordType === 'adjective') return '평범한';
            if (wordType === 'items') return '장비';
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

    // 옵션 생성 - 완전히 새로 작성
    generateOptions(rarity, itemType, userEmblemType = null) {
        const options = [];
        // 모든 부위가 동일한 옵션 풀 사용
        const availableOptions = this.data.optionTypes.universal;
        const ranges = this.data.optionRanges[rarity];
        
        // 디버그: 장비 타입별 사용 가능한 옵션
        if (Math.random() < 0.1) { // 10% 확률로 로그
            console.log(`[generateOptions] ${itemType} 타입의 가능한 옵션: ${availableOptions.join(', ')}`);
        }
        
        // 망작은 특별 처리 - 랜덤하게 1개만
        if (rarity === 'trash') {
            const randomOption = availableOptions[Math.floor(Math.random() * availableOptions.length)];
            const range = ranges[randomOption] || { min: 1, max: 3 };
            // 쓰레기는 항상 최소값만
            const value = range.min;
            return [{
                name: this.getOptionName(randomOption),
                key: randomOption,
                value: value
            }];
        }

        // 직업별 주스탯 정의 (정확한 엠블럼 이름)
        const mainStatByEmblem = {
            // 전사 계열
            '초보전사': 'strength',
            '튼튼한 기사': 'strength',
            '용맹한 검사': 'strength',
            '맹렬한 전사': 'strength',
            '전설의 기사': 'strength',
            
            // 궁수 계열
            '마을사냥꾼': 'agility',
            '숲의 궁수': 'agility',
            '바람 사수': 'agility',
            '정확한 사격수': 'agility',
            '전설의 명궁': 'agility',
            
            // 수호자 계열
            '초보 수호자': 'vitality',
            '철벽 방패병': 'vitality',
            '불굴의 수호자': 'vitality',
            '강철 파수꾼': 'vitality',
            '전설의 철벽': 'vitality',
            
            // 마법사 계열
            '견습 마법사': 'intelligence',
            '원소 술사': 'intelligence',
            '신비한 현자': 'intelligence',
            '대마법사': 'intelligence',
            '전설의 아크메이지': 'intelligence',
            
            // 도적 계열
            '떠돌이 도적': 'luck',
            '운 좋은 도둑': 'luck',
            '행운의 닌자': 'luck',
            '복 많은 도적': 'luck',
            '전설의 행운아': 'luck'
        };

        // 유저의 주스탯 확인
        let userMainStat = null;
        if (userEmblemType) {
            const emblemType = userEmblemType.toLowerCase();
            for (const [key, value] of Object.entries(mainStatByEmblem)) {
                if (emblemType.includes(key)) {
                    userMainStat = value;
                    break;
                }
            }
        }

        // 옵션 개수 결정
        const countRange = this.data.optionCount[rarity];
        const optionCount = countRange.min === countRange.max ? 
            countRange.min : 
            Math.floor(Math.random() * (countRange.max - countRange.min + 1)) + countRange.min;

        // 옵션 생성 (무기/장갑은 공격력 우선)
        const selectedOptions = [];
        
        // 무기나 장갑의 경우 첫 번째 옵션은 60% 확률로 공격력
        if ((itemType === 'weapon' || itemType === 'gloves') && optionCount > 0) {
            if (Math.random() < 0.6) {
                const range = ranges['attack'] || { min: 1, max: 10 };
                let value = Math.floor(Math.random() * range.max) + 1;
                
                // 0.5% 확률로 주스탯 1~2배 증폭
                if ('attack' === userMainStat && Math.random() < 0.005) {
                    const multiplier = 1 + Math.random(); // 1.0 ~ 2.0
                    value = Math.min(Math.floor(value * multiplier), range.max);
                }
                
                selectedOptions.push({
                    name: this.getOptionName('attack'),
                    key: 'attack',
                    value: value
                });
            }
        }
        
        // 스탯 사용 빈도 추적 (균등 분배를 위해)
        const statUsageCount = {};
        availableOptions.forEach(opt => statUsageCount[opt] = 0);
        selectedOptions.forEach(opt => statUsageCount[opt.key] = (statUsageCount[opt.key] || 0) + 1);
        
        // 나머지 옵션들
        for (let i = selectedOptions.length; i < optionCount; i++) {
            // 무기/장갑은 30% 추가 확률로 공격력
            let selectedOption;
            if ((itemType === 'weapon' || itemType === 'gloves') && 
                Math.random() < 0.3 && 
                statUsageCount['attack'] < 2) { // 공격력은 최대 2개까지만
                selectedOption = 'attack';
            } else {
                // 가중치 기반 선택 - 적게 사용된 스탯일수록 높은 확률
                const weights = availableOptions.map(opt => {
                    const usage = statUsageCount[opt] || 0;
                    // 사용 횟수가 적을수록 높은 가중치 (최소 1)
                    return Math.max(1, 10 - usage * 3);
                });
                
                // 가중치 기반 랜덤 선택
                const totalWeight = weights.reduce((sum, w) => sum + w, 0);
                let random = Math.random() * totalWeight;
                
                for (let j = 0; j < availableOptions.length; j++) {
                    random -= weights[j];
                    if (random <= 0) {
                        selectedOption = availableOptions[j];
                        break;
                    }
                }
                
                // 폴백: 만약 선택되지 않았다면 완전 랜덤
                if (!selectedOption) {
                    selectedOption = availableOptions[Math.floor(Math.random() * availableOptions.length)];
                }
            }
            
            // 옵션 값 결정 (1 ~ 최대값)
            const range = ranges[selectedOption] || { min: 1, max: 10 };
            let value = Math.floor(Math.random() * range.max) + 1;
            
            // 0.5% 확률로 주스탯 1~2배 증폭
            if (selectedOption === userMainStat && Math.random() < 0.005) {
                const multiplier = 1 + Math.random(); // 1.0 ~ 2.0
                value = Math.min(Math.floor(value * multiplier), range.max);
            }

            selectedOptions.push({
                name: this.getOptionName(selectedOption),
                key: selectedOption,
                value: value
            });
            
            // 사용 횟수 증가
            statUsageCount[selectedOption] = (statUsageCount[selectedOption] || 0) + 1;
        }

        return selectedOptions;
    }

    // 옵션 이름 가져오기
    getOptionName(optionKey) {
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
        return optionNames[optionKey] || optionKey;
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
    generateItem(gachaType, userEmblemType = null) {
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
        const options = this.generateOptions(rarity, itemType, userEmblemType);
        
        // 5. 특수 조합 확인
        const specialCombo = this.checkSpecialCombo(prefix, adjective, itemName);
        
        // 6. 가격 계산 (등급과 옵션에 따라)
        const basePrice = {
            legendary: 10000,   // 100000 → 10000
            unique: 1000,       // 10000 → 1000
            epic: 100,          // 1000 → 100
            rare: 100,          // 1000 → 100
            normal: 10,         // 100 → 10
            trash: 1            // 10 → 1
        };
        
        const optionMultiplier = options.reduce((sum, opt) => sum + opt.value, 0) / 10;
        const price = Math.floor(basePrice[rarity] * (1 + optionMultiplier));
        
        // 7. 아이템 객체 생성
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
            sellPrice: Math.floor(price * 0.3), // 판매가는 구매가의 60%
            enhanceLevel: 0,
            score: 0, // 나중에 계산
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
        
        // 직업 정보 없이 기본 점수 계산
        item.score = this.calculateItemScore(item);

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

    // 아이템 점수 계산 - 직업별 가중치 적용
    calculateItemScore(item, userJob = null) {
        // 점수는 순수하게 스탯 총합 기반으로 계산
        // 100점 = 스탯 총합 500 이상 (레전드리 최고급 기준)
        const SCORE_PER_STAT = 0.2; // 스탯 1당 0.2점
        
        // 주스탯과 공격력 비율
        // 공격력 1 = 주스탯 2 정도의 가치
        // 예: 공격력 50 = 힘 100과 비슷한 가치
        
        // 직업별 스탯 가중치
        const JOB_WEIGHTS = {
            warrior: { strength: 3.0, vitality: 2.0, attack: 1.5, defense: 1.2, hp: 1.0, agility: 0.5, intelligence: 0.3, luck: 0.5, dodge: 0.3 },
            archer: { agility: 3.0, luck: 2.5, attack: 2.0, strength: 0.8, dodge: 1.5, hp: 0.7, defense: 0.5, vitality: 0.6, intelligence: 0.4 },
            mage: { intelligence: 3.0, attack: 2.0, luck: 1.5, hp: 1.0, defense: 0.7, agility: 0.5, strength: 0.3, vitality: 0.6, dodge: 0.8 },
            thief: { luck: 3.0, agility: 3.0, attack: 1.8, dodge: 2.0, strength: 0.6, hp: 0.7, defense: 0.4, intelligence: 0.5, vitality: 0.5 },
            defender: { vitality: 3.5, defense: 3.0, hp: 2.5, strength: 1.5, attack: 0.8, agility: 0.4, intelligence: 0.4, luck: 0.5, dodge: 0.6 }
        };
        
        // 스탯 총합 계산
        const statTotal = Object.values(item.stats || {}).reduce((sum, value) => sum + value, 0);
        
        let score = 0;
        
        if (!userJob || !JOB_WEIGHTS[userJob]) {
            // 직업 정보 없으면 순수 스탯 총합 기반
            // 스탯 1당 0.33점 (스탯 총합 300 = 100점)
            score = Math.min(100, statTotal * SCORE_PER_STAT);
        } else {
            // 직업별 가중치 적용
            const weights = JOB_WEIGHTS[userJob];
            let weightedScore = 0;
            
            for (const [stat, value] of Object.entries(item.stats || {})) {
                const weight = weights[stat] || 0.1;
                weightedScore += value * weight;
            }
            
            // 가중치 적용 후 스탯 1당 0.33점으로 계산
            // 가중치 평균을 고려하여 보정
            const avgWeight = 1.2; // 평균 가중치
            score = Math.min(100, (weightedScore / avgWeight) * SCORE_PER_STAT);
        }
        
        // 최소 점수 보장 (등급별)
        const MIN_SCORE_BY_RARITY = {
            trash: 1,
            normal: 3,
            rare: 5,
            epic: 8,
            unique: 12,
            legendary: 15
        };
        
        const minScore = MIN_SCORE_BY_RARITY[item.rarity] || 1;
        score = Math.max(minScore, Math.floor(score));
        
        // 이름 등급이 모두 쓰레기인 경우 추가 제한
        if (item.nameRarities && 
            item.nameRarities.prefix === 'trash' && 
            item.nameRarities.adjective === 'trash' && 
            item.nameRarities.itemName === 'trash') {
            // 모든 이름이 쓰레기면 점수를 더 낮게 제한
            score = Math.min(score, 5);
        }
        
        return Math.floor(score);
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
            legendary: 10000,   // 100000 → 10000
            unique: 1000,       // 10000 → 1000
            epic: 100,          // 1000 → 100
            rare: 100,          // 1000 → 100
            normal: 10,         // 100 → 10
            trash: 1            // 10 → 1
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
            sellPrice: Math.floor(price * 0.3),
            enhanceLevel: 0
        };
        
        // stats 객체에 옵션 값 추가
        options.forEach(opt => {
            item.stats[opt.key] = opt.value;
        });
        
        return item;
    }
}

module.exports = new RandomItemGenerator();