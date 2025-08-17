const BaseHandler = require("../../core/BaseHandler");
const { Character } = require("../../../database/models");
const config = require("../../../config/config");

class CharacterStatsHandler extends BaseHandler {
  // Показать детальную статистику
  async handleShowStats(ctx) {
    await this.withCharacter(ctx, async (character) => {
      const classConfig = config.CLASSES[character.class];
      const raceConfig = config.RACES[character.race];

      let statsText = `📊 **Детальная статистика**\n\n`;
      statsText += `🎭 ${character.name}\n`;
      statsText += `${character.getFullTitle()} • ${
        character.level
      } уровень\n\n`;

      // Боевые характеристики
      statsText += `**⚔️ Боевые параметры:**\n`;
      statsText += `❤️ Здоровье: ${character.hp_current}/${character.hp_max}\n`;
      statsText += `🎯 Бонус мастерства: +${character.getProficiencyBonus()}\n`;
      statsText += `🗡️ Основная характеристика: ${classConfig.primaryStat}\n\n`;

      // Все характеристики с бонусами к броскам
      statsText += `**🎲 Модификаторы бросков:**\n`;
      for (const [stat, info] of Object.entries(config.STATS)) {
        const bonus = character.getRollBonus(stat);
        const isPrimary = classConfig.primaryStat === stat;
        statsText += `${info.emoji} ${info.name}: ${
          bonus >= 0 ? "+" : ""
        }${bonus}`;
        if (isPrimary) statsText += " ⭐";
        statsText += "\n";
      }

      // Прогресс
      statsText += `\n**📈 Прогресс:**\n`;
      statsText += `✨ Опыт: ${character.experience}\n`;
      statsText += `💰 Золото: ${character.gold}\n`;

      // Расовые особенности
      if (raceConfig.abilities.length > 0) {
        statsText += `\n**${raceConfig.emoji} Расовые способности:**\n`;
        for (const ability of raceConfig.abilities) {
          statsText += `• ${ability}\n`;
        }
      }

      await ctx.reply(statsText, { parse_mode: "Markdown" });
    });
  }

  // Добавим сюда функции улучшения характеристик из основного файла
  async handleImprove(ctx) {
    await this.withCharacter(ctx, async (character) => {
      if (!(await this.checkCharacterAlive(character, ctx))) return;

      const points = character.ability_points || 0;

      if (points === 0) {
        await ctx.reply(
          `❌ У вас нет очков улучшения!\n\n` +
            `Очки улучшения даются на ${config.ABILITY_IMPROVEMENT_LEVELS.join(
              ", "
            )} уровнях.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      let message = `⚡ **Улучшение характеристик**\n\n`;
      message += `У вас есть **${points}** ${
        points === 1 ? "очко" : "очка"
      } улучшения.\n\n`;
      message += `**Текущие характеристики:**\n`;

      // Показываем текущие характеристики
      for (const [stat, info] of Object.entries(config.STATS)) {
        const value = character[stat];
        const modifier = character.getStatModifier(stat);
        const canImprove = value < config.MAX_ABILITY_SCORE;

        message += `${info.emoji} ${info.name}: ${value} (${
          modifier >= 0 ? "+" : ""
        }${modifier})`;
        if (!canImprove) message += " [MAX]";
        message += "\n";
      }

      message += `\n**Выберите режим улучшения:**`;

      const keyboard = [
        [
          {
            text: "📈 +2 к одной характеристике",
            callback_data: "improve_single",
          },
        ],
        [
          {
            text: "📊 +1 к двум характеристикам",
            callback_data: "improve_double",
          },
        ],
        [{ text: "❌ Отмена", callback_data: "improve_cancel" }],
      ];

      // Если только 1 очко, показываем только вариант +1
      if (points === 1) {
        keyboard.splice(0, 1); // Убираем опцию +2
      }

      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    });
  }

  async handleImprovementHistory(ctx) {
    await this.withCharacter(ctx, async (character) => {
      const history = await character.getImprovementHistory();

      if (history.length === 0) {
        await ctx.reply(
          `📜 **История улучшений ${character.name}**\n\n` +
            `Вы еще не улучшали характеристики.\n` +
            `Очки улучшения даются на ${config.ABILITY_IMPROVEMENT_LEVELS.join(
              ", "
            )} уровнях.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      let message = `📜 **История улучшений ${character.name}**\n\n`;

      for (const imp of history) {
        const statInfo = config.STATS[imp.stat_name];
        const date = new Date(imp.improved_at).toLocaleDateString("ru-RU");

        message += `${statInfo.emoji} ${statInfo.name} +${imp.improvement} (ур. ${imp.level}) - ${date}\n`;
      }

      if (character.ability_points > 0) {
        message += `\n💎 Доступно очков: ${character.ability_points}`;
      }

      await ctx.reply(message, { parse_mode: "Markdown" });
    });
  }
  async handleImprovementCallback(ctx) {
    const action = ctx.callbackQuery.data;

    // Отмена
    if (action === "improve_cancel") {
      await ctx.answerCbQuery("Отменено");
      await ctx.deleteMessage();
      return;
    }

    await this.withCharacter(ctx, async (character) => {
      if (!(await this.checkCharacterAlive(character, ctx))) return;

      const points = character.ability_points || 0;
      if (points === 0) {
        await ctx.answerCbQuery("Нет очков улучшения!");
        return;
      }

      // Обработка выбора режима
      if (action === "improve_single") {
        // +2 к одной характеристике
        if (points < 2) {
          await ctx.answerCbQuery("Нужно 2 очка!");
          return;
        }

        await this.showStatSelection(ctx, character, "single");
      } else if (action === "improve_double") {
        // +1 к двум характеристикам
        await this.showStatSelection(ctx, character, "double");
      } else if (action.startsWith("improve_stat_")) {
        // Выбрана конкретная характеристика
        const parts = action.split("_");
        const mode = parts[2]; // single или double
        const stat = parts[3]; // название характеристики

        await this.processStatImprovement(ctx, character, mode, stat);
      }
    });
  }

  // Показать выбор характеристики
  async showStatSelection(ctx, character, mode) {
    const points = mode === "single" ? 2 : 1;
    let message = `⚡ **Выберите характеристику для улучшения**\n\n`;
    message +=
      mode === "single"
        ? `Вы получите +2 к выбранной характеристике\n\n`
        : `Вы получите +1 к выбранной характеристике\n\n`;

    const keyboard = [];

    for (const [stat, info] of Object.entries(config.STATS)) {
      const currentValue = character[stat];
      const canImprove = currentValue + points <= config.MAX_ABILITY_SCORE;

      if (canImprove) {
        keyboard.push([
          {
            text: `${info.emoji} ${info.name} (${currentValue} → ${
              currentValue + points
            })`,
            callback_data: `improve_stat_${mode}_${stat}`,
          },
        ]);
      }
    }

    keyboard.push([
      {
        text: "❌ Отмена",
        callback_data: "improve_cancel",
      },
    ]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  // Обработать улучшение характеристики
  async processStatImprovement(ctx, character, mode, stat) {
    try {
      const points = mode === "single" ? 2 : 1;
      const result = await character.improveAbility(stat, points);

      const statInfo = config.STATS[stat];
      let message = `✅ **Характеристика улучшена!**\n\n`;
      message += `${statInfo.emoji} ${statInfo.name}: ${result.oldValue} → ${result.newValue}\n`;

      if (result.hpIncrease > 0) {
        message += `❤️ HP увеличено на ${result.hpIncrease}\n`;
      }

      // Если режим double и есть еще очки, показываем выбор второй характеристики
      if (mode === "double" && character.ability_points >= 1) {
        message += `\n💎 Осталось очков: ${character.ability_points}\n`;
        message += `Выберите вторую характеристику для улучшения:`;

        const keyboard = [];
        for (const [stat2, info2] of Object.entries(config.STATS)) {
          if (stat2 !== stat) {
            // Нельзя улучшить ту же характеристику
            const currentValue = character[stat2];
            const canImprove = currentValue + 1 <= config.MAX_ABILITY_SCORE;

            if (canImprove) {
              keyboard.push([
                {
                  text: `${info2.emoji} ${info2.name} (${currentValue} → ${
                    currentValue + 1
                  })`,
                  callback_data: `improve_stat_single_${stat2}`,
                },
              ]);
            }
          }
        }

        await ctx.editMessageText(message, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard },
        });
      } else {
        // Улучшение завершено
        message += `\n💎 Осталось очков: ${character.ability_points}`;
        await ctx.editMessageText(message, { parse_mode: "Markdown" });
      }

      await ctx.answerCbQuery("Характеристика улучшена!");
    } catch (error) {
      await ctx.answerCbQuery(error.message);
      log(`Ошибка улучшения: ${error.message}`, "error");
    }
  }
}

module.exports = new CharacterStatsHandler();
