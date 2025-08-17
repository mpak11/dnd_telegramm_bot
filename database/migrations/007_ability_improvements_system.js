const BaseMigration = require("../migration-system/BaseMigration");
const { logDatabase } = require("../../utils/logger");

class AbilityImprovementsSystemMigration extends BaseMigration {
  constructor() {
    super(7, "ability_improvements_system");
  }

  async up(db) {
    // Добавляем поле ability_points если его нет
    const columns = await db.all("PRAGMA table_info(characters)");
    const hasAbilityPoints = columns.some((col) => col.name === "ability_points");

    if (!hasAbilityPoints) {
      await db.run("ALTER TABLE characters ADD COLUMN ability_points INTEGER DEFAULT 0");
      logDatabase("✅ Добавлено поле ability_points");

      // Даем очки существующим персонажам 4+ уровня
      await db.run(`
        UPDATE characters 
        SET ability_points = 
          CASE 
            WHEN level >= 8 THEN 4
            WHEN level >= 4 THEN 2
            ELSE 0
          END
        WHERE is_active = 1
      `);
      logDatabase("✅ Выданы очки улучшения существующим персонажам");
    }

    // Создаем таблицу истории улучшений
    await db.run(`
      CREATE TABLE IF NOT EXISTS ability_improvements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        level INTEGER NOT NULL,
        stat_name TEXT NOT NULL,
        improvement INTEGER NOT NULL,
        improved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id)
      )
    `);
    logDatabase("✅ Создана таблица ability_improvements");
  }
}

module.exports = new AbilityImprovementsSystemMigration();