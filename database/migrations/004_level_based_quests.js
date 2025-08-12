const BaseMigration = require('../migration-system/BaseMigration');
const { logDatabase } = require('../../utils/logger');

class LevelBasedQuestsMigration extends BaseMigration {
  constructor() {
    super(4, 'level_based_quests');
  }

  async up(db) {
    // Сначала проверяем, есть ли поле min_level
    const tableInfo = await db.all("PRAGMA table_info(quests)");
    const hasMinLevel = tableInfo.some((col) => col.name === "min_level");

    if (!hasMinLevel) {
      await db.run("ALTER TABLE quests ADD COLUMN min_level INTEGER DEFAULT 1");
    }

    const {
      beginnerQuests,
      midGameQuests,
      epicQuests,
    } = require("./epicQuests-data");

    const allQuests = [...beginnerQuests, ...midGameQuests, ...epicQuests];

    for (const quest of allQuests) {
      // Проверяем, существует ли квест с таким названием
      const existing = await db.get("SELECT id FROM quests WHERE title = ?", [
        quest.title,
      ]);
      if (existing) {
        logDatabase(`Квест "${quest.title}" уже существует, пропускаем`);
        continue;
      }

      const result = await db.run(
        `
        INSERT INTO quests (title, description, difficulty, stat_check, min_level, xp_reward, gold_reward)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          quest.title,
          quest.description,
          quest.difficulty,
          quest.stat_check,
          quest.min_level,
          quest.xp_reward,
          quest.gold_reward,
        ]
      );

      // Добавляем результаты
      for (const res of quest.results) {
        await db.run(
          `
          INSERT INTO quest_results (
            quest_id, roll_range, result_text, is_success,
            xp_modifier, gold_modifier, effects, damage
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            result.lastID,
            res.range,
            res.text,
            res.success ? 1 : 0,
            res.xp_modifier || 1.0,
            res.gold_modifier || 1.0,
            res.effects ? JSON.stringify(res.effects) : null,
            res.damage || null,
          ]
        );
      }
    }

    logDatabase(`Добавлено ${allQuests.length} квестов для разных уровней`);
  }
}

module.exports = new LevelBasedQuestsMigration();