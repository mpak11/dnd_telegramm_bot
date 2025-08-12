const BaseHandler = require('../../core/BaseHandler');
const { Character } = require('../../../database/models');
const equipmentSystem = require('../../../systems/equipmentSystem');
const { log } = require('../../../utils/logger');
const db = require('../../../database');

class EquipmentHandler extends BaseHandler {
  // Показать экипировку
  async handleEquipment(ctx) {
    await this.withCharacter(ctx, async (character) => {
      try {
        const display = await equipmentSystem.getEquipmentDisplay(character.id);

        // Добавляем кнопки управления
        const keyboard = [
          [
            { text: "📦 Инвентарь", callback_data: "show_inventory" },
            { text: "🎒 Экипировать", callback_data: "equip_menu" },
          ],
        ];

        await ctx.reply(display, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch (error) {
        log(`Ошибка показа экипировки: ${error.message}`, "error");
        await ctx.reply("❌ Ошибка при загрузке экипировки");
      }
    });
  }

  // Обработчик callback для возврата к экипировке
  async handleEquipmentCallback(ctx) {
    // Вызываем handleEquipment как обычную команду
    await this.handleEquipment(ctx);
  }

  // Меню выбора предметов для экипировки
  async handleEquipMenu(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    const character = await Character.findActive(userId, chatId);
    if (!character) {
      await ctx.answerCbQuery("❌ У вас нет персонажа!");
      return;
    }

    try {
      // Получаем предметы, которые можно экипировать
      const inventory = await character.getInventory();
      
      // ОТЛАДКА: Выводим информацию о предметах
      log(`[DEBUG] Всего предметов в инвентаре: ${inventory.length}`);
      
      for (let i = 0; i < Math.min(5, inventory.length); i++) {
        const item = inventory[i];
        log(`[DEBUG] Предмет ${i + 1}: ${item.name}`);
        log(`[DEBUG] - Тип: ${item.type}`);
        log(`[DEBUG] - slot_type: ${item.slot_type}`);
        log(`[DEBUG] - weapon_type: ${item.weapon_type}`);
        log(`[DEBUG] - armor_type: ${item.armor_type}`);
      }

      // Ищем предметы, которые можно экипировать (оружие и броню)
      const equipableItems = inventory.filter(item => {
        // Проверяем по типу предмета, а не только по slot_type
        const isWeapon = item.type === 'weapon';
        const isArmor = item.type === 'armor';
        const isShield = item.type === 'shield';
        const hasSlotType = item.slot_type && item.slot_type !== 'null' && item.slot_type !== '';
        
        log(`[DEBUG] Предмет ${item.name}: weapon=${isWeapon}, armor=${isArmor}, shield=${isShield}, slot_type=${item.slot_type}`);
        
        return isWeapon || isArmor || isShield || hasSlotType;
      });

      log(`[DEBUG] Предметов для экипировки найдено: ${equipableItems.length}`);

      if (equipableItems.length === 0) {
        await ctx.answerCbQuery("❌ У вас нет предметов для экипировки!");
        
        // Показываем детальную информацию для отладки
        let debugMessage = "🔍 **Отладочная информация:**\n\n";
        debugMessage += `Всего предметов: ${inventory.length}\n\n`;
        
        for (let i = 0; i < Math.min(3, inventory.length); i++) {
          const item = inventory[i];
          debugMessage += `**${item.name}**\n`;
          debugMessage += `Тип: ${item.type}\n`;
          debugMessage += `slot_type: ${item.slot_type || 'не указан'}\n`;
          debugMessage += `weapon_type: ${item.weapon_type || 'не указан'}\n\n`;
        }
        
        await ctx.editMessageText(debugMessage, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "◀️ Назад", callback_data: "back_to_equipment" }
            ]]
          }
        });
        return;
      }

      let message = "🎒 **Выберите предмет для экипировки:**\n\n";
      const keyboard = [];

      const rarityEmoji = {
        common: "⚪",
        uncommon: "🟢",
        rare: "🔵",
        epic: "🟣",
        legendary: "🟠",
      };

      // Простой список всех экипируемых предметов
      for (const item of equipableItems.slice(0, 10)) { // Ограничиваем 10 предметами
        const emoji = rarityEmoji[item.rarity] || "⚪";
        const typeInfo = item.weapon_type || item.armor_type || item.type;
        
        message += `${emoji} **${item.name}** (${typeInfo})\n`;
        
        keyboard.push([{
          text: `${emoji} ${item.name}`,
          callback_data: `equip_item_${item.id}`
        }]);
      }

      keyboard.push([
        { text: "◀️ Назад к экипировке", callback_data: "back_to_equipment" }
      ]);

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard },
      });

    } catch (error) {
      log(`Ошибка меню экипировки: ${error.message}`, "error");
      await ctx.answerCbQuery("❌ Ошибка при загрузке меню экипировки");
    }
  }

  // Экипировать предмет по команде
  async handleEquipItem(ctx) {
    await this.withCharacter(ctx, async (character) => {
      const itemName = ctx.message.text.replace("/equip_item", "").trim();

      if (!itemName) {
        // Показываем список предметов для экипировки
        const inventory = await character.getInventory();
        const equipable = inventory.filter((item) =>
          ["weapon", "armor", "shield", "accessory"].includes(item.type)
        );

        if (equipable.length === 0) {
          await ctx.reply("❌ У вас нет предметов для экипировки!");
          return;
        }

        let message = "🎒 **Выберите предмет для экипировки:**\n\n";
        const keyboard = [];

        for (const item of equipable) {
          const rarityEmoji = {
            common: "⚪",
            uncommon: "🟢",
            rare: "🔵",
            epic: "🟣",
            legendary: "🟠",
          }[item.rarity] || "⚪";

          keyboard.push([
            {
              text: `${rarityEmoji} ${item.name}`,
              callback_data: `equip_item_${item.id}`,
            },
          ]);
        }

        keyboard.push([{ text: "❌ Отмена", callback_data: "cancel" }]);

        await ctx.reply(message, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard },
        });
        return;
      }

      // Ищем предмет по имени
      const inventory = await character.getInventory();
      const item = inventory.find((i) =>
        i.name.toLowerCase().includes(itemName.toLowerCase())
      );

      if (!item) {
        await ctx.reply("❌ Предмет не найден в инвентаре!");
        return;
      }

      try {
        const result = await equipmentSystem.equipItem(character.id, item.id);
        await ctx.reply(`✅ ${item.name} экипирован в слот: ${result.slot}`, {
          parse_mode: "Markdown",
        });
      } catch (error) {
        await ctx.reply(`❌ ${error.message}`);
      }
    });
  }

  // Callback для экипировки предмета
  async handleEquipItemCallback(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const itemId = parseInt(ctx.callbackQuery.data.replace("equip_item_", ""));

    const character = await Character.findActive(userId, chatId);
    if (!character) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    try {
      // Проверяем, что предмет есть в инвентаре
      const inventory = await character.getInventory();
      const item = inventory.find(i => i.id === itemId);
      
      if (!item) {
        await ctx.answerCbQuery("❌ Предмет не найден в инвентаре!");
        return;
      }

      log(`[DEBUG] Попытка экипировать: ${item.name} (ID: ${itemId})`);
      log(`[DEBUG] Тип предмета: ${item.type}, slot_type: ${item.slot_type}`);

      // Определяем слот для экипировки
      let targetSlot = item.slot_type;
      
      // Если slot_type не указан, определяем по типу предмета
      if (!targetSlot || targetSlot === 'null') {
        if (item.type === 'weapon') {
          targetSlot = 'main_hand';
        } else if (item.type === 'armor') {
          targetSlot = 'chest';
        } else if (item.type === 'shield') {
          targetSlot = 'off_hand';
        } else {
          await ctx.answerCbQuery("❌ Не удается определить слот для этого предмета!");
          return;
        }
      }

      // Если есть система экипировки, используем её
      if (typeof equipmentSystem !== 'undefined') {
        const result = await equipmentSystem.equipItem(character.id, itemId);
        await ctx.answerCbQuery("✅ Предмет экипирован!");
        
        await ctx.editMessageText(`✅ **${item.name}** экипирован в слот: ${result.slot}`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "◀️ К экипировке", callback_data: "back_to_equipment" },
              { text: "🎒 Экипировать еще", callback_data: "equip_menu" }
            ]]
          }
        });
      } else {
        // Простая альтернатива без системы экипировки
        // Помечаем предмет как экипированный в инвентаре
        await db.run(
          "UPDATE inventory SET equipped = 1, equipped_slot = ? WHERE character_id = ? AND item_id = ?",
          [targetSlot, character.id, itemId]
        );
        
        await ctx.answerCbQuery("✅ Предмет экипирован!");
        
        await ctx.editMessageText(`✅ **${item.name}** экипирован!`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "◀️ К экипировке", callback_data: "back_to_equipment" },
              { text: "🎒 Экипировать еще", callback_data: "equip_menu" }
            ]]
          }
        });
      }

      log(`${character.name} экипировал ${item.name}`);

    } catch (error) {
      log(`Ошибка экипировки предмета: ${error.message}`, "error");
      await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
    }
  }

  // Снять предмет
  async handleUnequipItem(ctx) {
    await this.withCharacter(ctx, async (character) => {
      const equipment = await equipmentSystem.getEquipment(character.id);
      const equipped = Object.entries(equipment);

      if (equipped.length === 0) {
        await ctx.reply("❌ У вас нет экипированных предметов!");
        return;
      }

      let message = "🎒 **Выберите предмет для снятия:**\n\n";
      const keyboard = [];

      for (const [slot, item] of equipped) {
        const slotName = equipmentSystem.slots[slot]?.name || slot;
        keyboard.push([
          {
            text: `${slotName}: ${item.name}`,
            callback_data: `unequip_item_${item.id}`,
          },
        ]);
      }

      keyboard.push([{ text: "❌ Отмена", callback_data: "cancel" }]);

      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard },
      });
    });
  }

  // Callback для снятия предмета
  async handleUnequipItemCallback(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const itemId = parseInt(ctx.callbackQuery.data.replace("unequip_item_", ""));

    const character = await Character.findActive(userId, chatId);
    if (!character) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    try {
      const result = await equipmentSystem.unequipItem(character.id, itemId);
      await ctx.answerCbQuery("✅ Предмет снят!");

      await ctx.editMessageText(
        `✅ ${result.itemName} снят со слота: ${result.slot}`,
        {
          parse_mode: "Markdown",
        }
      );

      // Показываем обновленную экипировку
      setTimeout(() => this.handleEquipment(ctx), 1000);
    } catch (error) {
      await ctx.answerCbQuery(`❌ ${error.message}`);
    }
  }
}

module.exports = new EquipmentHandler();