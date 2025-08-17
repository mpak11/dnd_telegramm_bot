// Шаг 4: Генерация характеристик

const config = require('../../../config/config');
const { Character } = require('../../../database/models');
const CreationUI = require('../utils/CreationUI');
const { log } = require('../../../utils/logger');

class StatsGenerator {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }

  // Показать сгенерированные характеристики
  async show(ctx, isNewMessage = false) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const session = this.sessionManager.get(userId, chatId);

    if (!session) return false;

    // Генерируем характеристики
    const baseStats = Character.rollStats();
    
    // Обновляем сессию
    this.sessionManager.update(userId, chatId, {
      data: {
        ...session.data,
        stats: baseStats
      }
    });

    const message = CreationUI.createStatsMessage(baseStats, session.data.race);
    const fullMessage = message + 
      "\n✅ Характеристики сгенерированы!\n\n" +
      "Вы можете принять эти характеристики или перебросить";

    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Принять", callback_data: "stats_accept" },
          { text: "🎲 Перебросить", callback_data: "stats_reroll" },
        ],
      ],
    };

    if (isNewMessage) {
      // Для новых сообщений (после ввода имени)
      await ctx.reply(fullMessage, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      // Для callback (анимированный показ)
      await this.showAnimated(ctx, baseStats, session.data.race);
    }

    return true;
  }

  // Анимированный показ характеристик
  async showAnimated(ctx, baseStats, race) {
    const animMessage = await ctx.reply(
      `🎲 **Бросаем кубики для определения характеристик...**\n\n` +
      `Используется метод 4d6, отбрасываем минимум`,
      { parse_mode: "Markdown" }
    );

    let message = `**🎲 Результаты бросков:**\n\n`;
    const raceConfig = config.RACES[race];

    // Анимация броска для каждой характеристики
    for (const [stat, value] of Object.entries(baseStats)) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const statConfig = config.STATS[stat];
      const raceBonus = raceConfig.bonuses[stat];
      const finalValue = value + raceBonus;
      const modifier = Math.floor((finalValue - 10) / 2);

      message += `${statConfig.emoji} ${statConfig.name}: **${finalValue}** `;
      message += `(${modifier >= 0 ? "+" : ""}${modifier})\n`;

      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          animMessage.message_id,
          null,
          message,
          { parse_mode: "Markdown" }
        );
      } catch (error) {
        log(`[StatsGenerator] Ошибка анимации: ${error.message}`, "warning");
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Финальное сообщение с кнопками
    const fullMessage = message + 
      "\n✅ Характеристики сгенерированы!\n\n" +
      "Вы можете принять эти характеристики или перебросить";

    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        animMessage.message_id,
        null,
        fullMessage,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Принять", callback_data: "stats_accept" },
                { text: "🎲 Перебросить", callback_data: "stats_reroll" },
              ],
            ],
          },
        }
      );
    } catch (error) {
      log(`[StatsGenerator] Ошибка финального сообщения: ${error.message}`, "warning");
    }
  }

  // Обработать решение по характеристикам
  async handleDecision(ctx, decision) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    if (!this.sessionManager.isValid(userId, chatId, 'stats')) {
      await ctx.answerCbQuery("Сессия истекла. Используйте /create");
      return false;
    }

    if (decision === 'reroll') {
      await ctx.answerCbQuery("🎲 Перебрасываем...");
      
      // Генерируем новые характеристики
      const session = this.sessionManager.get(userId, chatId);
      const baseStats = Character.rollStats();
      
      // Обновляем сессию
      this.sessionManager.update(userId, chatId, {
        data: {
          ...session.data,
          stats: baseStats
        }
      });

      const message = CreationUI.createStatsMessage(baseStats, session.data.race);
      const fullMessage = message + 
        "\n✅ Характеристики сгенерированы!\n\n" +
        "Вы можете принять эти характеристики или перебросить";

      await ctx.editMessageText(fullMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Принять", callback_data: "stats_accept" },
              { text: "🎲 Перебросить", callback_data: "stats_reroll" },
            ],
          ],
        },
      });

      return true;
    }

    // decision === 'accept'
    await ctx.answerCbQuery("✅ Создаем персонажа...");
    return true;
  }
}

module.exports = StatsGenerator;