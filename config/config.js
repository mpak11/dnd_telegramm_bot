// Централизованная конфигурация бота

module.exports = {
  // Основные настройки
  BOT_TOKEN: process.env.BOT_TOKEN,
  NODE_ENV: process.env.NODE_ENV || "production",

  // База данных
  DATABASE_PATH: process.env.DATABASE_PATH || "./data/dnd_bot.db",

  // Временная зона и расписание
  TIMEZONE: "Europe/Moscow", // МСК
  QUEST_START_HOUR: 10, // Начало выдачи квестов (10:00 МСК)
  QUEST_END_HOUR: 22, // Конец выдачи квестов (22:00 МСК)

  // Игровые настройки
  QUESTS_PER_DAY: {
    MIN: 1,
    MAX: 3,
  },

  // Уровни персонажей
  MAX_LEVEL: 10,
  XP_PER_LEVEL: [
    0, // Уровень 1
    300, // Уровень 2
    900, // Уровень 3
    2700, // Уровень 4
    6500, // Уровень 5
    14000, // Уровень 6
    23000, // Уровень 7
    34000, // Уровень 8
    48000, // Уровень 9
    64000, // Уровень 10
  ],

  // Расы персонажей
  RACES: {
    human: {
      name: "Человек",
      emoji: "👤",
      description: "Универсальные и адаптивные",
      bonuses: {
        strength: 1,
        dexterity: 1,
        intelligence: 1,
        wisdom: 1,
        constitution: 1,
        charisma: 1,
      },
      abilities: ["Универсальность: +1 ко всем характеристикам"],
    },
    elf: {
      name: "Эльф",
      emoji: "🧝",
      description: "Грациозные и мудрые",
      bonuses: {
        strength: 0,
        dexterity: 2,
        intelligence: 1,
        wisdom: 0,
        constitution: 0,
        charisma: 0,
      },
      abilities: ["Ночное зрение", "Острый слух: +2 к проверкам внимания"],
    },
    dwarf: {
      name: "Дварф",
      emoji: "⛏️",
      description: "Крепкие и выносливые",
      bonuses: {
        strength: 2,
        dexterity: 0,
        intelligence: 0,
        wisdom: 0,
        constitution: 2,
        charisma: 0,
      },
      abilities: ["Каменная выносливость: +25% HP", "Знание камня"],
    },
    halfling: {
      name: "Полурослик",
      emoji: "🧙",
      description: "Ловкие и удачливые",
      bonuses: {
        strength: 0,
        dexterity: 2,
        intelligence: 0,
        wisdom: 0,
        constitution: 0,
        charisma: 1,
      },
      abilities: ["Удача полурослика: перебросить 1 на d20", "Проворство"],
    },
  },

  // Классы персонажей
  CLASSES: {
    WARRIOR: {
      name: "Воин",
      emoji: "⚔️",
      description: "Мастер ближнего боя и тактики",
      baseHP: 12,
      hpPerLevel: 7,
      primaryStat: "strength",
      recommendedRaces: ["human", "dwarf"],
    },
    ROGUE: {
      name: "Плут",
      emoji: "🗡️",
      description: "Скрытный убийца из тени",
      baseHP: 8,
      hpPerLevel: 5,
      primaryStat: "dexterity",
      recommendedRaces: ["halfling", "elf"],
    },
    MAGE: {
      name: "Маг",
      emoji: "🔮",
      description: "Повелитель тайных искусств",
      baseHP: 6,
      hpPerLevel: 4,
      primaryStat: "intelligence",
      recommendedRaces: ["elf", "human"],
    },
    CLERIC: {
      name: "Жрец",
      emoji: "✨",
      description: "Служитель божественных сил",
      baseHP: 8,
      hpPerLevel: 5,
      primaryStat: "wisdom",
      recommendedRaces: ["human", "dwarf"],
    },
    BARBARIAN: {
      name: "Варвар",
      emoji: "🪓",
      description: "Яростный берсерк",
      baseHP: 14,
      hpPerLevel: 8,
      primaryStat: "strength",
      recommendedRaces: ["dwarf", "human"],
    },
    RANGER: {
      name: "Следопыт",
      emoji: "🏹",
      description: "Охотник и следопыт",
      baseHP: 10,
      hpPerLevel: 6,
      primaryStat: "dexterity",
      recommendedRaces: ["elf", "halfling"],
    },
  },

  // Характеристики
  STATS: {
    strength: { name: "Сила", emoji: "💪" },
    dexterity: { name: "Ловкость", emoji: "🏃" },
    intelligence: { name: "Интеллект", emoji: "🧠" },
    wisdom: { name: "Мудрость", emoji: "👁️" },
    constitution: { name: "Телосложение", emoji: "🛡️" },
    charisma: { name: "Харизма", emoji: "💬" },
  },

  // Уровни сложности квестов
  QUEST_DIFFICULTY: {
    // Начальные квесты (1-4 уровень)
    EASY: {
      name: "Легкий",
      emoji: "🟢",
      minLevel: 1,
      maxLevel: 4,
      xpMultiplier: 1,
      goldMultiplier: 1,
      lootChance: 0.3,
      dcBase: 10,
    },
    MEDIUM: {
      name: "Средний",
      emoji: "🟡",
      minLevel: 3,
      maxLevel: 6,
      xpMultiplier: 2,
      goldMultiplier: 2,
      lootChance: 0.5,
      dcBase: 13,
    },
    // Средний уровень (5-8)
    HARD: {
      name: "Сложный",
      emoji: "🔴",
      minLevel: 5,
      maxLevel: 8,
      xpMultiplier: 3,
      goldMultiplier: 3,
      lootChance: 0.7,
      dcBase: 15,
    },
    // Высокий уровень (9-10)
    EPIC: {
      name: "Эпический",
      emoji: "🟣",
      minLevel: 8,
      maxLevel: 10,
      xpMultiplier: 5,
      goldMultiplier: 5,
      lootChance: 0.9,
      dcBase: 18,
    },
    LEGENDARY: {
      name: "Легендарный",
      emoji: "💜",
      minLevel: 9,
      maxLevel: 10,
      xpMultiplier: 10,
      goldMultiplier: 10,
      lootChance: 1.0,
      dcBase: 20,
    },
  },

  PROFICIENCY_BONUS: {
    1: 2,
    2: 2,
    3: 2,
    4: 2, // +2
    5: 3,
    6: 3,
    7: 3,
    8: 3, // +3
    9: 4,
    10: 4, // +4
  },

  // Редкость предметов
  ITEM_RARITY: {
    COMMON: {
      name: "Обычный",
      emoji: "⚪",
      color: "gray",
      dropWeight: 60,
    },
    UNCOMMON: {
      name: "Необычный",
      emoji: "🟢",
      color: "green",
      dropWeight: 25,
    },
    RARE: {
      name: "Редкий",
      emoji: "🔵",
      color: "blue",
      dropWeight: 10,
    },
    EPIC: {
      name: "Эпический",
      emoji: "🟣",
      color: "purple",
      dropWeight: 4,
    },
    LEGENDARY: {
      name: "Легендарный",
      emoji: "🟠",
      color: "orange",
      dropWeight: 1,
    },
  },

  // Типы предметов
  ITEM_TYPES: {
    WEAPON: "weapon",
    ARMOR: "armor",
    CONSUMABLE: "consumable",
    MISC: "misc",
    ARTIFACT: "artifact",
  },

  // Анимация броска кубика
  DICE_ANIMATION: {
    FRAMES: 5,
    DELAY: 300, // мс
  },

  // Анимация создания персонажа
  CHARACTER_CREATION: {
    ANIMATION_DELAY: 1500, // мс между этапами
    STAT_ROLL_DELAY: 500, // мс между бросками характеристик
  },

  ABILITY_IMPROVEMENT_LEVELS: [4, 8], // Уровни, на которых даются очки улучшения
  MAX_ABILITY_SCORE: 20, // Максимальное значение характеристики
  MIN_ABILITY_SCORE: 1, // Минимальное значение характеристики

  LOOT_CONFIG: {
    // Шанс выпадения предметов по сложности квеста
    DROP_CHANCES: {
      easy: 0.3,
      medium: 0.5,
      hard: 0.7,
      epic: 0.9,
      legendary: 1.0,
    },
    // Множитель золота за критический успех
    CRITICAL_GOLD_MULTIPLIER: 2,
    // Время жизни сундука (минуты)
    CHEST_LIFETIME: 60,
    // Таймаут обмена (минуты)
    TRADE_TIMEOUT: 5,
  },
};
