const BaseHandler = require('../../core/BaseHandler');
const { Character } = require('../../../database/models');
const { log } = require('../../../utils/logger');
const db = require('../../../database');

class InventoryHandler extends BaseHandler {
  // Показать инвентарь
  async handleShowInventory(ctx) {
    await this.withCharacter(ctx, async (character) => {
      const inventory = await character.getInventory();

      // ОТЛАДКА: выводим структуру первого предмета
      if (inventory.length > 0) {
        log(`[DEBUG] Первый предмет в инвентаре:`, inventory[0]);
      }

      if (inventory.length === 0) {
        await ctx.reply(
          `🎒 **Инвентарь ${character.name}**\n\n` +
          `Инвентарь пуст\n\n` +
          `💰 Золото: ${character.gold}`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      let inventoryText = `🎒 **Инвентарь ${character.name}**\n\n`;

      // Группируем по типу
      const byType = {};
      for (const item of inventory) {
        if (!byType[item.type]) byType[item.type] = [];
        byType[item.type].push(item);
      }

      const typeNames = {
        weapon: "⚔️ Оружие",
        armor: "🛡️ Броня",
        consumable: "🧪 Расходники",
        misc: "📦 Разное",
        artifact: "💎 Артефакты",
      };

      const rarityEmojis = {
        common: "⚪",
        uncommon: "🟢",
        rare: "🔵",
        epic: "🟣",
        legendary: "🟠",
      };

      let itemIndex = 1;
      const itemButtons = [];

      for (const [type, items] of Object.entries(byType)) {
        inventoryText += `**${typeNames[type] || type}:**\n`;

        for (const item of items) {
          const emoji = rarityEmojis[item.rarity] || "❓";
          inventoryText += `${itemIndex}. ${emoji} ${item.name}`;
          if (item.quantity > 1) inventoryText += ` x${item.quantity}`;
          if (item.equipped) inventoryText += " 📌";
          inventoryText += "\n";

          // Добавляем кнопки для расходников
          if (type === "consumable" && !character.isDead()) {
            itemButtons.push({
              text: `${itemIndex}. ${item.name}`,
              callback_data: `use_${item.id}`,
            });
          }

          itemIndex++;
        }
        inventoryText += "\n";
      }

      inventoryText += `💰 **Золото:** ${character.gold}`;

      const keyboard = [];

      // Добавляем кнопки использования предметов
      if (itemButtons.length > 0) {
        for (let i = 0; i < itemButtons.length; i += 2) {
          const row = [itemButtons[i]];
          if (itemButtons[i + 1]) {
            row.push(itemButtons[i + 1]);
          }
          keyboard.push(row);
        }
      }

      log(`[DEBUG] Всего кнопок создано: ${itemButtons.length}`);

      await ctx.reply(inventoryText, {
        parse_mode: "Markdown",
        reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
      });
    });
  }

  // Использование предмета по команде
  async handleUseItem(ctx) {
    const text = ctx.message.text;
    const itemName = text.replace("/use ", "").trim();

    if (!itemName) {
      await ctx.reply(
        "❌ Укажите название предмета!\n" +
        "Пример: /use Зелье лечения\n\n" +
        "Для просмотра доступных предметов используйте /inventory",
        { parse_mode: "Markdown" }
      );
      return;
    }

    await this.withCharacter(ctx, async (character) => {
      // Проверяем, не мертв ли персонаж
      if (!await this.checkCharacterAlive(character, ctx)) return;

      // Ищем предмет в инвентаре по названию
      const item = await db.get(
        `
        SELECT i.*, inv.id as inventory_id, inv.quantity 
        FROM inventory inv
        JOIN items i ON inv.item_id = i.id
        WHERE inv.character_id = ? 
          AND LOWER(i.name) = LOWER(?)
          AND i.type = 'consumable'
      `,
        [character.id, itemName]
      );

      if (!item) {
        // Пробуем поиск по частичному совпадению
        const partialMatch = await db.get(
          `
          SELECT i.*, inv.id as inventory_id, inv.quantity 
          FROM inventory inv
          JOIN items i ON inv.item_id = i.id
          WHERE inv.character_id = ? 
            AND LOWER(i.name) LIKE LOWER(?)
            AND i.type = 'consumable'
          LIMIT 1
        `,
          [character.id, `%${itemName}%`]
        );

        if (!partialMatch) {
          await ctx.reply(
            `❌ Предмет "${itemName}" не найден или не может быть использован!\n\n` +
            `Используйте /inventory для просмотра доступных расходников.`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        // Используем частичное совпадение
        await this._useItem(ctx, character, partialMatch);
      } else {
        await this._useItem(ctx, character, item);
      }
    });
  }

  // Callback для использования предмета
  async handleUseItemCallback(ctx) {
    const data = ctx.callbackQuery.data;
    const itemId = data.replace("use_", "");

    await this.withCharacter(ctx, async (character) => {
      // Проверяем, не мертв ли персонаж
      if (character.hp_current <= 0) {
        await ctx.answerCbQuery("☠️ Мертвые не могут использовать предметы!");
        return;
      }

      // Получаем предмет из инвентаря
      const item = await db.get(
        `
        SELECT i.*, inv.id as inventory_id, inv.quantity 
        FROM inventory inv
        JOIN items i ON inv.item_id = i.id
        WHERE inv.character_id = ? AND inv.item_id = ?
      `,
        [character.id, itemId]
      );

      if (!item || item.type !== "consumable") {
        await ctx.answerCbQuery("❌ Предмет не найден или не может быть использован!");
        return;
      }

      // Применяем эффекты
      const result = await this._useItem(ctx, character, item);
      
      if (result.used) {
        await ctx.answerCbQuery("✅ Предмет использован!");
        
        // Обновляем сообщение с инвентарем
        try {
          await ctx.deleteMessage();
        } catch (error) {
          // Игнорируем ошибку если сообщение уже удалено
        }
        
        // Показываем обновленный инвентарь
        await this.handleShowInventory(ctx);
      } else {
        await ctx.answerCbQuery("⚠️ Этот предмет сейчас не нужен!");
      }
    });
  }

  // Передать предметы (пока не реализовано полностью)
  async handleGive(ctx) {
    const text = ctx.message.text;
    const parts = text.split(" ");

    if (parts.length < 3) {
      await ctx.reply(
        `❌ **Использование:**\n` +
        `/give @username количество предмет\n` +
        `/give @username золото количество\n\n` +
        `**Примеры:**\n` +
        `/give @friend 1 Зелье лечения\n` +
        `/give @friend золото 100`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await ctx.reply(
      `⚠️ Функция передачи предметов в разработке.\n` +
      `Используйте /trade для безопасного обмена.`,
      { parse_mode: "Markdown" }
    );
  }

  // Подарить предметы
  async handleGift(ctx) {
    const text = ctx.message.text;
    const parts = text.split(" ");

    if (parts.length < 3) {
      await ctx.reply(
        `🎁 **Команда для подарков**\n\n` +
        `**Использование:**\n` +
        `/gift @имя сумма\n` +
        `/gift @имя предмет\n\n` +
        `**Примеры:**\n` +
        `• /gift @Ivan 50\n` +
        `• /gift @Maria 100 золота\n` +
        `• /gift @Alex Зелье лечения\n\n` +
        `**Доступные действия:**\n` +
        `• Подарить золото (число)\n` +
        `• Подарить предмет (название)\n`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await this.withCharacter(ctx, async (giver) => {
      // Парсим получателя
      const recipientName = parts[1].replace("@", "");

      // Парсим что дарим
      const giftText = parts.slice(2).join(" ");
      const goldAmount = parseInt(giftText);

      if (!isNaN(goldAmount) && goldAmount > 0) {
        // Дарим золото
        if (giver.gold < goldAmount) {
          await ctx.reply(
            `❌ У вас недостаточно золота!\n` +
            `У вас: ${giver.gold} 💰\n` +
            `Нужно: ${goldAmount} 💰`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        await ctx.reply(
          `🎁 **Подтверждение подарка**\n\n` +
          `Получатель: @${recipientName}\n` +
          `Подарок: 💰 ${goldAmount} золота\n\n` +
          `⚠️ В текущей версии нужно использовать /trade для выбора получателя из списка.`,
          { parse_mode: "Markdown" }
        );
      } else {
        // Дарим предмет
        const itemName = giftText;

        // Ищем предмет в инвентаре
        const inventory = await giver.getInventory();
        const item = inventory.find((i) =>
          i.name.toLowerCase().includes(itemName.toLowerCase())
        );

        if (!item) {
          await ctx.reply(
            `❌ Предмет "${itemName}" не найден в инвентаре!\n\n` +
            `Используйте /inventory для просмотра доступных предметов.`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        await ctx.reply(
          `🎁 **Подтверждение подарка**\n\n` +
          `Получатель: @${recipientName}\n` +
          `Подарок: ${item.name}\n\n` +
          `⚠️ Обмен предметами в разработке. Пока можно дарить только золото через /trade.`,
          { parse_mode: "Markdown" }
        );
      }
    });
  }

  // Приватный метод для применения эффектов предмета
  async _useItem(ctx, character, item) {
    // Применяем эффекты предмета
    const effects = JSON.parse(item.effects || "{}");
    let message = `🧪 **Использован ${item.name}**\n`;
    message += `_${item.description}_\n\n`;

    let actuallyUsed = false;

    // Применяем лечение
    if (effects.hp && effects.hp > 0) {
      const hpBefore = character.hp_current;
      await character.modifyHP(effects.hp);
      const hpAfter = character.hp_current;
      const actualHealed = hpAfter - hpBefore;

      if (actualHealed > 0) {
        message += `❤️ Восстановлено ${actualHealed} HP (${hpBefore} → ${hpAfter}/${character.hp_max})\n`;
        actuallyUsed = true;
      } else {
        message += `❤️ HP уже максимальное (${character.hp_max}/${character.hp_max})\n`;
      }
    }

    // Применяем другие эффекты (для будущих расширений)
    if (effects.mp) {
      message += `💙 Восстановлено ${effects.mp} MP\n`;
      actuallyUsed = true;
    }

    if (effects.invisibility) {
      message += `👻 Вы невидимы на ${effects.invisibility} минут\n`;
      actuallyUsed = true;
    }

    if (effects.teleport) {
      message += `✨ Телепортация в безопасное место активирована!\n`;
      actuallyUsed = true;
    }

    // Проверяем, был ли предмет полезен
    if (!actuallyUsed && effects.hp) {
      if (ctx.callbackQuery) {
        return { used: false };
      }
      
      await ctx.reply(
        `⚠️ **${item.name}** сейчас не нужен!\n\n` +
        `Ваше HP уже максимальное: ${character.hp_current}/${character.hp_max}`,
        { parse_mode: "Markdown" }
      );
      return { used: false };
    }

    // Уменьшаем количество предмета
    await db.run("UPDATE inventory SET quantity = quantity - 1 WHERE id = ?", [
      item.inventory_id,
    ]);

    // Удаляем из инвентаря если закончился
    await db.run("DELETE FROM inventory WHERE id = ? AND quantity <= 0", [
      item.inventory_id,
    ]);

    // Добавляем информацию об оставшемся количестве
    if (item.quantity > 1) {
      message += `\n📦 Осталось: ${item.quantity - 1} шт.`;
    } else {
      message += `\n📦 Это был последний предмет!`;
    }

    await ctx.reply(message, { parse_mode: "Markdown" });

    // Логируем использование
    log(`${character.name} использовал ${item.name}`);
    
    return { used: true };
  }
}

module.exports = new InventoryHandler();