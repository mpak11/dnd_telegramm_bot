// systems/questSystem.js
// Система квестов для D&D бота

const db = require("../database");
const config = require("../config/config");
const { log, logQuest } = require("../utils/logger");
const { Character } = require("../database/models");
const lootSystem = require('./lootSystem');

class QuestSystem {
  constructor() {
    this.activeQuests = new Map(); // Кеш активных квестов
  }

  // Получить активный квест для чата
  async getActiveQuest(chatId) {
    // Проверяем кеш
    if (this.activeQuests.has(chatId)) {
      const cached = this.activeQuests.get(chatId);
      if (new Date(cached.expires_at) > new Date()) {
        return cached;
      }
    }

    // Получаем из БД
    const quest = await db.get(
      `
      SELECT 
        aq.*,
        q.title,
        q.description,
        q.difficulty,
        q.stat_check,
        q.xp_reward,
        q.gold_reward,
        q.min_level
      FROM active_quests aq
      JOIN quests q ON aq.quest_id = q.id
      WHERE aq.chat_id = ? 
        AND aq.completed = 0 
        AND aq.expires_at > datetime('now')
      ORDER BY aq.assigned_at DESC
      LIMIT 1
    `,
      [chatId]
    );

    if (quest) {
      this.activeQuests.set(chatId, quest);
    }

    return quest;
  }

  // Назначить новый квест чату
  async assignQuest(chatId) {
    try {
      // Проверяем, есть ли уже активный квест
      let activeQuest = await this.getActiveQuest(chatId);
      if (activeQuest) {
        logQuest(`Чат ${chatId} уже имеет активный квест`);
        return null;
      }

      // Проверяем дневной лимит
      const today = new Date().toISOString().split("T")[0];
      const dailyLimit = await db.get(
        "SELECT * FROM daily_limits WHERE chat_id = ? AND date = ?",
        [chatId, today]
      );

      if (dailyLimit && dailyLimit.quests_given >= 999) {
        logQuest(`Чат ${chatId} достиг дневного лимита квестов`);
        return null;
      }

      // Получаем минимальный уровень персонажей в чате
      const minLevel = await this.getMinCharacterLevel(chatId);

      // Выбираем случайный квест подходящего уровня
      const availableQuests = await db.all(
        `
      SELECT * FROM quests 
      WHERE min_level <= ?
      ORDER BY RANDOM()
      LIMIT 1
    `,
        [minLevel]
      );

      if (availableQuests.length === 0) {
        logQuest("Нет доступных квестов");
        return null;
      }

      const quest = availableQuests[0];

      // Время истечения - через 4 часа
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 4);

      // Создаем активный квест
      await db.run(
        `
      INSERT INTO active_quests (chat_id, quest_id, expires_at)
      VALUES (?, ?, ?)
    `,
        [chatId, quest.id, expiresAt.toISOString()]
      );

      // Обновляем дневной лимит
      if (dailyLimit) {
        await db.run(
          "UPDATE daily_limits SET quests_given = quests_given + 1 WHERE chat_id = ? AND date = ?",
          [chatId, today]
        );
      } else {
        await db.run(
          "INSERT INTO daily_limits (chat_id, date, quests_given) VALUES (?, ?, 1)",
          [chatId, today]
        );
      }

      // Получаем полную информацию о квесте и проверяем наличие активного квеста
      activeQuest = await this.getActiveQuest(chatId);
      if (!activeQuest) {
        logQuest(
          `Ошибка: активный квест не был создан для чата ${chatId}`,
          "error"
        );
        return null;
      }

      logQuest(`Назначен квест "${quest.title}" для чата ${chatId}`);

      return activeQuest;
    } catch (error) {
      log(`Ошибка назначения квеста: ${error.message}`, "error");
      return null;
    }
  }

  // Получить минимальный уровень персонажей в чате
  async getMinCharacterLevel(chatId) {
  const result = await db.get(`
    SELECT MIN(level) as min_level 
    FROM characters 
    WHERE chat_id = ? AND is_active = 1 AND hp_current > 0
  `, [chatId]);

  return result?.min_level || 1;
}

  // Выполнить квест
  async executeQuest(character, rollResult) {
  const chatId = character.chat_id;
  const activeQuest = await this.getActiveQuest(chatId);

  if (!activeQuest) {
    return { success: false, message: 'Нет активного квеста!' };
  }

  // Получаем результат броска
  const questResult = await this.getQuestResult(activeQuest.quest_id, rollResult);
  if (!questResult) {
    return { success: false, message: 'Результат квеста не найден!' };
  }

  // Вычисляем модификатор характеристики
  const statModifier = character.getRollBonus(activeQuest.stat_check);
  const totalRoll = rollResult + statModifier;

  // Вычисляем базовые награды
  const xpGained = Math.floor(activeQuest.xp_reward * questResult.xp_modifier);
  const baseGoldGained = Math.floor(activeQuest.gold_reward * questResult.gold_modifier);

  // Генерируем лут
  let loot = { gold: 0, items: [] };
  let totalGoldGained = baseGoldGained;
  
  // Генерируем лут только при успехе или критическом успехе
  if (questResult.is_success || rollResult === 20) {
    loot = await lootSystem.generateQuestLoot(
      activeQuest.difficulty,
      character.level,
      rollResult
    );
    
    // Добавляем дополнительное золото из лута к базовому
    totalGoldGained = baseGoldGained + loot.gold;
  }

  // Объявляем переменные для результатов
  let levelUp = false;
  let isDead = false;

  // Применяем результаты
  if (xpGained > 0) {
    levelUp = await character.addExperience(xpGained);
    if (levelUp) {
      logQuest(`${character.name} повысил уровень с ${levelUp.from} до ${levelUp.to}!`);
    }
  }

  // Применяем золото (базовое + из лута)
  if (totalGoldGained !== 0) {
    await character.addGold(totalGoldGained);
  }

  // Выдаем предметы из лута
  let awardedItems = [];
  if (loot.items.length > 0) {
    const lootResult = await lootSystem.awardLoot(character.id, { gold: 0, items: loot.items });
    awardedItems = lootResult.items;
  }

  // Применяем урон если есть
  let damageDealt = 0;
  if (questResult.damage) {
    damageDealt = this.rollDice(questResult.damage);
    isDead = await character.modifyHP(-damageDealt);
    
    if (isDead) {
      logQuest(`☠️ ${character.name} погиб во время выполнения квеста "${activeQuest.title}"!`);
    }
  }

  // Сохраняем в историю
  await db.run(`
    INSERT INTO quest_history (
      character_id, quest_id, roll_result, success,
      xp_gained, gold_gained, items_gained, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    character.id,
    activeQuest.quest_id,
    totalRoll,
    questResult.is_success ? 1 : 0,
    xpGained,
    totalGoldGained,
    JSON.stringify(awardedItems)
  ]);

  // Помечаем квест как выполненный
  await db.run(
    'UPDATE active_quests SET completed = 1 WHERE id = ?',
    [activeQuest.id]
  );

  // Очищаем кеш
  this.activeQuests.delete(chatId);

  logQuest(`${character.name} выполнил квест "${activeQuest.title}" с результатом ${totalRoll}`);

  return {
    success: true,
    questTitle: activeQuest.title,
    questResult: questResult,
    rollResult: rollResult,
    statModifier: statModifier,
    totalRoll: totalRoll,
    xpGained: xpGained,
    goldGained: totalGoldGained,
    lootGold: loot.gold,
    lootItems: awardedItems,
    damageDealt: damageDealt,
    levelUp: levelUp,
    isDead: isDead,
    characterHp: character.hp_current,
    characterMaxHp: character.hp_max,
    statUsed: activeQuest.stat_check
  };
}

  // Получить результат квеста по броску
  async getQuestResult(questId, roll) {
    // Сначала проверяем точное совпадение
    let result = await db.get(
      `
      SELECT * FROM quest_results 
      WHERE quest_id = ? AND roll_range = ?
    `,
      [questId, roll.toString()]
    );

    if (result) return result;

    // Проверяем диапазоны
    const allResults = await db.all(
      "SELECT * FROM quest_results WHERE quest_id = ?",
      [questId]
    );

    for (const res of allResults) {
      if (res.roll_range.includes("-")) {
        const [min, max] = res.roll_range.split("-").map(Number);
        if (roll >= min && roll <= max) {
          return res;
        }
      }
    }

    return null;
  }

  // Бросок кубиков (например, "2d6" = 2 кубика по 6 граней)
  rollDice(diceNotation) {
    const match = diceNotation.match(/(\d+)d(\d+)/);
    if (!match) return 0;

    const [_, count, sides] = match;
    let total = 0;

    for (let i = 0; i < parseInt(count); i++) {
      total += Math.floor(Math.random() * parseInt(sides)) + 1;
    }

    return total;
  }

  // Получить историю квестов персонажа
  async getQuestHistory(characterId, limit = 10) {
    return await db.all(
      `
      SELECT 
        qh.*,
        q.title,
        q.description,
        q.difficulty
      FROM quest_history qh
      JOIN quests q ON qh.quest_id = q.id
      WHERE qh.character_id = ?
      ORDER BY qh.completed_at DESC
      LIMIT ?
    `,
      [characterId, limit]
    );
  }

  // Проверить, может ли чат получить новый квест
  async canReceiveQuest(chatId) {
    const now = new Date();
    const hours = now.getHours();

    // Проверяем время (10:00 - 24:00 МСК)
    if (hours < 10 || hours >= 24) {
      return { can: false, reason: "Квесты выдаются с 10:00 до 24:00 МСК" };
    }

    // Проверяем активный квест
    const activeQuest = await this.getActiveQuest(chatId);
    if (activeQuest) {
      const expiresIn = Math.ceil(
        (new Date(activeQuest.expires_at) - now) / 1000 / 60
      );
      return {
        can: false,
        reason: `У вас уже есть активный квест! Истекает через ${expiresIn} мин.`,
      };
    }

    // Проверяем дневной лимит
    const today = now.toISOString().split("T")[0];
    const dailyLimit = await db.get(
      "SELECT * FROM daily_limits WHERE chat_id = ? AND date = ?",
      [chatId, today]
    );

    if (dailyLimit && dailyLimit.quests_given >= 999) {
      return {
        can: false,
        reason: "Достигнут дневной лимит квестов (3 в день)",
      };
    }

    return { can: true };
  }

  // Очистить истекшие квесты
  async cleanupExpiredQuests() {
    const result = await db.run(`
      UPDATE active_quests 
      SET completed = 1 
      WHERE completed = 0 AND expires_at < datetime('now')
    `);

    if (result.changes > 0) {
      logQuest(`Очищено ${result.changes} истекших квестов`);
      // Очищаем кеш
      this.activeQuests.clear();
    }
  }
}

// Экспортируем singleton
module.exports = new QuestSystem();
