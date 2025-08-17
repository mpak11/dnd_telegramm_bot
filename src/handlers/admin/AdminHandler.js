const BaseHandler = require('../../core/BaseHandler');
const characterCreation = require('../../../systems/characterCreation');
const { log } = require('../../../utils/logger');

class AdminHandler extends BaseHandler {
  // Админ панель
  async handleAdmin(ctx) {
    // Здесь можно добавить проверку на админа
    await ctx.reply("🚧 Админ-панель в разработке!");
  }

  // Отладочная команда
  async handleDebugSessions(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const sessionKey = `${userId}_${chatId}`;

    // Получаем текущую сессию
    const currentSession = characterCreation.creationSessions.get(sessionKey);

    let debugText = `🔍 **Отладка сессий создания персонажа**\n\n`;

    if (currentSession) {
      debugText += `**Ваша сессия:**\n`;
      debugText += `• Ключ: ${sessionKey}\n`;
      debugText += `• Шаг: ${currentSession.step}\n`;
      debugText += `• Раса: ${currentSession.data.race || "не выбрана"}\n`;
      debugText += `• Класс: ${currentSession.data.class || "не выбран"}\n`;
      debugText += `• Имя: ${currentSession.data.name || "не введено"}\n`;
      debugText += `• Создана: ${new Date(
        currentSession.timestamp
      ).toLocaleString()}\n`;
    } else {
      debugText += `❌ У вас нет активной сессии создания\n`;
      debugText += `Ваш ключ сессии: ${sessionKey}\n`;
    }

    debugText += `\n**Всего активных сессий:** ${characterCreation.creationSessions.size}`;

    // Показываем все ключи сессий (для отладки)
    if (characterCreation.creationSessions.size > 0) {
      debugText += "\n\n**Активные сессии:**\n";
      for (const [key, session] of characterCreation.creationSessions.entries()) {
        debugText += `• ${key} (шаг: ${session.step})\n`;
      }
    }

    await ctx.reply(debugText, { parse_mode: "Markdown" });
  }

  // Тестовая команда для проверки ввода имени
  async handleTestName(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const sessionKey = `${userId}_${chatId}`;

    log(`[TestName] Создаем тестовую сессию для ${sessionKey}`);

    // Создаем тестовую сессию на этапе ввода имени
    characterCreation.creationSessions.set(sessionKey, {
      userId,
      chatId,
      chatType: ctx.chat.type,
      step: "name",
      data: {
        race: "human",
        class: "WARRIOR",
      },
      timestamp: Date.now(),
    });

    await ctx.reply(
      `🧪 **Тестовый режим**\n\n` +
      `Создана тестовая сессия на этапе ввода имени.\n` +
      `Раса: Человек\n` +
      `Класс: Воин\n` +
      `ChatId: \`${chatId}\`\n` +
      `UserId: \`${userId}\`\n` +
      `Ключ сессии: \`${sessionKey}\`\n\n` +
      `**Введите имя персонажа:**\n` +
      `• Просто напишите имя в чат\n` +
      `• Или используйте /setname ИмяПерсонажа`,
      { parse_mode: "Markdown" }
    );
  }
}

module.exports = new AdminHandler();