const { logDatabase } = require('../../utils/logger');
const fs = require('fs');
const path = require('path');

class MigrationManager {
  constructor() {
    this.migrations = [];
    this.loadMigrations();
  }

  loadMigrations() {
    // Загружаем миграции из папки database/migrations
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      logDatabase('Папка миграций не найдена');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Важно для правильного порядка

    for (const file of files) {
      const migration = require(path.join(migrationsDir, file));
      this.migrations.push(migration);
    }

    logDatabase(`Загружено ${this.migrations.length} миграций`);
  }

  async migrate(db) {
    // Создаем таблицу миграций если её нет
    await db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Получаем текущую версию
    const currentVersion = await this.getCurrentVersion(db);
    logDatabase(`Текущая версия БД: ${currentVersion}`);

    // Применяем новые миграции
    for (const migration of this.migrations) {
      if (migration.version > currentVersion) {
        logDatabase(`Применяем миграцию ${migration.version}: ${migration.name}`);

        try {
          // Выполняем миграцию
          await migration.up(db);

          // Записываем в таблицу миграций
          await db.run("INSERT INTO migrations (version, name) VALUES (?, ?)", [
            migration.version,
            migration.name,
          ]);

          logDatabase(`✅ Миграция ${migration.version} применена`);
        } catch (error) {
          logDatabase(`❌ Ошибка миграции ${migration.version}: ${error.message}`);
          throw error;
        }
      }
    }
  }

  async getCurrentVersion(db) {
    const row = await db.get("SELECT MAX(version) as version FROM migrations");
    return row?.version || 0;
  }
}

module.exports = new MigrationManager();