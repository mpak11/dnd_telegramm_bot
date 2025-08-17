// Фабрика для создания и поиска персонажей

const db = require("../../index");
const config = require("../../../config/config");

class CharacterFactory {
  // Создание нового персонажа
  static async create(userDbId, chatId, name, race, characterClass, stats = null) {
    const { log } = require("../../../utils/logger");

    log(`[Character.create] Создание персонажа: userDbId=${userDbId}, chatId=${chatId}, name=${name}, race=${race}, class=${characterClass}`);

    const classConfig = config.CLASSES[characterClass];
    const raceConfig = config.RACES[race];

    if (!classConfig) {
      throw new Error("Неверный класс персонажа");
    }
    if (!raceConfig) {
      throw new Error("Неверная раса персонажа");
    }

    // Проверяем, нет ли уже персонажа
    const existing = await db.get(
      "SELECT * FROM characters WHERE user_id = ? AND chat_id = ? AND is_active = 1",
      [userDbId, chatId]
    );

    if (existing) {
      throw new Error("У вас уже есть активный персонаж!");
    }

    // Генерируем или используем переданные характеристики
    const baseStats = stats || CharacterFactory.rollStats();

    // Применяем расовые бонусы
    const finalStats = {
      strength: baseStats.strength + raceConfig.bonuses.strength,
      dexterity: baseStats.dexterity + raceConfig.bonuses.dexterity,
      intelligence: baseStats.intelligence + raceConfig.bonuses.intelligence,
      wisdom: baseStats.wisdom + raceConfig.bonuses.wisdom,
      constitution: baseStats.constitution + raceConfig.bonuses.constitution,
      charisma: baseStats.charisma + raceConfig.bonuses.charisma,
    };

    // Рассчитываем HP с учетом расы
    const Character = require('./index');
    let hp = classConfig.baseHP + Character.getStatModifier(finalStats.constitution);

    // Дварфы получают +25% HP
    if (race === "dwarf") {
      hp = Math.floor(hp * 1.25);
    }

    hp = Math.max(1, hp); // Минимум 1 HP

    log(`[Character.create] Вставляем персонажа с HP=${hp}, stats=${JSON.stringify(finalStats)}`);

    try {
      const result = await db.run(
        `
        INSERT INTO characters (
          user_id, chat_id, name, race, class, 
          hp_current, hp_max,
          strength, dexterity, intelligence, wisdom, constitution, charisma
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          userDbId,
          chatId,
          name,
          race,
          characterClass,
          hp,
          hp,
          finalStats.strength,
          finalStats.dexterity,
          finalStats.intelligence,
          finalStats.wisdom,
          finalStats.constitution,
          finalStats.charisma,
        ]
      );

      log(`[Character.create] Персонаж создан с ID=${result.lastID}`);

      const character = await db.get("SELECT * FROM characters WHERE id = ?", [
        result.lastID,
      ]);
      return new Character(character);
    } catch (error) {
      log(`[Character.create] Ошибка вставки: ${error.message}`, "error");
      throw error;
    }
  }

  // Генерация случайных характеристик (4d6, отбрасываем минимум)
  static rollStats() {
    const rollStat = () => {
      const rolls = Array(4)
        .fill(0)
        .map(() => Math.floor(Math.random() * 6) + 1);
      rolls.sort((a, b) => b - a);
      return rolls[0] + rolls[1] + rolls[2]; // Суммируем 3 лучших
    };

    return {
      strength: rollStat(),
      dexterity: rollStat(),
      intelligence: rollStat(),
      wisdom: rollStat(),
      constitution: rollStat(),
      charisma: rollStat(),
    };
  }

  // Найти активного персонажа
  static async findActive(telegramUserId, chatId) {
    // Сначала получаем ID пользователя из базы
    const user = await db.get("SELECT id FROM users WHERE telegram_id = ?", [
      telegramUserId,
    ]);

    if (!user) {
      return null;
    }

    const Character = require('./index');
    const data = await db.get(
      "SELECT * FROM characters WHERE user_id = ? AND chat_id = ? AND is_active = 1",
      [user.id, chatId]
    );
    return data ? new Character(data) : null;
  }

  // Найти по ID
  static async findById(id) {
    const Character = require('./index');
    const data = await db.get("SELECT * FROM characters WHERE id = ?", [id]);
    return data ? new Character(data) : null;
  }

  // Найти активного живого персонажа
  static async findActiveAlive(telegramUserId, chatId) {
    const user = await db.get("SELECT id FROM users WHERE telegram_id = ?", [
      telegramUserId,
    ]);

    if (!user) {
      return null;
    }

    const Character = require('./index');
    const data = await db.get(
      "SELECT * FROM characters WHERE user_id = ? AND chat_id = ? AND is_active = 1 AND hp_current > 0",
      [user.id, chatId]
    );
    return data ? new Character(data) : null;
  }

  // Получить последнего персонажа (включая мертвого) для показа информации
  static async findLast(telegramUserId, chatId) {
    const user = await db.get("SELECT id FROM users WHERE telegram_id = ?", [
      telegramUserId,
    ]);

    if (!user) {
      return null;
    }

    const Character = require('./index');
    const data = await db.get(
      "SELECT * FROM characters WHERE user_id = ? AND chat_id = ? ORDER BY created_at DESC LIMIT 1",
      [user.id, chatId]
    );
    return data ? new Character(data) : null;
  }
}

module.exports = CharacterFactory;