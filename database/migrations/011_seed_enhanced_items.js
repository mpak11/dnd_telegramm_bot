const BaseMigration = require("../migration-system/BaseMigration");
const { logDatabase } = require("../../utils/logger");

class SeedEnhancedItemsMigration extends BaseMigration {
  constructor() {
    super(11, "seed_enhanced_items");
  }

  async up(db) {
    // Импортируем функцию seedItems
    const originalDb = require("../index");

    // Подменяем методы
    originalDb.get = db.get.bind(db);
    originalDb.run = db.run.bind(db);
    originalDb.all = db.all.bind(db);

    const seedItems = require("../seeders/items");
    await seedItems();

    logDatabase("✅ Предметы добавлены через сидер");
  }
}

module.exports = new SeedEnhancedItemsMigration();
