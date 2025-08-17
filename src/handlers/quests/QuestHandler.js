const BaseHandler = require('../../core/BaseHandler');
const { Character } = require('../../../database/models');
const questSystem = require('../../../systems/questSystem');
const { log } = require('../../../utils/logger');
const config = require('../../../config/config');

class QuestHandler extends BaseHandler {
  // Показать текущий квест (из основного index.js)
  async handleShowQuest(ctx) {
    const chatId = ctx.chat.id;
    
    await this.withCharacter(ctx, async (character) => {
      // Проверяем, не мертв ли персонаж
      if (character.hp_current <= 0) {
        await ctx.reply(
          `☠️ **${character.name} мертв!**\n\n` +
          `Ваш персонаж погиб с честью.\n` +
          `HP: ${character.hp_current}/${character.hp_max}\n\n` +
          `Используйте /create для создания нового персонажа.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Получаем активный квест (логика из RollQuestDice.js)
      const quest = await questSystem.getActiveQuest(chatId);
      if (!quest) {
        // Проверяем, можем ли получить новый квест
        const canReceive = await questSystem.canReceiveQuest(chatId);

        if (canReceive.can) {
          // Пытаемся выдать новый квест
          const newQuest = await questSystem.assignQuest(chatId);
          if (newQuest) {
            await this.showQuestInfo(ctx, newQuest, character);
            return;
          }
        }

        await ctx.reply(
          `❌ Нет активного квеста!\n\n${canReceive.reason || "Ждите автоматической выдачи."}`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Показываем информацию о квесте
      await this.showQuestInfo(ctx, quest, character);
    });
  }

  // Показать информацию о квесте с кнопкой броска (из RollQuestDice.js)
  async showQuestInfo(ctx, quest, character) {
    const statConfig = config.STATS[quest.stat_check];
    const timeLeft = Math.ceil(
      (new Date(quest.expires_at) - new Date()) / 1000 / 60
    );

    const difficultyEmoji = {
      easy: "🟢",
      medium: "🟡",
      hard: "🔴",
      epic: "🟣",
      legendary: "⭐",
    };

    // Получаем модификатор персонажа
    const statModifier = character.getRollBonus(quest.stat_check);
    const modSign = statModifier >= 0 ? "+" : "";

    const message = `
🎯 **АКТИВНЫЙ КВЕСТ**

${difficultyEmoji[quest.difficulty] || "❓"} **${quest.title}**
${quest.description}

📊 **Проверка:** ${statConfig.emoji} ${statConfig.name}
🎲 **Ваш модификатор:** ${modSign}${statModifier}
⏰ **Осталось времени:** ${timeLeft} мин
💰 **Базовая награда:** ${quest.xp_reward} XP, ${quest.gold_reward} золота

**Как это работает:**
- Вы бросите 1d20 ${modSign}${statModifier}
- Разные результаты дают разные награды
- 20 - критический успех!
- 1 - критический провал!
`;

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎲 Бросить кубик!", callback_data: "quest_roll" }],
        ],
      },
    });
  }

  // Бросок кубика для выполнения квеста (из ResultQuest.js)
  async handleQuestRoll(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      await ctx.answerCbQuery("🎲 Бросаем кубик...");
    } catch (error) {
      // Игнорируем ошибку answerCbQuery
    }

    try {
      // Получаем персонажа
      const character = await Character.findActive(userId, chatId);
      if (!character) {
        await ctx.editMessageText("❌ Персонаж не найден!");
        return;
      }

      // Проверяем квест
      const quest = await questSystem.getActiveQuest(chatId);
      if (!quest) {
        await ctx.editMessageText("❌ Квест уже завершен или истек!");
        return;
      }

      // Бросаем кубик
      const roll = Math.floor(Math.random() * 20) + 1;

      // Анимация броска
      const diceEmojis = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
      let lastDice = null;

      for (let i = 0; i < 3; i++) {
        let randomDice;
        // Гарантируем, что выбираем другой эмодзи
        do {
          randomDice = diceEmojis[Math.floor(Math.random() * diceEmojis.length)];
        } while (randomDice === lastDice && diceEmojis.length > 1);

        lastDice = randomDice;

        try {
          await ctx.editMessageText(`${randomDice} Бросаем кубик...`);
        } catch (error) {
          // Если ошибка из-за одинакового текста, просто пропускаем
          if (!error.message.includes("message is not modified")) {
            throw error;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Выполняем квест
      const result = await questSystem.executeQuest(character, roll);

      if (!result.success) {
        await ctx.editMessageText(`❌ ${result.message}`);
        return;
      }

      // Формируем сообщение с результатом
      const statConfig = config.STATS[result.statUsed];
      const criticalText =
        roll === 20
          ? "⚡ КРИТИЧЕСКИЙ УСПЕХ! ⚡\n"
          : roll === 1
            ? "💀 КРИТИЧЕСКИЙ ПРОВАЛ! 💀\n"
            : "";

      let message = `🎯 **${result.questTitle}**\n\n`;
      message += criticalText;
      message += `🎲 Бросок: **${roll}**\n`;
      message += `${statConfig.emoji} Модификатор ${statConfig.name}: ${result.statModifier >= 0 ? "+" : ""}${result.statModifier}\n`;
      message += `📊 Итого: **${result.totalRoll}**\n\n`;

      message += `${result.questResult.result_text}\n\n`;

      message += `**Результаты:**\n`;
      if (result.xpGained > 0) {
        message += `✨ Опыт: +${result.xpGained} XP\n`;
      }

      // Показываем золото отдельно
      if (result.goldGained > 0) {
        if (result.lootGold > 0) {
          message += `💰 Золото: +${result.goldGained - result.lootGold} (квест) +${result.lootGold} (добыча) = **+${result.goldGained}**\n`;
        } else {
          message += `💰 Золото: +${result.goldGained}\n`;
        }
      } else if (result.goldGained < 0) {
        message += `💸 Потеряно золота: ${Math.abs(result.goldGained)}\n`;
      }

      // Показываем найденные предметы
      if (result.lootItems && result.lootItems.length > 0) {
        message += `\n🎁 **Найденные предметы:**\n`;

        const rarityEmojis = {
          common: "⚪",
          uncommon: "🟢",
          rare: "🔵",
          epic: "🟣",
          legendary: "🟠",
        };

        for (const item of result.lootItems) {
          const emoji = rarityEmojis[item.rarity] || "❓";
          message += `${emoji} ${item.name}\n`;
        }
      }

      if (result.damageDealt > 0) {
        message += `💔 Урон: -${result.damageDealt} HP (${result.characterHp}/${result.characterMaxHp})\n`;
      }

      if (result.levelUp) {
        message += `\n🎉 **НОВЫЙ УРОВЕНЬ! ${result.levelUp.from} → ${result.levelUp.to}**\n`;

        if (result.levelUp.abilityPointsGained > 0) {
          message += `💎 **Получено ${result.levelUp.abilityPointsGained} очка улучшения!** Используйте /improve\n`;
        }
      }

      // Проверяем смерть персонажа
      if (result.isDead) {
        message += `\n☠️ **ПЕРСОНАЖ ПОГИБ!** ☠️\n`;
        message += `\n_${character.name} пал смертью храбрых, выполняя опасный квест._\n`;
        message += `_Покойся с миром, отважный ${character.getClassInfo()}._\n\n`;
        message += `Используйте /create для создания нового персонажа.`;
      }

      await ctx.editMessageText(message, { parse_mode: "Markdown" });

      log(`${character.name} выполнил квест "${result.questTitle}" с результатом ${result.totalRoll}`);
    } catch (error) {
      log(`Ошибка выполнения квеста: ${error.message}`, "error");

      try {
        await ctx.editMessageText(
          "❌ Произошла ошибка при выполнении квеста.\nПопробуйте еще раз через несколько секунд.",
          { parse_mode: "Markdown" }
        );
      } catch (editError) {
        // Если не можем отредактировать сообщение, отправляем новое
        await ctx.reply(
          "❌ Произошла ошибка при выполнении квеста.\nПопробуйте еще раз через несколько секунд.",
          { parse_mode: "Markdown" }
        );
      }
    }
  }

  // История квестов (из основного index.js)
  async handleListQuests(ctx) {
    await this.withCharacter(ctx, async (character) => {
      // Получаем историю
      const history = await questSystem.getQuestHistory(character.id, 10);

      if (history.length === 0) {
        await ctx.reply(
          `📜 **История квестов ${character.name}**\n\nВы еще не выполнили ни одного квеста!`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      const difficultyEmoji = {
        easy: "🟢",
        medium: "🟡",
        hard: "🔴",
        epic: "🟣",
        legendary: "⭐",
      };

      let message = `📜 **История квестов ${character.name}**\n\n`;

      for (const quest of history) {
        const date = new Date(quest.completed_at).toLocaleDateString("ru-RU");
        const successEmoji = quest.success ? "✅" : "❌";

        message += `${successEmoji} ${difficultyEmoji[quest.difficulty]} **${quest.title}**\n`;
        message += `   Бросок: ${quest.roll_result} | +${quest.xp_gained} XP | +${quest.gold_gained} 💰\n`;
        message += `   ${date}\n\n`;
      }

      await ctx.reply(message, { parse_mode: "Markdown" });
    });
  }

  // Получить квест вручную (из основного index.js)
  async handleGetQuest(ctx) {
    const chatId = ctx.chat.id;
    const db = require('../../../database');

    // Проверяем, есть ли ЖИВЫЕ персонажи в чате
    const characters = await db.all(
      "SELECT COUNT(*) as count FROM characters WHERE chat_id = ? AND is_active = 1 AND hp_current > 0",
      [chatId]
    );

    if (characters[0].count === 0) {
      await ctx.reply(
        "❌ В этом чате нет живых персонажей!\n\n" +
        "Все герои пали в битвах. 😢\n\n" +
        "Создайте нового персонажа командой /create",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Проверяем возможность получения квеста
    const canReceive = await questSystem.canReceiveQuest(chatId);

    if (!canReceive.can) {
      await ctx.reply(`❌ Невозможно получить квест!\n\n${canReceive.reason}`, {
        parse_mode: "Markdown",
      });
      return;
    }

    // Пытаемся назначить квест
    const quest = await questSystem.assignQuest(chatId);

    if (!quest) {
      await ctx.reply("❌ Не удалось назначить квест. Попробуйте позже.", {
        parse_mode: "Markdown",
      });
      return;
    }

    // Отправляем информацию о квесте
    const statConfig = config.STATS[quest.stat_check];
    const difficultyEmoji = {
      easy: "🟢",
      medium: "🟡",
      hard: "🔴",
      epic: "🟣",
      legendary: "⭐",
    };

    const message = `
🎯 **НОВЫЙ КВЕСТ ПОЛУЧЕН!**

${difficultyEmoji[quest.difficulty] || "❓"} **${quest.title}**
${quest.description}

📊 **Проверка:** ${statConfig.emoji} ${statConfig.name}
⏰ **Время на выполнение:** 4 часа
💰 **Базовая награда:** ${quest.xp_reward} XP, ${quest.gold_reward} золота

Используйте /quest чтобы попытаться выполнить!
`;

    await ctx.reply(message, { parse_mode: "Markdown" });

    log(`Квест "${quest.title}" выдан вручную для чата ${chatId}`);
  }
}

module.exports = new QuestHandler();