// Управление сессиями создания персонажей

const { log } = require('../../utils/logger');

class SessionManager {
  constructor() {
    this.sessions = new Map();
    
    // Очистка сессий каждые 5 минут
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  // Создать новую сессию
  create(userId, chatId) {
    const sessionKey = `${userId}_${chatId}`;
    
    const session = {
      userId,
      chatId,
      step: 'race',
      data: {},
      timestamp: Date.now()
    };
    
    this.sessions.set(sessionKey, session);
    log(`[SessionManager] Создана сессия для ${sessionKey}`);
    
    return session;
  }

  // Получить сессию
  get(userId, chatId) {
    const sessionKey = `${userId}_${chatId}`;
    return this.sessions.get(sessionKey);
  }

  // Обновить сессию
  update(userId, chatId, updates) {
    const session = this.get(userId, chatId);
    if (!session) return null;
    
    Object.assign(session, updates);
    session.timestamp = Date.now();
    
    return session;
  }

  // Удалить сессию
  delete(userId, chatId) {
    const sessionKey = `${userId}_${chatId}`;
    const deleted = this.sessions.delete(sessionKey);
    
    if (deleted) {
      log(`[SessionManager] Удалена сессия для ${sessionKey}`);
    }
    
    return deleted;
  }

  // Проверить валидность сессии
  isValid(userId, chatId, expectedStep = null) {
    const session = this.get(userId, chatId);
    
    if (!session) return false;
    
    // Проверяем таймаут (30 минут)
    if (Date.now() - session.timestamp > 30 * 60 * 1000) {
      this.delete(userId, chatId);
      return false;
    }
    
    // Проверяем шаг если указан
    if (expectedStep && session.step !== expectedStep) {
      return false;
    }
    
    return true;
  }

  // Очистка старых сессий
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, session] of this.sessions.entries()) {
      if (now - session.timestamp > 30 * 60 * 1000) {
        this.sessions.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log(`[SessionManager] Очищено ${cleaned} истекших сессий`);
    }
  }

  // Остановить очистку (для graceful shutdown)
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = SessionManager;