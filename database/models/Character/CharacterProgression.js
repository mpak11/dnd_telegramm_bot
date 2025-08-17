// Методы прогрессии персонажа

const db = require("../../index");
const config = require("../../../config/config");
const { log } = require("../../../utils/logger");

class CharacterProgression {
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
      let hpGain = classConfig.hpPerLevel + this.getStatModifier("constitution");

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
      log(`🎉 Персонаж ${this.name} повысил уровень до ${this.level}!`);
      return {
        from: oldLevel,
        to: this.level,
        abilityPointsGained: abilityPointsGained,
      };
    }

    return false;
  }

  // Получить необходимый опыт для следующего уровня
  getXPToNextLevel() {
    if (this.level >= config.MAX_LEVEL) {
      return 0;
    }
    return config.XP_PER_LEVEL[this.level] - this.experience;
  }

  // Получить процент прогресса к следующему уровню
  getLevelProgress() {
    if (this.level >= config.MAX_LEVEL) {
      return 1.0;
    }

    const currentLevelXP = config.XP_PER_LEVEL[this.level - 1] || 0;
    const nextLevelXP = config.XP_PER_LEVEL[this.level];
    
    return (this.experience - currentLevelXP) / (nextLevelXP - currentLevelXP);
  }
}

CharacterProgression.prototype = {};

module.exports = CharacterProgression;