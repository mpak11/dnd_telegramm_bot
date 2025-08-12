const { log } = require("../../utils/logger");
const CallbackRouter = require("../core/CallbackRouter");

// Импортируем все handlers
const generalHandler = require("./general/GeneralHandler");
const characterHandler = require("./character/CharacterHandler");
const characterStatsHandler = require("./character/CharacterStatsHandler");
const characterDeleteHandler = require("./character/CharacterDeleteHandler");
const graveyardHandler = require("./character/GraveyardHandler");
const inventoryHandler = require("./inventory/InventoryHandler");
const questHandler = require("./quests/QuestHandler");
const tradeHandler = require("./trading/TradeHandler");
const equipmentHandler = require("./equipment/EquipmentHandler");
const shopHandler = require("./shop/ShopHandler");
const craftingHandler = require("./crafting/CraftingHandler");
const lootHandler = require("./loot/LootHandler");
const adminHandler = require("./admin/AdminHandler");
const itemSearchHandler = require("./items/ItemSearchHandler");

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

  //Экипировка
  bot.command("equipment", (ctx) => equipmentHandler.handleEquipment(ctx));
  bot.command("equip", (ctx) => equipmentHandler.handleEquipment(ctx));
  bot.command("eq", (ctx) => equipmentHandler.handleEquipment(ctx));
  bot.command("equip_item", (ctx) => equipmentHandler.handleEquipItem(ctx));
  bot.command("unequip", (ctx) => equipmentHandler.handleUnequipItem(ctx));

  // Квесты
  bot.command("quest", (ctx) => questHandler.handleShowQuest(ctx));
  bot.command("quests", (ctx) => questHandler.handleListQuests(ctx));
  bot.command("getquest", (ctx) => questHandler.handleGetQuest(ctx));

  //Торговля
  bot.command("trade", (ctx) => tradeHandler.handleTrade(ctx));
  bot.command("trades", (ctx) => tradeHandler.handleActiveTrades(ctx));

  //Шоп
  bot.command("shop", (ctx) => shopHandler.handleShop(ctx));
  bot.command("buy", (ctx) => shopHandler.handleBuy(ctx));
  bot.command("sell", (ctx) => shopHandler.handleSell(ctx));

  //Крафт
  bot.command("craft", (ctx) => craftingHandler.handleCraft(ctx));
  bot.command("recipes", (ctx) => craftingHandler.handleRecipes(ctx));

  //Лут
  bot.command("chest", (ctx) => lootHandler.handleCreateChest(ctx));
  bot.command("create_chest", (ctx) =>
    lootHandler.handleCreateSpecialChest(ctx)
  );
  bot.command("chest_history", (ctx) => lootHandler.handleChestHistory(ctx));

  // Команды поиска предметов
  bot.command("itemsearch", (ctx) => itemSearchHandler.handleItemSearch(ctx));
  bot.command("iteminfo", (ctx) => itemSearchHandler.handleItemInfo(ctx));

  // Административные команды
  bot.command("admin", (ctx) => adminHandler.handleAdmin(ctx));
  bot.command("debug_sessions", (ctx) => adminHandler.handleDebugSessions(ctx));
  bot.command("test_name", (ctx) => adminHandler.handleTestName(ctx));

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
  callbackRouter.register("quest_roll", (ctx) =>
    questHandler.handleQuestRoll(ctx)
  );
  callbackRouter.register("trade_", (ctx) =>
    tradeHandler.handleTradeCallback(ctx)
  );
  callbackRouter.register("equip_menu", (ctx) =>
    equipmentHandler.handleEquipMenu(ctx)
  );
  callbackRouter.register("equip_item_", (ctx) =>
    equipmentHandler.handleEquipItemCallback(ctx)
  );
  callbackRouter.register("unequip_item_", (ctx) =>
    equipmentHandler.handleUnequipItemCallback(ctx)
  );
  callbackRouter.register("back_to_equipment", (ctx) =>
    equipmentHandler.handleEquipmentCallback(ctx)
  );
  callbackRouter.register("shop_main", (ctx) => shopHandler.handleShop(ctx));
  callbackRouter.register("visit_merchant_", (ctx) =>
    shopHandler.handleVisitMerchantCallback(ctx)
  );
  callbackRouter.register("merchant_buy_", (ctx) =>
    shopHandler.handleMerchantBuyCallback(ctx)
  );
  callbackRouter.register("merchant_sell_", (ctx) =>
    shopHandler.handleMerchantSellCallback(ctx)
  );
  callbackRouter.register("buy_item_", (ctx) =>
    shopHandler.handleBuyItemCallback(ctx)
  );
  callbackRouter.register("sell_item_", (ctx) =>
    shopHandler.handleSellItemCallback(ctx)
  );
  callbackRouter.register("craft_main", (ctx) =>
    craftingHandler.handleCraft(ctx)
  );
  callbackRouter.register("craft_view_", (ctx) =>
    craftingHandler.handleCraftViewCallback(ctx)
  );
  callbackRouter.register("craft_item_", (ctx) =>
    craftingHandler.handleCraftItemCallback(ctx)
  );
  callbackRouter.register("chest_", (ctx) =>
    lootHandler.handleChestCallback(ctx)
  );
  callbackRouter.register("improve_", (ctx) =>
    characterStatsHandler.handleImprovementCallback(ctx)
  );

  // TODO: добавить остальные callbacks

  // Устанавливаем общий обработчик callback_query
  bot.on("callback_query", (ctx) => callbackRouter.route(ctx));

  log("✅ Handlers настроены", "success");
}

module.exports = { setupHandlers };
