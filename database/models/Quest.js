// Модель квестов

const db = require('../index');
const config = require('../../config/config');

class Quest {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.difficulty = data.difficulty;
    this.stat_check = data.stat_check;
    this.min_level = data.min_level || 1;
    this.xp_reward = data.xp_reward;
    this.gold_reward = data.gold_reward;
    this.possible_items = data.possible_items ? JSON.parse(data.possible_items) : [];
  }

  // Найти квест по ID
  static async findById(id) {
    const data = await db.get('SELECT * FROM quests WHERE id = ?', [id]);
    return data ? new Quest(data) : null;
  }

  // Получить случайный квест
  static async getRandomQuest(character) {
    let query = 'SELECT * FROM quests WHERE min_level <= ?';
    const params = [character.level];

    // Фильтруем по подходящей сложности
    const suitableDifficulties = [];
    for (const [key, diff] of Object.entries(config.QUEST_DIFFICULTY)) {
      if (character.level >= diff.minLevel && character.level <= diff.maxLevel) {
        suitableDifficulties.push(key.toLowerCase());
      }
    }

    if (suitableDifficulties.length > 0) {
      query += ` AND difficulty IN (${suitableDifficulties.map(() => '?').join(',')})`;
      params.push(...suitableDifficulties);
    }

    // Предпочитаем квесты для основной характеристики класса (50% шанс)
    if (Math.random() < 0.5) {
      const classConfig = config.CLASSES[character.class];
      query += ' AND stat_check = ?';
      params.push(classConfig.primaryStat);
    }

    const quests = await db.all(query, params);
    if (quests.length === 0) {
      // Если нет подходящих, берем любой доступный по уровню
      const anyQuest = await db.all('SELECT * FROM quests WHERE min_level <= ?', [character.level]);
      return anyQuest.length > 0 ? new Quest(anyQuest[Math.floor(Math.random() * anyQuest.length)]) : null;
    }

    const randomQuest = quests[Math.floor(Math.random() * quests.length)];
    return new Quest(randomQuest);
  }

  // Получить квесты по сложности
  static async findByDifficulty(difficulty) {
    const quests = await db.all(
      'SELECT * FROM quests WHERE difficulty = ?',
      [difficulty]
    );
    return quests.map(q => new Quest(q));
  }

  // Создать активный квест для чата
  async assignToChat(chatId, hoursToExpire = 24) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hoursToExpire);

    const { id } = await db.run(`
      INSERT INTO active_quests (chat_id, quest_id, expires_at)
      VALUES (?, ?, ?)
    `, [chatId, this.id, expiresAt.toISOString()]);

    return id;
  }

  // Получить активный квест чата
  static async getActiveForChat(chatId) {
    const data = await db.get(`
      SELECT q.*, aq.id as active_quest_id, aq.expires_at
      FROM active_quests aq
      JOIN quests q ON aq.quest_id = q.id
      WHERE aq.chat_id = ? AND aq.completed = 0 AND aq.expires_at > datetime('now')
      ORDER BY aq.assigned_at DESC
      LIMIT 1
    `, [chatId]);

    if (!data) return null;

    const quest = new Quest(data);
    quest.activeQuestId = data.active_quest_id;
    quest.expiresAt = data.expires_at;
    return quest;
  }

  // Завершить квест
  static async completeActiveQuest(activeQuestId) {
    await db.run(
      'UPDATE active_quests SET completed = 1 WHERE id = ?',
      [activeQuestId]
    );
  }

  // Получить результаты квеста
  async getResults() {
    const results = await db.all(
      'SELECT * FROM quest_results WHERE quest_id = ? ORDER BY roll_range DESC',
      [this.id]
    );
    return results;
  }

  // Обработать бросок и получить результат
  async processRoll(roll, characterBonus = 0) {
    const results = await this.getResults();
    let selectedResult = null;

    // Критические броски игнорируют модификаторы
    if (roll === 20 || roll === 1) {
      selectedResult = results.find(r => r.roll_range === roll.toString());
    } else {
      // Применяем модификатор для обычных бросков
      const totalRoll = roll + characterBonus;
      
      // Сортируем результаты по убыванию диапазона
      const sortedResults = results.sort((a, b) => {
        const aMax = this.getRangeMax(a.roll_range);
        const bMax = this.getRangeMax(b.roll_range);
        return bMax - aMax;
      });
      
      // Проходим по результатам и находим подходящий
      for (const result of sortedResults) {
        const range = result.roll_range;
        
        if (range.includes('-')) {
          const [min, max] = range.split('-').map(Number);
          if (totalRoll >= min && totalRoll <= max) {
            selectedResult = result;
            break;
          }
        } else {
          const singleValue = parseInt(range);
          if (totalRoll === singleValue) {
            selectedResult = result;
            break;
          }
        }
      }
    }

    // Если не нашли подходящий результат, берем самый плохой
    if (!selectedResult) {
      selectedResult = results.find(r => r.roll_range.includes('2-') || r.roll_range === '1') || results[results.length - 1];
    }

    // Парсим эффекты и урон
    const effects = selectedResult.effects ? JSON.parse(selectedResult.effects) : null;
    
    return {
      success: selectedResult.is_success,
      text: selectedResult.result_text,
      roll: roll,
      bonus: characterBonus,
      total: roll + characterBonus,
      xpModifier: selectedResult.xp_modifier || 1.0,
      goldModifier: selectedResult.gold_modifier || 1.0,
      damage: selectedResult.damage,
      effects: effects,
      isCritical: roll === 20 || roll === 1
    };
  }

  // Получить максимальное значение диапазона
  getRangeMax(range) {
    if (range.includes('-')) {
      return parseInt(range.split('-')[1]);
    }
    return parseInt(range);
  }

  // Записать в историю
  async recordHistory(characterId, rollResult, rewards) {
    await db.run(`
      INSERT INTO quest_history (
        character_id, quest_id, roll_result, success,
        xp_gained, gold_gained, items_gained
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      characterId,
      this.id,
      rollResult.total,
      rollResult.success ? 1 : 0,
      rewards.xp || 0,
      rewards.gold || 0,
      JSON.stringify(rewards.items || [])
    ]);
  }

  // Получить историю квестов персонажа
  static async getCharacterHistory(characterId, limit = 10) {
    const history = await db.all(`
      SELECT 
        qh.*,
        q.title,
        q.difficulty,
        q.stat_check
      FROM quest_history qh
      JOIN quests q ON qh.quest_id = q.id
      WHERE qh.character_id = ?
      ORDER BY qh.completed_at DESC
      LIMIT ?
    `, [characterId, limit]);

    return history;
  }

  // Получить награды за квест
  calculateRewards(rollResult) {
    if (!rollResult.success) {
      // За провал даем часть опыта
      return {
        xp: Math.floor(this.xp_reward * rollResult.xpModifier),
        gold: rollResult.goldModifier < 0 ? 'all' : 0, // 'all' означает потерю всего золота
        items: []
      };
    }

    // Расчет наград с учетом модификаторов из результата
    return {
      xp: Math.floor(this.xp_reward * rollResult.xpModifier),
      gold: Math.floor(this.gold_reward * rollResult.goldModifier),
      items: [] // Предметы добавляются отдельно
    };
  }

  // Форматирование для отображения
  getDisplay() {
    const difficultyConfig = config.QUEST_DIFFICULTY[this.difficulty.toUpperCase()];
    const statConfig = config.STATS[this.stat_check];

    return `${difficultyConfig.emoji} **${this.title}**\n` +
           `_${this.description}_\n\n` +
           `📊 Проверка: ${statConfig.emoji} ${statConfig.name}\n` +
           `🎯 Сложность: ${difficultyConfig.name} (DC ${difficultyConfig.dcBase})\n` +
           `🏆 Награды: ${this.xp_reward} XP, ${this.gold_reward} 💰`;
  }

  getTimeLeft(expiresAt) {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;

    if (diff <= 0) return 'Истек';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    }
    return `${minutes}м`;
  }
}

module.exports = Quest;