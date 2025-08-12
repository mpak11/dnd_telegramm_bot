// Подключение и управление базой данных SQLite

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const { log, logDatabase } = require('../utils/logger');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.resolve(config.DATABASE_PATH);
    this.isInitialized = false;
  }

  // Подключение к БД
  async connect() {
    return new Promise((resolve, reject) => {
      // Создаем директорию если её нет
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logDatabase('Создана директория для БД');
      }

      // Подключаемся к БД
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          log(`❌ Ошибка подключения к БД: ${err.message}`, 'error');
          reject(err);
        } else {
          logDatabase(`Подключено к БД: ${this.dbPath}`);
          
          // Включаем foreign keys
          this.db.run('PRAGMA foreign_keys = ON');
          
          resolve();
        }
      });
    });
  }

  // Выполнение SQL запроса
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logDatabase(`Ошибка запроса: ${err.message}`);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // Получение одной записи
  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logDatabase(`Ошибка запроса: ${err.message}`);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Получение всех записей
  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logDatabase(`Ошибка запроса: ${err.message}`);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Транзакция
  async transaction(callback) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.run('BEGIN TRANSACTION');
        const result = await callback();
        await this.run('COMMIT');
        resolve(result);
      } catch (error) {
        await this.run('ROLLBACK');
        reject(error);
      }
    });
  }

  // Инициализация БД (создание таблиц)
  async initialize() {
    if (this.isInitialized) return;

    try {
      logDatabase('Инициализация базы данных...');
      
      // Читаем и выполняем schema.sql
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Разделяем на отдельные запросы
      const queries = schema
        .split(';')
        .map(q => q.trim())
        .filter(q => q.length > 0);

      // Выполняем каждый запрос
      for (const query of queries) {
        await this.run(query);
      }

      // Запускаем миграции
      this.isInitialized = true;
      logDatabase('✅ База данных инициализирована');
      
    } catch (error) {
      log(`❌ Ошибка инициализации БД: ${error.message}`, 'error');
      throw error;
    }
  }

  // Закрытие соединения
  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          logDatabase('Соединение с БД закрыто');
          resolve();
        }
      });
    });
  }
}

// Экспортируем singleton
module.exports = new Database();