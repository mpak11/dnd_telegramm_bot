const BaseMigration = require("../migration-system/BaseMigration");
const { logDatabase } = require("../../utils/logger");

class QuestHistoryItemsMigration extends BaseMigration {
  constructor() {
    super(9, "quest_history_items");
  }

  async up(db) {
    // Добавляем поле для хранения полученных предметов в истории квестов
    const columns = await db.all("PRAGMA table_info(quest_history)");
    const hasItemsGained = columns.some((col) => col.name === "items_gained");

    if (!hasItemsGained) {
      await db.run("ALTER TABLE quest_history ADD COLUMN items_gained TEXT");
      logDatabase("✅ Добавлено поле items_gained в quest_history");
    }

    // Создаем индекс для ускорения поиска уникальных предметов
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_unique_items 
      ON items(is_unique)
      WHERE is_unique = 1
    `);
    logDatabase("✅ Создан индекс для уникальных предметов");

    // Добавляем поле equipped если его нет
    const invColumns = await db.all("PRAGMA table_info(inventory)");
    const hasEquipped = invColumns.some((col) => col.name === "equipped");

    if (!hasEquipped) {
      await db.run("ALTER TABLE inventory ADD COLUMN equipped INTEGER DEFAULT 0");
      logDatabase("✅ Добавлено поле equipped в inventory");
    }
  }
}

module.exports = new QuestHistoryItemsMigration();