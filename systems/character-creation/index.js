// Система создания персонажей - главный координатор

const { Character } = require('../../database/models');
const { log } = require('../../utils/logger');

// Импортируем модули
const SessionManager = require('./SessionManager');
const RaceSelector = require('./steps/RaceSelector');
const ClassSelector = require('./steps/ClassSelector');
const NameHandler = require('./steps/NameHandler');
const StatsGenerator = require('./steps/StatsGenerator');
const CharacterBuilder = require('./CharacterBuilder');

class CharacterCreationSystem {
  constructor() {
    // Менеджер сессий
    this.sessionManager = new SessionManager();
    
    // Шаги создания
    this.raceSelector = new RaceSelector(this.sessionManager);
    this.classSelector = new ClassSelector(this.sessionManager);
    this.nameHandler = new NameHandler(this.sessionManager);
    this.statsGenerator = new StatsGenerator(this.sessionManager);
    this.characterBuilder = new CharacterBuilder(this.sessionManager);
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
    this.sessionManager.create(userId, chatId);

    // Показываем выбор расы
    await this.raceSelector.show(ctx);
  }

  // Обработать ввод имени из текста
  async handleNameInput(ctx) {
    return await this.nameHandler.handleTextInput(ctx);
  }

  // Обработать команду /setname
  async handleNameCommand(ctx, name) {
    return await this.nameHandler.handleCommand(ctx, name);
  }

  // Обработка callback запросов
  async handleCallback(ctx) {
    const data = ctx.callbackQuery.data;
    log(`[CharacterCreation] Обработка callback: ${data}`);

    if (data.startsWith("race_")) {
      const race = data.substring(5);
      const success = await this.raceSelector.handleSelection(ctx, race);
      if (success) {
        await this.classSelector.show(ctx);
      }
      return true;
    }

    if (data.startsWith("class_")) {
      const characterClass = data.substring(6);
      const success = await this.classSelector.handleSelection(ctx, characterClass);
      return true;
    }

    if (data.startsWith("stats_")) {
      const decision = data.substring(6);
      
      if (decision === 'accept') {
        await this.statsGenerator.handleDecision(ctx, decision);
        await this.characterBuilder.build(ctx);
      } else {
        await this.statsGenerator.handleDecision(ctx, decision);
      }
      
      return true;
    }

    return false;
  }

  // После ввода имени показать генерацию характеристик
  async showStatsGeneration(ctx, isNewMessage = false) {
    await this.statsGenerator.show(ctx, isNewMessage);
  }

  // Остановить систему (для graceful shutdown)
  stop() {
    this.sessionManager.stop();
  }
}

// Экспортируем singleton
const characterCreationSystem = new CharacterCreationSystem();

// Для обратной совместимости (используется в обработчиках)
characterCreationSystem.creationSessions = characterCreationSystem.sessionManager.sessions;

module.exports = characterCreationSystem;