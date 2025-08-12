const BaseMigration = require("../migration-system/BaseMigration");
const { logDatabase } = require("../../utils/logger");

class FixCharactersUniqueConstraintMigration extends BaseMigration {
  constructor() {
    super(6, "fix_characters_unique_constraint");
  }

  async up(db) {
    // Сначала убеждаемся, что все NULL значения заменены на 1
    await db.run(`
      UPDATE characters 
      SET is_active = 1 
      WHERE is_active IS NULL
    `);

    // Проверяем, существует ли старый индекс
    const indexes = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type = 'index' AND tbl_name = 'characters'
    `);

    // Удаляем старый индекс если есть
    if (indexes.some((idx) => idx.name === "idx_characters_user_chat")) {
      await db.run("DROP INDEX idx_characters_user_chat");
      logDatabase("Удален старый индекс idx_characters_user_chat");
    }

    // Создаем новый частичный уникальный индекс
    // Это позволит иметь несколько неактивных персонажей, но только одного активного
    await db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_active_character 
      ON characters(user_id, chat_id) 
      WHERE is_active = 1
    `);

    logDatabase("Создан новый частичный уникальный индекс для активных персонажей");
  }
}

module.exports = new FixCharactersUniqueConstraintMigration();