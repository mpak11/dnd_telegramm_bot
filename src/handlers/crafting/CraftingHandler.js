const BaseHandler = require('../../core/BaseHandler');
const { Character } = require('../../../database/models');
const craftingSystem = require('../../../systems/craftingSystem');
const { log } = require('../../../utils/logger');
const db = require('../../../database');

class CraftingHandler extends BaseHandler {
  // Показать доступные рецепты для крафта
  async handleCraft(ctx) {
    await this.withCharacter(ctx, async (character) => {
      const recipes = await craftingSystem.getAvailableRecipes(character.id);

      if (recipes.length === 0) {
        await ctx.reply("📜 У вас пока нет доступных рецептов!");
        return;
      }

      let message = "🔨 **Доступные рецепты:**\n\n";
      const keyboard = [];

      for (const recipe of recipes) {
        const canCraft = await craftingSystem.canCraft(character.id, recipe.id);
        const status = canCraft.canCraft ? "✅" : "❌";

        message += `${status} **${recipe.name}**\n`;
        message += `_${recipe.description}_\n`;
        message += `Уровень: ${recipe.required_level}, Золото: ${recipe.required_gold}\n\n`;

        keyboard.push([
          {
            text: `${status} ${recipe.name}`,
            callback_data: `craft_view_${recipe.id}`,
          },
        ]);
      }

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

  // Показать книгу рецептов
  async handleRecipes(ctx) {
    await this.withCharacter(ctx, async (character) => {
      try {
        // Получаем все доступные рецепты
        const recipes = await db.all(
          `
          SELECT * FROM crafting_recipes 
          WHERE required_level <= ? 
          ORDER BY required_level, name
        `,
          [character.level]
        );

        if (recipes.length === 0) {
          await ctx.reply("📜 Рецепты пока недоступны!");
          return;
        }

        let message = `📜 **Книга рецептов** (Уровень ${character.level})\n\n`;

        for (const recipe of recipes) {
          const canCraft = await craftingSystem.canCraft(character.id, recipe.id);
          const status = canCraft.canCraft ? "✅" : "❌";

          message += `${status} **${recipe.name}**\n`;
          message += `   _${recipe.description}_\n`;
          message += `   Уровень: ${recipe.required_level} | Золото: ${recipe.required_gold}\n`;

          // Показываем материалы
          const materials = JSON.parse(recipe.materials || "[]");
          if (materials.length > 0) {
            const matList = materials
              .map((m) => `${m.name} x${m.quantity}`)
              .join(", ");
            message += `   Материалы: ${matList}\n`;
          }

          message += `\n`;
        }

        message += `Используйте /craft для создания предметов.`;

        await ctx.reply(message, { parse_mode: "Markdown" });
      } catch (error) {
        log(`Ошибка показа рецептов: ${error.message}`, "error");
        await ctx.reply("❌ Ошибка при загрузке рецептов");
      }
    });
  }

  // Callback для просмотра рецепта
  async handleCraftViewCallback(ctx) {
    const recipeId = parseInt(ctx.callbackQuery.data.replace("craft_view_", ""));
    const character = await Character.findActive(ctx.from.id, ctx.chat.id);

    if (!character) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    const recipe = await db.get("SELECT * FROM crafting_recipes WHERE id = ?", [recipeId]);
    if (!recipe) {
      await ctx.answerCbQuery("❌ Рецепт не найден!");
      return;
    }

    const materials = JSON.parse(recipe.materials);
    const canCraft = await craftingSystem.canCraft(character.id, recipeId);

    let message = `🔨 **${recipe.name}**\n\n`;
    message += `_${recipe.description}_\n\n`;
    message += `**Требования:**\n`;
    message += `• Уровень: ${recipe.required_level}\n`;
    message += `• Золото: ${recipe.required_gold} 💰\n\n`;

    message += `**Материалы:**\n`;
    for (const mat of materials) {
      const check = await craftingSystem.checkInventory(character.id, mat.name, mat.quantity);
      const status = check.has ? "✅" : "❌";
      message += `${status} ${mat.name} x${mat.quantity} (есть ${check.quantity})\n`;
    }

    message += `\nШанс успеха: ${Math.floor(recipe.success_rate * 100)}%`;

    const keyboard = [];

    if (canCraft.canCraft) {
      keyboard.push([
        {
          text: "🔨 Создать",
          callback_data: `craft_item_${recipeId}`,
        },
      ]);
    }

    keyboard.push([{ text: "◀️ Назад", callback_data: "craft_main" }]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  // Callback для создания предмета
  async handleCraftItemCallback(ctx) {
    const recipeId = parseInt(ctx.callbackQuery.data.replace("craft_item_", ""));
    const character = await Character.findActive(ctx.from.id, ctx.chat.id);

    if (!character) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    try {
      const result = await craftingSystem.craftItem(character.id, recipeId);

      if (result.success) {
        const rarityEmoji = {
          common: "⚪",
          uncommon: "🟢",
          rare: "🔵",
          epic: "🟣",
          legendary: "🟠",
        }[result.item.rarity] || "⚪";

        await ctx.answerCbQuery(result.message);
        
        let successMessage = `${result.message}\n\n`;
        successMessage += `Получен предмет: ${rarityEmoji} **${result.item.name}**\n`;
        successMessage += `_${result.item.description}_`;

        await ctx.editMessageText(successMessage, { 
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔨 Создать еще", callback_data: "craft_main" },
                { text: "📦 Инвентарь", callback_data: "show_inventory" }
              ]
            ]
          }
        });

        log(`${character.name} создал ${result.item.name} через крафт`);
      } else {
        await ctx.answerCbQuery(result.message);
        
        // Если неудача, показываем сообщение об ошибке
        await ctx.editMessageText(
          `❌ **Крафт не удался!**\n\n${result.message}`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "◀️ Назад к рецептам", callback_data: "craft_main" }]
              ]
            }
          }
        );
      }
    } catch (error) {
      log(`Ошибка крафта: ${error.message}`, "error");
      await ctx.answerCbQuery(`❌ ${error.message}`);
    }
  }
}

module.exports = new CraftingHandler();