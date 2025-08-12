const BaseHandler = require('../../core/BaseHandler');
const { Character } = require('../../../database/models');
const { log } = require('../../../utils/logger');
const db = require('../../../database');

class CharacterDeleteHandler extends BaseHandler {
  // Удалить персонажа
  async handleDeleteCharacter(ctx) {
    await this.withCharacter(ctx, async (character) => {
      await ctx.reply(
        `⚠️ **Вы уверены, что хотите удалить персонажа?**\n\n` +
        `Персонаж: ${character.name} (${character.level} уровень)\n` +
        `Класс: ${character.getClassInfo()}\n\n` +
        `Это действие необратимо!`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "❌ Да, удалить", callback_data: "delete_confirm" },
                { text: "✅ Отмена", callback_data: "delete_cancel" },
              ],
            ],
          },
        }
      );
    });
  }

  // Подтверждение удаления
  async confirmDeleteCharacter(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    log(`[Delete] Начинаем удаление персонажа для user ${userId} в чате ${chatId}`);

    const character = await Character.findActive(userId, chatId);

    if (!character) {
      await ctx.answerCbQuery("Персонаж не найден");
      log(`[Delete] Персонаж не найден для user ${userId} в чате ${chatId}`, "warning");
      return;
    }

    const characterName = character.name;
    const characterId = character.id;
    const characterUserId = character.user_id;

    log(`[Delete] Удаляем персонажа: ${characterName} (ID: ${characterId})`);

    await character.delete();

    // Добавляем небольшую задержку для гарантии записи в БД
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Проверяем, что персонаж действительно удален
    const checkDeleted = await Character.findActive(userId, chatId);
    if (checkDeleted) {
      log(`[Delete] ОШИБКА: Персонаж ${characterName} не был удален!`, "error");

      // Пробуем еще раз принудительно
      await db.run(
        "UPDATE characters SET is_active = 0 WHERE id = ? AND user_id = ? AND chat_id = ?",
        [characterId, characterUserId, chatId]
      );
    } else {
      log(`[Delete] Персонаж ${characterName} успешно удален`);
    }

    await ctx.answerCbQuery("Персонаж удален!");
    await ctx.editMessageText(
      `✅ Персонаж ${characterName} был удален.\n\n` +
      `Используйте /create для создания нового персонажа.`,
      { parse_mode: "Markdown" }
    );
  }
}

module.exports = new CharacterDeleteHandler();