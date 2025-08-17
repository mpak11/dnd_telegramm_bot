// UI утилиты для создания персонажа

const { Markup } = require('telegraf');
const config = require('../../../config/config');

class CreationUI {
  // Создать кнопки для выбора расы
  static createRaceButtons() {
    const races = Object.entries(config.RACES);
    const buttons = [];

    for (let i = 0; i < races.length; i += 2) {
      const row = [];

      row.push({
        text: `${races[i][1].emoji} ${races[i][1].name}`,
        callback_data: `race_${races[i][0]}`,
      });

      if (races[i + 1]) {
        row.push({
          text: `${races[i + 1][1].emoji} ${races[i + 1][1].name}`,
          callback_data: `race_${races[i + 1][0]}`,
        });
      }

      buttons.push(row);
    }

    return buttons;
  }

  // Создать кнопки для выбора класса
  static createClassButtons(selectedRace) {
    const classes = Object.entries(config.CLASSES);
    const buttons = [];

    for (let i = 0; i < classes.length; i += 2) {
      const row = [];

      const class1 = classes[i];
      const isRecommended1 = class1[1].recommendedRaces.includes(selectedRace);
      row.push({
        text: `${class1[1].emoji} ${class1[1].name}${isRecommended1 ? " ⭐" : ""}`,
        callback_data: `class_${class1[0]}`,
      });

      if (classes[i + 1]) {
        const class2 = classes[i + 1];
        const isRecommended2 = class2[1].recommendedRaces.includes(selectedRace);
        row.push({
          text: `${class2[1].emoji} ${class2[1].name}${isRecommended2 ? " ⭐" : ""}`,
          callback_data: `class_${class2[0]}`,
        });
      }

      buttons.push(row);
    }

    return buttons;
  }

  // Создать сообщение с информацией о расе
  static createRaceMessage() {
    const races = Object.entries(config.RACES);
    
    return (
      `🎭 **Создание персонажа**\n\n` +
      `**Шаг 1: Выберите расу**\n\n` +
      races
        .map(([key, race]) => 
          `${race.emoji} **${race.name}** - ${race.description}`
        )
        .join("\n")
    );
  }

  // Создать сообщение с информацией о классе
  static createClassMessage(selectedRace) {
    const classes = Object.entries(config.CLASSES);
    
    return (
      `🎭 **Создание персонажа**\n\n` +
      `**Шаг 2: Выберите класс**\n` +
      `⭐ отмечены рекомендуемые классы для вашей расы\n\n` +
      classes
        .map(([key, cls]) => {
          const isRecommended = cls.recommendedRaces.includes(selectedRace);
          return (
            `${cls.emoji} **${cls.name}** - ${cls.description}` +
            `\n   HP: ${cls.baseHP}, Основная характеристика: ${
              config.STATS[cls.primaryStat].name
            }` +
            (isRecommended ? " ⭐" : "")
          );
        })
        .join("\n\n")
    );
  }

  // Создать сообщение о расовых бонусах
  static createRaceBonusMessage(race) {
    const raceConfig = config.RACES[race];
    
    const bonusText = Object.entries(raceConfig.bonuses)
      .filter(([_, value]) => value > 0)
      .map(([stat, value]) =>
        `${config.STATS[stat].emoji} ${config.STATS[stat].name}: +${value}`
      )
      .join("\n");

    const abilitiesText = raceConfig.abilities
      .map((a) => `• ${a}`)
      .join("\n");

    return (
      `${raceConfig.emoji} **${raceConfig.name}**\n\n` +
      `**Расовые бонусы:**\n${bonusText}\n\n` +
      `**Способности:**\n${abilitiesText}`
    );
  }

  // Создать сообщение о характеристиках
  static createStatsMessage(baseStats, race) {
    const raceConfig = config.RACES[race];
    let message = `**🎲 Результаты бросков:**\n\n`;

    for (const [stat, value] of Object.entries(baseStats)) {
      const statConfig = config.STATS[stat];
      const raceBonus = raceConfig.bonuses[stat];
      const finalValue = value + raceBonus;
      const modifier = Math.floor((finalValue - 10) / 2);

      message += `${statConfig.emoji} ${statConfig.name}: **${finalValue}** `;
      message += `(${modifier >= 0 ? "+" : ""}${modifier})`;
      
      if (raceBonus > 0) {
        message += ` _[${value} + ${raceBonus}]_`;
      }
      
      message += '\n';
    }

    return message;
  }
}

module.exports = CreationUI;