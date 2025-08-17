const BaseHandler = require('../../core/BaseHandler');
const { Character } = require('../../../database/models');
const lootSystem = require('../../../systems/lootSystem');
const { log } = require('../../../utils/logger');

class LootHandler extends BaseHandler {
  // Создать сундук с лутом
  async handleCreateChest(ctx) {
    await this.withCharacter(ctx, async (character) => {
      // Проверяем права (только для админов или в специальных условиях)
      if (ctx.chat.type === "private") {
        await ctx.reply("❌ Сундуки можно создавать только в групповых чатах!");
        return;
      }

      // Создаем случайный сундук
      const difficulties = ["easy", "medium", "hard"];
      const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];

      const chest = await lootSystem.createLootChest(
        ctx.chat.id,
        difficulty,
        character.id
      );

      const difficultyNames = {
        easy: "🟢 Простой",
        medium: "🟡 Обычный",
        hard: "🔴 Редкий",
      };

      await ctx.reply(
        `📦 **Появился сундук с сокровищами!**\n\n` +
        `${difficultyNames[difficulty]} сундук\n` +
        `💰 Внутри что-то ценное...\n\n` +
        `Первый, кто откроет, получит все сокровища!`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔓 Открыть сундук!",
                  callback_data: `chest_open_${chest.id}`,
                },
              ],
            ],
          },
        }
      );

      log(`${character.name} создал ${difficulty} сундук в чате ${ctx.chat.id}`);
    });
  }

  // Обработчик открытия сундука
  async handleChestCallback(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const data = ctx.callbackQuery.data;

    if (data.startsWith("chest_open_")) {
      const chestId = parseInt(data.replace("chest_open_", ""));

      const character = await Character.findActive(userId, chatId);
      if (!character) {
        await ctx.answerCbQuery("❌ У вас нет персонажа!");
        return;
      }

      const result = await lootSystem.openChest(chestId, character.id);

      if (!result.success) {
        await ctx.answerCbQuery(result.message);
        return;
      }

      await ctx.answerCbQuery("🎉 Сундук открыт!");

      let message = `🎉 **${character.name} открыл сундук!**\n\n`;
      message += `**Получено:**\n`;

      if (result.loot.gold > 0) {
        message += `💰 ${result.loot.gold} золота\n`;
      }

      const rarityEmojis = {
        common: "⚪",
        uncommon: "🟢",
        rare: "🔵",
        epic: "🟣",
        legendary: "🟠",
      };

      for (const item of result.loot.items) {
        const emoji = rarityEmojis[item.rarity] || "❓";
        message += `${emoji} ${item.name}\n`;
      }

      await ctx.editMessageText(message, { parse_mode: "Markdown" });

      log(`${character.name} открыл сундук ${chestId} и получил: ${result.loot.gold} золота и ${result.loot.items.length} предметов`);
    }
  }

  // Дополнительный метод для создания специальных сундуков (для админов)
  async handleCreateSpecialChest(ctx) {
    // Проверяем права админа
    const isAdmin = await this.checkAdminRights(ctx);
    if (!isAdmin) {
      await ctx.reply("❌ Эта команда доступна только администраторам!");
      return;
    }

    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length < 1) {
      await ctx.reply(
        `❌ **Использование:**\n` +
        `/create_chest [difficulty] [gold]\n\n` +
        `**Сложность:** easy, medium, hard, epic, legendary\n` +
        `**Пример:** /create_chest epic 1000`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const difficulty = args[0] || "medium";
    const goldAmount = parseInt(args[1]) || null;

    await this.withCharacter(ctx, async (character) => {
      const chest = await lootSystem.createLootChest(
        ctx.chat.id,
        difficulty,
        character.id,
        goldAmount
      );

      const difficultyNames = {
        easy: "🟢 Простой",
        medium: "🟡 Обычный",
        hard: "🔴 Редкий",
        epic: "🟣 Эпический",
        legendary: "🟠 Легендарный",
      };

      await ctx.reply(
        `📦 **Создан особый сундук!**\n\n` +
        `${difficultyNames[difficulty] || difficulty} сундук\n` +
        `${goldAmount ? `💰 Гарантированное золото: ${goldAmount}\n` : ''}` +
        `✨ Создатель: ${character.name}\n\n` +
        `Кто первый откроет?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔓 Открыть сундук!",
                  callback_data: `chest_open_${chest.id}`,
                },
              ],
            ],
          },
        }
      );
    });
  }

  // Проверка прав администратора
  async checkAdminRights(ctx) {
    if (ctx.chat.type === "private") {
      // В приватном чате считаем пользователя админом
      return true;
    }

    try {
      const member = await ctx.getChatMember(ctx.from.id);
      return member.status === "administrator" || member.status === "creator";
    } catch (error) {
      log(`Ошибка проверки прав админа: ${error.message}`, "error");
      return false;
    }
  }

  // Показать историю сундуков в чате (для статистики)
  async handleChestHistory(ctx) {
    const chatId = ctx.chat.id;
    
    try {
      const history = await lootSystem.getChestHistory(chatId, 10);
      
      if (!history || history.length === 0) {
        await ctx.reply("📦 В этом чате еще не было сундуков!");
        return;
      }

      let message = "📦 **История сундуков**\n\n";
      
      for (const chest of history) {
        const date = new Date(chest.created_at).toLocaleDateString("ru-RU");
        const openedBy = chest.opened_by_name || "Не открыт";
        
        message += `• ${date} - ${chest.difficulty} сундук\n`;
        message += `  Открыл: ${openedBy}\n`;
        if (chest.gold_amount > 0) {
          message += `  Золото: ${chest.gold_amount} 💰\n`;
        }
        message += "\n";
      }

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      log(`Ошибка получения истории сундуков: ${error.message}`, "error");
      await ctx.reply("❌ Ошибка при загрузке истории");
    }
  }
}

module.exports = new LootHandler();