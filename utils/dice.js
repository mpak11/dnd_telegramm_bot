// Утилита для бросков кубиков в стиле D&D

class Dice {
  // Парсинг и бросок кубика по формуле (например: "2d6+3", "1d20", "3d4-2")
  static rollDice(formula) {
    // Убираем пробелы
    formula = formula.replace(/\s/g, '');
    
    // Парсим формулу
    const match = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (!match) {
      throw new Error(`Неверная формула броска: ${formula}`);
    }

    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    // Валидация
    if (count < 1 || count > 100) {
      throw new Error('Количество кубиков должно быть от 1 до 100');
    }
    if (sides < 2 || sides > 100) {
      throw new Error('Количество граней должно быть от 2 до 100');
    }

    // Бросаем кубики
    const rolls = [];
    let sum = 0;

    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      sum += roll;
    }

    const total = sum + modifier;

    return {
      formula: formula,
      rolls: rolls,
      modifier: modifier,
      sum: sum,
      total: Math.max(0, total), // Минимум 0
      breakdown: this.formatBreakdown(rolls, modifier)
    };
  }

  // Простой бросок d20
  static rollD20() {
    return Math.floor(Math.random() * 20) + 1;
  }

  // Бросок с преимуществом (2d20, берем больший)
  static rollAdvantage() {
    const roll1 = this.rollD20();
    const roll2 = this.rollD20();
    return {
      result: Math.max(roll1, roll2),
      rolls: [roll1, roll2],
      type: 'advantage'
    };
  }

  // Бросок с помехой (2d20, берем меньший)
  static rollDisadvantage() {
    const roll1 = this.rollD20();
    const roll2 = this.rollD20();
    return {
      result: Math.min(roll1, roll2),
      rolls: [roll1, roll2],
      type: 'disadvantage'
    };
  }

  // Форматирование результата броска
  static formatBreakdown(rolls, modifier) {
    let breakdown = rolls.join(' + ');
    if (modifier > 0) {
      breakdown += ` + ${modifier}`;
    } else if (modifier < 0) {
      breakdown += ` - ${Math.abs(modifier)}`;
    }
    return breakdown;
  }

  // Анимация броска кубика для Telegram
  static async animateDiceRoll(ctx, messageId = null) {
    const frames = [
      '🎲 Бросаем кубик...',
      '🎲 ⚀',
      '🎲 ⚁',
      '🎲 ⚂',
      '🎲 ⚃',
      '🎲 ⚄',
      '🎲 ⚅'
    ];

    let currentMessage = messageId;

    // Показываем анимацию
    for (let i = 0; i < 5; i++) {
      const frame = frames[Math.floor(Math.random() * (frames.length - 1)) + 1];
      
      if (currentMessage) {
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            currentMessage,
            null,
            frame
          );
        } catch (e) {
          // Игнорируем ошибки если сообщение не изменилось
        }
      } else {
        const msg = await ctx.reply(frame);
        currentMessage = msg.message_id;
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return currentMessage;
  }

  // Проверка критического успеха/провала
  static checkCritical(roll) {
    if (roll === 20) return 'critical_success';
    if (roll === 1) return 'critical_fail';
    return null;
  }

  // Генерация эмодзи для результата броска
  static getDiceEmoji(value, maxValue = 20) {
    const percentage = value / maxValue;
    
    if (value === maxValue) return '🎯'; // Критический успех
    if (value === 1) return '💀'; // Критический провал
    if (percentage >= 0.9) return '✨'; // Отличный бросок
    if (percentage >= 0.7) return '✅'; // Хороший бросок
    if (percentage >= 0.5) return '👍'; // Средний бросок
    if (percentage >= 0.3) return '😐'; // Ниже среднего
    return '😟'; // Плохой бросок
  }

  // Форматирование результата броска для отображения
  static formatRollResult(roll, modifier = 0, stat = null) {
    const total = roll + modifier;
    const emoji = this.getDiceEmoji(roll);
    const critical = this.checkCritical(roll);
    
    let text = `${emoji} **Бросок d20:** ${roll}`;
    
    if (modifier !== 0) {
      const sign = modifier > 0 ? '+' : '';
      text += ` ${sign}${modifier} = **${total}**`;
    }
    
    if (stat) {
      text += ` (${stat})`;
    }
    
    if (critical === 'critical_success') {
      text += '\n🎉 **КРИТИЧЕСКИЙ УСПЕХ!**';
    } else if (critical === 'critical_fail') {
      text += '\n💥 **КРИТИЧЕСКИЙ ПРОВАЛ!**';
    }
    
    return text;
  }

  // Бросок характеристики с модификатором
  static rollAbilityCheck(abilityModifier, proficiencyBonus = 0, advantage = null) {
    let roll;
    
    if (advantage === 'advantage') {
      const result = this.rollAdvantage();
      roll = result.result;
    } else if (advantage === 'disadvantage') {
      const result = this.rollDisadvantage();
      roll = result.result;
    } else {
      roll = this.rollD20();
    }
    
    const totalModifier = abilityModifier + proficiencyBonus;
    const total = roll + totalModifier;
    
    return {
      roll: roll,
      modifier: totalModifier,
      total: total,
      critical: this.checkCritical(roll),
      success: total >= 10 // DC по умолчанию
    };
  }

  // Бросок урона
  static rollDamage(damageFormula) {
    try {
      const result = this.rollDice(damageFormula);
      return {
        ...result,
        text: `💥 Урон: ${result.total} (${result.breakdown})`
      };
    } catch (error) {
      return {
        total: 0,
        text: '❌ Ошибка броска урона',
        error: error.message
      };
    }
  }

  // Массовый бросок (например, для генерации характеристик)
  static rollMultiple(count, formula) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(this.rollDice(formula));
    }
    return results;
  }

  // Бросок с перебросом единиц (способность полурослика)
  static rollWithReroll(advantage = null) {
    let roll = this.rollD20();
    let rerolled = false;
    
    if (roll === 1) {
      roll = this.rollD20();
      rerolled = true;
    }
    
    return {
      result: roll,
      rerolled: rerolled,
      critical: this.checkCritical(roll)
    };
  }
}

module.exports = Dice;