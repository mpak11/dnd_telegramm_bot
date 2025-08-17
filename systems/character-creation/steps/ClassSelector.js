// Шаг 2: Выбор класса

const config = require('../../../config/config');
const CreationUI = require('../utils/CreationUI');
const { log } = require('../../../utils/logger');

class ClassSelector {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }

  // Показать выбор класса
  async show(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const session = this.sessionManager.get(userId, chatId);

    if (!session) {
      await ctx.reply("Сессия истекла. Используйте /create");
      return false;
    }

    const selectedRace = session.data.race;
    const message = CreationUI.createClassMessage(selectedRace);
    const buttons = CreationUI.createClassButtons(selectedRace);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    });

    return true;
  }

  // Обработать выбор класса
  async handleSelection(ctx, characterClass) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    log(`[ClassSelector] Выбор класса ${characterClass} от ${userId} в чате ${chatId}`);

    // Проверяем сессию
    if (!this.sessionManager.isValid(userId, chatId, 'class')) {
      await ctx.answerCbQuery("Сессия создания истекла. Используйте /create");
      return false;
    }

    // Проверяем класс
    const classConfig = config.CLASSES[characterClass];
    if (!classConfig) {
      await ctx.answerCbQuery("Неверный класс!");
      return false;
    }

    // Обновляем сессию
    const session = this.sessionManager.update(userId, chatId, {
      step: 'name',
      data: { 
        ...this.sessionManager.get(userId, chatId).data,
        class: characterClass 
      }
    });

    log(`[ClassSelector] Класс выбран: ${characterClass}, переход к вводу имени`);

    await ctx.answerCbQuery(`Выбран класс: ${classConfig.name}!`);

    // Показываем информацию о классе
    await ctx.editMessageText(
      `${classConfig.emoji} **${classConfig.name}**\n\n` +
      `${classConfig.description}\n\n` +
      `❤️ Базовое здоровье: ${classConfig.baseHP}\n` +
      `📈 HP за уровень: ${classConfig.hpPerLevel}\n` +
      `📊 Основная характеристика: ${config.STATS[classConfig.primaryStat].emoji} ` +
      `${config.STATS[classConfig.primaryStat].name}\n\n` +
      `✅ Класс выбран!`,
      { parse_mode: "Markdown" }
    );

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Запрашиваем имя
    await ctx.reply(
      `**Шаг 3: Введите имя персонажа**\n\n` +
      `Имя должно быть от 2 до 20 символов\n` +
      `Разрешены только буквы, пробелы и дефисы\n\n` +
      `⚠️ **Если бот не видит ваши сообщения в группе:**\n` +
      `Используйте команду: /setname ИмяПерсонажа\n` +
      `Например: /setname Горак Сильный`,
      { parse_mode: "Markdown" }
    );

    return true;
  }
}

module.exports = ClassSelector;