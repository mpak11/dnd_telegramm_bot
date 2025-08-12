const BaseHandler = require('../../core/BaseHandler');
const { Character } = require('../../../database/models');
const tradeSystem = require('../../../systems/tradeSystem');
const { log } = require('../../../utils/logger');
const db = require('../../../database');

class TradeHandler extends BaseHandler {
  constructor() {
    super();
    // Храним торговые сессии
    this.tradeSessions = new Map();
  }

  // Команда создания предложения обмена
  async handleTrade(ctx) {
    await this.withCharacter(ctx, async (character) => {
      // В группе показываем список активных персонажей
      if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
        const activeCharacters = await db.all(
          `
          SELECT c.*, u.telegram_username as username, u.first_name 
          FROM characters c
          JOIN users u ON c.user_id = u.id
          WHERE c.chat_id = ? AND c.is_active = 1 AND c.user_id != ?
          ORDER BY c.level DESC
          LIMIT 10
          `,
          [ctx.chat.id, character.user_id]
        );

        if (activeCharacters.length === 0) {
          await ctx.reply(
            "❌ В этом чате нет других активных персонажей для обмена!"
          );
          return;
        }

        let message = "🤝 **Выберите персонажа для обмена:**\n\n";
        const keyboard = [];

        for (const char of activeCharacters) {
          const name = char.username || char.first_name || "Игрок";
          message += `${char.name} (${name}) - ${char.level} ур.\n`;

          keyboard.push([
            {
              text: `📦 Обмен с ${char.name}`,
              callback_data: `trade_start_${char.id}`,
            },
          ]);
        }

        await ctx.reply(message, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard },
        });
      } else {
        await ctx.reply(
          "❌ Обмен доступен только в групповых чатах!\n\n" +
          "Добавьте бота в группу для торговли с другими игроками.",
          { parse_mode: "Markdown" }
        );
      }
    });
  }

  // Показать активные предложения обмена
  async handleActiveTrades(ctx) {
    await this.withCharacter(ctx, async (character) => {
      const trades = tradeSystem.getActiveTradesForCharacter(character.id);

      if (trades.length === 0) {
        await ctx.reply("📦 У вас нет активных предложений обмена.");
        return;
      }

      for (const trade of trades) {
        const message = tradeSystem.formatTradeOffer(trade);
        const keyboard = [];

        if (trade.to.character.id === character.id) {
          // Входящее предложение
          keyboard.push([
            { text: "✅ Принять", callback_data: `trade_accept_${trade.id}` },
            { text: "❌ Отклонить", callback_data: `trade_decline_${trade.id}` },
          ]);
        } else {
          // Исходящее предложение
          keyboard.push([
            { text: "❌ Отменить", callback_data: `trade_cancel_${trade.id}` },
          ]);
        }

        await ctx.reply(message, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard },
        });
      }
    });
  }

  // Обработчик callback для торговли
  async handleTradeCallback(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const data = ctx.callbackQuery.data;

    const character = await Character.findActive(userId, chatId);
    if (!character) {
      await ctx.answerCbQuery("❌ У вас нет персонажа!");
      return;
    }

    const session = this.getTradeSession(userId, chatId);

    // Начало обмена
    if (data.startsWith("trade_start_")) {
      const targetId = parseInt(data.replace("trade_start_", ""));
      await this.startTradeDialog(ctx, character, targetId);
    }

    // Подарок золота
    else if (data.startsWith("trade_gift_gold_")) {
      await this.handleGiftGold(ctx, character, data);
    }

    // Выбор предметов для обмена
    else if (data.startsWith("trade_select_items_")) {
      const targetId = parseInt(data.replace("trade_select_items_", ""));
      session.tradeTargetId = targetId;
      await this.showItemSelectionForTrade(ctx, character, targetId, session.selectedItems);
    }

    // Добавление предмета
    else if (data.startsWith("trade_add_item_")) {
      await this.handleAddItem(ctx, character, data, session);
    }

    // Добавление золота
    else if (data.startsWith("trade_add_gold_")) {
      await this.handleAddGold(ctx, character, data);
    }

    // Установка золота
    else if (data.startsWith("trade_set_gold_")) {
      await this.handleSetGold(ctx, character, data, session);
    }

    // Сброс выбора
    else if (data.startsWith("trade_reset_")) {
      const targetId = parseInt(data.replace("trade_reset_", ""));
      session.selectedItems = [];
      session.selectedGold = 0;
      await ctx.answerCbQuery("🔄 Выбор сброшен");
      await this.showItemSelectionForTrade(ctx, character, targetId, []);
    }

    // Подтверждение и создание обмена
    else if (data.startsWith("trade_confirm_giving_")) {
      await this.handleConfirmTrade(ctx, character, data, session);
    }

    // Отмена
    else if (data === "trade_cancel") {
      this.clearTradeSession(userId, chatId);
      await ctx.answerCbQuery("Отменено");
      await ctx.deleteMessage();
    }

    // Принятие/отклонение обмена
    else if (data.startsWith("trade_accept_")) {
      await this.handleAcceptTrade(ctx, character, data);
    } 
    else if (data.startsWith("trade_decline_") || data.startsWith("trade_cancel_")) {
      await this.handleDeclineTrade(ctx, data);
    }
  }

  // Вспомогательные методы
  getTradeSession(userId, chatId) {
    const key = `${userId}_${chatId}`;
    if (!this.tradeSessions.has(key)) {
      this.tradeSessions.set(key, {
        selectedItems: [],
        selectedGold: 0,
        requestedItems: [],
        requestedGold: 0,
        tradeTargetId: null,
        createdAt: Date.now(),
      });
    }
    return this.tradeSessions.get(key);
  }

  clearTradeSession(userId, chatId) {
    const key = `${userId}_${chatId}`;
    this.tradeSessions.delete(key);
  }

  async startTradeDialog(ctx, fromCharacter, toCharacterId) {
    const toCharacter = await Character.findById(toCharacterId);
    if (!toCharacter) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    // Получаем инвентарь инициатора обмена
    const fromInventory = await fromCharacter.getInventory();

    let message = `🤝 **Обмен с ${toCharacter.name}**\n\n`;
    message += `💰 Ваше золото: ${fromCharacter.gold}\n`;
    message += `💰 Золото партнера: ${toCharacter.gold}\n\n`;
    message += `**Выберите тип обмена:**`;

    const keyboard = [];

    // Варианты обмена золотом
    if (fromCharacter.gold >= 50) {
      keyboard.push([
        {
          text: "💰 Подарить 50 золота",
          callback_data: `trade_gift_gold_50_${toCharacter.id}`,
        },
      ]);
    }
    if (fromCharacter.gold >= 100) {
      keyboard.push([
        {
          text: "💰 Подарить 100 золота",
          callback_data: `trade_gift_gold_100_${toCharacter.id}`,
        },
      ]);
    }

    // Варианты обмена предметами
    if (fromInventory.length > 0) {
      keyboard.push([
        {
          text: "📦 Выбрать предметы для обмена",
          callback_data: `trade_select_items_${toCharacter.id}`,
        },
      ]);
    }

    keyboard.push([{ text: "❌ Отмена", callback_data: "trade_cancel" }]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async showItemSelectionForTrade(ctx, fromCharacter, toCharacterId, selectedItems = []) {
    const inventory = await fromCharacter.getInventory();
    const session = this.getTradeSession(ctx.from.id, ctx.chat.id);

    let message = `📦 **Выберите что предложить:**\n\n`;

    // Показываем выбранное
    if (selectedItems.length > 0 || session.selectedGold > 0) {
      message += `**Выбрано:**\n`;

      if (session.selectedGold > 0) {
        message += `• 💰 ${session.selectedGold} золота\n`;
      }

      for (const itemId of selectedItems) {
        const item = inventory.find((i) => i.id === itemId);
        if (item) {
          message += `• ${item.name}\n`;
        }
      }
      message += `\n`;
    }

    message += `💰 Ваше золото: ${fromCharacter.gold}\n`;

    if (inventory.length > 0) {
      message += `\n**Доступные предметы:**`;
    }

    const keyboard = [];

    // Предметы
    for (const item of inventory) {
      if (!selectedItems.includes(item.id)) {
        keyboard.push([
          {
            text: `➕ ${item.name} (x${item.quantity})`,
            callback_data: `trade_add_item_${item.id}_${toCharacterId}`,
          },
        ]);
      }
    }

    // Золото
    if (!session.selectedGold && fromCharacter.gold > 0) {
      keyboard.push([
        {
          text: "💰 Добавить золото",
          callback_data: `trade_add_gold_${toCharacterId}`,
        },
      ]);
    }

    // Управление
    if (selectedItems.length > 0 || session.selectedGold > 0) {
      keyboard.push([
        {
          text: "✅ Создать предложение",
          callback_data: `trade_confirm_giving_${toCharacterId}`,
        },
        { text: "🔄 Сбросить", callback_data: `trade_reset_${toCharacterId}` },
      ]);
    }

    keyboard.push([{ text: "❌ Отмена", callback_data: "trade_cancel" }]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async handleGiftGold(ctx, character, data) {
    const parts = data.split("_");
    const amount = parseInt(parts[3]);
    const targetId = parseInt(parts[4]);

    // Проверяем наличие золота
    if (character.gold < amount) {
      await ctx.answerCbQuery("❌ Недостаточно золота!");
      return;
    }

    const toCharacter = await Character.findById(targetId);
    if (!toCharacter) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    // Создаем простое предложение подарка
    const offer = {
      giving: { items: [], gold: amount },
      requesting: { items: [], gold: 0 },
    };

    const result = await tradeSystem.createTradeOffer(character, toCharacter, offer);

    if (!result.success) {
      await ctx.editMessageText(`❌ ${result.message}`, { parse_mode: "Markdown" });
      return;
    }

    await ctx.editMessageText(
      `✅ **Подарок отправлен!**\n\n` +
      `Вы подарили ${toCharacter.name}: 💰 ${amount} золота\n\n` +
      `Ожидайте подтверждения.`,
      { parse_mode: "Markdown" }
    );

    // Отправляем уведомление
    try {
      await ctx.telegram.sendMessage(
        toCharacter.chat_id,
        `🎁 **Подарок от ${character.name}!**\n\n` +
        `Вам предлагают: 💰 ${amount} золота`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Принять", callback_data: `trade_accept_${result.tradeId}` },
                { text: "❌ Отклонить", callback_data: `trade_decline_${result.tradeId}` },
              ],
            ],
          },
        }
      );
    } catch (error) {
      log(`Ошибка отправки уведомления: ${error.message}`, "error");
    }
  }

  async handleAddItem(ctx, character, data, session) {
    const parts = data.split("_");
    const itemId = parseInt(parts[3]);
    const targetId = parseInt(parts[4]);

    session.selectedItems.push(itemId);

    await ctx.answerCbQuery("✅ Предмет добавлен");
    await this.showItemSelectionForTrade(ctx, character, targetId, session.selectedItems);
  }

  async handleAddGold(ctx, character, data) {
    const targetId = parseInt(data.replace("trade_add_gold_", ""));

    // Простой вариант - фиксированные суммы
    let message = `💰 **Сколько золота добавить?**\n\n`;
    message += `У вас: ${character.gold} золота\n\n`;

    const keyboard = [];
    const amounts = [50, 100, 200, 500];

    for (const amount of amounts) {
      if (character.gold >= amount) {
        keyboard.push([
          {
            text: `💰 ${amount}`,
            callback_data: `trade_set_gold_${amount}_${targetId}`,
          },
        ]);
      }
    }

    keyboard.push([
      { text: "❌ Назад", callback_data: `trade_select_items_${targetId}` },
    ]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  async handleSetGold(ctx, character, data, session) {
    const parts = data.split("_");
    const amount = parseInt(parts[3]);
    const targetId = parseInt(parts[4]);

    session.selectedGold = amount;

    await ctx.answerCbQuery(`✅ Добавлено ${amount} золота`);
    await this.showItemSelectionForTrade(ctx, character, targetId, session.selectedItems);
  }

  async handleConfirmTrade(ctx, character, data, session) {
    const targetId = parseInt(data.replace("trade_confirm_giving_", ""));

    const toCharacter = await Character.findById(targetId);
    if (!toCharacter) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    // Для простоты создаем обмен как подарок
    const offer = {
      giving: {
        items: session.selectedItems,
        gold: session.selectedGold,
      },
      requesting: {
        items: [],
        gold: 0,
      },
    };

    const result = await tradeSystem.createTradeOffer(character, toCharacter, offer);

    if (!result.success) {
      await ctx.editMessageText(`❌ ${result.message}`, { parse_mode: "Markdown" });
      return;
    }

    // Формируем сообщение
    let message = `✅ **Предложение создано!**\n\n`;
    message += `Кому: ${toCharacter.name}\n\n`;
    message += `**Вы предлагаете:**\n`;

    if (session.selectedGold > 0) {
      message += `• 💰 ${session.selectedGold} золота\n`;
    }

    const inventory = await character.getInventory();
    for (const itemId of session.selectedItems) {
      const item = inventory.find((i) => i.id === itemId);
      if (item) {
        message += `• ${item.name}\n`;
      }
    }

    message += `\nЭто подарок (ничего не просите взамен)`;

    await ctx.editMessageText(message, { parse_mode: "Markdown" });

    // Очищаем сессию
    this.clearTradeSession(ctx.from.id, ctx.chat.id);

    // Отправляем уведомление
    try {
      const tradeMessage = tradeSystem.formatTradeOffer(result.trade);

      await ctx.telegram.sendMessage(
        toCharacter.chat_id,
        `${tradeMessage}\n\nОт: ${character.name}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Принять", callback_data: `trade_accept_${result.tradeId}` },
                { text: "❌ Отклонить", callback_data: `trade_decline_${result.tradeId}` },
              ],
            ],
          },
        }
      );
    } catch (error) {
      log(`Ошибка отправки: ${error.message}`, "error");
    }
  }

  async handleAcceptTrade(ctx, character, data) {
    const tradeId = data.replace("trade_accept_", "");
    const result = await tradeSystem.acceptTrade(tradeId, character.id);

    await ctx.answerCbQuery(result.message);
    if (result.success) {
      await ctx.editMessageText(
        `✅ **Обмен завершен!**\n\n${tradeSystem.formatTradeOffer(result.trade)}`,
        { parse_mode: "Markdown" }
      );
    }
  }

  async handleDeclineTrade(ctx, data) {
    const tradeId = data.replace(/trade_(decline|cancel)_/, "");
    tradeSystem.cancelTrade(tradeId);
    await ctx.answerCbQuery("Обмен отменен");
    await ctx.deleteMessage();
  }
}

module.exports = new TradeHandler();