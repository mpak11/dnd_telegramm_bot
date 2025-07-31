// D&D Telegram Bot - Версия 2.0
// Чистая архитектура с модульной структурой

require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const config = require("./config/config");
const { setupCommands } = require("./commands");
const { setupMiddleware } = require("./middleware");
const { log } = require("./utils/logger");
const questScheduler = require("./systems/questScheduler");

// Инициализация бота
const bot = new Telegraf(config.BOT_TOKEN);

// Проверка токена
if (!config.BOT_TOKEN) {
  log("❌ КРИТИЧЕСКАЯ ОШИБКА: BOT_TOKEN не найден в файле .env!", "error");
  process.exit(1);
}

// Настройка middleware
setupMiddleware(bot);

// Настройка команд
setupCommands(bot);

// Обработка ошибок
bot.catch((err, ctx) => {
  log(`Ошибка для ${ctx.updateType}: ${err.message}`, "error");
  console.error(err);
});

// Graceful shutdown
async function stopBot(signal) {
  log(`\n📛 Получен сигнал ${signal}, останавливаем бота...`, "warning");

  // Закрываем БД
  try {
    const db = require("./database");
    await db.close();
  } catch (error) {
    log(`Ошибка закрытия БД: ${error.message}`, "error");
  }
  questScheduler.stop();

  await bot.stop(signal);
  log("✅ Бот остановлен", "success");
  process.exit(0);
}

process.once("SIGINT", () => stopBot("SIGINT"));
process.once("SIGTERM", () => stopBot("SIGTERM"));

// Запуск бота
async function startBot() {
  try {
    log("🚀 Запускаем D&D бота...", "info");

    // Инициализация базы данных
    const db = require("./database");
    await db.connect();
    await db.initialize();
    questScheduler.init(bot);

    await bot.launch({
      dropPendingUpdates: true,
    });

    log("🎲 D&D бот успешно запущен!", "success");
    log(`📱 Режим: ${config.NODE_ENV}`, "info");
    log("🛑 Для остановки нажмите Ctrl+C\n", "info");
  } catch (error) {
    log(`❌ КРИТИЧЕСКАЯ ОШИБКА запуска: ${error.message}`, "error");
    console.error(error);
    process.exit(1);
  }
}

// Запускаем бота
startBot();
