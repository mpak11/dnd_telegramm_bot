const BaseHandler = require('../../core/BaseHandler');
const { Character } = require('../../../database/models');
const advancedMerchantSystem = require('../../../systems/advancedMerchantSystem');
const { log } = require('../../../utils/logger');

class ShopHandler extends BaseHandler {
  // Показать список торговцев
  async handleShop(ctx) {
    await this.withCharacter(ctx, async (character) => {
      // Показываем список торговцев
      const merchants = Object.entries(advancedMerchantSystem.merchants);

      let message = "🏪 **Торговая площадь**\n\n";
      message += `💰 Ваше золото: ${character.gold}\n\n`;
      message += "Выберите торговца:\n";

      const keyboard = merchants.map(([id, merchant]) => [
        {
          text: `${merchant.name} - ${merchant.title}`,
          callback_data: `visit_merchant_${id}`,
        },
      ]);

      keyboard.push([{ text: "❌ Закрыть", callback_data: "cancel" }]);

      // Если это callback, редактируем сообщение
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard },
        });
      } else {
        await ctx.reply(message, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard },
        });
      }
    });
  }

  // Команда покупки - перенаправляет на магазин
  async handleBuy(ctx) {
    await ctx.reply(
      "🛒 Для покупки предметов используйте /shop\n\n" +
      "Там вы найдете всех торговцев с их товарами.",
      { parse_mode: "Markdown" }
    );
  }

  // Команда продажи - перенаправляет на магазин
  async handleSell(ctx) {
    await ctx.reply(
      "💰 Для продажи предметов используйте /shop\n\n" +
      "Выберите торговца и нажмите кнопку 'Продать'.",
      { parse_mode: "Markdown" }
    );
  }

  // Callback для посещения торговца
  async handleVisitMerchantCallback(ctx) {
    const merchantId = parseInt(ctx.callbackQuery.data.replace("visit_merchant_", ""));
    const character = await Character.findActive(ctx.from.id, ctx.chat.id);

    if (!character) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    // Получаем приветствие
    const greeting = await advancedMerchantSystem.getMerchantGreeting(character.id, merchantId);
    const merchant = advancedMerchantSystem.merchants[merchantId];

    // Получаем репутацию
    const rep = await advancedMerchantSystem.getReputation(character.id, merchantId);
    const mood = advancedMerchantSystem.getMerchantMood(rep.reputation);

    let message = `**${merchant.name}** ${mood.emoji}\n`;
    message += `_${greeting}_\n\n`;
    message += `💰 Ваше золото: ${character.gold}\n`;
    message += `🤝 Репутация: ${rep.reputation}\n\n`;

    const keyboard = [
      [
        { text: "📦 Купить", callback_data: `merchant_buy_${merchantId}` },
        { text: "💰 Продать", callback_data: `merchant_sell_${merchantId}` },
      ],
    ];

    if (merchant.canCraft) {
      keyboard[0].push({
        text: "🔨 Крафт",
        callback_data: `merchant_craft_${merchantId}`,
      });
    }

    keyboard.push([{ text: "◀️ Назад", callback_data: "shop_main" }]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  // Callback для покупки у торговца
  async handleMerchantBuyCallback(ctx) {
    const merchantId = parseInt(ctx.callbackQuery.data.replace("merchant_buy_", ""));
    const character = await Character.findActive(ctx.from.id, ctx.chat.id);

    if (!character) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    try {
      const inventory = await advancedMerchantSystem.getMerchantInventory(merchantId, character.id);

      if (inventory.length === 0) {
        await ctx.answerCbQuery("❌ У торговца нет товаров!");
        return;
      }

      let message = `🛒 **Товары торговца**\n\n`;
      message += `💰 Ваше золото: ${character.gold}\n\n`;

      const keyboard = [];
      const rarityEmoji = {
        common: "⚪",
        uncommon: "🟢",
        rare: "🔵",
        epic: "🟣",
        legendary: "🟠",
      };

      // Показываем первые 10 предметов
      for (let i = 0; i < Math.min(10, inventory.length); i++) {
        const item = inventory[i];
        const emoji = rarityEmoji[item.rarity] || "⚪";

        message += `${emoji} **${item.name}** - ${item.buyPrice} 💰\n`;
        if (item.description) {
          message += `_${item.description}_\n`;
        }
        message += "\n";

        keyboard.push([
          {
            text: `${emoji} ${item.name} (${item.buyPrice}💰)`,
            callback_data: `buy_item_${merchantId}_${item.id}`,
          },
        ]);
      }

      keyboard.push([
        { text: "◀️ Назад", callback_data: `visit_merchant_${merchantId}` },
      ]);

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      await ctx.answerCbQuery(`❌ ${error.message}`);
    }
  }

  // Callback для продажи торговцу
  async handleMerchantSellCallback(ctx) {
    const merchantId = parseInt(ctx.callbackQuery.data.replace("merchant_sell_", ""));
    const character = await Character.findActive(ctx.from.id, ctx.chat.id);

    if (!character) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    try {
      const inventory = await character.getInventory();

      if (inventory.length === 0) {
        await ctx.answerCbQuery("❌ У вас нет предметов для продажи!");
        return;
      }

      let message = `💰 **Продажа предметов**\n\n`;
      message += `Выберите предмет для продажи:\n\n`;

      const keyboard = [];
      const rarityEmoji = {
        common: "⚪",
        uncommon: "🟢",
        rare: "🔵",
        epic: "🟣",
        legendary: "🟠",
      };

      for (const item of inventory.slice(0, 10)) {
        const emoji = rarityEmoji[item.rarity] || "⚪";
        const sellPrice = Math.floor(item.value_gold * 0.5); // 50% от стоимости

        message += `${emoji} ${item.name} - ${sellPrice} 💰\n`;

        keyboard.push([
          {
            text: `${emoji} ${item.name} (${sellPrice}💰)`,
            callback_data: `sell_item_${merchantId}_${item.id}`,
          },
        ]);
      }

      keyboard.push([
        { text: "◀️ Назад", callback_data: `visit_merchant_${merchantId}` },
      ]);

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      await ctx.answerCbQuery(`❌ ${error.message}`);
    }
  }

  // Callback для покупки конкретного предмета
  async handleBuyItemCallback(ctx) {
    const parts = ctx.callbackQuery.data.split("_");
    const merchantId = parseInt(parts[2]);
    const itemId = parseInt(parts[3]);

    const character = await Character.findActive(ctx.from.id, ctx.chat.id);
    if (!character) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    try {
      const result = await advancedMerchantSystem.buyItem(character.id, merchantId, itemId);

      await ctx.answerCbQuery(`✅ ${result.comment}`);

      let message = `✅ **Покупка совершена!**\n\n`;
      message += `Куплено: ${result.item}\n`;
      message += `Потрачено: ${result.price} 💰\n\n`;
      message += `Осталось золота: ${character.gold - result.price} 💰`;

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "◀️ К товарам",
                callback_data: `merchant_buy_${merchantId}`,
              },
              { text: "🏪 К торговцам", callback_data: "shop_main" },
            ],
          ],
        },
      });
    } catch (error) {
      await ctx.answerCbQuery(`❌ ${error.message}`);
    }
  }

  // Callback для продажи конкретного предмета
  async handleSellItemCallback(ctx) {
    const parts = ctx.callbackQuery.data.split("_");
    const merchantId = parseInt(parts[2]);
    const itemId = parseInt(parts[3]);

    const character = await Character.findActive(ctx.from.id, ctx.chat.id);
    if (!character) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    try {
      const result = await advancedMerchantSystem.sellItem(character.id, merchantId, itemId);

      await ctx.answerCbQuery(`✅ ${result.comment}`);

      let message = `✅ **Предмет продан!**\n\n`;
      message += `Продано: ${result.item}\n`;
      message += `Получено: ${result.price} 💰\n\n`;
      message += `Золото: ${character.gold} → ${character.gold + result.price} 💰`;

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "💰 Продать еще",
                callback_data: `merchant_sell_${merchantId}`,
              },
              { text: "🏪 К торговцам", callback_data: "shop_main" },
            ],
          ],
        },
      });
    } catch (error) {
      await ctx.answerCbQuery(`❌ ${error.message}`);
    }
  }
}

module.exports = new ShopHandler();