// Модель персонажа

const db = require("../index");
const config = require("../../config/config");

class Character {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.chat_id = data.chat_id;
    this.name = data.name;
    this.race = data.race || "human";
    this.class = data.class;
    this.level = data.level;
    this.experience = data.experience;
    this.hp_current = data.hp_current;
    this.hp_max = data.hp_max;
    this.gold = data.gold;

    // Характеристики
    this.strength = data.strength;
    this.dexterity = data.dexterity;
    this.intelligence = data.intelligence;
    this.wisdom = data.wisdom;
    this.constitution = data.constitution;
    this.charisma = data.charisma;

    this.created_at = data.created_at;
    this.is_active = data.is_active;
    this.ability_points = data.ability_points || 0;
  }

  // Создание нового персонажа
  static async create(
    userDbId,
    chatId,
    name,
    race,
    characterClass,
    stats = null
  ) {
    const { log } = require("../../utils/logger");

    log(
      `[Character.create] Создание персонажа: userDbId=${userDbId}, chatId=${chatId}, name=${name}, race=${race}, class=${characterClass}`
    );

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
    const baseStats = stats || Character.rollStats();

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
    let hp =
      classConfig.baseHP + Character.getStatModifier(finalStats.constitution);

    // Дварфы получают +25% HP
    if (race === "dwarf") {
      hp = Math.floor(hp * 1.25);
    }

    hp = Math.max(1, hp); // Минимум 1 HP

    log(
      `[Character.create] Вставляем персонажа с HP=${hp}, stats=${JSON.stringify(
        finalStats
      )}`
    );

    try {
      const { id } = await db.run(
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

      log(`[Character.create] Персонаж создан с ID=${id}`);

      const character = await db.get("SELECT * FROM characters WHERE id = ?", [
        id,
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

    const data = await db.get(
      "SELECT * FROM characters WHERE user_id = ? AND chat_id = ? AND is_active = 1",
      [user.id, chatId]
    );
    return data ? new Character(data) : null;
  }

  // Найти по ID
  static async findById(id) {
    const data = await db.get("SELECT * FROM characters WHERE id = ?", [id]);
    return data ? new Character(data) : null;
  }

  // Получить модификатор характеристики (статический для использования при создании)
  static getStatModifier(value) {
    return Math.floor((value - 10) / 2);
  }

  // Получить модификатор характеристики
  getStatModifier(stat) {
    const value = this[stat];
    return Character.getStatModifier(value);
  }

  // Получить бонус мастерства
  getProficiencyBonus() {
    return config.PROFICIENCY_BONUS[this.level] || 2;
  }

  // Получить полный бонус к броску
  getRollBonus(stat) {
    const classConfig = config.CLASSES[this.class];
    let bonus = this.getStatModifier(stat);

    // Добавляем бонус мастерства если это основная характеристика класса
    if (classConfig.primaryStat === stat) {
      bonus += this.getProficiencyBonus();
    }

    return bonus;
  }

  // Добавить опыт
  async addExperience(amount) {
    const oldLevel = this.level;
    this.experience += amount;

    // Проверяем повышение уровня
    let leveledUp = false;
    let abilityPointsGained = 0;
    const xpTable = config.XP_PER_LEVEL;

    while (
      this.level < config.MAX_LEVEL &&
      this.experience >= xpTable[this.level]
    ) {
      this.level++;
      leveledUp = true;

      // Проверяем, получает ли персонаж очки улучшения
      if (config.ABILITY_IMPROVEMENT_LEVELS.includes(this.level)) {
        abilityPointsGained += 2; // Даем 2 очка
        this.ability_points = (this.ability_points || 0) + 2;
      }

      // Увеличиваем HP
      const classConfig = config.CLASSES[this.class];
      let hpGain =
        classConfig.hpPerLevel + this.getStatModifier("constitution");

      // Дварфы получают +25% HP при прокачке
      if (this.race === "dwarf") {
        hpGain = Math.floor(hpGain * 1.25);
      }

      hpGain = Math.max(1, hpGain); // Минимум 1 HP за уровень

      this.hp_max += hpGain;
      this.hp_current += hpGain;
    }

    // Сохраняем изменения
    await db.run(
      `
    UPDATE characters 
    SET experience = ?, level = ?, hp_max = ?, hp_current = ?, ability_points = ?
    WHERE id = ?
  `,
      [
        this.experience,
        this.level,
        this.hp_max,
        this.hp_current,
        this.ability_points || 0,
        this.id,
      ]
    );

    if (leveledUp) {
      return {
        from: oldLevel,
        to: this.level,
        abilityPointsGained: abilityPointsGained,
      };
    }

    return false;
  }

  async improveAbility(stat, amount) {
    if (!config.STATS[stat]) {
      throw new Error("Неверная характеристика");
    }

    if (this.ability_points < amount) {
      throw new Error("Недостаточно очков улучшения");
    }

    const currentValue = this[stat];
    const newValue = currentValue + amount;

    if (newValue > config.MAX_ABILITY_SCORE) {
      throw new Error(
        `Характеристика не может быть выше ${config.MAX_ABILITY_SCORE}`
      );
    }

    // Обновляем характеристику
    this[stat] = newValue;
    this.ability_points -= amount;

    // Если улучшили Телосложение, пересчитываем HP
    if (stat === "constitution") {
      const oldModifier = Character.getStatModifier(currentValue);
      const newModifier = Character.getStatModifier(newValue);
      const hpIncrease = (newModifier - oldModifier) * this.level;

      if (hpIncrease > 0) {
        this.hp_max += hpIncrease;
        this.hp_current += hpIncrease;
      }
    }

    // Сохраняем в БД
    await db.run(
      `UPDATE characters 
     SET ${stat} = ?, ability_points = ?, hp_max = ?, hp_current = ?
     WHERE id = ?`,
      [this[stat], this.ability_points, this.hp_max, this.hp_current, this.id]
    );

    // Записываем в историю
    await db.run(
      `INSERT INTO ability_improvements (character_id, level, stat_name, improvement)
     VALUES (?, ?, ?, ?)`,
      [this.id, this.level, stat, amount]
    );

    return {
      stat: stat,
      oldValue: currentValue,
      newValue: newValue,
      hpIncrease:
        stat === "constitution"
          ? (Character.getStatModifier(newValue) -
              Character.getStatModifier(currentValue)) *
            this.level
          : 0,
    };
  }

  // Добавить метод для получения истории улучшений
  async getImprovementHistory() {
    return await db.all(
      `SELECT * FROM ability_improvements 
     WHERE character_id = ? 
     ORDER BY improved_at DESC`,
      [this.id]
    );
  }

  // Добавить золото
  async addGold(amount) {
    this.gold = Math.max(0, this.gold + amount);
    await db.run("UPDATE characters SET gold = ? WHERE id = ?", [
      this.gold,
      this.id,
    ]);
  }

  // Изменить HP
  async modifyHP(amount) {
    this.hp_current = Math.max(
      0,
      Math.min(this.hp_max, this.hp_current + amount)
    );

    // Проверяем смерть
    let isDead = false;
    if (this.hp_current <= 0) {
      isDead = true;
      this.is_active = 0;

      // Деактивируем персонажа
      await db.run(
        "UPDATE characters SET hp_current = ?, is_active = 0 WHERE id = ?",
        [this.hp_current, this.id]
      );

      // Логируем смерть
      const { log } = require("../../utils/logger");
      log(`☠️ Персонаж ${this.name} (ID: ${this.id}) погиб!`, "warning");
    } else {
      // Обычное обновление HP
      await db.run("UPDATE characters SET hp_current = ? WHERE id = ?", [
        this.hp_current,
        this.id,
      ]);
    }

    return isDead;
  }

  // Добавим метод для проверки, жив ли персонаж
  isDead() {
    return this.hp_current <= 0 || !this.is_active;
  }

  // Добавим метод воскрешения (для будущего функционала)
  async resurrect(hpAmount = null) {
    const resurrectionHP = hpAmount || Math.floor(this.hp_max * 0.5);

    this.hp_current = Math.min(resurrectionHP, this.hp_max);
    this.is_active = 1;

    await db.run(
      "UPDATE characters SET hp_current = ?, is_active = 1 WHERE id = ?",
      [this.hp_current, this.id]
    );

    const { log } = require("../../utils/logger");
    log(`✨ Персонаж ${this.name} воскрешен с ${this.hp_current} HP!`);
  }

  static async findActiveAlive(telegramUserId, chatId) {
    // Сначала получаем ID пользователя из базы
    const user = await db.get("SELECT id FROM users WHERE telegram_id = ?", [
      telegramUserId,
    ]);

    if (!user) {
      return null;
    }

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

    const data = await db.get(
      "SELECT * FROM characters WHERE user_id = ? AND chat_id = ? ORDER BY created_at DESC LIMIT 1",
      [user.id, chatId]
    );
    return data ? new Character(data) : null;
  }

  // Получить инвентарь
  async getInventory() {
    const items = await db.all(
      `
      SELECT i.*, inv.quantity, inv.equipped
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE inv.character_id = ?
      ORDER BY i.rarity DESC, i.name
    `,
      [this.id]
    );

    return items;
  }

  // Добавить предмет в инвентарь
  async addItem(itemId, quantity = 1) {
    const existing = await db.get(
      "SELECT * FROM inventory WHERE character_id = ? AND item_id = ?",
      [this.id, itemId]
    );

    if (existing) {
      await db.run(
        "UPDATE inventory SET quantity = quantity + ? WHERE id = ?",
        [quantity, existing.id]
      );
    } else {
      await db.run(
        "INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)",
        [this.id, itemId, quantity]
      );
    }
  }

  // Удалить персонажа (деактивировать)
  async delete() {
    await db.run("UPDATE characters SET is_active = 0 WHERE id = ?", [this.id]);
  }

  // Форматирование для отображения
  getRaceInfo() {
    const raceConfig = config.RACES[this.race];
    return `${raceConfig.emoji} ${raceConfig.name}`;
  }

  getClassInfo() {
    const classConfig = config.CLASSES[this.class];
    return `${classConfig.emoji} ${classConfig.name}`;
  }

  getFullTitle() {
    return `${this.getRaceInfo()} ${this.getClassInfo()}`;
  }

  getStatsDisplay() {
    const stats = config.STATS;
    let display = "";

    for (const [key, info] of Object.entries(stats)) {
      const value = this[key];
      const modifier = this.getStatModifier(key);
      const modSign = modifier >= 0 ? "+" : "";

      display += `${info.emoji} ${info.name}: ${value}`;
      display += ` (${modSign}${modifier})`;
      // Убираем показ расовых бонусов
      display += "\n";
    }

    return display;
  }

  getProgressBar() {
    if (this.level >= config.MAX_LEVEL) {
      return "█████████████████████ MAX";
    }

    const currentLevelXP = config.XP_PER_LEVEL[this.level - 1] || 0;
    const nextLevelXP = config.XP_PER_LEVEL[this.level];
    const progress =
      (this.experience - currentLevelXP) / (nextLevelXP - currentLevelXP);
    const filled = Math.floor(progress * 20);
    const empty = 20 - filled;

    return (
      "█".repeat(filled) +
      "░".repeat(empty) +
      ` ${this.experience}/${nextLevelXP}`
    );
  }

  // Получить полную информацию о персонаже
  async getFullDisplay() {
  const classConfig = config.CLASSES[this.class];
  const raceConfig = config.RACES[this.race];

  let display = `🎭 **${this.name}**`;
  
  // Добавляем метку если мертв
  if (this.hp_current <= 0) {
    display += ` ☠️ [МЕРТВ]`;
  }
  
  display += `\n${this.getFullTitle()} • Уровень ${this.level}\n\n`;

  // HP бар
  const hpPercent = this.hp_current / this.hp_max;
  const hpFilled = Math.floor(hpPercent * 10);
  const hpEmpty = 10 - hpFilled;
  
  if (this.hp_current <= 0) {
    display += `❤️ HP: ${"💀".repeat(10)} ${this.hp_current}/${this.hp_max}\n`;
  } else {
    const hpColor = hpPercent > 0.5 ? "🟩" : hpPercent > 0.25 ? "🟨" : "🟥";
    display += `❤️ HP: ${hpColor.repeat(hpFilled)}${"⬜".repeat(hpEmpty)} ${this.hp_current}/${this.hp_max}\n`;
  }

  // XP бар
  display += `✨ XP: ${this.getProgressBar()}\n`;
  display += `💰 Золото: ${this.gold}\n`;
  
  // Показываем доступные очки улучшения
  if (this.ability_points > 0) {
    display += `💎 **Очки улучшения: ${this.ability_points}** (/improve)\n`;
  }
  
  display += `\n**📊 Характеристики:**\n${this.getStatsDisplay()}\n`;

  // Расовые способности
  if (raceConfig.abilities && raceConfig.abilities.length > 0) {
    display += `**🎯 Расовые способности:**\n`;
    for (const ability of raceConfig.abilities) {
      display += `• ${ability}\n`;
    }
  }

  return display;
}
}

module.exports = Character;
