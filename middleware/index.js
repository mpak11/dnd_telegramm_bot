// Middleware для обработки запросов

const { log } = require('../utils/logger');

function setupMiddleware(bot) {
  // Логирование всех сообщений
  bot.use(async (ctx, next) => {
    const start = Date.now();
    
    // Логируем входящее сообщение
    if (ctx.message) {
      if (ctx.message.text) {
        log(`[${ctx.from.id}] ${ctx.from.first_name}: ${ctx.message.text}`, 'debug');
      } else {
        log(`[${ctx.from.id}] ${ctx.from.first_name}: [не текстовое сообщение]`, 'debug');
      }
    } else if (ctx.callbackQuery) {
      log(`[Callback] ${ctx.from.id}: ${ctx.callbackQuery.data}`, 'debug');
    }
    
    // Продолжаем обработку
    await next();
    
    // Логируем время обработки
    const ms = Date.now() - start;
    log(`Обработано за ${ms}мс`, 'debug');
  });
  
  // Проверка типа чата (только группы и приватные чаты)
  bot.use(async (ctx, next) => {
    if (ctx.chat && (ctx.chat.type === 'private' || ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
      await next();
    }
  });
  
  log('✅ Middleware настроен', 'success');
}

module.exports = {
  setupMiddleware
};