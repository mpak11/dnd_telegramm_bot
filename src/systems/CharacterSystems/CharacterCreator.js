//Создание персонажа.
// Создание персонажа
async function handleCreateCharacter(ctx) {
    log(`[Commands] Вызвана команда создания персонажа от ${ctx.from.id}`);

    await User.findOrCreate(ctx.from);

    // Если это callback от кнопки, отвечаем на него
    if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
    }

    await characterCreation.startCreation(ctx);
}

// Показать персонажа
async function handleShowCharacter(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    const character = await Character.findActive(userId, chatId);

    if (!character) {
        await ctx.reply(
            "❌ У вас нет персонажа!\n\nИспользуйте /create для создания.",
            { parse_mode: "Markdown" }
        );
        return;
    }

    let display = await character.getFullDisplay();
    async function handleSetName(ctx) {
        const userId = ctx.from.id;
        const chatId = ctx.chat.id;
        const sessionKey = `${userId}_${chatId}`;

        // Получаем сессию
        const session = characterCreation.creationSessions.get(sessionKey);

        if (!session || session.step !== "name") {
            await ctx.reply(
                `❌ Нет активной сессии создания персонажа на этапе ввода имени.\n\n` +
                `Используйте /create для создания персонажа.`,
                { parse_mode: "Markdown" }
            );
            return;
        }

        // Получаем имя из команды
        const text = ctx.message.text;
        const parts = text.split(" ");

        if (parts.length < 2) {
            await ctx.reply(
                `❌ Использование: /setname ИмяПерсонажа\n\n` +
                `Например: /setname Горак Сильный`,
                { parse_mode: "Markdown" }
            );
            return;
        }

        // Собираем имя из всех частей после команды
        const name = parts.slice(1).join(" ").trim();

        // Валидация имени
        if (name.length < 2 || name.length > 20) {
            await ctx.reply("❌ Имя должно быть от 2 до 20 символов!");
            return;
        }

        if (!/^[а-яА-ЯёЁa-zA-Z\s-]+$/.test(name)) {
            await ctx.reply("❌ Имя может содержать только буквы, пробелы и дефисы!");
            return;
        }

        // Сохраняем имя и переходим к генерации характеристик
        session.data.name = name;
        session.step = "stats";

        log(`[SetName] Имя установлено: "${name}" для сессии ${sessionKey}`);

        await ctx.reply(
            `✅ Имя принято: **${name}**\n\nГенерируем характеристики...`,
            { parse_mode: "Markdown" }
        );

        // Запускаем генерацию характеристик (true = новое сообщение, без анимации)
        await characterCreation.generateStats(ctx, true);
    }

    // Быстрое создание персонажа для групп
    async function handleQuickCreate(ctx) {
        const text = ctx.message.text;
        const parts = text.split(" ");

        if (parts.length < 4) {
            await ctx.reply(
                `❌ **Использование:**\n` +
                `/quickcreate раса класс имя\n\n` +
                `**Расы:** human, elf, dwarf, halfling\n` +
                `**Классы:** WARRIOR, ROGUE, MAGE, CLERIC, BARBARIAN, RANGER\n\n` +
                `**Пример:**\n` +
                `/quickcreate human WARRIOR Горак Сильный`,
                { parse_mode: "Markdown" }
            );
            return;
        }

        const race = parts[1].toLowerCase();
        const characterClass = parts[2].toUpperCase();
        const name = parts.slice(3).join(" ").trim();

        // Валидация
        const config = require("../config/config");

        if (!config.RACES[race]) {
            await ctx.reply(`❌ Неверная раса! Доступны: human, elf, dwarf, halfling`);
            return;
        }

        if (!config.CLASSES[characterClass]) {
            await ctx.reply(
                `❌ Неверный класс! Доступны: WARRIOR, ROGUE, MAGE, CLERIC, BARBARIAN, RANGER`
            );
            return;
        }

        if (name.length < 2 || name.length > 20) {
            await ctx.reply("❌ Имя должно быть от 2 до 20 символов!");
            return;
        }

        if (!/^[а-яА-ЯёЁa-zA-Z\s-]+$/.test(name)) {
            await ctx.reply("❌ Имя может содержать только буквы, пробелы и дефисы!");
            return;
        }

        try {
            // Создаем/обновляем пользователя
            const user = await User.findOrCreate(ctx.from);

            // Проверяем, нет ли уже персонажа
            const existing = await Character.findActive(ctx.from.id, ctx.chat.id);
            if (existing) {
                await ctx.reply(
                    `❌ У вас уже есть персонаж: **${existing.name}**!\n\n` +
                    `Используйте /delete для удаления.`,
                    { parse_mode: "Markdown" }
                );
                return;
            }

            await ctx.reply(
                `🎲 **Создаем персонажа...**\n\n` +
                `Раса: ${config.RACES[race].emoji} ${config.RACES[race].name}\n` +
                `Класс: ${config.CLASSES[characterClass].emoji} ${config.CLASSES[characterClass].name}\n` +
                `Имя: ${name}\n\n` +
                `Генерируем характеристики...`,
                { parse_mode: "Markdown" }
            );

            // Создаем персонажа с правильным user.id
            const character = await Character.create(
                user.id, // Используем ID из базы данных
                ctx.chat.id,
                name,
                race,
                characterClass
            );

            const display = await character.getFullDisplay();

            await ctx.reply(
                `🎉 **Персонаж создан!**\n\n${display}\n\n` +
                `Используйте /hero для просмотра персонажа\n` +
                `Квесты будут доступны с 10:00 до 22:00 МСК`,
                { parse_mode: "Markdown" }
            );

            log(
                `Быстрое создание персонажа: ${name} (${race} ${characterClass}) для пользователя ${ctx.from.id}`
            );
        } catch (error) {
            log(`Ошибка быстрого создания персонажа: ${error.message}`, "error");

            // Экранируем специальные символы для Markdown
            const errorMessage = escapeMarkdown(error.message);

            await ctx.reply(`❌ Ошибка создания: ${errorMessage}`, {
                parse_mode: "Markdown",
            });
        }
    }
