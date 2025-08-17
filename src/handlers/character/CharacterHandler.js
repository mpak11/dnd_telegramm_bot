const BaseHandler = require('../../core/BaseHandler');
const { Character } = require('../../../database/models');
const characterCreation = require('../../../systems/characterCreation');
const { log } = require('../../../utils/logger');
const { escapeMarkdown } = require('../../../utils/markdown');
const config = require('../../../config/config');
const db = require('../../../database');

class CharacterHandler extends BaseHandler {
  async handleCreateCharacter(ctx) {
    // Проверяем, есть ли активный персонаж
    const existingCharacter = await Character.findActive(ctx.from.id, ctx.chat.id);
    
    if (existingCharacter) {
      await ctx.reply(
        `⚠️ У вас уже есть активный персонаж: **${existingCharacter.name}**\n\n` +
        `Используйте /delete чтобы удалить текущего персонажа перед созданием нового.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Запускаем создание персонажа
    await characterCreation.startCreation(ctx);
  }

  async handleShowCharacter(ctx) {
    await this.withCharacter(ctx, async (character) => {
      let display = await character.getDisplay();

      // Добавляем информацию о смерти
      if (character.hp_current <= 0) {
        display =
          `☠️ **МЕРТВ** ☠️\n\n${display}\n\n` +
          `_Этот персонаж пал в бою. Его подвиги будут помнить в веках._\n\n` +
          `Используйте /create для создания нового героя.`;
      }

      await ctx.reply(display, { parse_mode: "Markdown" });
    });
  }

  async handleQuickCreate(ctx) {
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length < 3) {
      await ctx.reply(
        `❌ **Использование:**\n` +
        `/quickcreate раса класс имя\n\n` +
        `**Пример:**\n` +
        `/quickcreate human WARRIOR Горак Сильный\n\n` +
        `**Доступные расы:** human, elf, dwarf, halfling\n` +
        `**Доступные классы:** WARRIOR, ROGUE, MAGE, CLERIC, BARBARIAN, RANGER`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const race = args[0].toLowerCase();
    const charClass = args[1].toUpperCase();
    const name = args.slice(2).join(' ');

    // Валидация
    if (!config.RACES[race]) {
      await ctx.reply(`❌ Неизвестная раса: ${race}`);
      return;
    }

    if (!config.CLASSES[charClass]) {
      await ctx.reply(`❌ Неизвестный класс: ${charClass}`);
      return;
    }

    // Проверяем существующего персонажа
    const existingCharacter = await Character.findActive(ctx.from.id, ctx.chat.id);
    if (existingCharacter) {
      await ctx.reply(
        `⚠️ У вас уже есть персонаж: ${existingCharacter.name}\n` +
        `Используйте /delete для удаления.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Создаем персонажа
    try {
      const character = await Character.create({
        telegram_id: ctx.from.id,
        chat_id: ctx.chat.id,
        name: name,
        race: race,
        class: charClass
      });

      await ctx.reply(
        `✅ **Персонаж создан!**\n\n${character.getDisplay()}`,
        { parse_mode: "Markdown" }
      );

      log(`Быстрое создание персонажа ${name} для ${ctx.from.id}`);
    } catch (error) {
      log(`Ошибка быстрого создания: ${error.message}`, "error");
      await ctx.reply(`❌ Ошибка создания персонажа: ${escapeMarkdown(error.message)}`, {
        parse_mode: "Markdown"
      });
    }
  }

  async handleSetName(ctx) {
    const name = ctx.message.text.replace('/setname', '').trim();
    
    if (!name) {
      await ctx.reply(
        `❌ Укажите имя персонажа!\n\n` +
        `Пример: /setname Горак Сильный`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Передаем системе создания персонажа
    const handled = await characterCreation.handleNameCommand(ctx, name);
    
    if (!handled) {
      await ctx.reply(
        `❌ Вы не находитесь в процессе создания персонажа.\n\n` +
        `Используйте /create для начала создания.`,
        { parse_mode: "Markdown" }
      );
    }
  }

  async handleDebugCharacters(ctx) {
    const telegramId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      const user = await db.get("SELECT * FROM users WHERE telegram_id = ?", [telegramId]);

      if (!user) {
        await ctx.reply("❌ Пользователь не найден в БД");
        return;
      }

      const characters = await db.all(
        "SELECT * FROM characters WHERE user_id = ? AND chat_id = ? ORDER BY created_at DESC",
        [user.id, chatId]
      );

      let message = `🔍 **Отладка персонажей**\n\n`;
      message += `Telegram ID: \`${telegramId}\`\n`;
      message += `User DB ID: \`${user.id}\`\n`;
      message += `Chat ID: \`${chatId}\`\n\n`;

      if (characters.length === 0) {
        message += `❌ Персонажей не найдено`;
      } else {
        message += `**Найдено персонажей: ${characters.length}**\n\n`;

        for (const char of characters) {
          message += `**${char.name}**\n`;
          message += `• ID: ${char.id}\n`;
          message += `• Активен: ${char.is_active ? "✅" : "❌"}\n`;
          message += `• Создан: ${new Date(char.created_at).toLocaleString()}\n`;
          message += `• Уровень: ${char.level}\n`;
          message += `• HP: ${char.hp_current}/${char.hp_max}\n\n`;
        }
      }

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      const errorMessage = escapeMarkdown(error.message);
      await ctx.reply(`❌ Ошибка: ${errorMessage}`, { parse_mode: "Markdown" });
    }
  }
}

module.exports = new CharacterHandler();