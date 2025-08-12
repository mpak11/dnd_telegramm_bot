const { log } = require("../../utils/logger");

class CallbackRouter {
  constructor() {
    this.routes = new Map();
  }
  
  register(pattern, handler) {
    this.routes.set(pattern, handler);
    log(`[CallbackRouter] Зарегистрирован маршрут: ${pattern}`);
  }
  
  async route(ctx) {
    const data = ctx.callbackQuery.data;
    
    for (const [pattern, handler] of this.routes) {
      if (data.startsWith(pattern)) {
        log(`[CallbackRouter] Обработка callback: ${data} -> ${pattern}`);
        return handler(ctx);
      }
    }
    
    log(`[CallbackRouter] Не найден обработчик для: ${data}`, "warning");
    await ctx.answerCbQuery("❌ Неизвестная команда");
  }
}

module.exports = CallbackRouter;