const db = require('../database');
const { log } = require('../utils/logger');

class CraftingSystem {
  constructor() {
    // Базовые рецепты (потом загрузятся из БД)
    this.baseRecipes = [
      {
        name: 'Усиленный стальной меч',
        description: 'Улучшенная версия обычного стального меча',
        materials: [
          { name: 'Стальной меч', quantity: 1 },
          { name: 'Железный слиток', quantity: 3 },
          { name: 'Уголь', quantity: 5 }
        ],
        requirements: {
          level: 5,
          gold: 100
        },
        result: {
          baseName: 'Стальной меч',
          prefix: 'Усиленный',
          bonusStats: { damage: 2, durability: 50 }
        },
        successRate: 0.9
      },
      {
        name: 'Зачарованный посох',
        description: 'Посох, наполненный магической энергией',
        materials: [
          { name: 'Простой посох', quantity: 1 },
          { name: 'Магический кристалл', quantity: 2 },
          { name: 'Пыль звезд', quantity: 1 }
        ],
        requirements: {
          level: 7,
          gold: 200,
          class: 'MAGE'
        },
        result: {
          baseName: 'Посох',
          prefix: 'Зачарованный',
          bonusStats: { intelligence: 3, mp_max: 20, spell_power: 10 }
        },
        successRate: 0.8
      },
      {
        name: 'Укрепленная кожаная броня',
        description: 'Кожаная броня с металлическими вставками',
        materials: [
          { name: 'Кожаная броня', quantity: 1 },
          { name: 'Металлические пластины', quantity: 4 },
          { name: 'Прочная нить', quantity: 10 }
        ],
        requirements: {
          level: 4,
          gold: 150
        },
        result: {
          baseName: 'Кожаная броня',
          prefix: 'Укрепленная',
          bonusStats: { defense: 3, dexterity: -1 }
        },
        successRate: 0.95
      }
    ];
  }

  // Инициализация - загрузка рецептов в БД
  async initialize() {
    for (const recipe of this.baseRecipes) {
      await this.addRecipe(recipe);
    }
  }

  // Добавить рецепт в БД
  async addRecipe(recipe) {
    try {
      // Проверяем, есть ли уже такой рецепт
      const existing = await db.get(
        'SELECT id FROM crafting_recipes WHERE name = ?',
        [recipe.name]
      );
      
      if (existing) return;
      
      // Находим ID результирующего предмета или создаем его
      let resultItemId = null;
      if (recipe.result.itemId) {
        resultItemId = recipe.result.itemId;
      }
      
      await db.run(`
        INSERT INTO crafting_recipes (
          name, description, result_item_id, required_level,
          required_gold, materials, tools_required, success_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        recipe.name,
        recipe.description,
        resultItemId,
        recipe.requirements.level || 1,
        recipe.requirements.gold || 0,
        JSON.stringify(recipe.materials),
        JSON.stringify(recipe.tools || []),
        recipe.successRate || 1.0
      ]);
      
      log(`Добавлен рецепт: ${recipe.name}`);
    } catch (error) {
      log(`Ошибка добавления рецепта ${recipe.name}: ${error.message}`, 'error');
    }
  }

  // Получить доступные рецепты для персонажа
  async getAvailableRecipes(characterId) {
    const character = await db.get(
      'SELECT * FROM characters WHERE id = ?',
      [characterId]
    );
    
    if (!character) return [];
    
    const recipes = await db.all(`
      SELECT * FROM crafting_recipes
      WHERE required_level <= ?
      ORDER BY required_level, name
    `, [character.level]);
    
    // Парсим JSON поля
    return recipes.map(recipe => ({
      ...recipe,
      materials: JSON.parse(recipe.materials),
      tools_required: recipe.tools_required ? JSON.parse(recipe.tools_required) : []
    }));
  }

  // Проверить, может ли персонаж создать предмет
  async canCraft(characterId, recipeId) {
    const character = await db.get(
      'SELECT * FROM characters WHERE id = ?',
      [characterId]
    );
    
    const recipe = await db.get(
      'SELECT * FROM crafting_recipes WHERE id = ?',
      [recipeId]
    );
    
    if (!character || !recipe) {
      return { canCraft: false, reason: 'Рецепт не найден' };
    }
    
    // Проверяем уровень
    if (character.level < recipe.required_level) {
      return { 
        canCraft: false, 
        reason: `Требуется ${recipe.required_level} уровень (у вас ${character.level})` 
      };
    }
    
    // Проверяем золото
    if (character.gold < recipe.required_gold) {
      return { 
        canCraft: false, 
        reason: `Недостаточно золота: нужно ${recipe.required_gold}, у вас ${character.gold}` 
      };
    }
    
    // Проверяем материалы
    const materials = JSON.parse(recipe.materials);
    for (const mat of materials) {
      const hasItem = await this.checkInventory(characterId, mat.name, mat.quantity);
      if (!hasItem.has) {
        return { 
          canCraft: false, 
          reason: `Недостаточно: ${mat.name} (нужно ${mat.quantity}, есть ${hasItem.quantity})` 
        };
      }
    }
    
    return { canCraft: true };
  }

  // Проверить наличие предмета в инвентаре
  async checkInventory(characterId, itemName, requiredQuantity) {
    const item = await db.get(`
      SELECT inv.quantity, i.id
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE inv.character_id = ? AND i.name = ?
    `, [characterId, itemName]);
    
    if (!item) {
      return { has: false, quantity: 0 };
    }
    
    return {
      has: item.quantity >= requiredQuantity,
      quantity: item.quantity,
      itemId: item.id
    };
  }

  // Создать предмет
  async craftItem(characterId, recipeId) {
    const canCraft = await this.canCraft(characterId, recipeId);
    if (!canCraft.canCraft) {
      throw new Error(canCraft.reason);
    }
    
    const recipe = await db.get(
      'SELECT * FROM crafting_recipes WHERE id = ?',
      [recipeId]
    );
    
    const materials = JSON.parse(recipe.materials);
    
    // Начинаем транзакцию
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Забираем золото
      await db.run(
        'UPDATE characters SET gold = gold - ? WHERE id = ?',
        [recipe.required_gold, characterId]
      );
      
      // Забираем материалы
      for (const mat of materials) {
        await this.removeItem(characterId, mat.name, mat.quantity);
      }
      
      // Проверяем успех крафта
      const success = Math.random() < recipe.success_rate;
      
      if (!success) {
        await db.run('COMMIT');
        return {
          success: false,
          message: '❌ Крафт не удался! Материалы потеряны.'
        };
      }
      
      // Создаем предмет
      let newItemId;
      
      if (recipe.result_item_id) {
        // Если есть конкретный предмет-результат
        newItemId = recipe.result_item_id;
      } else {
        // Генерируем новый предмет на основе рецепта
        newItemId = await this.generateCraftedItem(recipe);
      }
      
      // Добавляем в инвентарь
      await this.addItemToInventory(characterId, newItemId);
      
      // Обновляем статистику
      await this.trackItemUsage(newItemId, 'crafted');
      
      await db.run('COMMIT');
      
      const item = await db.get('SELECT * FROM items WHERE id = ?', [newItemId]);
      
      return {
        success: true,
        item: item,
        message: `✅ Успешно создано: ${item.name}!`
      };
      
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  // Удалить предмет из инвентаря
  async removeItem(characterId, itemName, quantity) {
    const item = await db.get(`
      SELECT inv.id, inv.quantity, i.id as item_id
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE inv.character_id = ? AND i.name = ?
    `, [characterId, itemName]);
    
    if (!item || item.quantity < quantity) {
      throw new Error(`Недостаточно ${itemName}`);
    }
    
    if (item.quantity === quantity) {
      // Удаляем полностью
      await db.run('DELETE FROM inventory WHERE id = ?', [item.id]);
    } else {
      // Уменьшаем количество
      await db.run(
        'UPDATE inventory SET quantity = quantity - ? WHERE id = ?',
        [quantity, item.id]
      );
    }
  }

  // Генерировать созданный предмет
  async generateCraftedItem(recipe) {
    const recipeData = typeof recipe === 'string' ? JSON.parse(recipe) : recipe;
    
    // Находим базовый предмет
    const baseItem = await db.get(
      'SELECT * FROM items WHERE name = ?',
      [recipeData.result.baseName]
    );
    
    if (!baseItem) {
      throw new Error(`Базовый предмет не найден: ${recipeData.result.baseName}`);
    }
    
    // Создаем новый предмет на основе базового
    const newName = `${recipeData.result.prefix} ${baseItem.name}`;
    
    // Объединяем характеристики
    const baseStats = baseItem.stats_bonus ? JSON.parse(baseItem.stats_bonus) : {};
    const bonusStats = recipeData.result.bonusStats || {};
    const combinedStats = { ...baseStats };
    
    for (const [stat, value] of Object.entries(bonusStats)) {
      combinedStats[stat] = (combinedStats[stat] || 0) + value;
    }
    
    // Создаем новый предмет
    const result = await db.run(`
      INSERT INTO items (
        name, description, type, rarity, effects, requirements,
        value_gold, slot_type, weight, is_two_handed, weapon_type,
        armor_type, stats_bonus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newName,
      `${baseItem.description} (Улучшено крафтом)`,
      baseItem.type,
      this.getImprovedRarity(baseItem.rarity),
      baseItem.effects,
      baseItem.requirements,
      Math.floor(baseItem.value_gold * 1.5),
      baseItem.slot_type,
      baseItem.weight,
      baseItem.is_two_handed,
      baseItem.weapon_type,
      baseItem.armor_type,
      JSON.stringify(combinedStats)
    ]);
    
    return result.id;
  }

  // Получить улучшенную редкость
  getImprovedRarity(baseRarity) {
    const rarityProgression = {
      common: 'uncommon',
      uncommon: 'rare',
      rare: 'epic',
      epic: 'legendary',
      legendary: 'legendary'
    };
    return rarityProgression[baseRarity] || baseRarity;
  }

  // Добавить предмет в инвентарь
  async addItemToInventory(characterId, itemId) {
    const existing = await db.get(
      'SELECT id, quantity FROM inventory WHERE character_id = ? AND item_id = ?',
      [characterId, itemId]
    );
    
    if (existing) {
      await db.run(
        'UPDATE inventory SET quantity = quantity + 1 WHERE id = ?',
        [existing.id]
      );
    } else {
      await db.run(
        'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1)',
        [characterId, itemId]
      );
    }
  }

  // Отслеживание статистики
  async trackItemUsage(itemId, action) {
    const column = `times_${action}`;
    
    const exists = await db.get(
      'SELECT 1 FROM item_statistics WHERE item_id = ?',
      [itemId]
    );
    
    if (!exists) {
      await db.run(
        'INSERT INTO item_statistics (item_id) VALUES (?)',
        [itemId]
      );
    }
    
    await db.run(
      `UPDATE item_statistics SET ${column} = ${column} + 1 WHERE item_id = ?`,
      [itemId]
    );
  }

  // Получить список материалов для крафта
  async getCraftingMaterials() {
    // Это можно расширить для генерации материалов
    return [
      {
        name: 'Железный слиток',
        description: 'Основной материал для крафта',
        type: 'material',
        rarity: 'common',
        value: 10
      },
      {
        name: 'Уголь',
        description: 'Топливо для кузницы',
        type: 'material',
        rarity: 'common',
        value: 5
      },
      {
        name: 'Магический кристалл',
        description: 'Источник магической энергии',
        type: 'material',
        rarity: 'uncommon',
        value: 50
      },
      {
        name: 'Пыль звезд',
        description: 'Редкий магический компонент',
        type: 'material',
        rarity: 'rare',
        value: 200
      },
      {
        name: 'Металлические пластины',
        description: 'Для укрепления брони',
        type: 'material',
        rarity: 'common',
        value: 15
      },
      {
        name: 'Прочная нить',
        description: 'Для шитья и ремонта',
        type: 'material',
        rarity: 'common',
        value: 3
      }
    ];
  }
}

module.exports = new CraftingSystem();