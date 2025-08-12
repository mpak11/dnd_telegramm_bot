const BaseHandler = require('../../core/BaseHandler');
const { Character } = require('../../../database/models');
const { log } = require('../../../utils/logger');
const db = require('../../../database');

class GraveyardHandler extends BaseHandler {
  async handleGraveyard(ctx) {
    const telegramId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      const user = await db.get("SELECT id FROM users WHERE telegram_id = ?", [telegramId]);

      if (!user) {
        await ctx.reply("❌ Пользователь не найден");
        return;
      }

      const deadCharacters = await db.all(
        `SELECT * FROM characters 
         WHERE user_id = ? AND chat_id = ? AND hp_current <= 0 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [user.id, chatId]
      );

      if (deadCharacters.length === 0) {
        await ctx.reply(
          "⚰️ **Кладбище героев**\n\n" +
          "Пока что здесь пусто. Ваши герои еще живы!\n" +
          "Да пребудет с ними удача в опасных квестах.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      let message = "⚰️ **Кладбище героев**\n\n";
      message += "_Здесь покоятся отважные герои, павшие в битвах..._\n\n";

      for (const char of deadCharacters) {
        const character = new Character(char);
        const deathDate = new Date(char.created_at).toLocaleDateString("ru-RU");

        message += `🪦 **${character.name}**\n`;
        message += `${character.getFullTitle()} • ${character.level} уровень\n`;
        message += `💀 Погиб: ${deathDate}\n`;
        message += `✨ Опыт: ${character.experience} XP\n`;
        message += `💰 Золото: ${character.gold}\n\n`;
      }

      message += "_Покойтесь с миром, храбрые воины._";

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      log(`Ошибка показа кладбища: ${error.message}`, "error");
      await ctx.reply("❌ Ошибка при загрузке кладбища героев");
    }
  }

  // Можно добавить дополнительные методы для мемориала
  async handleMemorial(ctx) {
    // Например, общая статистика всех погибших героев
    const chatId = ctx.chat.id;
    
    try {
      const stats = await db.get(
        `SELECT 
          COUNT(*) as total_dead,
          MAX(level) as highest_level,
          SUM(experience) as total_experience,
          SUM(gold) as total_gold
         FROM characters 
         WHERE chat_id = ? AND hp_current <= 0`,
        [chatId]
      );

      if (!stats || stats.total_dead === 0) {
        await ctx.reply(
          "📊 **Мемориал героев**\n\n" +
          "В этом чате еще никто не погиб в битвах.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      let message = "📊 **Мемориал героев**\n\n";
      message += `⚰️ Всего погибло героев: ${stats.total_dead}\n`;
      message += `🏆 Высший достигнутый уровень: ${stats.highest_level}\n`;
      message += `✨ Суммарный опыт: ${stats.total_experience} XP\n`;
      message += `💰 Потерянное золото: ${stats.total_gold}\n\n`;
      message += "_Их жертва не будет забыта._";

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      log(`Ошибка показа мемориала: ${error.message}`, "error");
      await ctx.reply("❌ Ошибка при загрузке мемориала");
    }
  }

  // Метод для поиска конкретного погибшего героя
  async handleFindHero(ctx) {
    const heroName = ctx.message.text.replace('/findhero', '').trim();
    
    if (!heroName) {
      await ctx.reply(
        "❌ Укажите имя героя для поиска!\n\n" +
        "Пример: /findhero Горак",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const telegramId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      const user = await db.get("SELECT id FROM users WHERE telegram_id = ?", [telegramId]);
      
      if (!user) {
        await ctx.reply("❌ Пользователь не найден");
        return;
      }

      const hero = await db.get(
        `SELECT * FROM characters 
         WHERE user_id = ? AND chat_id = ? AND hp_current <= 0 
         AND LOWER(name) LIKE LOWER(?)
         ORDER BY created_at DESC 
         LIMIT 1`,
        [user.id, chatId, `%${heroName}%`]
      );

      if (!hero) {
        await ctx.reply(
          `❌ Герой с именем "${heroName}" не найден среди павших.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      const character = new Character(hero);
      const deathDate = new Date(hero.created_at).toLocaleDateString("ru-RU");

      let message = `🪦 **Найден павший герой:**\n\n`;
      message += `**${character.name}**\n`;
      message += `${character.getFullTitle()} • ${character.level} уровень\n`;
      message += `💀 Погиб: ${deathDate}\n`;
      message += `✨ Опыт: ${character.experience} XP\n`;
      message += `💰 Золото: ${character.gold}\n\n`;
      message += `_Покойся с миром, ${character.name}._`;

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      log(`Ошибка поиска героя: ${error.message}`, "error");
      await ctx.reply("❌ Ошибка при поиске героя");
    }
  }
}

module.exports = new GraveyardHandler();