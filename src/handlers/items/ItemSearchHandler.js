const BaseHandler = require('../../core/BaseHandler');
const { log } = require('../../../utils/logger');
const db = require('../../../database');

class ItemSearchHandler extends BaseHandler {
  // Поиск предметов
  async handleItemSearch(ctx) {
    const query = ctx.message.text.replace("/itemsearch", "").trim();

    if (!query) {
      await ctx.reply("❌ Укажите запрос для поиска: /itemsearch меч");
      return;
    }

    try {
      const items = await db.all(
        `
        SELECT * FROM items 
        WHERE name LIKE ? OR description LIKE ?
        ORDER BY rarity DESC, name
        LIMIT 10
      `,
        [`%${query}%`, `%${query}%`]
      );

      if (items.length === 0) {
        await ctx.reply("❌ Предметы не найдены");
        return;
      }

      let result = `🔍 **Результаты поиска "${query}":**\n\n`;

      const rarityEmoji = {
        common: "⚪",
        uncommon: "🟢",
        rare: "🔵",
        epic: "🟣",
        legendary: "🟠",
      };

      for (const item of items) {
        const emoji = rarityEmoji[item.rarity] || "⚪";
        result += `${emoji} **${item.name}** - ${item.value_gold} 💰\n`;
        result += `_${item.description}_\n`;

        if (item.stats_bonus) {
          const stats = JSON.parse(item.stats_bonus);
          const statStr = Object.entries(stats)
            .map(([k, v]) => `${k}: +${v}`)
            .join(", ");
          if (statStr) result += `Бонусы: ${statStr}\n`;
        }

        result += "\n";
      }

      await ctx.reply(result, { parse_mode: "Markdown" });
    } catch (error) {
      log(`Ошибка поиска предметов: ${error.message}`, "error");
      await ctx.reply("❌ Ошибка при поиске");
    }
  }

  // Информация о предмете
  async handleItemInfo(ctx) {
    const query = ctx.message.text.replace("/iteminfo", "").trim();

    if (!query) {
      await ctx.reply("❌ Укажите название предмета: /iteminfo меч");
      return;
    }

    try {
      const item = await db.get(`SELECT * FROM items WHERE name LIKE ? LIMIT 1`, [
        `%${query}%`,
      ]);

      if (!item) {
        await ctx.reply("❌ Предмет не найден");
        return;
      }

      const rarityEmoji = {
        common: "⚪",
        uncommon: "🟢",
        rare: "🔵",
        epic: "🟣",
        legendary: "🟠",
      };

      const emoji = rarityEmoji[item.rarity] || "❓";
      let info = `${emoji} **${item.name}**\n\n`;
      info += `_${item.description}_\n\n`;
      info += `**Характеристики:**\n`;
      info += `• Тип: ${item.type}\n`;
      info += `• Редкость: ${item.rarity}\n`;
      info += `• Стоимость: ${item.value_gold} 💰\n`;

      if (item.stats_bonus) {
        const stats = JSON.parse(item.stats_bonus);
        if (Object.keys(stats).length > 0) {
          info += `\n**Бонусы:**\n`;
          for (const [stat, value] of Object.entries(stats)) {
            info += `• ${stat}: +${value}\n`;
          }
        }
      }

      if (item.effects) {
        const effects = JSON.parse(item.effects);
        if (Object.keys(effects).length > 0) {
          info += `\n**Эффекты:**\n`;
          for (const [effect, value] of Object.entries(effects)) {
            info += `• ${effect}: ${value}\n`;
          }
        }
      }

      await ctx.reply(info, { parse_mode: "Markdown" });
    } catch (error) {
      log(`Ошибка информации о предмете: ${error.message}`, "error");
      await ctx.reply("❌ Ошибка при получении информации");
    }
  }
}

module.exports = new ItemSearchHandler();