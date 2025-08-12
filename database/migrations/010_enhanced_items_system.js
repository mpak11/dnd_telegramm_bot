const BaseMigration = require("../migration-system/BaseMigration");
const { logDatabase } = require("../../utils/logger");

class EnhancedItemsSystemMigration extends BaseMigration {
  constructor() {
    super(10, "enhanced_items_system");
  }

  async up(db) {
    logDatabase("🎯 Обновляем систему предметов...");

    // Добавляем новые поля в таблицу items
    const columns = await db.all("PRAGMA table_info(items)");
    const columnNames = columns.map((col) => col.name);

    // Добавляем slot_type (куда экипируется предмет)
    if (!columnNames.includes("slot_type")) {
      await db.run(`ALTER TABLE items ADD COLUMN slot_type TEXT`);
      logDatabase("✅ Добавлено поле slot_type");
    }

    // Добавляем weight (вес предмета)
    if (!columnNames.includes("weight")) {
      await db.run(`ALTER TABLE items ADD COLUMN weight REAL DEFAULT 0`);
      logDatabase("✅ Добавлено поле weight");
    }

    // Добавляем is_two_handed (для оружия)
    if (!columnNames.includes("is_two_handed")) {
      await db.run(`ALTER TABLE items ADD COLUMN is_two_handed INTEGER DEFAULT 0`);
      logDatabase("✅ Добавлено поле is_two_handed");
    }

    // Добавляем weapon_type (тип оружия: slash, pierce, blunt, ranged, magic)
    if (!columnNames.includes("weapon_type")) {
      await db.run(`ALTER TABLE items ADD COLUMN weapon_type TEXT`);
      logDatabase("✅ Добавлено поле weapon_type");
    }

    // Добавляем armor_type (тип брони: light, medium, heavy)
    if (!columnNames.includes("armor_type")) {
      await db.run(`ALTER TABLE items ADD COLUMN armor_type TEXT`);
      logDatabase("✅ Добавлено поле armor_type");
    }

    // Добавляем stats_bonus (бонусы к характеристикам)
    if (!columnNames.includes("stats_bonus")) {
      await db.run(`ALTER TABLE items ADD COLUMN stats_bonus TEXT`);
      logDatabase("✅ Добавлено поле stats_bonus");
    }

    // Создаем таблицу торговцев
    await db.run(`
      CREATE TABLE IF NOT EXISTS merchants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        chat_id INTEGER,
        location TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logDatabase("✅ Создана таблица merchants");

    // Создаем таблицу инвентаря торговцев
    await db.run(`
      CREATE TABLE IF NOT EXISTS merchant_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT -1, -- -1 = бесконечное количество
        price_modifier REAL DEFAULT 1.0, -- множитель цены
        FOREIGN KEY (merchant_id) REFERENCES merchants(id),
        FOREIGN KEY (item_id) REFERENCES items(id),
        UNIQUE(merchant_id, item_id)
      )
    `);
    logDatabase("✅ Создана таблица merchant_inventory");

    // Добавляем базового торговца
    const existingMerchant = await db.get("SELECT id FROM merchants WHERE id = 1");
    if (!existingMerchant) {
      await db.run(`
        INSERT INTO merchants (id, name, description, location)
        VALUES (1, 'Гаррет Торговец', 'Дружелюбный торговец с базовыми товарами', 'Таверна')
      `);
      logDatabase("✅ Добавлен базовый торговец");
    }

    // Обновляем таблицу inventory для поддержки equipped по слотам
    const invColumns = await db.all("PRAGMA table_info(inventory)");
    const hasEquippedSlot = invColumns.some((col) => col.name === "equipped_slot");
    
    if (!hasEquippedSlot) {
      await db.run(`ALTER TABLE inventory ADD COLUMN equipped_slot TEXT`);
      logDatabase("✅ Добавлено поле equipped_slot в inventory");
    }

    logDatabase("✅ Система предметов обновлена!");
  }
}

module.exports = new EnhancedItemsSystemMigration();