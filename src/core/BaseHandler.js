const { log } = require("../../utils/logger");
const { Character } = require("../../database/models");

class BaseHandler {
  async withCharacter(ctx, callback) {
    const character = await Character.findActive(ctx.from.id, ctx.chat.id);
    if (!character) {
      return ctx.reply("❌ У вас нет персонажа!\n\nИспользуйте /create для создания.", {
        parse_mode: "Markdown"
      });
    }
    return callback(character);
  }
  
  async handleError(ctx, error, message = "❌ Произошла ошибка") {
    log(`Ошибка: ${error.message}`, "error");
    await ctx.reply(message);
  }

  async checkCharacterAlive(character, ctx) {
    if (character.hp_current <= 0) {
      await ctx.reply("☠️ Мертвые не могут выполнять это действие!", {
        parse_mode: "Markdown",
      });
      return false;
    }
    return true;
  }
}

module.exports = BaseHandler;