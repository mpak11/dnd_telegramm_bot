const db = require('../database');
const config = require('../config/config');
const { log } = require('../utils/logger');
const itemGenerator = require('../utils/itemGenerator');

class LootSystem {
  constructor() {
    // Таблицы лута по сложности квеста
    this.lootTables = {
      easy: {
        gold: { min: 10, max: 50 },
        itemChance: 0.3,
        itemCount: { min: 0, max: 1 },
        generatedItemChance: 0.2, // 20% шанс на сгенерированный предмет
        rarityWeights: {
          common: 90,
          uncommon: 10,
          rare: 0,
          epic: 0,
          legendary: 0
        }
      },
      medium: {
        gold: { min: 50, max: 150 },
        itemChance: 0.5,
        itemCount: { min: 0, max: 1 },
        generatedItemChance: 0.3,
        rarityWeights: {
          common: 70,
          uncommon: 25,
          rare: 5,
          epic: 0,
          legendary: 0
        }
      },
      hard: {
        gold: { min: 150, max: 300 },
        itemChance: 0.7,
        itemCount: { min: 1, max: 2 },
        generatedItemChance: 0.4,
        rarityWeights: {
          common: 50,
          uncommon: 35,
          rare: 12,
          epic: 3,
          legendary: 0
        }
      },
      epic: {
        gold: { min: 300, max: 500 },
        itemChance: 0.9,
        itemCount: { min: 1, max: 2 },
        generatedItemChance: 0.5,
        rarityWeights: {
          common: 30,
          uncommon: 40,
          rare: 20,
          epic: 9,
          legendary: 1
        }
      },
      legendary: {
        gold: { min: 500, max: 1000 },
        itemChance: 1.0,
        itemCount: { min: 1, max: 3 },
        generatedItemChance: 0.6,
        rarityWeights: {
          common: 20,
          uncommon: 30,
          rare: 30,
          epic: 15,
          legendary: 5
        }
      }
    };
  }

  // Генерировать лут для квеста
  async generateQuestLoot(questDifficulty, characterLevel, roll) {
    const lootTable = this.lootTables[questDifficulty] || this.lootTables.easy;
    const loot = {
      gold: 0,
      items: []
    };

    // Бонус к золоту за критический успех
    const goldMultiplier = roll === 20 ? 2 : roll === 1 ? 0.5 : 1;
    
    // Генерируем золото
    loot.gold = Math.floor(
      this.randomBetween(lootTable.gold.min, lootTable.gold.max) * goldMultiplier
    );

    // Проверяем, выпадают ли предметы
    if (Math.random() < lootTable.itemChance || roll === 20) {
      const itemCount = roll === 20 
        ? lootTable.itemCount.max 
        : this.randomBetween(lootTable.itemCount.min, lootTable.itemCount.max);

      for (let i = 0; i < itemCount; i++) {
        // Определяем, генерировать новый предмет или взять из БД
        const shouldGenerate = Math.random() < lootTable.generatedItemChance;
        
        let item;
        if (shouldGenerate) {
          // Генерируем новый предмет
          item = await this.generateNewItem(lootTable.rarityWeights, characterLevel, questDifficulty);
        } else {
          // Берем из БД
          item = await this.generateItem(lootTable.rarityWeights, characterLevel);
        }
        
        if (item) {
          loot.items.push(item);
        }
      }
    }

    // Шанс на бонусный предмет за идеальный бросок
    if (roll === 20) {
      const bonusItem = await this.generateBonusItem(characterLevel);
      if (bonusItem) {
        loot.items.push(bonusItem);
      }
    }

    return loot;
  }

  // Генерировать новый предмет с помощью itemGenerator
  async generateNewItem(rarityWeights, characterLevel, difficulty) {
    const rarity = this.rollRarity(rarityWeights);
    
    // Определяем тип предмета в зависимости от сложности
    const typeWeights = {
      easy: { weapon: 20, armor: 20, consumable: 50, accessory: 10 },
      medium: { weapon: 30, armor: 25, consumable: 35, accessory: 10 },
      hard: { weapon: 35, armor: 30, consumable: 20, accessory: 15 },
      epic: { weapon: 40, armor: 35, consumable: 10, accessory: 15 },
      legendary: { weapon: 45, armor: 35, consumable: 5, accessory: 15 }
    };
    
    const weights = typeWeights[difficulty] || typeWeights.medium;
    const type = this.rollFromWeights(weights);
    
    // Генерируем предмет
    const generatedItem = itemGenerator.generateItem(rarity, characterLevel, type);
    
    // Сохраняем в БД
    const savedItem = await this.saveGeneratedItem(generatedItem);
    
    if (savedItem) {
      log(`Сгенерирован новый предмет: ${savedItem.name} (${savedItem.rarity})`);
    }
    
    return savedItem;
  }

  // Сохранить сгенерированный предмет в БД
  async saveGeneratedItem(item) {
    try {
      const result = await db.run(`
        INSERT INTO items (
          name, description, type, rarity, effects, requirements,
          value_gold, slot_type, weight, is_two_handed, weapon_type,
          armor_type, stats_bonus, is_unique
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.name,
        item.description,
        item.type,
        item.rarity,
        JSON.stringify(item.effects || {}),
        JSON.stringify(item.requirements || {}),
        item.value || item.value_gold || 0,
        item.slot || item.slot_type || null,
        item.weight || 0,
        item.two_handed || item.is_two_handed || 0,
        item.weapon_type || null,
        item.armor_type || null,
        JSON.stringify(item.stats || item.stats_bonus || {}),
        0 // Сгенерированные предметы не уникальны
      ]);
      
      return {
        id: result.lastID,
        ...item
      };
    } catch (error) {
      log(`Ошибка сохранения сгенерированного предмета: ${error.message}`, 'error');
      return null;
    }
  }

  // Генерировать случайный предмет из БД (существующий метод)
  async generateItem(rarityWeights, characterLevel) {
    // Определяем редкость
    const rarity = this.rollRarity(rarityWeights);
    
    // Получаем подходящие предметы
    const items = await db.all(`
      SELECT * FROM items 
      WHERE rarity = ? 
        AND (requirements IS NULL OR json_extract(requirements, '$.level') <= ? OR json_extract(requirements, '$.level') IS NULL)
        AND (is_unique = 0 OR id NOT IN (
          SELECT item_id FROM inventory
        ))
      ORDER BY RANDOM()
      LIMIT 1
    `, [rarity, characterLevel]);

    if (items.length === 0) {
      // Если нет подходящих предметов, берем любой неуникальный той же редкости
      const anyItem = await db.get(
        'SELECT * FROM items WHERE rarity = ? AND is_unique = 0 ORDER BY RANDOM() LIMIT 1',
        [rarity]
      );
      return anyItem;
    }

    return items[0];
  }

  // Генерировать бонусный предмет за критический успех
  async generateBonusItem(characterLevel) {
    // Увеличенные шансы на редкие предметы
    const bonusRarityWeights = {
      common: 10,
      uncommon: 30,
      rare: 40,
      epic: 15,
      legendary: 5
    };

    // 50% шанс на сгенерированный бонусный предмет
    if (Math.random() < 0.5) {
      return await this.generateNewItem(bonusRarityWeights, characterLevel, 'epic');
    } else {
      return await this.generateItem(bonusRarityWeights, characterLevel);
    }
  }

  // Определить результат по весам
  rollFromWeights(weights) {
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * totalWeight;

    for (const [key, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) {
        return key;
      }
    }

    return Object.keys(weights)[0]; // На всякий случай
  }

  // Определить редкость по весам
  rollRarity(weights) {
    return this.rollFromWeights(weights);
  }

  // Выдать лут персонажу (обновленный метод)
  async awardLoot(characterId, loot) {
    const results = {
      gold: loot.gold,
      items: []
    };

    // Выдаем золото
    if (loot.gold > 0) {
      await db.run(
        'UPDATE characters SET gold = gold + ? WHERE id = ?',
        [loot.gold, characterId]
      );
    }

    // Выдаем предметы
    for (const item of loot.items) {
      // Проверяем, есть ли уже такой предмет (для стакаемых)
      const isStackable = item.type === 'consumable' || item.type === 'misc';
      
      if (isStackable) {
        const existing = await db.get(
          'SELECT * FROM inventory WHERE character_id = ? AND item_id = ?',
          [characterId, item.id]
        );

        if (existing) {
          // Увеличиваем количество
          await db.run(
            'UPDATE inventory SET quantity = quantity + 1 WHERE id = ?',
            [existing.id]
          );
        } else {
          // Добавляем новый предмет
          await db.run(
            'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1)',
            [characterId, item.id]
          );
        }
      } else {
        // Для нестакаемых предметов всегда добавляем новую запись
        await db.run(
          'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1)',
          [characterId, item.id]
        );
      }

      results.items.push({
        name: item.name,
        rarity: item.rarity,
        type: item.type,
        description: item.description
      });

      log(`Выдан предмет ${item.name} (${item.rarity}) персонажу ${characterId}`);
    }

    return results;
  }

  // Создать сундук с лутом в чате (обновленный метод)
  async createLootChest(chatId, difficulty = 'medium', creatorId = null) {
    const lootTable = this.lootTables[difficulty];
    const chest = {
      gold: this.randomBetween(lootTable.gold.min * 2, lootTable.gold.max * 2),
      items: []
    };

    // Генерируем 2-5 предметов для сундука
    const itemCount = this.randomBetween(2, 5);
    for (let i = 0; i < itemCount; i++) {
      let item;
      
      // Для сундуков увеличиваем шанс на сгенерированные предметы
      if (Math.random() < (lootTable.generatedItemChance * 1.5)) {
        item = await this.generateNewItem(lootTable.rarityWeights, 10, difficulty);
      } else {
        item = await this.generateItem(lootTable.rarityWeights, 10);
      }
      
      if (item) {
        chest.items.push(item);
      }
    }

    // Сохраняем сундук в БД
    const result = await db.run(`
      INSERT INTO loot_chests (
        chat_id, creator_id, gold, items, difficulty, expires_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now', '+1 hour'))
    `, [
      chatId,
      creatorId,
      chest.gold,
      JSON.stringify(chest.items.map(i => i.id)),
      difficulty
    ]);

    chest.id = result.lastID;
    log(`Создан сундук с лутом в чате ${chatId}: ${chest.items.length} предметов, ${chest.gold} золота`);
    
    return chest;
  }

  // Открыть сундук (без изменений)
  async openChest(chestId, characterId) {
    const chest = await db.get(
      'SELECT * FROM loot_chests WHERE id = ? AND claimed = 0 AND expires_at > datetime("now")',
      [chestId]
    );

    if (!chest) {
      return { success: false, message: 'Сундук не найден или уже открыт!' };
    }

    // Помечаем сундук как открытый
    await db.run(
      'UPDATE loot_chests SET claimed = 1, claimed_by = ? WHERE id = ?',
      [characterId, chestId]
    );

    // Выдаем лут
    const loot = {
      gold: chest.gold,
      items: []
    };

    // Парсим предметы
    const itemIds = JSON.parse(chest.items);
    for (const itemId of itemIds) {
      const item = await db.get('SELECT * FROM items WHERE id = ?', [itemId]);
      if (item) {
        loot.items.push(item);
      }
    }

    const awarded = await this.awardLoot(characterId, loot);
    
    return {
      success: true,
      loot: awarded,
      difficulty: chest.difficulty
    };
  }

  // Создать особый сундук с гарантированно хорошим лутом
  async createEpicChest(chatId, creatorId = null) {
    const chest = {
      gold: this.randomBetween(1000, 2000),
      items: []
    };

    // Гарантированно 1 эпический или легендарный предмет
    const epicRarity = {
      common: 0,
      uncommon: 0,
      rare: 30,
      epic: 60,
      legendary: 10
    };

    const epicItem = await this.generateNewItem(epicRarity, 10, 'legendary');
    if (epicItem) chest.items.push(epicItem);

    // И еще 2-3 редких предмета
    for (let i = 0; i < this.randomBetween(2, 3); i++) {
      const item = await this.generateItem({
        common: 0,
        uncommon: 40,
        rare: 50,
        epic: 10,
        legendary: 0
      }, 10);
      
      if (item) chest.items.push(item);
    }

    // Сохраняем особый сундук
    const result = await db.run(`
      INSERT INTO loot_chests (
        chat_id, creator_id, gold, items, difficulty, expires_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now', '+2 hours'))
    `, [
      chatId,
      creatorId,
      chest.gold,
      JSON.stringify(chest.items.map(i => i.id)),
      'epic'
    ]);

    chest.id = result.lastID;
    log(`Создан ЭПИЧЕСКИЙ сундук в чате ${chatId}!`);
    
    return chest;
  }

  // Вспомогательная функция
  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

// Экспортируем singleton
module.exports = new LootSystem();