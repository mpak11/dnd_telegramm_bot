const BaseMigration = require('../migration-system/BaseMigration');

class InitialDataMigration extends BaseMigration {
  constructor() {
    super(1, 'initial_data');
  }

  async up(db) {
    // Добавляем базовые классы в таблицу настроек
    await db.run(`
      CREATE TABLE IF NOT EXISTS game_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    await db.run(`
      INSERT OR REPLACE INTO game_settings (key, value) 
      VALUES ('version', '2.0.0')
    `);
  }
}

module.exports = new InitialDataMigration();