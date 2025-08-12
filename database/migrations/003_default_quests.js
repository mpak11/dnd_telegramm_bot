const BaseMigration = require("../migration-system/BaseMigration");
const { logDatabase } = require("../../utils/logger");

class DefaultQuestsMigration extends BaseMigration {
  constructor() {
    super(3, "default_quests");
  }
  async up(db) {
    // Проверяем, есть ли уже квесты
    const existingQuests = await db.get("SELECT COUNT(*) as count FROM quests");
    if (existingQuests.count > 0) {
      logDatabase("Квесты уже существуют, пропускаем");
      return;
    }

    const quests = [
      // Легкие квесты
      {
        title: "Крысы в подвале",
        description: "Трактирщик просит избавить подвал от крыс. Киньте 1d20!",
        difficulty: "easy",
        stat_check: "strength",
        xp_reward: 50,
        gold_reward: 20,
        results: [
          {
            range: "20",
            text: "🏆 Вы уничтожили короля-крысу! Трактирщик дарит вам именное оружие и пожизненную скидку!",
            success: true,
            xp_mod: 2.0,
            gold_mod: 3.0,
          },
          {
            range: "15-19",
            text: "💪 Отличная работа! Крысы разбежались, подвал чист. Трактирщик доволен!",
            success: true,
            xp_mod: 1.5,
            gold_mod: 1.5,
          },
          {
            range: "10-14",
            text: "✅ Вы справились, но покусаны. Крысы ушли, но вы потеряли 1d4 HP.",
            success: true,
            xp_mod: 1.0,
            gold_mod: 1.0,
            damage: "1d4",
          },
          {
            range: "5-9",
            text: "😰 Крысы оказались агрессивными! Вы убежали, потеряв 1d6 HP.",
            success: false,
            xp_mod: 0.5,
            gold_mod: 0,
            damage: "1d6",
          },
          {
            range: "2-4",
            text: "💀 Стая крыс повалила вас! Потеряно 2d4 HP и достоинство.",
            success: false,
            xp_mod: 0.2,
            gold_mod: 0,
            damage: "2d4",
            effects: { charisma: -1, duration: 24 },
          },
          {
            range: "1",
            text: "☠️ КРЫСИНЫЙ КОРОЛЬ ПРОБУДИЛСЯ! Вы едва выжили, потеряв 3d6 HP. Таверна закрыта на карантин!",
            success: false,
            xp_mod: 0.1,
            gold_mod: 0,
            damage: "3d6",
            effects: { all_stats: -1, duration: 48 },
          },
        ],
      },
      {
        title: "Нападение кракена",
        description:
          "На ваш корабль напал морской монстр! Киньте 1d20 для битвы!",
        difficulty: "hard",
        stat_check: "dexterity",
        xp_reward: 300,
        gold_reward: 200,
        results: [
          {
            range: "20",
            text: "⚔️ Вы пронзили глаз кракена гарпуном! Монстр отступает, оставив легендарную жемчужину!",
            success: true,
            xp_mod: 2.0,
            gold_mod: 5.0,
            effects: { water_breathing: true, duration: 168 },
          },
          {
            range: "15-19",
            text: "💪 Вы отрубили несколько щупалец. Корабль поврежден, но цел!",
            success: true,
            xp_mod: 1.5,
            gold_mod: 2.0,
          },
          {
            range: "10-14",
            text: "🗡️ Щупальца хлестнули по палубе. Вы отбились, но ранены (1d8 урона).",
            success: true,
            xp_mod: 1.0,
            gold_mod: 1.0,
            damage: "1d8",
          },
          {
            range: "5-9",
            text: "💫 Кракен утащил вас под воду! Вы выбрались, но едва не утонули (2d6 урона).",
            success: false,
            xp_mod: 0.5,
            gold_mod: 0,
            damage: "2d6",
            effects: { constitution: -2, duration: 72 },
          },
          {
            range: "2-4",
            text: "⛓️ Щупальца сломали вам ребра! 3d6 урона и -2 к Ловкости на 3 дня.",
            success: false,
            xp_mod: 0.2,
            gold_mod: 0,
            damage: "3d6",
            effects: { dexterity: -2, duration: 72 },
          },
          {
            range: "1",
            text: "💀 КРАКЕН ПОГЛОТИЛ ВАС! Вы чудом выжили в его желудке, потеряв 4d8 HP и всё снаряжение!",
            success: false,
            xp_mod: 0.1,
            gold_mod: -1.0, // теряет всё золото
            damage: "4d8",
            effects: { all_stats: -3, duration: 168 },
          },
        ],
      },
      {
        title: "Логово дракона",
        description:
          "Вы нашли спящего дракона и его сокровища! Киньте 1d20 на скрытность!",
        difficulty: "legendary",
        stat_check: "dexterity",
        xp_reward: 1000,
        gold_reward: 1000,
        results: [
          {
            range: "20",
            text: "🏆 Вы украли яйцо дракона! Теперь у вас есть питомец-дракончик!",
            success: true,
            xp_mod: 3.0,
            gold_mod: 10.0,
            effects: { dragon_pet: true, charisma: 5, duration: -1 },
          },
          {
            range: "15-19",
            text: "💎 Вы набили карманы драгоценностями и тихо ушли!",
            success: true,
            xp_mod: 2.0,
            gold_mod: 5.0,
          },
          {
            range: "10-14",
            text: "💰 Схватили золото, но дракон зашевелился. Пришлось бежать!",
            success: true,
            xp_mod: 1.5,
            gold_mod: 2.0,
            effects: { speed: 2, duration: 24 },
          },
          {
            range: "5-9",
            text: "🔥 Дракон проснулся! Вы убежали, обожженные (2d10 огненного урона).",
            success: false,
            xp_mod: 0.5,
            gold_mod: 0.5,
            damage: "2d10",
            effects: { fire_vulnerability: true, duration: 72 },
          },
          {
            range: "2-4",
            text: "😱 Дракон в ярости! Преследовал вас до города (3d10 урона и проклятие).",
            success: false,
            xp_mod: 0.2,
            gold_mod: 0,
            damage: "3d10",
            effects: { cursed: true, all_stats: -2, duration: 168 },
          },
          {
            range: "1",
            text: "☠️ ВЫ РАЗБУДИЛИ ДРЕВНЕГО! Едва выжили, потеряв 5d10 HP. Дракон объявил вас личным врагом!",
            success: false,
            xp_mod: 0.1,
            gold_mod: 0,
            damage: "5d10",
            effects: { dragon_enemy: true, all_stats: -5, duration: -1 },
          },
        ],
      },
    ];

    // Вставляем квесты и их результаты
    for (const quest of quests) {
  const result = await db.run(
    `
    INSERT INTO quests (title, description, difficulty, stat_check, xp_reward, gold_reward)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      quest.title,
      quest.description,
      quest.difficulty,
      quest.stat_check,
      quest.xp_reward,
      quest.gold_reward,
    ]
  );

  // Добавляем результаты
  for (const questResult of quest.results) {
    await db.run(
      `
      INSERT INTO quest_results (
        quest_id, roll_range, result_text, is_success,
        xp_modifier, gold_modifier, effects, damage
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        result.lastID,  // Используем lastID из результата вставки
        questResult.range,
        questResult.text,
        questResult.success ? 1 : 0,
        questResult.xp_mod || 1.0,
        questResult.gold_mod || 1.0,
        questResult.effects ? JSON.stringify(questResult.effects) : null,
        questResult.damage || null,
      ]
    );
  }
}

    logDatabase(
      `Добавлено ${quests.length} базовых квестов с полными результатами`
    );
  }
}

module.exports = new DefaultQuestsMigration();
