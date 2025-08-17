// Шаг 1: Выбор расы

const config = require('../../../config/config');
const CreationUI = require('../utils/CreationUI');
const { log } = require('../../../utils/logger');

class RaceSelector {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }

  // Показать выбор расы
  async show(ctx) {
    log(`[RaceSelector] Показываем выбор расы`);

    const message = CreationUI.createRaceMessage();
    const buttons = CreationUI.createRaceButtons();

    log(`[RaceSelector] Отправляем сообщение с ${buttons.length} рядами кнопок`);

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }

  // Обработать выбор расы
  async handleSelection(ctx, race) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    log(`[RaceSelector] Выбор расы ${race} от ${userId} в чате ${chatId}`);

    // Проверяем сессию
    if (!this.sessionManager.isValid(userId, chatId, 'race')) {
      await ctx.answerCbQuery("Сессия создания истекла. Используйте /create");
      return false;
    }

    // Проверяем расу
    const raceConfig = config.RACES[race];
    if (!raceConfig) {
      await ctx.answerCbQuery("Неверная раса!");
      return false;
    }

    // Обновляем сессию
    this.sessionManager.update(userId, chatId, {
      step: 'class',
      data: { race }
    });

    log(`[RaceSelector] Раса выбрана: ${race}, переход к выбору класса`);

    // Анимация выбора
    await ctx.answerCbQuery(`Выбрана раса: ${raceConfig.name}!`);

    // Показываем информацию о расе с анимацией
    await ctx.editMessageText(
      `${raceConfig.emoji} **${raceConfig.name}**\n\n` +
      `${raceConfig.description}\n\n` +
      `🎲 Генерируем расовые бонусы...`,
      { parse_mode: "Markdown" }
    );

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Показываем бонусы
    const bonusMessage = CreationUI.createRaceBonusMessage(race);
    await ctx.editMessageText(
      bonusMessage + '\n\n✅ Раса выбрана! Переходим к выбору класса...',
      { parse_mode: "Markdown" }
    );

    await new Promise(resolve => setTimeout(resolve, 1500));

    return true;
  }
}

module.exports = RaceSelector;