// Централизованная регистрация команд

const { log } = require("../utils/logger");
const { escapeMarkdown } = require("../utils/markdown");
const { User, Character } = require("../database/models");
const characterCreation = require("../systems/characterCreation");
const questSystem = require("../systems/questSystem");
const db = require("../database");
const config = require("../config/config");
const tradeSystem = require("../systems/tradeSystem");
const lootSystem = require("../systems/lootSystem");
const tradeSessions = new Map();
const equipmentSystem = require("../systems/equipmentSystem");
const craftingSystem = require("../systems/craftingSystem");
const advancedMerchantSystem = require("../systems/advancedMerchantSystem");

function setupCommands(bot) {
  // ТЕСТОВЫЙ ОБРАБОТЧИК - для проверки, что текст вообще доходит
  bot.use(async (ctx, next) => {
    if (ctx.message && ctx.message.text) {
      log(
        `[TEST] Сообщение получено: "${ctx.message.text}" от ${ctx.from.id} в чате ${ctx.chat.id} (тип: ${ctx.chat.type})`
      );
    }
    await next();
  });

  // Основные команды
  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("status", handleStatus);

  // Команды персонажа
  bot.command("create", handleCreateCharacter);
  bot.command("hero", handleShowCharacter);
  bot.command("inventory", handleShowInventory);
  bot.command("stats", handleShowStats);
  bot.command("delete", handleDeleteCharacter);
  bot.command("setname", handleSetName);
  bot.command("quickcreate", handleQuickCreate);
  bot.command("debug_chars", handleDebugCharacters);
  bot.command("graveyard", handleGraveyard);
  bot.command("improve", handleImprove);
  bot.command("improvements", handleImprovementHistory);

  // Команды квестов
  bot.command("quest", handleShowQuest);
  bot.command("quests", handleListQuests);
  bot.command("getquest", handleGetQuest);

  // Команды инвентаря
  bot.command("give", handleGive);
  bot.command("trade", handleTrade);
  bot.command("trades", handleActiveTrades);
  bot.command("chest", handleCreateChest);
  bot.command("use", handleUseItem);
  bot.command("gift", handleGift);

  // Команды экипировки
  bot.command("equipment", handleEquipment);
  bot.command("equip", handleEquipment);
  bot.command("eq", handleEquipment);
  bot.command("equip_item", handleEquipItem);
  bot.command("unequip", handleUnequipItem);

  // Команды магазина
  bot.command("shop", handleShop);
  bot.command("buy", handleBuy);
  bot.command("sell", handleSell);

  // Команды крафта
  bot.command("craft", handleCraft);
  bot.command("recipes", handleRecipes);

  // Команды поиска
  bot.command("itemsearch", handleItemSearch);
  bot.command("iteminfo", handleItemInfo);

  // Административные команды
  bot.command("admin", handleAdmin);
  bot.command("debug_sessions", handleDebugSessions);
  bot.command("test_name", handleTestName);
  bot.command("check_bot", handleCheckBot);

  // Обработка текстовых сообщений (ДО callback_query!)
  bot.on("text", async (ctx, next) => {
    // Пропускаем команды
    const text = ctx.message.text;
    if (text.startsWith("/")) {
      return next();
    }

    log(
      `[Commands] Обработка текста: "${text}" от ${ctx.from.id} в чате ${ctx.chat.id}`
    );

    // Проверяем систему создания персонажа
    try {
      const handled = await characterCreation.handleNameInput(ctx);
      if (handled) {
        log(`[Commands] Текст обработан как имя персонажа`);
        return; // Не передаем дальше
      }
    } catch (error) {
      log(`[Commands] Ошибка обработки имени: ${error.message}`, "error");
    }

    // Передаем дальше
    await next();
  });

  // Обработка callback queries
  bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data;

    log(`[Callback] Получен callback: ${data} от ${ctx.from.id}`);

    // Система создания персонажа
    if (await characterCreation.handleCallback(ctx)) {
      return;
    }

    // Другие callbacks
    if (data === "create_character") {
      await handleCreateCharacter(ctx);
    } else if (data === "show_hero") {
      await handleShowCharacter(ctx);
    } else if (data === "delete_confirm") {
      await confirmDeleteCharacter(ctx);
    } else if (data === "delete_cancel") {
      await ctx.answerCbQuery("Удаление отменено");
      await ctx.deleteMessage();
    } else if (data === "quest_roll") {
      await handleQuestRoll(ctx);
    } else if (data.startsWith("improve_")) {
      await handleImprovementCallback(ctx);
    } else if (data.startsWith("trade_")) {
      await handleTradeCallback(ctx);
    } else if (data.startsWith("chest_")) {
      await handleChestCallback(ctx);
    } else if (data.startsWith("use_")) {
      await handleUseItemCallback(ctx);
    } else if (data.startsWith("equip_item_")) {
      await handleEquipItemCallback(ctx);
    } else if (data.startsWith("unequip_item_")) {
      await handleUnequipItemCallback(ctx);
    } else if (data === "show_inventory") {
      await handleShowInventory(ctx);
    } else if (data === "equip_menu") {
      await handleEquipMenu(ctx);
    } else if (data === "cancel") {
      await ctx.answerCbQuery("Отменено");
      await ctx.deleteMessage();
    } else if (data === "back_to_equipment") {
      await handleEquipmentCallback(ctx);
    }

    // Callbacks для магазина
    else if (data.startsWith("visit_merchant_")) {
      await handleVisitMerchantCallback(ctx);
    } else if (data.startsWith("merchant_buy_")) {
      await handleMerchantBuyCallback(ctx);
    } else if (data.startsWith("merchant_sell_")) {
      await handleMerchantSellCallback(ctx);
    } else if (data.startsWith("buy_item_")) {
      await handleBuyItemCallback(ctx);
    } else if (data.startsWith("sell_item_")) {
      await handleSellItemCallback(ctx);
    }

    // Callbacks для крафта
    else if (data.startsWith("craft_item_")) {
      await handleCraftItemCallback(ctx);
    } else if (data.startsWith("craft_view_")) {
      await handleCraftViewCallback(ctx);
    }

    // Общие callbacks
    else if (data === "shop_main") {
      await handleShop(ctx);
    }
  });

  log("✅ Команды зарегистрированы", "success");
}

// === Обработчики команд ===

async function handleStart(ctx) {
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

async function handleHelp(ctx) {
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
/check\\_bot - Проверка прав бота
/help - Эта справка

**🎯 Система квестов:**
• Автоматическая выдача в 10:00, 14:00, 18:00 МСК
• До 3 квестов в день на чат
• Время выполнения: 4 часа
• Результат зависит от броска 1d20 + модификатор
• **Успешные квесты дают предметы!**

**💎 Система предметов:**
• Редкость: ⚪ Обычный → 🟢 Необычный → 🔵 Редкий → 🟣 Эпический → 🟠 Легендарный
• Предметы выпадают из квестов
• Критический успех (20) дает больше лута
• Уникальные легендарные предметы существуют в единственном экземпляре

**🤝 Система обмена:**
• Обмен доступен только в групповых чатах
• Можно обменивать предметы и золото
• Предложения действуют 5 минут
• Безопасная система с подтверждением

**💎 Улучшение характеристик:**
• На 4 и 8 уровнях даются 2 очка улучшения
• Можно потратить 2 очка на +2 к одной характеристике
• Или по 1 очку на +1 к двум разным характеристикам
• Максимальное значение характеристики: 20

**💀 Смерть персонажа:**
• При HP = 0 персонаж умирает
• Мертвые персонажи не могут выполнять квесты
• Используйте /create для создания нового героя
• /graveyard - посмотреть павших героев

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

async function handleStatus(ctx) {
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



  // Добавляем информацию о смерти
  if (character.hp_current <= 0) {
    display =
      `☠️ **МЕРТВ** ☠️\n\n${display}\n\n` +
      `_Этот персонаж пал в бою. Его подвиги будут помнить в веках._\n\n` +
      `Используйте /create для создания нового героя.`;
  }

  await ctx.reply(display, { parse_mode: "Markdown" });
}



async function handleEquipMenu(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.answerCbQuery("❌ У вас нет персонажа!");
    return;
  }

  try {
    // Получаем предметы, которые можно экипировать
    const inventory = await character.getInventory();
    
    // ОТЛАДКА: Выводим информацию о предметах
    log(`[DEBUG] Всего предметов в инвентаре: ${inventory.length}`);
    
    for (let i = 0; i < Math.min(5, inventory.length); i++) {
      const item = inventory[i];
      log(`[DEBUG] Предмет ${i + 1}: ${item.name}`);
      log(`[DEBUG] - Тип: ${item.type}`);
      log(`[DEBUG] - slot_type: ${item.slot_type}`);
      log(`[DEBUG] - weapon_type: ${item.weapon_type}`);
      log(`[DEBUG] - armor_type: ${item.armor_type}`);
    }

    // Ищем предметы, которые можно экипировать (оружие и броню)
    const equipableItems = inventory.filter(item => {
      // Проверяем по типу предмета, а не только по slot_type
      const isWeapon = item.type === 'weapon';
      const isArmor = item.type === 'armor';
      const isShield = item.type === 'shield';
      const hasSlotType = item.slot_type && item.slot_type !== 'null' && item.slot_type !== '';
      
      log(`[DEBUG] Предмет ${item.name}: weapon=${isWeapon}, armor=${isArmor}, shield=${isShield}, slot_type=${item.slot_type}`);
      
      return isWeapon || isArmor || isShield || hasSlotType;
    });

    log(`[DEBUG] Предметов для экипировки найдено: ${equipableItems.length}`);

    if (equipableItems.length === 0) {
      await ctx.answerCbQuery("❌ У вас нет предметов для экипировки!");
      
      // Показываем детальную информацию для отладки
      let debugMessage = "🔍 **Отладочная информация:**\n\n";
      debugMessage += `Всего предметов: ${inventory.length}\n\n`;
      
      for (let i = 0; i < Math.min(3, inventory.length); i++) {
        const item = inventory[i];
        debugMessage += `**${item.name}**\n`;
        debugMessage += `Тип: ${item.type}\n`;
        debugMessage += `slot_type: ${item.slot_type || 'не указан'}\n`;
        debugMessage += `weapon_type: ${item.weapon_type || 'не указан'}\n\n`;
      }
      
      await ctx.editMessageText(debugMessage, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "◀️ Назад", callback_data: "back_to_equipment" }
          ]]
        }
      });
      return;
    }

    let message = "🎒 **Выберите предмет для экипировки:**\n\n";
    const keyboard = [];

    const rarityEmoji = {
      common: "⚪",
      uncommon: "🟢",
      rare: "🔵",
      epic: "🟣",
      legendary: "🟠",
    };

    // Простой список всех экипируемых предметов
    for (const item of equipableItems.slice(0, 10)) { // Ограничиваем 10 предметами
      const emoji = rarityEmoji[item.rarity] || "⚪";
      const typeInfo = item.weapon_type || item.armor_type || item.type;
      
      message += `${emoji} **${item.name}** (${typeInfo})\n`;
      
      keyboard.push([{
        text: `${emoji} ${item.name}`,
        callback_data: `equip_item_${item.id}`
      }]);
    }

    keyboard.push([
      { text: "◀️ Назад к экипировке", callback_data: "back_to_equipment" }
    ]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });

  } catch (error) {
    log(`Ошибка меню экипировки: ${error.message}`, "error");
    await ctx.answerCbQuery("❌ Ошибка при загрузке меню экипировки");
  }
}

async function handleEquipItemCallback(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const itemId = parseInt(ctx.callbackQuery.data.replace("equip_item_", ""));

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  try {
    // Проверяем, что предмет есть в инвентаре
    const inventory = await character.getInventory();
    const item = inventory.find(i => i.id === itemId);
    
    if (!item) {
      await ctx.answerCbQuery("❌ Предмет не найден в инвентаре!");
      return;
    }

    log(`[DEBUG] Попытка экипировать: ${item.name} (ID: ${itemId})`);
    log(`[DEBUG] Тип предмета: ${item.type}, slot_type: ${item.slot_type}`);

    // Определяем слот для экипировки
    let targetSlot = item.slot_type;
    
    // Если slot_type не указан, определяем по типу предмета
    if (!targetSlot || targetSlot === 'null') {
      if (item.type === 'weapon') {
        targetSlot = 'main_hand';
      } else if (item.type === 'armor') {
        targetSlot = 'chest';
      } else if (item.type === 'shield') {
        targetSlot = 'off_hand';
      } else {
        await ctx.answerCbQuery("❌ Не удается определить слот для этого предмета!");
        return;
      }
    }

    // Если есть система экипировки, используем её
    if (typeof equipmentSystem !== 'undefined') {
      const result = await equipmentSystem.equipItem(character.id, itemId);
      await ctx.answerCbQuery("✅ Предмет экипирован!");
      
      await ctx.editMessageText(`✅ **${item.name}** экипирован в слот: ${result.slot}`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "◀️ К экипировке", callback_data: "back_to_equipment" },
            { text: "🎒 Экипировать еще", callback_data: "equip_menu" }
          ]]
        }
      });
    } else {
      // Простая альтернатива без системы экипировки
      // Помечаем предмет как экипированный в инвентаре
      await db.run(
        "UPDATE inventory SET equipped = 1, equipped_slot = ? WHERE character_id = ? AND item_id = ?",
        [targetSlot, character.id, itemId]
      );
      
      await ctx.answerCbQuery("✅ Предмет экипирован!");
      
      await ctx.editMessageText(`✅ **${item.name}** экипирован!`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "◀️ К экипировке", callback_data: "back_to_equipment" },
            { text: "🎒 Экипировать еще", callback_data: "equip_menu" }
          ]]
        }
      });
    }

    log(`${character.name} экипировал ${item.name}`);

  } catch (error) {
    log(`Ошибка экипировки предмета: ${error.message}`, "error");
    await ctx.answerCbQuery(`❌ Ошибка: ${error.message}`);
  }
}

async function handleEquipment(ctx) {
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

  try {
    const display = await equipmentSystem.getEquipmentDisplay(character.id);

    // Добавляем кнопки управления
    const keyboard = [
      [
        { text: "📦 Инвентарь", callback_data: "show_inventory" },
        { text: "🎒 Экипировать", callback_data: "equip_menu" },
      ],
    ];

    await ctx.reply(display, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    log(`Ошибка показа экипировки: ${error.message}`, "error");
    await ctx.reply("❌ Ошибка при загрузке экипировки");
  }
}

// Экипировать предмет
async function handleEquipItem(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

  const itemName = ctx.message.text.replace("/equip_item", "").trim();

  if (!itemName) {
    // Показываем список предметов для экипировки
    const inventory = await character.getInventory();
    const equipable = inventory.filter((item) =>
      ["weapon", "armor", "shield", "accessory"].includes(item.type)
    );

    if (equipable.length === 0) {
      await ctx.reply("❌ У вас нет предметов для экипировки!");
      return;
    }

    let message = "🎒 **Выберите предмет для экипировки:**\n\n";
    const keyboard = [];

    for (const item of equipable) {
      const rarityEmoji =
        {
          common: "⚪",
          uncommon: "🟢",
          rare: "🔵",
          epic: "🟣",
          legendary: "🟠",
        }[item.rarity] || "⚪";

      keyboard.push([
        {
          text: `${rarityEmoji} ${item.name}`,
          callback_data: `equip_item_${item.id}`,
        },
      ]);
    }

    keyboard.push([{ text: "❌ Отмена", callback_data: "cancel" }]);

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
    return;
  }

  // Ищем предмет по имени
  const inventory = await character.getInventory();
  const item = inventory.find((i) =>
    i.name.toLowerCase().includes(itemName.toLowerCase())
  );

  if (!item) {
    await ctx.reply("❌ Предмет не найден в инвентаре!");
    return;
  }

  try {
    const result = await equipmentSystem.equipItem(character.id, item.id);
    await ctx.reply(`✅ ${item.name} экипирован в слот: ${result.slot}`, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    await ctx.reply(`❌ ${error.message}`);
  }
}

// Снять предмет
async function handleUnequipItem(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

  const equipment = await equipmentSystem.getEquipment(character.id);
  const equipped = Object.entries(equipment);

  if (equipped.length === 0) {
    await ctx.reply("❌ У вас нет экипированных предметов!");
    return;
  }

  let message = "🎒 **Выберите предмет для снятия:**\n\n";
  const keyboard = [];

  for (const [slot, item] of equipped) {
    const slotName = equipmentSystem.slots[slot]?.name || slot;
    keyboard.push([
      {
        text: `${slotName}: ${item.name}`,
        callback_data: `unequip_item_${item.id}`,
      },
    ]);
  }

  keyboard.push([{ text: "❌ Отмена", callback_data: "cancel" }]);

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

// Магазин
async function handleShop(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

  // Показываем список торговцев
  const merchants = Object.entries(advancedMerchantSystem.merchants);

  let message = "🏪 **Торговая площадь**\n\n";
  message += `💰 Ваше золото: ${character.gold}\n\n`;
  message += "Выберите торговца:\n";

  const keyboard = merchants.map(([id, merchant]) => [
    {
      text: `${merchant.name} - ${merchant.title}`,
      callback_data: `visit_merchant_${id}`,
    },
  ]);

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
}

// Крафт
async function handleCraft(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

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

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

// Поиск предметов
async function handleItemSearch(ctx) {
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

async function handleImprove(ctx) {
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

  if (character.hp_current <= 0) {
    await ctx.reply("☠️ Мертвые не могут улучшать характеристики!", {
      parse_mode: "Markdown",
    });
    return;
  }

  const points = character.ability_points || 0;

  if (points === 0) {
    await ctx.reply(
      `❌ У вас нет очков улучшения!\n\n` +
        `Очки улучшения даются на ${config.ABILITY_IMPROVEMENT_LEVELS.join(
          ", "
        )} уровнях.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  let message = `⚡ **Улучшение характеристик**\n\n`;
  message += `У вас есть **${points}** ${
    points === 1 ? "очко" : "очка"
  } улучшения.\n\n`;
  message += `**Текущие характеристики:**\n`;

  // Показываем текущие характеристики
  for (const [stat, info] of Object.entries(config.STATS)) {
    const value = character[stat];
    const modifier = character.getStatModifier(stat);
    const canImprove = value < config.MAX_ABILITY_SCORE;

    message += `${info.emoji} ${info.name}: ${value} (${
      modifier >= 0 ? "+" : ""
    }${modifier})`;
    if (!canImprove) message += " [MAX]";
    message += "\n";
  }

  message += `\n**Выберите режим улучшения:**`;

  const keyboard = [
    [{ text: "📈 +2 к одной характеристике", callback_data: "improve_single" }],
    [{ text: "📊 +1 к двум характеристикам", callback_data: "improve_double" }],
    [{ text: "❌ Отмена", callback_data: "improve_cancel" }],
  ];

  // Если только 1 очко, показываем только вариант +1
  if (points === 1) {
    keyboard.splice(0, 1); // Убираем опцию +2
  }

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}

// Обработчик callback для улучшений
async function handleImprovementCallback(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;

  const character = await Character.findActive(userId, chatId);
  if (!character || character.ability_points === 0) {
    await ctx.answerCbQuery("❌ Нет доступных очков улучшения");
    return;
  }

  if (data === "improve_cancel") {
    await ctx.answerCbQuery("Отменено");
    await ctx.deleteMessage();
    return;
  }

  if (data === "improve_single") {
    // Показываем выбор одной характеристики для +2
    await showSingleImproveMenu(ctx, character);
  } else if (data === "improve_double") {
    // Показываем выбор первой характеристики для +1
    await showDoubleImproveMenu(ctx, character, "first");
  } else if (data.startsWith("improve_apply_single_")) {
    // Применяем +2 к одной характеристике
    const stat = data.replace("improve_apply_single_", "");
    await applyImprovement(ctx, character, stat, 2);
  } else if (data.startsWith("improve_apply_first_")) {
    // Выбрана первая характеристика для +1, показываем выбор второй
    const firstStat = data.replace("improve_apply_first_", "");
    await showDoubleImproveMenu(ctx, character, "second", firstStat);
  } else if (data.startsWith("improve_apply_second_")) {
    // Применяем +1 к двум характеристикам
    const [firstStat, secondStat] = data
      .replace("improve_apply_second_", "")
      .split("_");
    await applyDoubleImprovement(ctx, character, firstStat, secondStat);
  }
}

// Показать меню выбора одной характеристики для +2
async function showSingleImproveMenu(ctx, character) {
  let message = `⚡ **Выберите характеристику для улучшения на +2**\n\n`;
  const keyboard = [];

  for (const [stat, info] of Object.entries(config.STATS)) {
    const value = character[stat];
    const canImprove = value <= config.MAX_ABILITY_SCORE - 2;

    if (canImprove) {
      keyboard.push([
        {
          text: `${info.emoji} ${info.name} (${value} → ${value + 2})`,
          callback_data: `improve_apply_single_${stat}`,
        },
      ]);
    }
  }

  keyboard.push([{ text: "❌ Назад", callback_data: "improve_cancel" }]);

  await ctx.editMessageText(message, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

// Показать меню выбора характеристик для +1
async function showDoubleImproveMenu(ctx, character, step, firstStat = null) {
  let message;
  const keyboard = [];

  if (step === "first") {
    message = `📊 **Выберите первую характеристику для улучшения на +1**\n\n`;

    for (const [stat, info] of Object.entries(config.STATS)) {
      const value = character[stat];
      const canImprove = value < config.MAX_ABILITY_SCORE;

      if (canImprove) {
        keyboard.push([
          {
            text: `${info.emoji} ${info.name} (${value} → ${value + 1})`,
            callback_data: `improve_apply_first_${stat}`,
          },
        ]);
      }
    }
  } else {
    const firstInfo = config.STATS[firstStat];
    message = `📊 **Выберите вторую характеристику для улучшения на +1**\n\n`;
    message += `Первая: ${firstInfo.emoji} ${firstInfo.name} +1\n\n`;

    for (const [stat, info] of Object.entries(config.STATS)) {
      if (stat === firstStat) continue; // Нельзя выбрать ту же характеристику

      const value = character[stat];
      const canImprove = value < config.MAX_ABILITY_SCORE;

      if (canImprove) {
        keyboard.push([
          {
            text: `${info.emoji} ${info.name} (${value} → ${value + 1})`,
            callback_data: `improve_apply_second_${firstStat}_${stat}`,
          },
        ]);
      }
    }
  }

  keyboard.push([{ text: "❌ Назад", callback_data: "improve_cancel" }]);

  await ctx.editMessageText(message, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

// Применить улучшение одной характеристики
async function applyImprovement(ctx, character, stat, amount) {
  try {
    const result = await character.improveAbility(stat, amount);
    const statInfo = config.STATS[stat];

    let message = `✅ **Характеристика улучшена!**\n\n`;
    message += `${statInfo.emoji} ${statInfo.name}: ${result.oldValue} → ${result.newValue}\n`;
    message += `Модификатор: ${
      Character.getStatModifier(result.oldValue) >= 0 ? "+" : ""
    }${Character.getStatModifier(result.oldValue)} → ${
      Character.getStatModifier(result.newValue) >= 0 ? "+" : ""
    }${Character.getStatModifier(result.newValue)}\n`;

    if (result.hpIncrease > 0) {
      message += `\n❤️ Максимальное HP увеличено на ${result.hpIncrease}!`;
    }

    if (character.ability_points > 0) {
      message += `\n\nОсталось очков улучшения: ${character.ability_points}`;
    }

    await ctx.editMessageText(message, { parse_mode: "Markdown" });
  } catch (error) {
    await ctx.answerCbQuery(`❌ ${error.message}`);
  }
}

// Применить улучшение двух характеристик
async function applyDoubleImprovement(ctx, character, firstStat, secondStat) {
  try {
    const result1 = await character.improveAbility(firstStat, 1);
    const result2 = await character.improveAbility(secondStat, 1);

    const stat1Info = config.STATS[firstStat];
    const stat2Info = config.STATS[secondStat];

    let message = `✅ **Характеристики улучшены!**\n\n`;
    message += `${stat1Info.emoji} ${stat1Info.name}: ${result1.oldValue} → ${result1.newValue}\n`;
    message += `${stat2Info.emoji} ${stat2Info.name}: ${result2.oldValue} → ${result2.newValue}\n`;

    const totalHpIncrease = result1.hpIncrease + result2.hpIncrease;
    if (totalHpIncrease > 0) {
      message += `\n❤️ Максимальное HP увеличено на ${totalHpIncrease}!`;
    }

    if (character.ability_points > 0) {
      message += `\n\nОсталось очков улучшения: ${character.ability_points}`;
    }

    await ctx.editMessageText(message, { parse_mode: "Markdown" });
  } catch (error) {
    await ctx.answerCbQuery(`❌ ${error.message}`);
  }
}

// История улучшений
async function handleImprovementHistory(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);

  if (!character) {
    await ctx.reply("❌ У вас нет персонажа!", { parse_mode: "Markdown" });
    return;
  }

  const history = await character.getImprovementHistory();

  if (history.length === 0) {
    await ctx.reply(
      `📜 **История улучшений ${character.name}**\n\n` +
        `Вы еще не улучшали характеристики.\n` +
        `Очки улучшения даются на ${config.ABILITY_IMPROVEMENT_LEVELS.join(
          ", "
        )} уровнях.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  let message = `📜 **История улучшений ${character.name}**\n\n`;

  for (const imp of history) {
    const statInfo = config.STATS[imp.stat_name];
    const date = new Date(imp.improved_at).toLocaleDateString("ru-RU");

    message += `${statInfo.emoji} ${statInfo.name} +${imp.improvement} (ур. ${imp.level}) - ${date}\n`;
  }

  if (character.ability_points > 0) {
    message += `\n💎 Доступно очков: ${character.ability_points}`;
  }

  await ctx.reply(message, { parse_mode: "Markdown" });
}

async function startTradeDialog(ctx, fromCharacter, toCharacterId) {
  const toCharacter = await Character.findById(toCharacterId);
  if (!toCharacter) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  // Получаем инвентарь инициатора обмена
  const fromInventory = await fromCharacter.getInventory();

  let message = `🤝 **Обмен с ${toCharacter.name}**\n\n`;
  message += `💰 Ваше золото: ${fromCharacter.gold}\n`;
  message += `💰 Золото партнера: ${toCharacter.gold}\n\n`;

  message += `**Выберите тип обмена:**`;

  const keyboard = [];

  // Варианты обмена золотом
  if (fromCharacter.gold >= 50) {
    keyboard.push([
      {
        text: "💰 Подарить 50 золота",
        callback_data: `trade_gift_gold_50_${toCharacter.id}`,
      },
    ]);
  }
  if (fromCharacter.gold >= 100) {
    keyboard.push([
      {
        text: "💰 Подарить 100 золота",
        callback_data: `trade_gift_gold_100_${toCharacter.id}`,
      },
    ]);
  }

  // Варианты обмена предметами
  if (fromInventory.length > 0) {
    keyboard.push([
      {
        text: "📦 Выбрать предметы для обмена",
        callback_data: `trade_select_items_${toCharacter.id}`,
      },
    ]);
  }

  keyboard.push([{ text: "❌ Отмена", callback_data: "trade_cancel" }]);

  await ctx.editMessageText(message, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function handleGift(ctx) {
  const text = ctx.message.text;
  const parts = text.split(" ");

  if (parts.length < 3) {
    await ctx.reply(
      `🎁 **Команда для подарков**\n\n` +
        `**Использование:**\n` +
        `/gift @имя сумма\n` +
        `/gift @имя предмет\n\n` +
        `**Примеры:**\n` +
        `• /gift @Ivan 50\n` +
        `• /gift @Maria 100 золота\n` +
        `• /gift @Alex Зелье лечения\n\n` +
        `**Доступные действия:**\n` +
        `• Подарить золото (число)\n` +
        `• Подарить предмет (название)\n`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const giver = await Character.findActive(userId, chatId);
  if (!giver) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

  // Парсим получателя
  const recipientName = parts[1].replace("@", "");

  // Парсим что дарим
  const giftText = parts.slice(2).join(" ");
  const goldAmount = parseInt(giftText);

  if (!isNaN(goldAmount) && goldAmount > 0) {
    // Дарим золото
    if (giver.gold < goldAmount) {
      await ctx.reply(
        `❌ У вас недостаточно золота!\n` +
          `У вас: ${giver.gold} 💰\n` +
          `Нужно: ${goldAmount} 💰`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await ctx.reply(
      `🎁 **Подтверждение подарка**\n\n` +
        `Получатель: @${recipientName}\n` +
        `Подарок: 💰 ${goldAmount} золота\n\n` +
        `⚠️ В текущей версии нужно использовать /trade для выбора получателя из списка.`,
      { parse_mode: "Markdown" }
    );
  } else {
    // Дарим предмет
    const itemName = giftText;

    // Ищем предмет в инвентаре
    const inventory = await giver.getInventory();
    const item = inventory.find((i) =>
      i.name.toLowerCase().includes(itemName.toLowerCase())
    );

    if (!item) {
      await ctx.reply(
        `❌ Предмет "${itemName}" не найден в инвентаре!\n\n` +
          `Используйте /inventory для просмотра доступных предметов.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await ctx.reply(
      `🎁 **Подтверждение подарка**\n\n` +
        `Получатель: @${recipientName}\n` +
        `Подарок: ${item.name}\n\n` +
        `⚠️ Обмен предметами в разработке. Пока можно дарить только золото через /trade.`,
      { parse_mode: "Markdown" }
    );
  }
}

async function showItemSelectionForTrade(
  ctx,
  fromCharacter,
  toCharacterId,
  selectedItems = []
) {
  const inventory = await fromCharacter.getInventory();
  const session = getTradeSession(ctx.from.id, ctx.chat.id);

  let message = `📦 **Выберите что предложить:**\n\n`;

  // Показываем выбранное
  if (selectedItems.length > 0 || session.selectedGold > 0) {
    message += `**Выбрано:**\n`;

    if (session.selectedGold > 0) {
      message += `• 💰 ${session.selectedGold} золота\n`;
    }

    for (const itemId of selectedItems) {
      const item = inventory.find((i) => i.id === itemId);
      if (item) {
        message += `• ${item.name}\n`;
      }
    }
    message += `\n`;
  }

  message += `💰 Ваше золото: ${fromCharacter.gold}\n`;

  if (inventory.length > 0) {
    message += `\n**Доступные предметы:**`;
  }

  const keyboard = [];

  // Предметы
  for (const item of inventory) {
    if (!selectedItems.includes(item.id)) {
      keyboard.push([
        {
          text: `➕ ${item.name} (x${item.quantity})`,
          callback_data: `trade_add_item_${item.id}_${toCharacterId}`,
        },
      ]);
    }
  }

  // Золото
  if (!session.selectedGold && fromCharacter.gold > 0) {
    keyboard.push([
      {
        text: "💰 Добавить золото",
        callback_data: `trade_add_gold_${toCharacterId}`,
      },
    ]);
  }

  // Управление
  if (selectedItems.length > 0 || session.selectedGold > 0) {
    keyboard.push([
      {
        text: "✅ Создать предложение",
        callback_data: `trade_confirm_giving_${toCharacterId}`,
      },
      { text: "🔄 Сбросить", callback_data: `trade_reset_${toCharacterId}` },
    ]);
  }

  keyboard.push([{ text: "❌ Отмена", callback_data: "trade_cancel" }]);

  await ctx.editMessageText(message, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

// Создать простое предложение обмена
async function createSimpleTradeOffer(ctx, fromCharacter, toCharacter) {
  // Для демонстрации создаем простой обмен золота
  const offer = {
    giving: { items: [], gold: 100 },
    requesting: { items: [], gold: 0 },
  };

  // Проверяем, есть ли у инициатора 100 золота
  if (fromCharacter.gold < 100) {
    await ctx.reply(
      "❌ У вас недостаточно золота для примера обмена (нужно 100)!"
    );
    return;
  }

  const result = await tradeSystem.createTradeOffer(
    fromCharacter,
    toCharacter,
    offer
  );

  if (!result.success) {
    await ctx.reply(`❌ ${result.message}`);
    return;
  }

  const tradeMessage = tradeSystem.formatTradeOffer(result.trade);

  // Отправляем уведомление получателю
  try {
    await ctx.telegram.sendMessage(
      toCharacter.chat_id,
      `${tradeMessage}\n\n` +
        `От игрока ${fromCharacter.name}\n` +
        `Используйте /trades для просмотра`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Принять",
                callback_data: `trade_accept_${result.tradeId}`,
              },
              {
                text: "❌ Отклонить",
                callback_data: `trade_decline_${result.tradeId}`,
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    log(`Ошибка отправки уведомления об обмене: ${error.message}`, "error");
  }

  await ctx.reply(
    `✅ Предложение обмена отправлено!\n\n` +
      `Вы предлагаете: 💰 100 золота\n` +
      `Взамен на: _ничего_ (подарок)\n\n` +
      `Ожидайте ответа от ${toCharacter.name}`,
    { parse_mode: "Markdown" }
  );
}

async function handleGetQuest(ctx) {
  const chatId = ctx.chat.id;

  // Проверяем, есть ли ЖИВЫЕ персонажи в чате
  const characters = await db.all(
    "SELECT COUNT(*) as count FROM characters WHERE chat_id = ? AND is_active = 1 AND hp_current > 0",
    [chatId]
  );

  if (characters[0].count === 0) {
    await ctx.reply(
      "❌ В этом чате нет живых персонажей!\n\n" +
        "Все герои пали в битвах. 😢\n\n" +
        "Создайте нового персонажа командой /create",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Проверяем возможность получения квеста
  const canReceive = await questSystem.canReceiveQuest(chatId);

  if (!canReceive.can) {
    await ctx.reply(`❌ Невозможно получить квест!\n\n${canReceive.reason}`, {
      parse_mode: "Markdown",
    });
    return;
  }

  // Пытаемся назначить квест
  const quest = await questSystem.assignQuest(chatId);

  if (!quest) {
    await ctx.reply("❌ Не удалось назначить квест. Попробуйте позже.", {
      parse_mode: "Markdown",
    });
    return;
  }

  // Отправляем информацию о квесте
  const config = require("../config/config");
  const statConfig = config.STATS[quest.stat_check];
  const difficultyEmoji = {
    easy: "🟢",
    medium: "🟡",
    hard: "🔴",
    epic: "🟣",
    legendary: "⭐",
  };

  const message = `
🎯 **НОВЫЙ КВЕСТ ПОЛУЧЕН!**

${difficultyEmoji[quest.difficulty] || "❓"} **${quest.title}**
${quest.description}

📊 **Проверка:** ${statConfig.emoji} ${statConfig.name}
⏰ **Время на выполнение:** 4 часа
💰 **Базовая награда:** ${quest.xp_reward} XP, ${quest.gold_reward} золота

Используйте /quest чтобы попытаться выполнить!
`;

  await ctx.reply(message, { parse_mode: "Markdown" });

  log(`Квест "${quest.title}" выдан вручную для чата ${chatId}`);
}



// Показать инвентарь
async function handleShowInventory(ctx) {
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

  const inventory = await character.getInventory();

  // ОТЛАДКА: выводим структуру первого предмета
  if (inventory.length > 0) {
    log(`[DEBUG] Первый предмет в инвентаре:`, inventory[0]);
  }

  if (inventory.length === 0) {
    await ctx.reply(
      `🎒 **Инвентарь ${character.name}**\n\n` +
        `Инвентарь пуст\n\n` +
        `💰 Золото: ${character.gold}`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  let inventoryText = `🎒 **Инвентарь ${character.name}**\n\n`;

  // Группируем по типу
  const byType = {};
  for (const item of inventory) {
    if (!byType[item.type]) byType[item.type] = [];
    byType[item.type].push(item);
  }

  const typeNames = {
    weapon: "⚔️ Оружие",
    armor: "🛡️ Броня",
    consumable: "🧪 Расходники",
    misc: "📦 Разное",
    artifact: "💎 Артефакты",
  };

  const rarityEmojis = {
    common: "⚪",
    uncommon: "🟢",
    rare: "🔵",
    epic: "🟣",
    legendary: "🟠",
  };

  let itemIndex = 1;
  const itemButtons = [];

  for (const [type, items] of Object.entries(byType)) {
    inventoryText += `**${typeNames[type] || type}:**\n`;

    for (const item of items) {
      const emoji = rarityEmojis[item.rarity] || "❓";
      inventoryText += `${itemIndex}. ${emoji} ${item.name}`;
      if (item.quantity > 1) inventoryText += ` x${item.quantity}`;
      if (item.equipped) inventoryText += " 📌";
      inventoryText += "\n";

      // Добавляем кнопки для расходников
      if (type === "consumable" && !character.isDead()) {
        // Сохраняем данные о предмете для кнопки
        itemButtons.push({
          text: `${itemIndex}. ${item.name}`, // Упрощаем текст кнопки
          callback_data: `use_${item.id}`, // item.id - это ID из таблицы items
        });
      }

      itemIndex++;
    }
    inventoryText += "\n";
  }

  inventoryText += `💰 **Золото:** ${character.gold}`;

  const keyboard = [];

  // Добавляем кнопки использования предметов
  if (itemButtons.length > 0) {
    for (let i = 0; i < itemButtons.length; i += 2) {
      const row = [itemButtons[i]];
      if (itemButtons[i + 1]) {
        row.push(itemButtons[i + 1]);
      }
      keyboard.push(row);
    }
  }

  log(`[DEBUG] Всего кнопок создано: ${itemButtons.length}`);

  await ctx.reply(inventoryText, {
    parse_mode: "Markdown",
    reply_markup:
      keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
  });
}

async function handleUnequipItemCallback(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const itemId = parseInt(ctx.callbackQuery.data.replace("unequip_item_", ""));

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  try {
    const result = await equipmentSystem.unequipItem(character.id, itemId);
    await ctx.answerCbQuery("✅ Предмет снят!");

    await ctx.editMessageText(
      `✅ ${result.itemName} снят со слота: ${result.slot}`,
      {
        parse_mode: "Markdown",
      }
    );

    // Показываем обновленную экипировку
    setTimeout(() => handleEquipment(ctx), 1000);
  } catch (error) {
    await ctx.answerCbQuery(`❌ ${error.message}`);
  }
}

// Callback для продажи у торговца
async function handleMerchantSellCallback(ctx) {
  const merchantId = parseInt(
    ctx.callbackQuery.data.replace("merchant_sell_", "")
  );
  const character = await Character.findActive(ctx.from.id, ctx.chat.id);

  if (!character) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  try {
    const inventory = await character.getInventory();

    if (inventory.length === 0) {
      await ctx.answerCbQuery("❌ У вас нет предметов для продажи!");
      return;
    }

    let message = `💰 **Продажа предметов**\n\n`;
    message += `Выберите предмет для продажи:\n\n`;

    const keyboard = [];
    const rarityEmoji = {
      common: "⚪",
      uncommon: "🟢",
      rare: "🔵",
      epic: "🟣",
      legendary: "🟠",
    };

    for (const item of inventory.slice(0, 10)) {
      const emoji = rarityEmoji[item.rarity] || "⚪";
      const sellPrice = Math.floor(item.value_gold * 0.5); // 50% от стоимости

      message += `${emoji} ${item.name} - ${sellPrice} 💰\n`;

      keyboard.push([
        {
          text: `${emoji} ${item.name} (${sellPrice}💰)`,
          callback_data: `sell_item_${merchantId}_${item.id}`,
        },
      ]);
    }

    keyboard.push([
      { text: "◀️ Назад", callback_data: `visit_merchant_${merchantId}` },
    ]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    await ctx.answerCbQuery(`❌ ${error.message}`);
  }
}

// Callback для продажи конкретного предмета
async function handleSellItemCallback(ctx) {
  const parts = ctx.callbackQuery.data.split("_");
  const merchantId = parseInt(parts[2]);
  const itemId = parseInt(parts[3]);

  const character = await Character.findActive(ctx.from.id, ctx.chat.id);
  if (!character) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  try {
    const result = await advancedMerchantSystem.sellItem(
      character.id,
      merchantId,
      itemId
    );

    await ctx.answerCbQuery(`✅ ${result.comment}`);

    let message = `✅ **Предмет продан!**\n\n`;
    message += `Продано: ${result.item}\n`;
    message += `Получено: ${result.price} 💰\n\n`;
    message += `Золото: ${character.gold} → ${
      character.gold + result.price
    } 💰`;

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💰 Продать еще",
              callback_data: `merchant_sell_${merchantId}`,
            },
            { text: "🏪 К торговцам", callback_data: "shop_main" },
          ],
        ],
      },
    });
  } catch (error) {
    await ctx.answerCbQuery(`❌ ${error.message}`);
  }
}

// Функция для обработки информации о предмете
async function handleItemInfo(ctx) {
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

async function handleGive(ctx) {
  const text = ctx.message.text;
  const parts = text.split(" ");

  if (parts.length < 3) {
    await ctx.reply(
      `❌ **Использование:**\n` +
        `/give @username количество предмет\n` +
        `/give @username золото количество\n\n` +
        `**Примеры:**\n` +
        `/give @friend 1 Зелье лечения\n` +
        `/give @friend золото 100`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const giver = await Character.findActive(userId, chatId);
  if (!giver) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

  // Получаем получателя
  const targetUsername = parts[1].replace("@", "");
  // В реальном боте здесь нужно получить ID пользователя по username
  // Для примера используем упрощенную логику

  await ctx.reply(
    `⚠️ Функция передачи предметов в разработке.\n` +
      `Используйте /trade для безопасного обмена.`,
    { parse_mode: "Markdown" }
  );
}

// Команда создания предложения обмена
async function handleTrade(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

  // В группе показываем список активных персонажей
  if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
    // Исправленный запрос с правильными именами колонок
    const activeCharacters = await db.all(
      `
      SELECT c.*, u.telegram_username as username, u.first_name 
      FROM characters c
      JOIN users u ON c.user_id = u.id
      WHERE c.chat_id = ? AND c.is_active = 1 AND c.user_id != ?
      ORDER BY c.level DESC
      LIMIT 10
      `,
      [chatId, character.user_id]
    );

    if (activeCharacters.length === 0) {
      await ctx.reply(
        "❌ В этом чате нет других активных персонажей для обмена!"
      );
      return;
    }

    let message = "🤝 **Выберите персонажа для обмена:**\n\n";
    const keyboard = [];

    for (const char of activeCharacters) {
      const name = char.username || char.first_name || "Игрок";
      message += `${char.name} (${name}) - ${char.level} ур.\n`;

      keyboard.push([
        {
          text: `📦 Обмен с ${char.name}`,
          callback_data: `trade_start_${char.id}`,
        },
      ]);
    }

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  } else {
    await ctx.reply(
      "❌ Обмен доступен только в групповых чатах!\n\n" +
        "Добавьте бота в группу для торговли с другими игроками.",
      { parse_mode: "Markdown" }
    );
  }
}

// Показать активные предложения обмена
async function handleActiveTrades(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

  const trades = tradeSystem.getActiveTradesForCharacter(character.id);

  if (trades.length === 0) {
    await ctx.reply("📦 У вас нет активных предложений обмена.");
    return;
  }

  for (const trade of trades) {
    const message = tradeSystem.formatTradeOffer(trade);
    const keyboard = [];

    if (trade.to.character.id === character.id) {
      // Входящее предложение
      keyboard.push([
        { text: "✅ Принять", callback_data: `trade_accept_${trade.id}` },
        { text: "❌ Отклонить", callback_data: `trade_decline_${trade.id}` },
      ]);
    } else {
      // Исходящее предложение
      keyboard.push([
        { text: "❌ Отменить", callback_data: `trade_cancel_${trade.id}` },
      ]);
    }

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }
}

// Создать сундук с лутом
async function handleCreateChest(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

  // Проверяем права (только для админов или в специальных условиях)
  if (ctx.chat.type === "private") {
    await ctx.reply("❌ Сундуки можно создавать только в групповых чатах!");
    return;
  }

  // Создаем случайный сундук
  const difficulties = ["easy", "medium", "hard"];
  const difficulty =
    difficulties[Math.floor(Math.random() * difficulties.length)];

  const chest = await lootSystem.createLootChest(
    chatId,
    difficulty,
    character.id
  );

  const difficultyNames = {
    easy: "🟢 Простой",
    medium: "🟡 Обычный",
    hard: "🔴 Редкий",
  };

  await ctx.reply(
    `📦 **Появился сундук с сокровищами!**\n\n` +
      `${difficultyNames[difficulty]} сундук\n` +
      `💰 Внутри что-то ценное...\n\n` +
      `Первый, кто откроет, получит все сокровища!`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔓 Открыть сундук!",
              callback_data: `chest_open_${chest.id}`,
            },
          ],
        ],
      },
    }
  );
}

function getTradeSession(userId, chatId) {
  const key = `${userId}_${chatId}`;
  if (!tradeSessions.has(key)) {
    tradeSessions.set(key, {
      selectedItems: [],
      selectedGold: 0,
      requestedItems: [],
      requestedGold: 0,
      tradeTargetId: null,
      createdAt: Date.now(),
    });
  }
  return tradeSessions.get(key);
}

function clearTradeSession(userId, chatId) {
  const key = `${userId}_${chatId}`;
  tradeSessions.delete(key);
}

async function handleBuy(ctx) {
  await ctx.reply(
    "🛒 Для покупки предметов используйте /shop\n\n" +
      "Там вы найдете всех торговцев с их товарами.",
    { parse_mode: "Markdown" }
  );
}

async function handleSell(ctx) {
  await ctx.reply(
    "💰 Для продажи предметов используйте /shop\n\n" +
      "Выберите торговца и нажмите кнопку 'Продать'.",
    { parse_mode: "Markdown" }
  );
}

async function handleTradeCallback(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.answerCbQuery("❌ У вас нет персонажа!");
    return;
  }

  const session = getTradeSession(userId, chatId);

  // Начало обмена
  if (data.startsWith("trade_start_")) {
    const targetId = parseInt(data.replace("trade_start_", ""));
    await startTradeDialog(ctx, character, targetId);
  }

  // Подарок золота
  else if (data.startsWith("trade_gift_gold_")) {
    const parts = data.split("_");
    const amount = parseInt(parts[3]);
    const targetId = parseInt(parts[4]);

    // Проверяем наличие золота
    if (character.gold < amount) {
      await ctx.answerCbQuery("❌ Недостаточно золота!");
      return;
    }

    const toCharacter = await Character.findById(targetId);
    if (!toCharacter) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    // Создаем простое предложение подарка
    const offer = {
      giving: { items: [], gold: amount },
      requesting: { items: [], gold: 0 },
    };

    const result = await tradeSystem.createTradeOffer(
      character,
      toCharacter,
      offer
    );

    if (!result.success) {
      await ctx.editMessageText(`❌ ${result.message}`, {
        parse_mode: "Markdown",
      });
      return;
    }

    await ctx.editMessageText(
      `✅ **Подарок отправлен!**\n\n` +
        `Вы подарили ${toCharacter.name}: 💰 ${amount} золота\n\n` +
        `Ожидайте подтверждения.`,
      { parse_mode: "Markdown" }
    );

    // Отправляем уведомление
    try {
      await ctx.telegram.sendMessage(
        toCharacter.chat_id,
        `🎁 **Подарок от ${character.name}!**\n\n` +
          `Вам предлагают: 💰 ${amount} золота`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Принять",
                  callback_data: `trade_accept_${result.tradeId}`,
                },
                {
                  text: "❌ Отклонить",
                  callback_data: `trade_decline_${result.tradeId}`,
                },
              ],
            ],
          },
        }
      );
    } catch (error) {
      log(`Ошибка отправки уведомления: ${error.message}`, "error");
    }
  }

  // Выбор предметов для обмена
  else if (data.startsWith("trade_select_items_")) {
    const targetId = parseInt(data.replace("trade_select_items_", ""));
    session.tradeTargetId = targetId;
    await showItemSelectionForTrade(
      ctx,
      character,
      targetId,
      session.selectedItems
    );
  }

  // Добавление предмета
  else if (data.startsWith("trade_add_item_")) {
    const parts = data.split("_");
    const itemId = parseInt(parts[3]);
    const targetId = parseInt(parts[4]);

    session.selectedItems.push(itemId);

    await ctx.answerCbQuery("✅ Предмет добавлен");
    await showItemSelectionForTrade(
      ctx,
      character,
      targetId,
      session.selectedItems
    );
  }

  // Добавление золота
  else if (data.startsWith("trade_add_gold_")) {
    const targetId = parseInt(data.replace("trade_add_gold_", ""));

    // Простой вариант - фиксированные суммы
    let message = `💰 **Сколько золота добавить?**\n\n`;
    message += `У вас: ${character.gold} золота\n\n`;

    const keyboard = [];
    const amounts = [50, 100, 200, 500];

    for (const amount of amounts) {
      if (character.gold >= amount) {
        keyboard.push([
          {
            text: `💰 ${amount}`,
            callback_data: `trade_set_gold_${amount}_${targetId}`,
          },
        ]);
      }
    }

    keyboard.push([
      { text: "❌ Назад", callback_data: `trade_select_items_${targetId}` },
    ]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  // Установка золота
  else if (data.startsWith("trade_set_gold_")) {
    const parts = data.split("_");
    const amount = parseInt(parts[3]);
    const targetId = parseInt(parts[4]);

    session.selectedGold = amount;

    await ctx.answerCbQuery(`✅ Добавлено ${amount} золота`);
    await showItemSelectionForTrade(
      ctx,
      character,
      targetId,
      session.selectedItems
    );
  }

  // Сброс выбора
  else if (data.startsWith("trade_reset_")) {
    const targetId = parseInt(data.replace("trade_reset_", ""));
    session.selectedItems = [];
    session.selectedGold = 0;

    await ctx.answerCbQuery("🔄 Выбор сброшен");
    await showItemSelectionForTrade(ctx, character, targetId, []);
  }

  // Подтверждение и создание обмена
  else if (data.startsWith("trade_confirm_giving_")) {
    const targetId = parseInt(data.replace("trade_confirm_giving_", ""));

    const toCharacter = await Character.findById(targetId);
    if (!toCharacter) {
      await ctx.answerCbQuery("❌ Персонаж не найден!");
      return;
    }

    // Для простоты создаем обмен как подарок
    const offer = {
      giving: {
        items: session.selectedItems,
        gold: session.selectedGold,
      },
      requesting: {
        items: [],
        gold: 0,
      },
    };

    const result = await tradeSystem.createTradeOffer(
      character,
      toCharacter,
      offer
    );

    if (!result.success) {
      await ctx.editMessageText(`❌ ${result.message}`, {
        parse_mode: "Markdown",
      });
      return;
    }

    // Формируем сообщение
    let message = `✅ **Предложение создано!**\n\n`;
    message += `Кому: ${toCharacter.name}\n\n`;
    message += `**Вы предлагаете:**\n`;

    if (session.selectedGold > 0) {
      message += `• 💰 ${session.selectedGold} золота\n`;
    }

    const inventory = await character.getInventory();
    for (const itemId of session.selectedItems) {
      const item = inventory.find((i) => i.id === itemId);
      if (item) {
        message += `• ${item.name}\n`;
      }
    }

    message += `\nЭто подарок (ничего не просите взамен)`;

    await ctx.editMessageText(message, { parse_mode: "Markdown" });

    // Очищаем сессию
    clearTradeSession(userId, chatId);

    // Отправляем уведомление
    try {
      const tradeMessage = tradeSystem.formatTradeOffer(result.trade);

      await ctx.telegram.sendMessage(
        toCharacter.chat_id,
        `${tradeMessage}\n\nОт: ${character.name}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Принять",
                  callback_data: `trade_accept_${result.tradeId}`,
                },
                {
                  text: "❌ Отклонить",
                  callback_data: `trade_decline_${result.tradeId}`,
                },
              ],
            ],
          },
        }
      );
    } catch (error) {
      log(`Ошибка отправки: ${error.message}`, "error");
    }
  }

  // Отмена
  else if (data === "trade_cancel") {
    clearTradeSession(userId, chatId);
    await ctx.answerCbQuery("Отменено");
    await ctx.deleteMessage();
  }

  // Принятие/отклонение обмена
  else if (data.startsWith("trade_accept_")) {
    const tradeId = data.replace("trade_accept_", "");
    const result = await tradeSystem.acceptTrade(tradeId, character.id);

    await ctx.answerCbQuery(result.message);
    if (result.success) {
      await ctx.editMessageText(
        `✅ **Обмен завершен!**\n\n${tradeSystem.formatTradeOffer(
          result.trade
        )}`,
        { parse_mode: "Markdown" }
      );
    }
  } else if (
    data.startsWith("trade_decline_") ||
    data.startsWith("trade_cancel_")
  ) {
    const tradeId = data.replace(/trade_(decline|cancel)_/, "");
    tradeSystem.cancelTrade(tradeId);
    await ctx.answerCbQuery("Обмен отменен");
    await ctx.deleteMessage();
  }
}

// Обработчик открытия сундука
async function handleChestCallback(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;

  if (data.startsWith("chest_open_")) {
    const chestId = parseInt(data.replace("chest_open_", ""));

    const character = await Character.findActive(userId, chatId);
    if (!character) {
      await ctx.answerCbQuery("❌ У вас нет персонажа!");
      return;
    }

    const result = await lootSystem.openChest(chestId, character.id);

    if (!result.success) {
      await ctx.answerCbQuery(result.message);
      return;
    }

    await ctx.answerCbQuery("🎉 Сундук открыт!");

    let message = `🎉 **${character.name} открыл сундук!**\n\n`;
    message += `**Получено:**\n`;

    if (result.loot.gold > 0) {
      message += `💰 ${result.loot.gold} золота\n`;
    }

    const rarityEmojis = {
      common: "⚪",
      uncommon: "🟢",
      rare: "🔵",
      epic: "🟣",
      legendary: "🟠",
    };

    for (const item of result.loot.items) {
      const emoji = rarityEmojis[item.rarity] || "❓";
      message += `${emoji} ${item.name}\n`;
    }

    await ctx.editMessageText(message, { parse_mode: "Markdown" });
  }
}

// Использование предмета
async function handleUseItem(ctx) {
  // Команда для использования предмета по названию
  const text = ctx.message.text;
  const itemName = text.replace("/use ", "").trim();

  if (!itemName) {
    await ctx.reply(
      "❌ Укажите название предмета!\n" +
        "Пример: /use Зелье лечения\n\n" +
        "Для просмотра доступных предметов используйте /inventory",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

  // Проверяем, не мертв ли персонаж
  if (character.hp_current <= 0) {
    await ctx.reply("☠️ Мертвые не могут использовать предметы!", {
      parse_mode: "Markdown",
    });
    return;
  }

  // Ищем предмет в инвентаре по названию
  const item = await db.get(
    `
    SELECT i.*, inv.id as inventory_id, inv.quantity 
    FROM inventory inv
    JOIN items i ON inv.item_id = i.id
    WHERE inv.character_id = ? 
      AND LOWER(i.name) = LOWER(?)
      AND i.type = 'consumable'
  `,
    [character.id, itemName]
  );

  if (!item) {
    // Пробуем поиск по частичному совпадению
    const partialMatch = await db.get(
      `
      SELECT i.*, inv.id as inventory_id, inv.quantity 
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE inv.character_id = ? 
        AND LOWER(i.name) LIKE LOWER(?)
        AND i.type = 'consumable'
      LIMIT 1
    `,
      [character.id, `%${itemName}%`]
    );

    if (!partialMatch) {
      await ctx.reply(
        `❌ Предмет "${itemName}" не найден или не может быть использован!\n\n` +
          `Используйте /inventory для просмотра доступных расходников.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Если нашли частичное совпадение, используем его
    item = partialMatch;
  }

  // Применяем эффекты предмета
  const effects = JSON.parse(item.effects || "{}");
  let message = `🧪 **Использован ${item.name}**\n`;
  message += `_${item.description}_\n\n`;

  let actuallyUsed = false;

  // Применяем лечение
  if (effects.hp && effects.hp > 0) {
    const hpBefore = character.hp_current;
    await character.modifyHP(effects.hp);
    const hpAfter = character.hp_current;
    const actualHealed = hpAfter - hpBefore;

    if (actualHealed > 0) {
      message += `❤️ Восстановлено ${actualHealed} HP (${hpBefore} → ${hpAfter}/${character.hp_max})\n`;
      actuallyUsed = true;
    } else {
      message += `❤️ HP уже максимальное (${character.hp_max}/${character.hp_max})\n`;
    }
  }

  // Применяем другие эффекты (для будущих расширений)
  if (effects.mp) {
    message += `💙 Восстановлено ${effects.mp} MP\n`;
    actuallyUsed = true;
  }

  if (effects.invisibility) {
    message += `👻 Вы невидимы на ${effects.invisibility} минут\n`;
    actuallyUsed = true;
  }

  if (effects.teleport) {
    message += `✨ Телепортация в безопасное место активирована!\n`;
    actuallyUsed = true;
  }

  // Проверяем, был ли предмет полезен
  if (!actuallyUsed && effects.hp) {
    await ctx.reply(
      `⚠️ **${item.name}** сейчас не нужен!\n\n` +
        `Ваше HP уже максимальное: ${character.hp_current}/${character.hp_max}`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Уменьшаем количество предмета
  await db.run("UPDATE inventory SET quantity = quantity - 1 WHERE id = ?", [
    item.inventory_id,
  ]);

  // Удаляем из инвентаря если закончился
  await db.run("DELETE FROM inventory WHERE id = ? AND quantity <= 0", [
    item.inventory_id,
  ]);

  // Добавляем информацию об оставшемся количестве
  if (item.quantity > 1) {
    message += `\n📦 Осталось: ${item.quantity - 1} шт.`;
  } else {
    message += `\n📦 Это был последний предмет!`;
  }

  await ctx.reply(message, { parse_mode: "Markdown" });

  // Логируем использование
  log(`${character.name} использовал ${item.name}`);
}

// Callback для экипировки предмета
async function handleEquipItemCallback(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const itemId = parseInt(ctx.callbackQuery.data.replace("equip_item_", ""));

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  try {
    const result = await equipmentSystem.equipItem(character.id, itemId);
    await ctx.answerCbQuery("✅ Предмет экипирован!");

    // Обновляем сообщение
    await ctx.editMessageText(`✅ Предмет экипирован в слот: ${result.slot}`, {
      parse_mode: "Markdown",
    });

    // Показываем обновленную экипировку
    setTimeout(() => handleEquipment(ctx), 1000);
  } catch (error) {
    await ctx.answerCbQuery(`❌ ${error.message}`);
  }
}

// Callback для посещения торговца
async function handleVisitMerchantCallback(ctx) {
  const merchantId = parseInt(
    ctx.callbackQuery.data.replace("visit_merchant_", "")
  );
  const character = await Character.findActive(ctx.from.id, ctx.chat.id);

  if (!character) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  // Получаем приветствие
  const greeting = await advancedMerchantSystem.getMerchantGreeting(
    character.id,
    merchantId
  );
  const merchant = advancedMerchantSystem.merchants[merchantId];

  // Получаем репутацию
  const rep = await advancedMerchantSystem.getReputation(
    character.id,
    merchantId
  );
  const mood = advancedMerchantSystem.getMerchantMood(rep.reputation);

  let message = `**${merchant.name}** ${mood.emoji}\n`;
  message += `_${greeting}_\n\n`;
  message += `💰 Ваше золото: ${character.gold}\n`;
  message += `🤝 Репутация: ${rep.reputation}\n\n`;

  const keyboard = [
    [
      { text: "📦 Купить", callback_data: `merchant_buy_${merchantId}` },
      { text: "💰 Продать", callback_data: `merchant_sell_${merchantId}` },
    ],
  ];

  if (merchant.canCraft) {
    keyboard[0].push({
      text: "🔨 Крафт",
      callback_data: `merchant_craft_${merchantId}`,
    });
  }

  keyboard.push([{ text: "◀️ Назад", callback_data: "shop_main" }]);

  await ctx.editMessageText(message, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

// Callback для покупки у торговца
async function handleMerchantBuyCallback(ctx) {
  const merchantId = parseInt(
    ctx.callbackQuery.data.replace("merchant_buy_", "")
  );
  const character = await Character.findActive(ctx.from.id, ctx.chat.id);

  if (!character) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  try {
    const inventory = await advancedMerchantSystem.getMerchantInventory(
      merchantId,
      character.id
    );

    if (inventory.length === 0) {
      await ctx.answerCbQuery("❌ У торговца нет товаров!");
      return;
    }

    let message = `🛒 **Товары торговца**\n\n`;
    message += `💰 Ваше золото: ${character.gold}\n\n`;

    const keyboard = [];
    const rarityEmoji = {
      common: "⚪",
      uncommon: "🟢",
      rare: "🔵",
      epic: "🟣",
      legendary: "🟠",
    };

    // Показываем первые 10 предметов
    for (let i = 0; i < Math.min(10, inventory.length); i++) {
      const item = inventory[i];
      const emoji = rarityEmoji[item.rarity] || "⚪";

      message += `${emoji} **${item.name}** - ${item.buyPrice} 💰\n`;
      if (item.description) {
        message += `_${item.description}_\n`;
      }
      message += "\n";

      keyboard.push([
        {
          text: `${emoji} ${item.name} (${item.buyPrice}💰)`,
          callback_data: `buy_item_${merchantId}_${item.id}`,
        },
      ]);
    }

    keyboard.push([
      { text: "◀️ Назад", callback_data: `visit_merchant_${merchantId}` },
    ]);

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    await ctx.answerCbQuery(`❌ ${error.message}`);
  }
}

// Callback для покупки конкретного предмета
async function handleBuyItemCallback(ctx) {
  const parts = ctx.callbackQuery.data.split("_");
  const merchantId = parseInt(parts[2]);
  const itemId = parseInt(parts[3]);

  const character = await Character.findActive(ctx.from.id, ctx.chat.id);
  if (!character) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  try {
    const result = await advancedMerchantSystem.buyItem(
      character.id,
      merchantId,
      itemId
    );

    await ctx.answerCbQuery(`✅ ${result.comment}`);

    let message = `✅ **Покупка совершена!**\n\n`;
    message += `Куплено: ${result.item}\n`;
    message += `Потрачено: ${result.price} 💰\n\n`;
    message += `Осталось золота: ${character.gold - result.price} 💰`;

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "◀️ К товарам",
              callback_data: `merchant_buy_${merchantId}`,
            },
            { text: "🏪 К торговцам", callback_data: "shop_main" },
          ],
        ],
      },
    });
  } catch (error) {
    await ctx.answerCbQuery(`❌ ${error.message}`);
  }
}

// Callback для крафта
async function handleCraftItemCallback(ctx) {
  const recipeId = parseInt(ctx.callbackQuery.data.replace("craft_item_", ""));
  const character = await Character.findActive(ctx.from.id, ctx.chat.id);

  if (!character) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  try {
    const result = await craftingSystem.craftItem(character.id, recipeId);

    if (result.success) {
      const rarityEmoji =
        {
          common: "⚪",
          uncommon: "🟢",
          rare: "🔵",
          epic: "🟣",
          legendary: "🟠",
        }[result.item.rarity] || "⚪";

      await ctx.answerCbQuery(result.message);
      await ctx.editMessageText(
        `${result.message}\n\n` +
          `Получен предмет: ${rarityEmoji} **${result.item.name}**\n` +
          `_${result.item.description}_`,
        { parse_mode: "Markdown" }
      );
    } else {
      await ctx.answerCbQuery(result.message);
    }
  } catch (error) {
    await ctx.answerCbQuery(`❌ ${error.message}`);
  }
}

async function handleRecipes(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.reply("❌ У вас нет персонажа!");
    return;
  }

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
}

// Callback для просмотра рецепта
async function handleCraftViewCallback(ctx) {
  const recipeId = parseInt(ctx.callbackQuery.data.replace("craft_view_", ""));
  const character = await Character.findActive(ctx.from.id, ctx.chat.id);

  if (!character) {
    await ctx.answerCbQuery("❌ Персонаж не найден!");
    return;
  }

  const recipe = await db.get("SELECT * FROM crafting_recipes WHERE id = ?", [
    recipeId,
  ]);
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
    const check = await craftingSystem.checkInventory(
      character.id,
      mat.name,
      mat.quantity
    );
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

// Обработчик использования предмета через callback
async function handleUseItemCallback(ctx) {
  const data = ctx.callbackQuery.data;
  const itemId = data.replace("use_", ""); // Получаем ID предмета

  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.answerCbQuery("❌ У вас нет персонажа!");
    return;
  }

  // Проверяем, не мертв ли персонаж
  if (character.hp_current <= 0) {
    await ctx.answerCbQuery("☠️ Мертвые не могут использовать предметы!");
    return;
  }

  // Получаем предмет из инвентаря
  const item = await db.get(
    `
    SELECT i.*, inv.id as inventory_id, inv.quantity 
    FROM inventory inv
    JOIN items i ON inv.item_id = i.id
    WHERE inv.character_id = ? AND inv.item_id = ?
  `,
    [character.id, itemId]
  );

  if (!item || item.type !== "consumable") {
    await ctx.answerCbQuery(
      "❌ Предмет не найден или не может быть использован!"
    );
    return;
  }

  // Применяем эффекты
  const effects = JSON.parse(item.effects || "{}");
  let message = `🧪 **Использован ${item.name}**\n`;
  message += `_${item.description}_\n\n`;

  let actuallyUsed = false;

  // Применяем лечение
  if (effects.hp && effects.hp > 0) {
    const hpBefore = character.hp_current;
    await character.modifyHP(effects.hp);
    const hpAfter = character.hp_current;
    const actualHealed = hpAfter - hpBefore;

    if (actualHealed > 0) {
      message += `❤️ Восстановлено ${actualHealed} HP (${hpBefore} → ${hpAfter}/${character.hp_max})\n`;
      actuallyUsed = true;
    } else {
      await ctx.answerCbQuery("⚠️ HP уже максимальное!");
      return;
    }
  }

  // Применяем другие эффекты
  if (effects.mp) {
    message += `💙 Восстановлено ${effects.mp} MP\n`;
    actuallyUsed = true;
  }

  if (effects.invisibility) {
    message += `👻 Вы невидимы на ${effects.invisibility} минут\n`;
    actuallyUsed = true;
  }

  if (effects.teleport) {
    message += `✨ Телепортация в безопасное место активирована!\n`;
    actuallyUsed = true;
  }

  // Если предмет не был полезен, не тратим его
  if (!actuallyUsed) {
    await ctx.answerCbQuery("⚠️ Этот предмет сейчас не нужен!");
    return;
  }

  // Уменьшаем количество
  await db.run("UPDATE inventory SET quantity = quantity - 1 WHERE id = ?", [
    item.inventory_id,
  ]);

  // Удаляем если кончились
  await db.run("DELETE FROM inventory WHERE id = ? AND quantity <= 0", [
    item.inventory_id,
  ]);

  // Добавляем информацию об оставшемся количестве
  if (item.quantity > 1) {
    message += `\n📦 Осталось: ${item.quantity - 1} шт.`;
  } else {
    message += `\n📦 Это был последний предмет!`;
  }

  await ctx.answerCbQuery("✅ Предмет использован!");

  // Отправляем детальное сообщение
  await ctx.reply(message, { parse_mode: "Markdown" });

  // Обновляем сообщение с инвентарем
  try {
    await ctx.deleteMessage();
  } catch (error) {
    // Игнорируем ошибку если сообщение уже удалено
  }

  // Показываем обновленный инвентарь
  await handleShowInventory(ctx);
}

async function handleGraveyard(ctx) {
  const telegramId = ctx.from.id;
  const chatId = ctx.chat.id;

  try {
    // Получаем пользователя из БД
    const user = await db.get("SELECT id FROM users WHERE telegram_id = ?", [
      telegramId,
    ]);

    if (!user) {
      await ctx.reply("❌ Пользователь не найден");
      return;
    }

    // Получаем всех мертвых персонажей
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


  /

// История квестов
async function handleListQuests(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  // Получаем персонажа
  const character = await Character.findActive(userId, chatId);
  if (!character) {
    await ctx.reply(
      "❌ У вас нет персонажа!\n\nИспользуйте /create для создания.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Получаем историю
  const history = await questSystem.getQuestHistory(character.id, 10);

  if (history.length === 0) {
    await ctx.reply(
      `📜 **История квестов ${character.name}**\n\nВы еще не выполнили ни одного квеста!`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const difficultyEmoji = {
    easy: "🟢",
    medium: "🟡",
    hard: "🔴",
    epic: "🟣",
    legendary: "⭐",
  };

  let message = `📜 **История квестов ${character.name}**\n\n`;

  for (const quest of history) {
    const date = new Date(quest.completed_at).toLocaleDateString("ru-RU");
    const successEmoji = quest.success ? "✅" : "❌";

    message += `${successEmoji} ${difficultyEmoji[quest.difficulty]} **${
      quest.title
    }**\n`;
    message += `   Бросок: ${quest.roll_result} | +${quest.xp_gained} XP | +${quest.gold_gained} 💰\n`;
    message += `   ${date}\n\n`;
  }

  await ctx.reply(message, { parse_mode: "Markdown" });
}

async function handleAdmin(ctx) {
  // Здесь можно добавить проверку на админа
  await ctx.reply("🚧 Админ-панель в разработке!");
}

// Отладочная команда
async function handleDebugSessions(ctx) {
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
async function handleTestName(ctx) {
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

// Проверка прав бота
async function handleCheckBot(ctx) {
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

async function handleDebugCharacters(ctx) {
  const telegramId = ctx.from.id;
  const chatId = ctx.chat.id;

  try {
    // Получаем пользователя из БД
    const db = require("../database");
    const user = await db.get("SELECT * FROM users WHERE telegram_id = ?", [
      telegramId,
    ]);

    if (!user) {
      await ctx.reply("❌ Пользователь не найден в БД");
      return;
    }

    // Получаем все персонажи пользователя в этом чате
    const characters = await db.all(
      "SELECT * FROM characters WHERE user_id = ? AND chat_id = ? ORDER BY created_at DESC",
      [user.id, chatId]
    );

    let message = `🔍 **Отладка персонажей**\n\n`;
    message += `Telegram ID: \`${telegramId}\`\n`;
    message += `User DB ID: \`${user.id}\`\n`;
    message += `Chat ID: \`${chatId}\`\n\n`;

    if (characters.length === 0) {
      message += `❌ Персонажей не найдено`;
    } else {
      message += `**Найдено персонажей: ${characters.length}**\n\n`;

      for (const char of characters) {
        message += `**${char.name}**\n`;
        message += `• ID: ${char.id}\n`;
        message += `• Активен: ${char.is_active ? "✅" : "❌"}\n`;
        message += `• Создан: ${new Date(char.created_at).toLocaleString()}\n`;
        message += `• Уровень: ${char.level}\n\n`;
      }
    }

    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    const errorMessage = escapeMarkdown(error.message);
    await ctx.reply(`❌ Ошибка: ${errorMessage}`, { parse_mode: "Markdown" });
  }
}

// Прямой ввод имени через команду


    
module.exports = {
  setupCommands,
};
