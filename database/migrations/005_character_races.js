const BaseMigration = require("../migration-system/BaseMigration");
const { logDatabase } = require("../../utils/logger");

class CharacterRacesMigration extends BaseMigration {
  constructor() {
    super(5, "character_races");
  }

  async up(db) {
    // Проверяем, есть ли поле race
    const tableInfo = await db.all("PRAGMA table_info(characters)");
    const hasRace = tableInfo.some((col) => col.name === "race");

    if (!hasRace) {
      await db.run('ALTER TABLE characters ADD COLUMN race TEXT DEFAULT "human"');
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
}

module.exports = new CharacterRacesMigration();