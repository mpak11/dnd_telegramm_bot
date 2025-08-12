const { log } = require("../../utils/logger");
const CallbackRouter = require("../core/CallbackRouter");

// Импортируем все handlers
const generalHandler = require("./general/GeneralHandler");
const characterHandler = require("./character/CharacterHandler");
const characterStatsHandler = require("./character/CharacterStatsHandler");
const characterDeleteHandler = require("./character/CharacterDeleteHandler");
const graveyardHandler = require("./character/GraveyardHandler");
const inventoryHandler = require("./inventory/InventoryHandler");

// TODO: добавить остальные handlers

function setupHandlers(bot) {
  log("🔧 Настройка handlers...", "info");

  // Общие команды
  bot.command("start", (ctx) => generalHandler.handleStart(ctx));
  bot.command("help", (ctx) => generalHandler.handleHelp(ctx));
  bot.command("status", (ctx) => generalHandler.handleStatus(ctx));
  bot.command("check_bot", (ctx) => generalHandler.handleCheckBot(ctx));

  // Команды персонажа
  bot.command("create", (ctx) => characterHandler.handleCreateCharacter(ctx));
  bot.command("hero", (ctx) => characterHandler.handleShowCharacter(ctx));
  bot.command("quickcreate", (ctx) => characterHandler.handleQuickCreate(ctx));
  bot.command("setname", (ctx) => characterHandler.handleSetName(ctx));
  bot.command("debug_chars", (ctx) =>
    characterHandler.handleDebugCharacters(ctx)
  );

  // Статистика
  bot.command("stats", (ctx) => characterStatsHandler.handleShowStats(ctx));
  bot.command("improve", (ctx) => characterStatsHandler.handleImprove(ctx));
  bot.command("improvements", (ctx) =>
    characterStatsHandler.handleImprovementHistory(ctx)
  );

  // Удаление и кладбище
  bot.command("delete", (ctx) =>
    characterDeleteHandler.handleDeleteCharacter(ctx)
  );
  bot.command("graveyard", (ctx) => graveyardHandler.handleGraveyard(ctx));
  bot.command("memorial", (ctx) => graveyardHandler.handleMemorial(ctx));
  bot.command("findhero", (ctx) => graveyardHandler.handleFindHero(ctx));

  // Инвентарь
  bot.command("inventory", (ctx) => inventoryHandler.handleShowInventory(ctx));
  bot.command("use", (ctx) => inventoryHandler.handleUseItem(ctx));
  bot.command("give", (ctx) => inventoryHandler.handleGive(ctx));
  bot.command("gift", (ctx) => inventoryHandler.handleGift(ctx));

  // TODO: добавить остальные команды

  // Настройка callback router
  const callbackRouter = new CallbackRouter();

  // Регистрируем callback handlers
  callbackRouter.register("create_character", (ctx) =>
    characterHandler.handleCreateCharacter(ctx)
  );
  callbackRouter.register("show_hero", (ctx) =>
    characterHandler.handleShowCharacter(ctx)
  );
  callbackRouter.register("delete_confirm", (ctx) =>
    characterDeleteHandler.confirmDeleteCharacter(ctx)
  );
  callbackRouter.register("delete_cancel", async (ctx) => {
    await ctx.answerCbQuery("Удаление отменено");
    await ctx.deleteMessage();
  });
  callbackRouter.register("use_", (ctx) =>
    inventoryHandler.handleUseItemCallback(ctx)
  );
  callbackRouter.register("show_inventory", (ctx) =>
    inventoryHandler.handleShowInventory(ctx)
  );

  // TODO: добавить остальные callbacks

  // Устанавливаем общий обработчик callback_query
  bot.on("callback_query", (ctx) => callbackRouter.route(ctx));

  log("✅ Handlers настроены", "success");
}

module.exports = { setupHandlers };
