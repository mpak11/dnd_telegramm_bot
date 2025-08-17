// Шаг 3: Ввод имени персонажа

const { log } = require("../../../utils/logger");

class NameHandler {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }

  // Обработать ввод имени из текстового сообщения
  async handleTextInput(ctx) {
    if (!ctx.message || !ctx.message.text) {
      return false;
    }

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    log(`[NameHandler] Попытка ввода имени от ${userId} в чате ${chatId}`);

    // Проверяем сессию
    if (!this.sessionManager.isValid(userId, chatId, "name")) {
      return false;
    }

    const name = ctx.message.text.trim();
    return await this.processName(ctx, name, true);
  }

  // Обработать команду /setname
  async handleCommand(ctx, name) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    log(`[NameHandler] Команда /setname от ${userId}: "${name}"`);

    // Проверяем сессию
    if (!this.sessionManager.isValid(userId, chatId, "name")) {
      await ctx.reply(
        `❌ Вы не находитесь в процессе создания персонажа.\n\n` +
          `Используйте /create для начала создания.`,
        { parse_mode: "Markdown" }
      );
      return false;
    }

    return await this.processName(ctx, name, false);
  }

  // Обработать введенное имя
  async processName(ctx, name, isTextInput) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    log(`[NameHandler] Обработка имени: "${name}"`);

    // Валидация имени
    const validation = this.validateName(name);
    if (!validation.valid) {
      await ctx.reply(`❌ ${validation.error}`);
      return true;
    }

    // Обновляем сессию
    const session = this.sessionManager.update(userId, chatId, {
      step: "stats",
      data: {
        ...this.sessionManager.get(userId, chatId).data,
        name: name,
      },
    });

    log(
      `[NameHandler] Имя принято: "${name}", переход к генерации характеристик`
    );

    // Отправляем подтверждение
    await ctx.reply(
      `✅ Имя принято: **${name}**\n\nГенерируем характеристики...`,
      { parse_mode: "Markdown" }
    );

    const characterCreation = require("../index");
    await characterCreation.showStatsGeneration(ctx, true);

    return true;
  }

  // Валидация имени
  validateName(name) {
    if (name.length < 2 || name.length > 20) {
      return {
        valid: false,
        error: "Имя должно быть от 2 до 20 символов!",
      };
    }

    if (!/^[а-яА-ЯёЁa-zA-Z\s-]+$/.test(name)) {
      return {
        valid: false,
        error: "Имя может содержать только буквы, пробелы и дефисы!",
      };
    }

    return { valid: true };
  }
}

module.exports = NameHandler;
