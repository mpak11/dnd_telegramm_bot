// Система миграций для управления версиями БД

const { logDatabase } = require("../utils/logger");

class Migrator {
  constructor() {
    this.migrations = [
      {
        version: 1,
        name: "initial_data",
        up: this.migration001_initialData,
      },
      {
        version: 2,
        name: "default_items",
        up: this.migration002_defaultItems,
      },
      {
        version: 3,
        name: "default_quests",
        up: this.migration003_defaultQuests,
      },
      {
        version: 4,
        name: "level_based_quests",
        up: this.migration004_levelBasedQuests,
      },
      {
        version: 5,
        name: "character_races",
        up: this.migration005_characterRaces,
      },
      {
        version: 6,
        name: "fix_characters_unique_constraint",
        up: this.migration006_fixCharactersConstraint,
      },
      {
        version: 7,
        name: "ability_improvements_system",
        up: this.migration007_abilityImprovements,
      },
      {
        version: 8,
        name: "loot_and_trade_system",
        up: this.migration008_lootAndTrade,
      },
      {
        version: 9,
        name: "quest_history_items",
        up: this.migration009_questHistoryItems,
      },
      {
        version: 10,
        name: "enhanced_items_system",
        up: this.migration010_enhancedItemsSystem,
      },
      {
        version: 11,
        name: "seed_enhanced_items",
        up: this.migration011_seedEnhancedItems,
      },
      {
        version: 12,
        name: "enhanced_equipment_slots",
        up: this.migration012_enhancedEquipmentSlots,
      },
    ];
  }

  async migrate(db) {
    // Создаем таблицу миграций если её нет
    await db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Получаем текущую версию
    const currentVersion = await this.getCurrentVersion(db);
    logDatabase(`Текущая версия БД: ${currentVersion}`);

    // Применяем новые миграции
    for (const migration of this.migrations) {
      if (migration.version > currentVersion) {
        logDatabase(
          `Применяем миграцию ${migration.version}: ${migration.name}`
        );

        try {
          // Выполняем миграцию
          await migration.up(db);

          // Записываем в таблицу миграций
          await db.run("INSERT INTO migrations (version, name) VALUES (?, ?)", [
            migration.version,
            migration.name,
          ]);

          logDatabase(`✅ Миграция ${migration.version} применена`);
        } catch (error) {
          logDatabase(
            `❌ Ошибка миграции ${migration.version}: ${error.message}`
          );
          throw error;
        }
      }
    }
  }

  async getCurrentVersion(db) {
    const row = await db.get("SELECT MAX(version) as version FROM migrations");
    return row?.version || 0;
  }

  // === МИГРАЦИИ ===

  // Миграция 1: Начальные данные
  async migration001_initialData(db) {
    // Добавляем базовые классы в таблицу настроек
    await db.run(`
      CREATE TABLE IF NOT EXISTS game_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    await db.run(`
      INSERT OR REPLACE INTO game_settings (key, value) 
      VALUES ('version', '2.0.0')
    `);
  }

  // Миграция 2: Базовые предметы
  async migration002_defaultItems(db) {
    // Проверяем, есть ли уже предметы
    const existingItems = await db.get("SELECT COUNT(*) as count FROM items");
    if (existingItems.count > 0) {
      logDatabase("Предметы уже существуют, пропускаем");
      return;
    }

    const items = [
      // Расходники
      {
        name: "Зелье лечения",
        description: "Восстанавливает 50 HP",
        type: "consumable",
        rarity: "common",
        effects: JSON.stringify({ hp: 50 }),
        value_gold: 50,
      },
      {
        name: "Зелье маны",
        description: "Восстанавливает 30 MP",
        type: "consumable",
        rarity: "common",
        effects: JSON.stringify({ mp: 30 }),
        value_gold: 40,
      },
      // Оружие
      {
        name: "Ржавый меч",
        description: "Старый, но все еще острый",
        type: "weapon",
        rarity: "common",
        effects: JSON.stringify({ damage: 5 }),
        value_gold: 100,
      },
      {
        name: "Стальной меч",
        description: "Надежное оружие воина",
        type: "weapon",
        rarity: "uncommon",
        effects: JSON.stringify({ damage: 10, strength: 1 }),
        value_gold: 500,
      },
      // Броня
      {
        name: "Кожаная броня",
        description: "Легкая защита",
        type: "armor",
        rarity: "common",
        effects: JSON.stringify({ defense: 5 }),
        value_gold: 150,
      },
      {
        name: "Кольчуга",
        description: "Прочная металлическая защита",
        type: "armor",
        rarity: "uncommon",
        effects: JSON.stringify({ defense: 10, constitution: 1 }),
        value_gold: 600,
      },
      // Редкие предметы
      {
        name: "Пылающий меч",
        description: "Клинок, объятый вечным пламенем",
        type: "weapon",
        rarity: "rare",
        effects: JSON.stringify({ damage: 15, strength: 2, fire_damage: 5 }),
        value_gold: 2000,
      },
      // Эпические предметы
      {
        name: "Мантия архимага",
        description: "Одеяние великого волшебника",
        type: "armor",
        rarity: "epic",
        effects: JSON.stringify({ defense: 8, intelligence: 3, wisdom: 2 }),
        requirements: JSON.stringify({ class: "MAGE", level: 5 }),
        value_gold: 5000,
      },
      // Легендарные предметы (уникальные)
      {
        name: "Экскалибур",
        description: "Легендарный меч короля",
        type: "weapon",
        rarity: "legendary",
        effects: JSON.stringify({ damage: 25, strength: 5, charisma: 3 }),
        requirements: JSON.stringify({ level: 8 }),
        value_gold: 50000,
        is_unique: 1,
      },
      {
        name: "Сердце дракона",
        description: "Пылающий рубин с душой древнего дракона",
        type: "artifact",
        rarity: "legendary",
        effects: JSON.stringify({ hp_max: 50, all_stats: 2 }),
        value_gold: 100000,
        is_unique: 1,
      },
    ];

    // Вставляем предметы
    for (const item of items) {
      await db.run(
        `
        INSERT INTO items (name, description, type, rarity, effects, requirements, value_gold, is_unique)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          item.name,
          item.description,
          item.type,
          item.rarity,
          item.effects,
          item.requirements || null,
          item.value_gold,
          item.is_unique || 0,
        ]
      );
    }

    logDatabase(`Добавлено ${items.length} базовых предметов`);
  }

  // Миграция 3: Базовые квесты
  async migration003_defaultQuests(db) {
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
      const { id } = await db.run(
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
      for (const result of quest.results) {
        await db.run(
          `
          INSERT INTO quest_results (
            quest_id, roll_range, result_text, is_success,
            xp_modifier, gold_modifier, effects, damage
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            id,
            result.range,
            result.text,
            result.success ? 1 : 0,
            result.xp_mod || 1.0,
            result.gold_mod || 1.0,
            result.effects ? JSON.stringify(result.effects) : null,
            result.damage || null,
          ]
        );
      }
    }

    logDatabase(
      `Добавлено ${quests.length} базовых квестов с полными результатами`
    );
  }

  // Миграция 4: Квесты для разных уровней
  async migration004_levelBasedQuests(db) {
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
    } = require("./migrations/epicQuests");

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

      const { id } = await db.run(
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
      for (const result of quest.results) {
        await db.run(
          `
          INSERT INTO quest_results (
            quest_id, roll_range, result_text, is_success,
            xp_modifier, gold_modifier, effects, damage
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            id,
            result.range,
            result.text,
            result.success ? 1 : 0,
            result.xp_modifier || 1.0,
            result.gold_modifier || 1.0,
            result.effects ? JSON.stringify(result.effects) : null,
            result.damage || null,
          ]
        );
      }
    }

    logDatabase(`Добавлено ${allQuests.length} квестов для разных уровней`);
  }

  // Миграция 5: Добавление рас персонажей
  async migration005_characterRaces(db) {
    // Проверяем, есть ли поле race
    const tableInfo = await db.all("PRAGMA table_info(characters)");
    const hasRace = tableInfo.some((col) => col.name === "race");

    if (!hasRace) {
      await db.run(
        'ALTER TABLE characters ADD COLUMN race TEXT DEFAULT "human"'
      );
      logDatabase("Добавлено поле race в таблицу characters");
    }

    // Добавляем таблицу для расовых бонусов (если нужно будет в будущем)
    await db.run(`
      CREATE TABLE IF NOT EXISTS race_bonuses (
        race TEXT PRIMARY KEY,
        strength_bonus INTEGER DEFAULT 0,
        dexterity_bonus INTEGER DEFAULT 0,
        intelligence_bonus INTEGER DEFAULT 0,
        wisdom_bonus INTEGER DEFAULT 0,
        constitution_bonus INTEGER DEFAULT 0,
        charisma_bonus INTEGER DEFAULT 0,
        special_abilities TEXT
      )
    `);

    // Добавляем базовые расы
    const races = [
      {
        race: "human",
        str: 1,
        dex: 1,
        int: 1,
        wis: 1,
        con: 1,
        cha: 1,
        abilities: "Универсальность",
      },
      {
        race: "elf",
        str: 0,
        dex: 2,
        int: 1,
        wis: 0,
        con: 0,
        cha: 0,
        abilities: "Ночное зрение, Острый слух",
      },
      {
        race: "dwarf",
        str: 2,
        dex: 0,
        int: 0,
        wis: 0,
        con: 2,
        cha: 0,
        abilities: "Каменная выносливость",
      },
      {
        race: "halfling",
        str: 0,
        dex: 2,
        int: 0,
        wis: 0,
        con: 0,
        cha: 1,
        abilities: "Удача полурослика",
      },
    ];

    for (const r of races) {
      await db.run(
        `
        INSERT OR IGNORE INTO race_bonuses (
          race, strength_bonus, dexterity_bonus, intelligence_bonus,
          wisdom_bonus, constitution_bonus, charisma_bonus, special_abilities
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [r.race, r.str, r.dex, r.int, r.wis, r.con, r.cha, r.abilities]
      );
    }

    logDatabase("Добавлены расовые бонусы");
  }

  // Миграция 6: Исправление уникального ограничения для персонажей
  async migration006_fixCharactersConstraint(db) {
    // Сначала убеждаемся, что все NULL значения заменены на 1
    await db.run(`
      UPDATE characters 
      SET is_active = 1 
      WHERE is_active IS NULL
    `);

    // Проверяем, существует ли старый индекс
    const indexes = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type = 'index' AND tbl_name = 'characters'
    `);

    // Удаляем старый индекс если есть
    if (indexes.some((idx) => idx.name === "idx_characters_user_chat")) {
      await db.run("DROP INDEX idx_characters_user_chat");
      logDatabase("Удален старый индекс idx_characters_user_chat");
    }

    // Создаем новый частичный уникальный индекс
    // Это позволит иметь несколько неактивных персонажей, но только одного активного
    await db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_active_character 
      ON characters(user_id, chat_id) 
      WHERE is_active = 1
    `);

    logDatabase(
      "Создан новый частичный уникальный индекс для активных персонажей"
    );
  }

  async migration007_abilityImprovements(db) {
    // Добавляем поле ability_points если его нет
    const columns = await db.all("PRAGMA table_info(characters)");
    const hasAbilityPoints = columns.some(
      (col) => col.name === "ability_points"
    );

    if (!hasAbilityPoints) {
      await db.run(
        "ALTER TABLE characters ADD COLUMN ability_points INTEGER DEFAULT 0"
      );
      logDatabase("✅ Добавлено поле ability_points");

      // Даем очки существующим персонажам 4+ уровня
      await db.run(`
      UPDATE characters 
      SET ability_points = 
        CASE 
          WHEN level >= 8 THEN 4
          WHEN level >= 4 THEN 2
          ELSE 0
        END
      WHERE is_active = 1
    `);
      logDatabase("✅ Выданы очки улучшения существующим персонажам");
    }

    // Создаем таблицу истории улучшений
    await db.run(`
    CREATE TABLE IF NOT EXISTS ability_improvements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      level INTEGER NOT NULL,
      stat_name TEXT NOT NULL,
      improvement INTEGER NOT NULL,
      improved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )
  `);
    logDatabase("✅ Создана таблица ability_improvements");
  }

  async migration008_lootAndTrade(db) {
    // Таблица сундуков с лутом
    await db.run(`
    CREATE TABLE IF NOT EXISTS loot_chests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      creator_id INTEGER,
      gold INTEGER DEFAULT 0,
      items TEXT, -- JSON массив ID предметов
      difficulty TEXT DEFAULT 'medium',
      claimed INTEGER DEFAULT 0,
      claimed_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES characters(id),
      FOREIGN KEY (claimed_by) REFERENCES characters(id)
    )
  `);
    logDatabase("✅ Создана таблица loot_chests");

    // Таблица истории обменов
    await db.run(`
    CREATE TABLE IF NOT EXISTS trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_character_id INTEGER NOT NULL,
      to_character_id INTEGER NOT NULL,
      from_items TEXT, -- JSON массив предметов
      from_gold INTEGER DEFAULT 0,
      to_items TEXT, -- JSON массив предметов
      to_gold INTEGER DEFAULT 0,
      completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_character_id) REFERENCES characters(id),
      FOREIGN KEY (to_character_id) REFERENCES characters(id)
    )
  `);
    logDatabase("✅ Создана таблица trade_history");

    // Добавляем больше предметов в игру
    const newItems = [
      // Зелья и расходники
      {
        name: "Большое зелье лечения",
        description: "Восстанавливает 100 HP",
        type: "consumable",
        rarity: "uncommon",
        effects: { hp: 100 },
        value: 150,
      },
      {
        name: "Зелье невидимости",
        description: "Делает невидимым на 1 час",
        type: "consumable",
        rarity: "rare",
        effects: { invisibility: 60 },
        value: 500,
      },
      {
        name: "Свиток телепортации",
        description: "Телепортирует в безопасное место",
        type: "consumable",
        rarity: "rare",
        effects: { teleport: true },
        value: 1000,
      },

      // Обычное оружие
      {
        name: "Железный топор",
        description: "Простое но эффективное оружие",
        type: "weapon",
        rarity: "common",
        effects: { damage: 6 },
        value: 120,
      },
      {
        name: "Длинный лук",
        description: "Для дальних атак",
        type: "weapon",
        rarity: "common",
        effects: { damage: 5, dexterity: 1 },
        value: 150,
      },

      // Необычное оружие
      {
        name: "Серебряный клинок",
        description: "Эффективен против нежити",
        type: "weapon",
        rarity: "uncommon",
        effects: { damage: 8, holy_damage: 3 },
        value: 400,
      },
      {
        name: "Посох мага",
        description: "Увеличивает магическую силу",
        type: "weapon",
        rarity: "uncommon",
        effects: { damage: 4, intelligence: 2, wisdom: 1 },
        requirements: { class: "MAGE" },
        value: 600,
      },

      // Редкое оружие
      {
        name: "Клинок бури",
        description: "Наносит электрический урон",
        type: "weapon",
        rarity: "rare",
        effects: { damage: 12, lightning_damage: 5, dexterity: 2 },
        value: 1500,
      },
      {
        name: "Молот грома",
        description: "Оглушает врагов",
        type: "weapon",
        rarity: "rare",
        effects: { damage: 15, strength: 3, stun_chance: 0.2 },
        requirements: { strength: 16 },
        value: 2000,
      },

      // Броня
      {
        name: "Стальные доспехи",
        description: "Тяжелая защита",
        type: "armor",
        rarity: "uncommon",
        effects: { defense: 12, constitution: 1 },
        requirements: { strength: 14 },
        value: 800,
      },
      {
        name: "Мантия теней",
        description: "Легкая броня для скрытности",
        type: "armor",
        rarity: "rare",
        effects: { defense: 8, dexterity: 3, stealth: 5 },
        requirements: { class: "ROGUE" },
        value: 1800,
      },

      // Эпические предметы
      {
        name: "Доспехи дракона",
        description: "Выкованы из драконьей чешуи",
        type: "armor",
        rarity: "epic",
        effects: { defense: 20, all_stats: 1, fire_resistance: 0.5 },
        requirements: { level: 7 },
        value: 8000,
      },
      {
        name: "Скипетр властелина",
        description: "Символ абсолютной власти",
        type: "weapon",
        rarity: "epic",
        effects: { damage: 18, charisma: 5, wisdom: 3 },
        requirements: { level: 6 },
        value: 10000,
      },

      // Легендарные предметы
      {
        name: "Корона вечности",
        description: "Дарует бессмертие владельцу",
        type: "artifact",
        rarity: "legendary",
        effects: { hp_max: 100, hp_regen: 10, all_stats: 3 },
        requirements: { level: 9 },
        value: 50000,
        is_unique: 1,
      },
      {
        name: "Перчатка бесконечности",
        description: "Содержит силу шести камней",
        type: "artifact",
        rarity: "legendary",
        effects: { all_stats: 5, damage: 50, reality_warp: true },
        requirements: { level: 10 },
        value: 100000,
        is_unique: 1,
      },

      // Разное
      {
        name: "Счастливая монетка",
        description: "Приносит удачу",
        type: "misc",
        rarity: "uncommon",
        effects: { luck: 1 },
        value: 200,
      },
      {
        name: "Карта сокровищ",
        description: "Ведет к спрятанным богатствам",
        type: "misc",
        rarity: "rare",
        effects: { treasure_map: true },
        value: 1000,
      },
      {
        name: "Осколок души",
        description: "Фрагмент древней магии",
        type: "misc",
        rarity: "epic",
        effects: { soul_fragment: true },
        value: 5000,
      },
    ];

    // Добавляем новые предметы
    for (const item of newItems) {
      const existing = await db.get("SELECT id FROM items WHERE name = ?", [
        item.name,
      ]);
      if (!existing) {
        await db.run(
          `
        INSERT INTO items (name, description, type, rarity, effects, requirements, value_gold, is_unique)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
          [
            item.name,
            item.description,
            item.type,
            item.rarity,
            JSON.stringify(item.effects),
            item.requirements ? JSON.stringify(item.requirements) : null,
            item.value,
            item.is_unique || 0,
          ]
        );
      }
    }
    logDatabase(`✅ Добавлено ${newItems.length} новых предметов`);
  }
  async migration009_questHistoryItems(db) {
    // Добавляем поле для хранения полученных предметов в истории квестов
    const columns = await db.all("PRAGMA table_info(quest_history)");
    const hasItemsGained = columns.some((col) => col.name === "items_gained");

    if (!hasItemsGained) {
      await db.run("ALTER TABLE quest_history ADD COLUMN items_gained TEXT");
      logDatabase("✅ Добавлено поле items_gained в quest_history");
    }

    // Создаем индекс для ускорения поиска уникальных предметов
    await db.run(`
    CREATE INDEX IF NOT EXISTS idx_unique_items 
    ON items(is_unique)
    WHERE is_unique = 1
  `);
    logDatabase("✅ Создан индекс для уникальных предметов");

    // Добавляем поле equipped если его нет
    const invColumns = await db.all("PRAGMA table_info(inventory)");
    const hasEquipped = invColumns.some((col) => col.name === "equipped");

    if (!hasEquipped) {
      await db.run(
        "ALTER TABLE inventory ADD COLUMN equipped INTEGER DEFAULT 0"
      );
      logDatabase("✅ Добавлено поле equipped в inventory");
    }
  }
  async migration010_enhancedItemsSystem(db) {
    logDatabase("🎯 Обновляем систему предметов...");

    // Добавляем новые поля в таблицу items
    const columns = await db.all("PRAGMA table_info(items)");
    const columnNames = columns.map((col) => col.name);

    // Добавляем slot_type (куда экипируется предмет)
    if (!columnNames.includes("slot_type")) {
      await db.run(`ALTER TABLE items ADD COLUMN slot_type TEXT`);
      logDatabase("✅ Добавлено поле slot_type");
    }

    // Добавляем weight (вес предмета)
    if (!columnNames.includes("weight")) {
      await db.run(`ALTER TABLE items ADD COLUMN weight REAL DEFAULT 0`);
      logDatabase("✅ Добавлено поле weight");
    }

    // Добавляем is_two_handed (для оружия)
    if (!columnNames.includes("is_two_handed")) {
      await db.run(
        `ALTER TABLE items ADD COLUMN is_two_handed INTEGER DEFAULT 0`
      );
      logDatabase("✅ Добавлено поле is_two_handed");
    }

    // Добавляем weapon_type (тип оружия: slash, pierce, blunt, ranged, magic)
    if (!columnNames.includes("weapon_type")) {
      await db.run(`ALTER TABLE items ADD COLUMN weapon_type TEXT`);
      logDatabase("✅ Добавлено поле weapon_type");
    }

    // Добавляем armor_type (тип брони: light, medium, heavy)
    if (!columnNames.includes("armor_type")) {
      await db.run(`ALTER TABLE items ADD COLUMN armor_type TEXT`);
      logDatabase("✅ Добавлено поле armor_type");
    }

    // Добавляем stats_bonus (бонусы к характеристикам)
    if (!columnNames.includes("stats_bonus")) {
      await db.run(`ALTER TABLE items ADD COLUMN stats_bonus TEXT`);
      logDatabase("✅ Добавлено поле stats_bonus");
    }

    // Создаем таблицу торговцев
    await db.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      chat_id INTEGER,
      location TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
    logDatabase("✅ Создана таблица merchants");

    // Создаем таблицу инвентаря торговцев
    await db.run(`
    CREATE TABLE IF NOT EXISTS merchant_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT -1, -- -1 = бесконечное количество
      price_modifier REAL DEFAULT 1.0, -- множитель цены
      FOREIGN KEY (merchant_id) REFERENCES merchants(id),
      FOREIGN KEY (item_id) REFERENCES items(id),
      UNIQUE(merchant_id, item_id)
    )
  `);
    logDatabase("✅ Создана таблица merchant_inventory");

    // Добавляем базового торговца
    const existingMerchant = await db.get(
      "SELECT id FROM merchants WHERE id = 1"
    );
    if (!existingMerchant) {
      await db.run(`
      INSERT INTO merchants (id, name, description, location)
      VALUES (1, 'Гаррет Торговец', 'Дружелюбный торговец с базовыми товарами', 'Таверна')
    `);
      logDatabase("✅ Добавлен базовый торговец");
    }

    // Обновляем таблицу inventory для поддержки equipped по слотам
    if (!columnNames.includes("equipped_slot")) {
      await db.run(`ALTER TABLE inventory ADD COLUMN equipped_slot TEXT`);
      logDatabase("✅ Добавлено поле equipped_slot в inventory");
    }

    logDatabase("✅ Система предметов обновлена!");
  }
  async migration011_seedEnhancedItems(db) {
    // Импортируем функцию seedItems
    const seedItems = require('./seeders/items');

    // Вызываем её
    await seedItems();

    logDatabase("✅ Предметы добавлены через сидер");
  }
  async migration012_enhancedEquipmentSlots(db) {
    logDatabase("🎯 Добавляем новые слоты экипировки...");

    // Создаем таблицу слотов персонажа
    await db.run(`
    CREATE TABLE IF NOT EXISTS character_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      slot_name TEXT NOT NULL,
      item_id INTEGER,
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (item_id) REFERENCES items(id),
      UNIQUE(character_id, slot_name)
    )
  `);

    // Добавляем индекс
    await db.run(`
    CREATE INDEX IF NOT EXISTS idx_character_equipment 
    ON character_equipment(character_id)
  `);

    // Создаем таблицу статистики предметов
    await db.run(`
    CREATE TABLE IF NOT EXISTS item_statistics (
      item_id INTEGER PRIMARY KEY,
      times_bought INTEGER DEFAULT 0,
      times_sold INTEGER DEFAULT 0,
      times_equipped INTEGER DEFAULT 0,
      times_dropped INTEGER DEFAULT 0,
      times_crafted INTEGER DEFAULT 0,
      FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `);

    // Создаем таблицу рецептов крафтинга
    await db.run(`
    CREATE TABLE IF NOT EXISTS crafting_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      result_item_id INTEGER,
      required_level INTEGER DEFAULT 1,
      required_gold INTEGER DEFAULT 0,
      materials TEXT NOT NULL, -- JSON массив {item_id, quantity}
      tools_required TEXT, -- JSON массив инструментов
      success_rate REAL DEFAULT 1.0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (result_item_id) REFERENCES items(id)
    )
  `);

    // Создаем таблицу репутации с торговцами
    await db.run(`
    CREATE TABLE IF NOT EXISTS merchant_reputation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      merchant_id INTEGER NOT NULL,
      reputation INTEGER DEFAULT 0,
      total_spent INTEGER DEFAULT 0,
      total_sold INTEGER DEFAULT 0,
      last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      special_flags TEXT, -- JSON для особых событий
      FOREIGN KEY (character_id) REFERENCES characters(id),
      FOREIGN KEY (merchant_id) REFERENCES merchants(id),
      UNIQUE(character_id, merchant_id)
    )
  `);

    logDatabase("✅ Новые системы добавлены!");
  }
}

module.exports = new Migrator();
