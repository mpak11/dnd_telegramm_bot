// Финальное создание персонажа

const { User, Character } = require('../../database/models');
const { log } = require('../../utils/logger');
const { escapeMarkdown } = require('../../utils/markdown');

class CharacterBuilder {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }

  // Создать персонажа
  async build(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const session = this.sessionManager.get(userId, chatId);

    if (!session || !session.data.name || !session.data.race || 
        !session.data.class || !session.data.stats) {
      throw new Error("Неполные данные для создания персонажа");
    }

    try {
      // Анимация создания
      await this.showCreationAnimation(ctx);

      // Создаем/обновляем пользователя
      const user = await User.findOrCreate(ctx.from);

      // Создаем персонажа
      const character = await Character.create(
        user.id,
        chatId,
        session.data.name,
        session.data.race,
        session.data.class,
        session.data.stats
      );

      // Удаляем сессию
      this.sessionManager.delete(userId, chatId);

      // Показываем созданного персонажа
      const display = await character.getFullDisplay();

      await ctx.editMessageText(
        `🎉 **Персонаж создан!**\n\n${display}\n\n` +
        `Используйте /hero для просмотра персонажа\n` +
        `Квесты будут доступны с 10:00 до 22:00 МСК`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "👤 Мой герой", callback_data: "show_hero" }],
            ],
          },
        }
      );

      log(`Создан персонаж: ${character.name} (${character.race} ${character.class}) для пользователя ${userId}`);

      return character;
    } catch (error) {
      log(`Ошибка создания персонажа: ${error.message}`, "error");
      
      // Удаляем сессию при ошибке
      this.sessionManager.delete(userId, chatId);

      const errorMessage = escapeMarkdown(error.message);
      await ctx.editMessageText(
        `❌ Ошибка создания персонажа: ${errorMessage}`,
        { parse_mode: "Markdown" }
      );
      
      throw error;
    }
  }

  // Анимация создания персонажа
  async showCreationAnimation(ctx) {
    const messages = [
      `✨ **Создание персонажа...**\n\n🎭 Формируем личность...`,
      `✨ **Создание персонажа...**\n\n🎭 Формируем личность...\n⚡ Наделяем силой...`,
      `✨ **Создание персонажа...**\n\n🎭 Формируем личность...\n⚡ Наделяем силой...\n🌟 Даруем судьбу...`
    ];

    for (const message of messages) {
      await ctx.editMessageText(message, { parse_mode: "Markdown" });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = CharacterBuilder;