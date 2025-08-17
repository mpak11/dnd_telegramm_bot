// Система создания персонажей с анимацией

const { Markup } = require("telegraf");
const config = require("../config/config");
const { Character } = require("../database/models");
const { log } = require("../utils/logger");
const { escapeMarkdown } = require("../utils/markdown");

class CharacterCreationSystem {
  constructor() {
    // Состояния создания персонажа
    this.creationSessions = new Map();

    // Очистка сессий каждые 5 минут
    setInterval(() => this.cleanupSessions(), 5 * 60 * 1000);
  }

  // Начать создание персонажа
  async startCreation(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    // Проверяем, нет ли уже персонажа
    const existing = await Character.findActive(userId, chatId);
    if (existing) {
      await ctx.reply(
        `У вас уже есть персонаж: **${existing.name}**!\n\n` +
          `Используйте /hero для просмотра или /delete для удаления.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Создаем сессию
    const sessionKey = `${userId}_${chatId}`;
    this.creationSessions.set(sessionKey, {
      userId,
      chatId,
      step: "race",
      data: {},
    });

    // Показываем выбор расы
    await this.showRaceSelection(ctx);
  }

  // Показать выбор расы
  async showRaceSelection(ctx) {
    log(`[CharCreate] Показываем выбор расы`);

    const races = Object.entries(config.RACES);
    const buttons = [];

    // Создаем кнопки по 2 в ряд
    for (let i = 0; i < races.length; i += 2) {
      const row = [];

      row.push({
        text: `${races[i][1].emoji} ${races[i][1].name}`,
        callback_data: `race_${races[i][0]}`,
      });

      if (races[i + 1]) {
        row.push({
          text: `${races[i + 1][1].emoji} ${races[i + 1][1].name}`,
          callback_data: `race_${races[i + 1][0]}`,
        });
      }

      buttons.push(row);
    }

    const message =
      `🎭 **Создание персонажа**\n\n` +
      `**Шаг 1: Выберите расу**\n\n` +
      races
        .map(
          ([key, race]) =>
            `${race.emoji} **${race.name}** - ${race.description}`
        )
        .join("\n");

    log(`[CharCreate] Отправляем сообщение с ${buttons.length} рядами кнопок`);

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }

  // Обработать выбор расы
  async handleRaceSelection(ctx, race) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const sessionKey = `${userId}_${chatId}`;
    const session = this.creationSessions.get(sessionKey);

    log(`[CharCreate] Выбор расы ${race} от ${userId} в чате ${chatId}`);

    if (!session || session.step !== "race") {
      await ctx.answerCbQuery("Сессия создания истекла. Используйте /create");
      return;
    }

    const raceConfig = config.RACES[race];
    if (!raceConfig) {
      await ctx.answerCbQuery("Неверная раса!");
      return;
    }

    // Сохраняем выбор
    session.data.race = race;
    session.step = "class";
    session.timestamp = Date.now(); // Обновляем время активности

    log(`[CharCreate] Раса выбрана: ${race}, переход к выбору класса`);

    // Анимация выбора
    await ctx.answerCbQuery(`Выбрана раса: ${raceConfig.name}!`);

    // Показываем информацию о расе с анимацией
    await ctx.editMessageText(
      `${raceConfig.emoji} **${raceConfig.name}**\n\n` +
        `${raceConfig.description}\n\n` +
        `🎲 Генерируем расовые бонусы...`,
      { parse_mode: "Markdown" }
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Показываем бонусы
    const bonusText = Object.entries(raceConfig.bonuses)
      .filter(([_, value]) => value > 0)
      .map(
        ([stat, value]) =>
          `${config.STATS[stat].emoji} ${config.STATS[stat].name}: +${value}`
      )
      .join("\n");

    const abilitiesText = raceConfig.abilities.map((a) => `• ${a}`).join("\n");

    await ctx.editMessageText(
      `${raceConfig.emoji} **${raceConfig.name}**\n\n` +
        `**Расовые бонусы:**\n${bonusText}\n\n` +
        `**Способности:**\n${abilitiesText}\n\n` +
        `✅ Раса выбрана! Переходим к выбору класса...`,
      { parse_mode: "Markdown" }
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Показываем выбор класса
    await this.showClassSelection(ctx);
  }

  // Показать выбор класса
  async showClassSelection(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const sessionKey = `${userId}_${chatId}`;
    const session = this.creationSessions.get(sessionKey);

    if (!session) {
      await ctx.reply("Сессия истекла. Используйте /create");
      return;
    }

    const selectedRace = session.data.race;
    const classes = Object.entries(config.CLASSES);
    const buttons = [];

    // Создаем кнопки по 2 в ряд
    for (let i = 0; i < classes.length; i += 2) {
      const row = [];

      const class1 = classes[i];
      const isRecommended1 = class1[1].recommendedRaces.includes(selectedRace);
      row.push({
        text: `${class1[1].emoji} ${class1[1].name}${
          isRecommended1 ? " ⭐" : ""
        }`,
        callback_data: `class_${class1[0]}`,
      });

      if (classes[i + 1]) {
        const class2 = classes[i + 1];
        const isRecommended2 =
          class2[1].recommendedRaces.includes(selectedRace);
        row.push({
          text: `${class2[1].emoji} ${class2[1].name}${
            isRecommended2 ? " ⭐" : ""
          }`,
          callback_data: `class_${class2[0]}`,
        });
      }

      buttons.push(row);
    }

    const message =
      `🎭 **Создание персонажа**\n\n` +
      `**Шаг 2: Выберите класс**\n` +
      `⭐ отмечены рекомендуемые классы для вашей расы\n\n` +
      classes
        .map(([key, cls]) => {
          const isRecommended = cls.recommendedRaces.includes(selectedRace);
          return (
            `${cls.emoji} **${cls.name}** - ${cls.description}` +
            `\n   HP: ${cls.baseHP}, Основная характеристика: ${
              config.STATS[cls.primaryStat].name
            }` +
            (isRecommended ? " ⭐" : "")
          );
        })
        .join("\n\n");

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }

  // Обработать выбор класса
  async handleClassSelection(ctx, characterClass) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const sessionKey = `${userId}_${chatId}`;
    const session = this.creationSessions.get(sessionKey);

    log(
      `[CharCreate] Выбор класса ${characterClass} от ${userId} в чате ${chatId}`
    );

    if (!session || session.step !== "class") {
      await ctx.answerCbQuery("Сессия создания истекла. Используйте /create");
      return;
    }

    const classConfig = config.CLASSES[characterClass];
    if (!classConfig) {
      await ctx.answerCbQuery("Неверный класс!");
      return;
    }

    // Сохраняем выбор
    session.data.class = characterClass;
    session.step = "name";
    session.timestamp = Date.now(); // Обновляем время активности

    log(`[CharCreate] Класс выбран: ${characterClass}, переход к вводу имени`);

    await ctx.answerCbQuery(`Выбран класс: ${classConfig.name}!`);

    // Показываем информацию о классе
    await ctx.editMessageText(
      `${classConfig.emoji} **${classConfig.name}**\n\n` +
        `${classConfig.description}\n\n` +
        `❤️ Базовое здоровье: ${classConfig.baseHP}\n` +
        `📈 HP за уровень: ${classConfig.hpPerLevel}\n` +
        `📊 Основная характеристика: ${
          config.STATS[classConfig.primaryStat].emoji
        } ${config.STATS[classConfig.primaryStat].name}\n\n` +
        `✅ Класс выбран!`,
      { parse_mode: "Markdown" }
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Запрашиваем имя
    await ctx.reply(
      `**Шаг 3: Введите имя персонажа**\n\n` +
        `Имя должно быть от 2 до 20 символов\n` +
        `Разрешены только буквы, пробелы и дефисы\n\n` +
        `⚠️ **Если бот не видит ваши сообщения в группе:**\n` +
        `Используйте команду: /setname ИмяПерсонажа\n` +
        `Например: /setname Горак Сильный`,
      { parse_mode: "Markdown" }
    );
  }

  // Обработать ввод имени
  async handleNameInput(ctx) {
    if (!ctx.message || !ctx.message.text) {
      return false;
    }

    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const chatType = ctx.chat.type;
    const sessionKey = `${userId}_${chatId}`;

    log(
      `[CharCreate] handleNameInput вызван: userId=${userId}, chatId=${chatId}, chatType=${chatType}, key=${sessionKey}`
    );

    const session = this.creationSessions.get(sessionKey);

    log(
      `[CharCreate] Попытка ввода имени от ${userId} в чате ${chatId}, сессия: ${
        session ? "найдена" : "не найдена"
      }`
    );

    // Отладка: показываем все ключи сессий
    if (!session) {
      log(
        `[CharCreate] Доступные сессии: ${Array.from(
          this.creationSessions.keys()
        ).join(", ")}`
      );

      // Проверим, может быть есть сессия для этого пользователя в другом чате
      for (const [key, sess] of this.creationSessions.entries()) {
        if (sess.userId === userId) {
          log(
            `[CharCreate] Найдена сессия для пользователя ${userId} с ключом ${key} (chatId: ${sess.chatId}, chatType: ${sess.chatType})`
          );
        }
      }
    }

    if (!session || session.step !== "name") {
      log(`[CharCreate] Сессия не подходит: step = ${session?.step}`);
      return false; // Не наша сессия
    }

    const name = ctx.message.text.trim();
    log(`[CharCreate] Введено имя: "${name}"`);

    // Валидация имени
    if (name.length < 2 || name.length > 20) {
      await ctx.reply("❌ Имя должно быть от 2 до 20 символов!");
      return true;
    }

    if (!/^[а-яА-ЯёЁa-zA-Z\s-]+$/.test(name)) {
      await ctx.reply("❌ Имя может содержать только буквы, пробелы и дефисы!");
      return true;
    }

    // Сохраняем имя
    session.data.name = name;
    session.step = "stats";
    log(
      `[CharCreate] Имя принято: "${name}", переход к генерации характеристик`
    );

    // ВАЖНО: Отправляем подтверждение
    await ctx.reply(
      `✅ Имя принято: **${name}**\n\nГенерируем характеристики...`,
      { parse_mode: "Markdown" }
    );

    // Начинаем генерацию характеристик
    // Передаем true как параметр isTextInput чтобы использовать reply вместо edit
    await this.generateStats(ctx, true, true);
    return true;
  }

  // Генерация характеристик с анимацией
  async generateStats(ctx, isNewMessage = false, isTextInput = false) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const sessionKey = `${userId}_${chatId}`;
    const session = this.creationSessions.get(sessionKey);

    if (!session) return;

    const raceConfig = config.RACES[session.data.race];

    if (isNewMessage || isTextInput) {
      // Для новых сообщений (команда /setname или ввод текстом) показываем без анимации
      const baseStats = Character.rollStats();
      session.data.stats = baseStats;

      let message = `**🎲 Результаты бросков:**\n\n`;

      for (const [stat, value] of Object.entries(baseStats)) {
        const statConfig = config.STATS[stat];
        const raceBonus = raceConfig.bonuses[stat];
        const finalValue = value + raceBonus;
        const modifier = Math.floor((finalValue - 10) / 2);

        message += `${statConfig.emoji} ${
          statConfig.name
        }: **${finalValue}** (${modifier >= 0 ? "+" : ""}${modifier})\n`;
      }

      message += "\n✅ Характеристики сгенерированы!\n\n";
      message += "Вы можете принять эти характеристики или перебросить";

      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Принять", callback_data: "stats_accept" },
              { text: "🎲 Перебросить", callback_data: "stats_reroll" },
            ],
          ],
        },
      });
    } else {
      // Для callback (обычное создание через кнопки) показываем с анимацией
      // Сначала отправляем новое сообщение вместо редактирования
      const animMessage = await ctx.reply(
        `🎲 **Бросаем кубики для определения характеристик...**\n\n` +
          `Используется метод 4d6, отбрасываем минимум`,
        { parse_mode: "Markdown" }
      );

      // Генерируем характеристики
      const baseStats = Character.rollStats();
      session.data.stats = baseStats;

      // Анимация броска для каждой характеристики
      let message = `**🎲 Результаты бросков:**\n\n`;

      for (const [stat, value] of Object.entries(baseStats)) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const statConfig = config.STATS[stat];
        const raceBonus = raceConfig.bonuses[stat];
        const finalValue = value + raceBonus;
        const modifier = Math.floor((finalValue - 10) / 2);

        message += `${statConfig.emoji} ${
          statConfig.name
        }: **${finalValue}** (${modifier >= 0 ? "+" : ""}${modifier})\n`;

        // Редактируем новое сообщение с анимацией
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            animMessage.message_id,
            null,
            message,
            { parse_mode: "Markdown" }
          );
        } catch (error) {
          log(
            `[CharCreate] Ошибка редактирования: ${error.message}`,
            "warning"
          );
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Показываем кнопки подтверждения
      message += "\n✅ Характеристики сгенерированы!\n\n";
      message += "Вы можете принять эти характеристики или перебросить";

      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          animMessage.message_id,
          null,
          message,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Принять", callback_data: "stats_accept" },
                  { text: "🎲 Перебросить", callback_data: "stats_reroll" },
                ],
              ],
            },
          }
        );
      } catch (error) {
        log(
          `[CharCreate] Ошибка финального редактирования: ${error.message}`,
          "warning"
        );
        // Если не удалось отредактировать, отправим новое сообщение
        await ctx.reply(message, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Принять", callback_data: "stats_accept" },
                { text: "🎲 Перебросить", callback_data: "stats_reroll" },
              ],
            ],
          },
        });
      }
    }
  }

  // Обработать решение по характеристикам
  async handleStatsDecision(ctx, decision) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const sessionKey = `${userId}_${chatId}`;
    const session = this.creationSessions.get(sessionKey);

    if (!session || session.step !== "stats") {
      await ctx.answerCbQuery("Сессия истекла. Используйте /create");
      return;
    }

    if (decision === "reroll") {
      await ctx.answerCbQuery("🎲 Перебрасываем...");

      // Генерируем новые характеристики
      const baseStats = Character.rollStats();
      session.data.stats = baseStats;

      const raceConfig = config.RACES[session.data.race];

      let message = `**🎲 Новые результаты бросков:**\n\n`;

      for (const [stat, value] of Object.entries(baseStats)) {
        const statConfig = config.STATS[stat];
        const raceBonus = raceConfig.bonuses[stat];
        const finalValue = value + raceBonus;
        const modifier = Math.floor((finalValue - 10) / 2);

        message += `${statConfig.emoji} ${
          statConfig.name
        }: **${finalValue}** (${modifier >= 0 ? "+" : ""}${modifier})\n`;
      }

      message += "\n✅ Характеристики сгенерированы!\n\n";
      message += "Вы можете принять эти характеристики или перебросить";

      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Принять", callback_data: "stats_accept" },
              { text: "🎲 Перебросить", callback_data: "stats_reroll" },
            ],
          ],
        },
      });

      return;
    }

    // Принимаем характеристики и создаем персонажа
    await ctx.answerCbQuery("✅ Создаем персонажа...");

    try {
      // Финальная анимация создания
      await ctx.editMessageText(
        `✨ **Создание персонажа...**\n\n` + `🎭 Формируем личность...`,
        { parse_mode: "Markdown" }
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await ctx.editMessageText(
        `✨ **Создание персонажа...**\n\n` +
          `🎭 Формируем личность...\n` +
          `⚡ Наделяем силой...`,
        { parse_mode: "Markdown" }
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await ctx.editMessageText(
        `✨ **Создание персонажа...**\n\n` +
          `🎭 Формируем личность...\n` +
          `⚡ Наделяем силой...\n` +
          `🌟 Даруем судьбу...`,
        { parse_mode: "Markdown" }
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Сначала создаем/обновляем пользователя
      const { User } = require("../database/models");
      const user = await User.findOrCreate(ctx.from);

      // Создаем персонажа
      const character = await Character.create(
        user.id, // Используем ID из базы, а не telegram_id
        chatId,
        session.data.name,
        session.data.race,
        session.data.class,
        session.data.stats
      );

      // Удаляем сессию
      this.creationSessions.delete(sessionKey);

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

      log(
        `Создан персонаж: ${character.name} (${character.race} ${character.class}) для пользователя ${userId}`
      );
    } catch (error) {
      log(`Ошибка создания персонажа: ${error.message}`, "error");

      // Экранируем специальные символы для Markdown
      const errorMessage = escapeMarkdown(error.message);

      await ctx.editMessageText(
        `❌ Ошибка создания персонажа: ${errorMessage}`,
        { parse_mode: "Markdown" }
      );
      this.creationSessions.delete(sessionKey);
    }
  }

  // Обработка callback запросов
  async handleCallback(ctx) {
    const data = ctx.callbackQuery.data;

    log(`[CharCreate] Обработка callback: ${data}`);

    if (data.startsWith("race_")) {
      const race = data.substring(5);
      await this.handleRaceSelection(ctx, race);
      return true;
    }

    if (data.startsWith("class_")) {
      const characterClass = data.substring(6);
      await this.handleClassSelection(ctx, characterClass);
      return true;
    }

    if (data.startsWith("stats_")) {
      const decision = data.substring(6);
      await this.handleStatsDecision(ctx, decision);
      return true;
    }

    return false;
  }

  // Очистка истекших сессий
  cleanupSessions() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, session] of this.creationSessions.entries()) {
      // Удаляем сессии старше 30 минут
      if (now - session.timestamp > 30 * 60 * 1000) {
        this.creationSessions.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log(`[CharCreate] Очищено ${cleaned} истекших сессий`);
    }
  }
}

// Экспортируем singleton
const characterCreationSystem = new CharacterCreationSystem();

// Делаем метод generateStats доступным извне
characterCreationSystem.generateStats =
  characterCreationSystem.generateStats.bind(characterCreationSystem);

module.exports = characterCreationSystem;
