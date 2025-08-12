const BaseMigration = require('../migration-system/BaseMigration');
const { logDatabase } = require('../../utils/logger');

class DefaultItemsMigration extends BaseMigration {
  constructor() {
    super(2, 'default_items');
  }

  async up(db) {
    // Проверяем, есть ли уже предметы
    const existingItems = await db.get("SELECT COUNT(*) as count FROM items");
    if (existingItems.count > 0) {
      logDatabase("Предметы уже существуют, пропускаем");
      return;
    }

    const items = [
      // Расходники
      {
        name: "Зелье лечения",
        description: "Восстанавливает 50 HP",
        type: "consumable",
        rarity: "common",
        effects: JSON.stringify({ hp: 50 }),
        value_gold: 50,
      },
      {
        name: "Зелье маны",
        description: "Восстанавливает 30 MP",
        type: "consumable",
        rarity: "common",
        effects: JSON.stringify({ mp: 30 }),
        value_gold: 40,
      },
      // Оружие
      {
        name: "Ржавый меч",
        description: "Старый, но все еще острый",
        type: "weapon",
        rarity: "common",
        effects: JSON.stringify({ damage: 5 }),
        value_gold: 100,
      },
      {
        name: "Стальной меч",
        description: "Надежное оружие воина",
        type: "weapon",
        rarity: "uncommon",
        effects: JSON.stringify({ damage: 10, strength: 1 }),
        value_gold: 500,
      },
      // Броня
      {
        name: "Кожаная броня",
        description: "Легкая защита",
        type: "armor",
        rarity: "common",
        effects: JSON.stringify({ defense: 5 }),
        value_gold: 150,
      },
      {
        name: "Кольчуга",
        description: "Прочная металлическая защита",
        type: "armor",
        rarity: "uncommon",
        effects: JSON.stringify({ defense: 10, constitution: 1 }),
        value_gold: 600,
      },
      // Редкие предметы
      {
        name: "Пылающий меч",
        description: "Клинок, объятый вечным пламенем",
        type: "weapon",
        rarity: "rare",
        effects: JSON.stringify({ damage: 15, strength: 2, fire_damage: 5 }),
        value_gold: 2000,
      },
      // Эпические предметы
      {
        name: "Мантия архимага",
        description: "Одеяние великого волшебника",
        type: "armor",
        rarity: "epic",
        effects: JSON.stringify({ defense: 8, intelligence: 3, wisdom: 2 }),
        requirements: JSON.stringify({ class: "MAGE", level: 5 }),
        value_gold: 5000,
      },
      // Легендарные предметы (уникальные)
      {
        name: "Экскалибур",
        description: "Легендарный меч короля",
        type: "weapon",
        rarity: "legendary",
        effects: JSON.stringify({ damage: 25, strength: 5, charisma: 3 }),
        requirements: JSON.stringify({ level: 8 }),
        value_gold: 50000,
        is_unique: 1,
      },
      {
        name: "Сердце дракона",
        description: "Пылающий рубин с душой древнего дракона",
        type: "artifact",
        rarity: "legendary",
        effects: JSON.stringify({ hp_max: 50, all_stats: 2 }),
        value_gold: 100000,
        is_unique: 1,
      },
    ];

    // Вставляем предметы
    for (const item of items) {
      await db.run(
        `
        INSERT INTO items (name, description, type, rarity, effects, requirements, value_gold, is_unique)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          item.name,
          item.description,
          item.type,
          item.rarity,
          item.effects,
          item.requirements || null,
          item.value_gold,
          item.is_unique || 0,
        ]
      );
    }

    logDatabase(`Добавлено ${items.length} базовых предметов`);
  }
}

module.exports = new DefaultItemsMigration();