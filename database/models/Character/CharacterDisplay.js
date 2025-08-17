// Методы отображения персонажа

const config = require("../../../config/config");

class CharacterDisplay {
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
    const progress = (this.experience - currentLevelXP) / (nextLevelXP - currentLevelXP);
    const filled = Math.floor(progress * 20);
    const empty = 20 - filled;

    return "█".repeat(filled) + "░".repeat(empty) + ` ${this.experience}/${nextLevelXP}`;
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

  // Краткое отображение (для списков)
  getShortDisplay() {
    const status = this.hp_current <= 0 ? "☠️" : "❤️";
    return `${status} ${this.name} (${this.level} ур.) - ${this.getFullTitle()}`;
  }

  // Добавляем метод getDisplay для обратной совместимости
  async getDisplay() {
    return await this.getFullDisplay();
  }
}

CharacterDisplay.prototype = {};

module.exports = CharacterDisplay;