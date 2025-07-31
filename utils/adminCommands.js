// Утилиты для администрирования бота
// Добавление новых квестов и предметов

const db = require('../database');
const { log } = require('./logger');

class AdminCommands {
  // Добавить новый предмет
  static async addItem(itemData) {
    try {
      const { id } = await db.run(`
        INSERT INTO items (
          name, description, type, rarity, 
          effects, requirements, value_gold, is_unique
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        itemData.name,
        itemData.description,
        itemData.type,
        itemData.rarity,
        itemData.effects ? JSON.stringify(itemData.effects) : null,
        itemData.requirements ? JSON.stringify(itemData.requirements) : null,
        itemData.value_gold || 0,
        itemData.is_unique || 0
      ]);

      log(`✅ Добавлен предмет: ${itemData.name} (ID: ${id})`, 'success');
      return id;
    } catch (error) {
      log(`❌ Ошибка добавления предмета: ${error.message}`, 'error');
      throw error;
    }
  }

  // Добавить новый квест
  static async addQuest(questData) {
    try {
      // Добавляем квест
      const { id } = await db.run(`
        INSERT INTO quests (
          title, description, difficulty, 
          stat_check, min_level, xp_reward, gold_reward
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        questData.title,
        questData.description,
        questData.difficulty,
        questData.stat_check,
        questData.min_level || 1,
        questData.xp_reward,
        questData.gold_reward
      ]);

      // Добавляем результаты (должно быть 6)
      if (!questData.results || questData.results.length !== 6) {
        throw new Error('Квест должен иметь ровно 6 результатов!');
      }

      for (const result of questData.results) {
        await db.run(`
          INSERT INTO quest_results (
            quest_id, roll_range, result_text, is_success,
            xp_modifier, gold_modifier, effects, damage
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          result.range,
          result.text,
          result.success ? 1 : 0,
          result.xp_modifier || 1.0,
          result.gold_modifier || 1.0,
          result.effects ? JSON.stringify(result.effects) : null,
          result.damage || null
        ]);
      }

      log(`✅ Добавлен квест: ${questData.title} (ID: ${id})`, 'success');
      return id;
    } catch (error) {
      log(`❌ Ошибка добавления квеста: ${error.message}`, 'error');
      throw error;
    }
  }

  // Примеры использования
  static getExamples() {
    return {
      item: {
        name: 'Меч пламени',
        description: 'Клинок, пылающий вечным огнем',
        type: 'weapon', // weapon, armor, consumable, misc, artifact
        rarity: 'rare', // common, uncommon, rare, epic, legendary
        effects: {
          damage: 12,
          fire_damage: 5,
          strength: 2
        },
        requirements: {
          level: 5,
          strength: 14
        },
        value_gold: 2500,
        is_unique: 0
      },
      quest: {
        title: 'Призрак в замке',
        description: 'Старый замок населен призраками. Изгоните их!',
        difficulty: 'medium', // easy, medium, hard, epic, legendary
        stat_check: 'wisdom', // strength, dexterity, intelligence, wisdom, constitution, charisma
        min_level: 3, // минимальный уровень для получения
        xp_reward: 200,
        gold_reward: 150,
        results: [
          {
            range: '20',
            text: '✨ Вы изгнали всех призраков и нашли тайную сокровищницу!',
            success: true,
            xp_modifier: 2.0,
            gold_modifier: 5.0
          },
          {
            range: '15-19',
            text: '👻 Призраки изгнаны! Граф щедро наградил вас.',
            success: true,
            xp_modifier: 1.5,
            gold_modifier: 2.0
          },
          {
            range: '10-14',
            text: '✝️ Вы справились, но один призрак вас проклял (-1 к Мудрости на день).',
            success: true,
            xp_modifier: 1.0,
            gold_modifier: 1.0,
            effects: { wisdom: -1, duration: 24 }
          },
          {
            range: '5-9',
            text: '😱 Призраки напали! Вы бежали, потеряв 2d6 HP.',
            success: false,
            xp_modifier: 0.5,
            gold_modifier: 0,
            damage: '2d6'
          },
          {
            range: '2-4',
            text: '💀 Вас одержал злой дух! Потеряно 3d6 HP и -2 ко всем броскам на 3 дня.',
            success: false,
            xp_modifier: 0.2,
            gold_modifier: 0,
            damage: '3d6',
            effects: { all_stats: -2, duration: 72 }
          },
          {
            range: '1',
            text: '☠️ ВЫ СТАЛИ ПРИЗРАКОМ! Воскрешение стоит всего вашего золота и -5 к Телосложению навсегда!',
            success: false,
            xp_modifier: 0.1,
            gold_modifier: -1.0,
            effects: { constitution: -5, duration: -1 }
          }
        ]
      }
    };
  }
}

module.exports = AdminCommands;