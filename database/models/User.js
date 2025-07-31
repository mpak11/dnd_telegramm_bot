// Модель пользователя

const db = require('../index');

class User {
  constructor(data) {
    this.id = data.id;
    this.telegram_id = data.telegram_id;
    this.telegram_username = data.telegram_username;
    this.first_name = data.first_name;
    this.created_at = data.created_at;
    this.last_active = data.last_active;
  }

  // Создание или обновление пользователя
  static async findOrCreate(telegramUser) {
    const existing = await db.get(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegramUser.id]
    );

    if (existing) {
      // Обновляем последнюю активность
      await db.run(
        `UPDATE users 
         SET telegram_username = ?, first_name = ?, last_active = CURRENT_TIMESTAMP 
         WHERE telegram_id = ?`,
        [
          telegramUser.username || null,
          telegramUser.first_name,
          telegramUser.id
        ]
      );
      return new User(existing);
    } else {
      // Создаем нового пользователя
      const { id } = await db.run(
        `INSERT INTO users (telegram_id, telegram_username, first_name) 
         VALUES (?, ?, ?)`,
        [
          telegramUser.id,
          telegramUser.username || null,
          telegramUser.first_name
        ]
      );

      const newUser = await db.get('SELECT * FROM users WHERE id = ?', [id]);
      return new User(newUser);
    }
  }

  // Найти по telegram_id
  static async findByTelegramId(telegramId) {
    const data = await db.get(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegramId]
    );
    return data ? new User(data) : null;
  }

  // Обновить последнюю активность
  async updateActivity() {
    await db.run(
      'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = ?',
      [this.id]
    );
  }
}

module.exports = User;