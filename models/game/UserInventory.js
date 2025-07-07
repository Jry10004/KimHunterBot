// 사용자 인벤토리 모델
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { 
        type: String, 
        required: true,
        enum: ['weapon', 'armor', 'accessory', 'consumable', 'material', 'special']
    },
    rarity: {
        type: String,
        required: true,
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
    },
    stats: {
        attack: { type: Number, default: 0 },
        defense: { type: Number, default: 0 },
        health: { type: Number, default: 0 },
        critRate: { type: Number, default: 0 },
        critDamage: { type: Number, default: 0 },
        speed: { type: Number, default: 0 }
    },
    enhanceLevel: { type: Number, default: 0, max: 20 },
    inventorySlot: { type: Number, required: true },
    equipped: { type: Boolean, default: false },
    tradeable: { type: Boolean, default: true },
    stackable: { type: Boolean, default: false },
    quantity: { type: Number, default: 1 },
    obtainedAt: { type: Date, default: Date.now },
    itemId: { type: String, required: true },
    kimhunterGrade: { type: String, default: null },
    soulboundTo: { type: String, default: null }
});

const userInventorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    discordId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // 인벤토리
    inventory: [itemSchema],
    
    // 장비 슬롯
    equipment: {
        weapon: { type: Number, default: null },
        armor: { type: Number, default: null },
        accessory: { type: Number, default: null },
        special: { type: Number, default: null }
    },
    
    // 인벤토리 크기
    inventorySize: { type: Number, default: 30, max: 100 },
    
    // 창고 (추가 저장 공간)
    storage: [itemSchema],
    storageSize: { type: Number, default: 50, max: 200 },
    
    // 소모품 빠른 슬롯
    quickSlots: [{
        slot: { type: Number, required: true },
        itemId: { type: String, default: null },
        quantity: { type: Number, default: 0 }
    }],
    
    // 컬렉션 (한 번이라도 획득한 아이템)
    collection: [{
        itemId: { type: String, required: true },
        firstObtained: { type: Date, default: Date.now },
        totalObtained: { type: Number, default: 1 }
    }],
    
    // 아이템 통계
    itemStats: {
        totalItemsObtained: { type: Number, default: 0 },
        totalItemsSold: { type: Number, default: 0 },
        totalItemsEnhanced: { type: Number, default: 0 },
        totalItemsDestroyed: { type: Number, default: 0 },
        highestEnhancement: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// 인덱스 설정
userInventorySchema.index({ userId: 1 });
userInventorySchema.index({ discordId: 1 });
userInventorySchema.index({ 'inventory.itemId': 1 });
userInventorySchema.index({ 'inventory.equipped': 1 });

// 가상 필드: 현재 사용 중인 인벤토리 슬롯 수
userInventorySchema.virtual('usedSlots').get(function() {
    return this.inventory.length;
});

// 가상 필드: 남은 인벤토리 공간
userInventorySchema.virtual('freeSlots').get(function() {
    return this.inventorySize - this.inventory.length;
});

// 메서드: 아이템 추가
userInventorySchema.methods.addItem = function(item) {
    if (this.inventory.length >= this.inventorySize) {
        throw new Error('인벤토리가 가득 찼습니다.');
    }
    
    // 사용 가능한 슬롯 찾기
    const usedSlots = this.inventory.map(item => item.inventorySlot);
    let availableSlot = 1;
    while (usedSlots.includes(availableSlot)) {
        availableSlot++;
    }
    
    item.inventorySlot = availableSlot;
    this.inventory.push(item);
    
    // 컬렉션 업데이트
    const collectionItem = this.collection.find(c => c.itemId === item.itemId);
    if (collectionItem) {
        collectionItem.totalObtained++;
    } else {
        this.collection.push({
            itemId: item.itemId,
            firstObtained: new Date(),
            totalObtained: 1
        });
    }
    
    this.itemStats.totalItemsObtained++;
    return this.save();
};

// 메서드: 아이템 제거
userInventorySchema.methods.removeItem = function(inventorySlot) {
    const itemIndex = this.inventory.findIndex(item => item.inventorySlot === inventorySlot);
    if (itemIndex === -1) {
        throw new Error('아이템을 찾을 수 없습니다.');
    }
    
    this.inventory.splice(itemIndex, 1);
    return this.save();
};

module.exports = mongoose.model('UserInventory', userInventorySchema);