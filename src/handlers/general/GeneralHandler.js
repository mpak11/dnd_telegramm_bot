const BaseHandler = require('../../core/BaseHandler');
const { User, Character } = require('../../../database/models');
const config = require('../../../config/config');

class GeneralHandler extends BaseHandler {
  async handleStart(ctx) {
    // Создаем или обновляем пользователя
    await User.findOrCreate(ctx.from);

    let welcomeText = `
🎲 **Добро пожаловать в D&D Bot!**

Я - ваш проводник в мире приключений!

**🎯 Основные команды:**
/create - Создать персонажа
/hero - Посмотреть персонажа
/stats - Детальная статистика
/inventory - Открыть инвентарь
/quest - Текущий квест
/quests - История квестов
/help - Справка

**📖 Как играть:**
1. Создайте персонажа командой /create
2. Выберите расу и класс
3. Дождитесь ежедневных квестов (1-3 в день)
4. Бросайте кубик и испытывайте судьбу!
5. Получайте опыт, золото и легендарные предметы!
`;

    // Добавляем рекомендацию для групп
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
      welcomeText += `
**⚠️ Для групп рекомендуется:**
Использовать /quickcreate для быстрого создания персонажа
Пример: /quickcreate human WARRIOR Горак
`;
    }

    welcomeText += `
Квесты выдаются с 10:00 до 22:00 по МСК
`;

    // Проверяем, есть ли персонаж
    const character = await Character.findActive(ctx.from.id, ctx.chat.id);

    const buttons = character
      ? [[{ text: "👤 Мой герой", callback_data: "show_hero" }]]
      : [[{ text: "🎭 Создать персонажа", callback_data: "create_character" }]];

    await ctx.reply(welcomeText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }

  async handleHelp(ctx) {
    const helpText = `
📖 **Справка по командам**

**Персонаж:**
/create - Создать нового персонажа
/quickcreate - Быстрое создание (для групп)
/hero - Информация о персонаже
/stats - Детальная статистика
/inventory - Ваш инвентарь
/improve - Улучшить характеристики 💎
/improvements - История улучшений
/delete - Удалить персонажа
/setname - Ввести имя (при создании)
/graveyard - Кладбище героев ⚰️

**Квесты:**
/quest - Текущий квест и выполнение
/quests - История выполненных квестов
/getquest - Получить новый квест вручную

**Предметы и обмен:**
/inventory - Инвентарь с возможностью использования
/trade - Начать обмен с другим игроком
/trades - Активные предложения обмена
/give - Передать предметы (в разработке)
/chest - Создать сундук с сокровищами
/use - Использовать предмет

**Прочее:**
/status - Статус бота
/check_bot - Проверка прав бота
/help - Эта справка

**🎯 Система квестов:**
- Автоматическая выдача в 10:00, 14:00, 18:00 МСК
- До 3 квестов в день на чат
- Время выполнения: 4 часа
- Результат зависит от броска 1d20 + модификатор
- **Успешные квесты дают предметы!**

**💎 Система предметов:**
- Редкость: ⚪ Обычный → 🟢 Необычный → 🔵 Редкий → 🟣 Эпический → 🟠 Легендарный
- Предметы выпадают из квестов
- Критический успех (20) дает больше лута
- Уникальные легендарные предметы существуют в единственном экземпляре

**🤝 Система обмена:**
- Обмен доступен только в групповых чатах
- Можно обменивать предметы и золото
- Предложения действуют 5 минут
- Безопасная система с подтверждением

**💎 Улучшение характеристик:**
- На 4 и 8 уровнях даются 2 очка улучшения
- Можно потратить 2 очка на +2 к одной характеристике
- Или по 1 очку на +1 к двум разным характеристикам
- Максимальное значение характеристики: 20

**💀 Смерть персонажа:**
- При HP = 0 персонаж умирает
- Мертвые персонажи не могут выполнять квесты
- Используйте /create для создания нового героя
- /graveyard - посмотреть павших героев

**📝 Быстрое создание для групп:**
/quickcreate раса класс имя

**Пример:**
/quickcreate human WARRIOR Горак Сильный

**Расы:** human, elf, dwarf, halfling
**Классы:** WARRIOR, ROGUE, MAGE, CLERIC, BARBARIAN, RANGER

Максимальный уровень: 10
Квесты доступны с 10:00 до 22:00 МСК

⚠️ **Для работы в группах бот должен быть администратором или иметь отключенный режим конфиденциальности**
`;

    await ctx.reply(helpText, { parse_mode: "Markdown" });
  }

  async handleStatus(ctx) {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    // Получаем персонажа если есть
    const character = await Character.findActive(userId, chatId);

    const statusText = `
📊 **Статус бота**

🎲 Версия: 2.0
📱 Чат ID: ${chatId}
👤 Ваш ID: ${userId}
⏰ Время сервера: ${new Date().toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
    })} МСК

${
      character
        ? `\n🎭 Ваш персонаж: ${character.name} (${character.level} ур.)`
        : "\n❌ Персонаж не создан"
    }

Квесты выдаются с 10:00 до 22:00 МСК
`;

    await ctx.reply(statusText, { parse_mode: "Markdown" });
  }

  async handleCheckBot(ctx) {
    const chatId = ctx.chat.id;
    const chatType = ctx.chat.type;
    const botId = ctx.botInfo.id;

    let info = `🤖 **Информация о боте**\n\n`;
    info += `• Тип чата: ${chatType}\n`;
    info += `• ID чата: \`${chatId}\`\n`;
    info += `• ID бота: ${botId}\n`;

    if (chatType === "group" || chatType === "supergroup") {
      try {
        const chatMember = await ctx.getChatMember(botId);
        info += `• Статус бота: ${chatMember.status}\n`;

        if (chatMember.status === "administrator") {
          info += `• Права админа: ✅\n`;
          info += `• Может читать сообщения: ${
            chatMember.can_read_all_group_messages ? "✅" : "❌"
          }\n`;
        } else {
          info += `• Права админа: ❌\n`;
        }
      } catch (error) {
        info += `• Ошибка получения прав: ${error.message}\n`;
      }

      info += `\n⚠️ **ВАЖНО для групп:**\n`;
      info += `Для работы ввода имени персонажа в группе, бот должен:\n`;
      info += `1. Быть администратором группы\n`;
      info += `2. Иметь отключенный "Режим конфиденциальности" в @BotFather\n\n`;
      info += `**Как исправить:**\n`;
      info += `1. Сделайте бота администратором группы\n`;
      info += `2. Или перейдите в @BotFather:\n`;
      info += `   • /mybots → выберите бота\n`;
      info += `   • Bot Settings → Group Privacy\n`;
      info += `   • Выберите "Turn off"\n`;
      info += `3. После изменения удалите и заново добавьте бота в группу\n`;
    } else {
      info += `\n✅ В приватном чате все должно работать!`;
    }

    await ctx.reply(info, { parse_mode: "Markdown" });
  }
}

module.exports = new GeneralHandler();