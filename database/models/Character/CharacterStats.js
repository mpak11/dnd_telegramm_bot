// Методы работы с характеристиками персонажа

const db = require("../../index");
const config = require("../../../config/config");

class CharacterStats {
  // Получить модификатор характеристики (статический для использования при создании)
  static getStatModifier(value) {
    return Math.floor((value - 10) / 2);
  }

  // Получить модификатор характеристики
  getStatModifier(stat) {
    const value = this[stat];
    return CharacterStats.getStatModifier(value);
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

  // Улучшить характеристику
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
      throw new Error(`Характеристика не может быть выше ${config.MAX_ABILITY_SCORE}`);
    }

    // Обновляем характеристику
    this[stat] = newValue;
    this.ability_points -= amount;

    let hpIncrease = 0;

    // Если улучшили Телосложение, пересчитываем HP
    if (stat === "constitution") {
      const oldModifier = CharacterStats.getStatModifier(currentValue);
      const newModifier = CharacterStats.getStatModifier(newValue);
      hpIncrease = (newModifier - oldModifier) * this.level;

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
      hpIncrease: hpIncrease
    };
  }

  // Получить историю улучшений
  async getImprovementHistory() {
    return await db.all(
      `SELECT * FROM ability_improvements 
       WHERE character_id = ? 
       ORDER BY improved_at DESC`,
      [this.id]
    );
  }
}

CharacterStats.prototype = {}; // Для правильного миксина

module.exports = CharacterStats;