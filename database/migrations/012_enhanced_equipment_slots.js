const BaseMigration = require("../migration-system/BaseMigration");
const { logDatabase } = require("../../utils/logger");

class EnhancedEquipmentSlotsMigration extends BaseMigration {
  constructor() {
    super(12, "enhanced_equipment_slots");
  }

  async up(db) {
    logDatabase("🎯 Добавляем новые слоты экипировки...");

    // Создаем таблицу слотов персонажа
    await db.run(`
      CREATE TABLE IF NOT EXISTS character_equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        slot_name TEXT NOT NULL,
        item_id INTEGER,
        FOREIGN KEY (character_id) REFERENCES characters(id),
        FOREIGN KEY (item_id) REFERENCES items(id),
        UNIQUE(character_id, slot_name)
      )
    `);

    // Добавляем индекс
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_character_equipment 
      ON character_equipment(character_id)
    `);

    // Создаем таблицу статистики предметов
    await db.run(`
      CREATE TABLE IF NOT EXISTS item_statistics (
        item_id INTEGER PRIMARY KEY,
        times_bought INTEGER DEFAULT 0,
        times_sold INTEGER DEFAULT 0,
        times_equipped INTEGER DEFAULT 0,
        times_dropped INTEGER DEFAULT 0,
        times_crafted INTEGER DEFAULT 0,
        FOREIGN KEY (item_id) REFERENCES items(id)
      )
    `);

    // Создаем таблицу рецептов крафтинга
    await db.run(`
      CREATE TABLE IF NOT EXISTS crafting_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        result_item_id INTEGER,
        required_level INTEGER DEFAULT 1,
        required_gold INTEGER DEFAULT 0,
        materials TEXT NOT NULL, -- JSON массив {item_id, quantity}
        tools_required TEXT, -- JSON массив инструментов
        success_rate REAL DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (result_item_id) REFERENCES items(id)
      )
    `);

    // Создаем таблицу репутации с торговцами
    await db.run(`
      CREATE TABLE IF NOT EXISTS merchant_reputation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        merchant_id INTEGER NOT NULL,
        reputation INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        total_sold INTEGER DEFAULT 0,
        last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        special_flags TEXT, -- JSON для особых событий
        FOREIGN KEY (character_id) REFERENCES characters(id),
        FOREIGN KEY (merchant_id) REFERENCES merchants(id),
        UNIQUE(character_id, merchant_id)
      )
    `);

    logDatabase("✅ Новые системы добавлены!");
  }
}

module.exports = new EnhancedEquipmentSlotsMigration();