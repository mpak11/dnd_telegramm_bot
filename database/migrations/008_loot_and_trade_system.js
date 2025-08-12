const BaseMigration = require("../migration-system/BaseMigration");
const { logDatabase } = require("../../utils/logger");

class LootAndTradeSystemMigration extends BaseMigration {
  constructor() {
    super(8, "loot_and_trade_system");
  }

  async up(db) {
    // Таблица сундуков с лутом
    await db.run(`
      CREATE TABLE IF NOT EXISTS loot_chests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        creator_id INTEGER,
        gold INTEGER DEFAULT 0,
        items TEXT, -- JSON массив ID предметов
        difficulty TEXT DEFAULT 'medium',
        claimed INTEGER DEFAULT 0,
        claimed_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES characters(id),
        FOREIGN KEY (claimed_by) REFERENCES characters(id)
      )
    `);
    logDatabase("✅ Создана таблица loot_chests");

    // Таблица истории обменов
    await db.run(`
      CREATE TABLE IF NOT EXISTS trade_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_character_id INTEGER NOT NULL,
        to_character_id INTEGER NOT NULL,
        from_items TEXT, -- JSON массив предметов
        from_gold INTEGER DEFAULT 0,
        to_items TEXT, -- JSON массив предметов
        to_gold INTEGER DEFAULT 0,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_character_id) REFERENCES characters(id),
        FOREIGN KEY (to_character_id) REFERENCES characters(id)
      )
    `);
    logDatabase("✅ Создана таблица trade_history");

    // Добавляем больше предметов в игру
    const newItems = [
      // Зелья и расходники
      {
        name: "Большое зелье лечения",
        description: "Восстанавливает 100 HP",
        type: "consumable",
        rarity: "uncommon",
        effects: { hp: 100 },
        value: 150,
      },
      {
        name: "Зелье невидимости",
        description: "Делает невидимым на 1 час",
        type: "consumable",
        rarity: "rare",
        effects: { invisibility: 60 },
        value: 500,
      },
      {
        name: "Свиток телепортации",
        description: "Телепортирует в безопасное место",
        type: "consumable",
        rarity: "rare",
        effects: { teleport: true },
        value: 1000,
      },
      // Обычное оружие
      {
        name: "Железный топор",
        description: "Простое но эффективное оружие",
        type: "weapon",
        rarity: "common",
        effects: { damage: 6 },
        value: 120,
      },
      {
        name: "Длинный лук",
        description: "Для дальних атак",
        type: "weapon",
        rarity: "common",
        effects: { damage: 5, dexterity: 1 },
        value: 150,
      },
      // Необычное оружие
      {
        name: "Серебряный клинок",
        description: "Эффективен против нежити",
        type: "weapon",
        rarity: "uncommon",
        effects: { damage: 8, holy_damage: 3 },
        value: 400,
      },
      {
        name: "Посох мага",
        description: "Увеличивает магическую силу",
        type: "weapon",
        rarity: "uncommon",
        effects: { damage: 4, intelligence: 2, wisdom: 1 },
        requirements: { class: "MAGE" },
        value: 600,
      },
      // Редкое оружие
      {
        name: "Клинок бури",
        description: "Наносит электрический урон",
        type: "weapon",
        rarity: "rare",
        effects: { damage: 12, lightning_damage: 5, dexterity: 2 },
        value: 1500,
      },
      {
        name: "Молот грома",
        description: "Оглушает врагов",
        type: "weapon",
        rarity: "rare",
        effects: { damage: 15, strength: 3, stun_chance: 0.2 },
        requirements: { strength: 16 },
        value: 2000,
      },
      // Броня
      {
        name: "Стальные доспехи",
        description: "Тяжелая защита",
        type: "armor",
        rarity: "uncommon",
        effects: { defense: 12, constitution: 1 },
        requirements: { strength: 14 },
        value: 800,
      },
      {
        name: "Мантия теней",
        description: "Легкая броня для скрытности",
        type: "armor",
        rarity: "rare",
        effects: { defense: 8, dexterity: 3, stealth: 5 },
        requirements: { class: "ROGUE" },
        value: 1800,
      },
      // Эпические предметы
      {
        name: "Доспехи дракона",
        description: "Выкованы из драконьей чешуи",
        type: "armor",
        rarity: "epic",
        effects: { defense: 20, all_stats: 1, fire_resistance: 0.5 },
        requirements: { level: 7 },
        value: 8000,
      },
      {
        name: "Скипетр властелина",
        description: "Символ абсолютной власти",
        type: "weapon",
        rarity: "epic",
        effects: { damage: 18, charisma: 5, wisdom: 3 },
        requirements: { level: 6 },
        value: 10000,
      },
      // Легендарные предметы
      {
        name: "Корона вечности",
        description: "Дарует бессмертие владельцу",
        type: "artifact",
        rarity: "legendary",
        effects: { hp_max: 100, hp_regen: 10, all_stats: 3 },
        requirements: { level: 9 },
        value: 50000,
        is_unique: 1,
      },
      {
        name: "Перчатка бесконечности",
        description: "Содержит силу шести камней",
        type: "artifact",
        rarity: "legendary",
        effects: { all_stats: 5, damage: 50, reality_warp: true },
        requirements: { level: 10 },
        value: 100000,
        is_unique: 1,
      },
      // Разное
      {
        name: "Счастливая монетка",
        description: "Приносит удачу",
        type: "misc",
        rarity: "uncommon",
        effects: { luck: 1 },
        value: 200,
      },
      {
        name: "Карта сокровищ",
        description: "Ведет к спрятанным богатствам",
        type: "misc",
        rarity: "rare",
        effects: { treasure_map: true },
        value: 1000,
      },
      {
        name: "Осколок души",
        description: "Фрагмент древней магии",
        type: "misc",
        rarity: "epic",
        effects: { soul_fragment: true },
        value: 5000,
      },
    ];

    // Добавляем новые предметы
    for (const item of newItems) {
      const existing = await db.get("SELECT id FROM items WHERE name = ?", [item.name]);
      if (!existing) {
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
            JSON.stringify(item.effects),
            item.requirements ? JSON.stringify(item.requirements) : null,
            item.value,
            item.is_unique || 0,
          ]
        );
      }
    }
    logDatabase(`✅ Добавлено ${newItems.length} новых предметов`);
  }
}

module.exports = new LootAndTradeSystemMigration();