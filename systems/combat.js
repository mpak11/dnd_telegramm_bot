// Система обработки урона и эффектов от квестов

const Dice = require('../utils/dice');
const config = require('../config/config');
const { log } = require('../utils/logger');

class CombatSystem {
  // Применить результат квеста к персонажу
  static async applyQuestResult(character, questResult) {
    const results = {
      damage: null,
      effects: [],
      statusText: []
    };

    // Обрабатываем урон
    if (questResult.damage) {
      results.damage = await this.applyDamage(character, questResult.damage);
    }

    // Обрабатываем эффекты
    if (questResult.effects) {
      results.effects = await this.applyEffects(character, questResult.effects);
    }

    return results;
  }

  // Применить урон
  static async applyDamage(character, damageFormula) {
    const damageRoll = Dice.rollDice(damageFormula);
    const actualDamage = damageRoll.total;

    // Учитываем защиту от брони (если будет реализована)
    // const defense = await character.getTotalDefense();
    // const finalDamage = Math.max(1, actualDamage - defense);

    await character.modifyHP(-actualDamage);

    log(`💔 ${character.name} получил ${actualDamage} урона (${damageRoll.breakdown})`);

    return {
      formula: damageFormula,
      rolled: damageRoll.rolls,
      total: actualDamage,
      currentHP: character.hp_current,
      maxHP: character.hp_max,
      isDead: character.hp_current <= 0
    };
  }

  // Применить эффекты
  static async applyEffects(character, effects) {
    const appliedEffects = [];
    const db = require('../database');

    for (const [effect, value] of Object.entries(effects)) {
      // Пропускаем duration
      if (effect === 'duration') continue;

      // Особые эффекты
      if (effect === 'level_loss' && value === true) {
        // Потеря уровня
        character.level = Math.max(1, character.level - 1);
        character.experience = config.XP_PER_LEVEL[character.level - 1] || 0;
        await db.run(
          'UPDATE characters SET level = ?, experience = ? WHERE id = ?',
          [character.level, character.experience, character.id]
        );
        appliedEffects.push({ type: 'level_loss', text: '📉 Потерян уровень!' });
        continue;
      }

      // Временные эффекты на характеристики
      if (['strength', 'dexterity', 'intelligence', 'wisdom', 'constitution', 'charisma'].includes(effect)) {
        await this.applyStatEffect(character.id, effect, value, effects.duration || 0);
        const sign = value > 0 ? '+' : '';
        appliedEffects.push({
          type: 'stat',
          stat: effect,
          value: value,
          duration: effects.duration,
          text: `${config.STATS[effect].emoji} ${sign}${value} к ${config.STATS[effect].name}`
        });
      }

      // Эффект на все характеристики
      if (effect === 'all_stats') {
        for (const stat of Object.keys(config.STATS)) {
          await this.applyStatEffect(character.id, stat, value, effects.duration || 0);
        }
        const sign = value > 0 ? '+' : '';
        appliedEffects.push({
          type: 'all_stats',
          value: value,
          duration: effects.duration,
          text: `📊 ${sign}${value} ко всем характеристикам`
        });
      }

      // Особые состояния
      if (['cursed', 'dragon_enemy', 'demon_mark', 'madness', 'soul_trapped'].includes(effect)) {
        await this.applySpecialEffect(character.id, effect, effects.duration || -1);
        appliedEffects.push({
          type: 'special',
          effect: effect,
          text: this.getSpecialEffectText(effect)
        });
      }

      // Титулы
      if (effect === 'title') {
        await this.applyTitle(character.id, value);
        appliedEffects.push({
          type: 'title',
          title: value,
          text: `🏆 Получен титул: "${value}"`
        });
      }
    }

    return appliedEffects;
  }

  // Применить временный эффект на характеристику
  static async applyStatEffect(characterId, stat, modifier, duration) {
    const db = require('../database');
    
    // Создаем таблицу эффектов если её нет
    await db.run(`
      CREATE TABLE IF NOT EXISTS character_effects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        effect_type TEXT NOT NULL,
        effect_value INTEGER NOT NULL,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id)
      )
    `);

    // Рассчитываем время истечения
    let expiresAt = null;
    if (duration > 0) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + duration);
    }

    // Добавляем эффект
    await db.run(`
      INSERT INTO character_effects (character_id, effect_type, effect_value, expires_at)
      VALUES (?, ?, ?, ?)
    `, [characterId, stat, modifier, expiresAt]);
  }

  // Применить особый эффект
  static async applySpecialEffect(characterId, effect, duration) {
    await this.applyStatEffect(characterId, `special_${effect}`, 1, duration);
  }

  // Применить титул
  static async applyTitle(characterId, title) {
    const db = require('../database');
    
    await db.run(`
      CREATE TABLE IF NOT EXISTS character_titles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id)
      )
    `);

    await db.run(
      'INSERT INTO character_titles (character_id, title) VALUES (?, ?)',
      [characterId, title]
    );
  }

  // Получить активные эффекты персонажа
  static async getActiveEffects(characterId) {
    const db = require('../database');
    
    // Удаляем истекшие эффекты
    await db.run(
      'DELETE FROM character_effects WHERE expires_at IS NOT NULL AND expires_at < datetime("now")'
    );

    // Получаем активные
    const effects = await db.all(`
      SELECT * FROM character_effects 
      WHERE character_id = ? AND (expires_at IS NULL OR expires_at > datetime("now"))
    `, [characterId]);

    return effects;
  }

  // Посчитать полный модификатор с учетом эффектов
  static async calculateTotalBonus(character, stat) {
    let bonus = character.getRollBonus(stat);
    
    // Добавляем временные эффекты
    const effects = await this.getActiveEffects(character.id);
    for (const effect of effects) {
      if (effect.effect_type === stat || effect.effect_type === 'all_stats') {
        bonus += effect.effect_value;
      }
    }

    // Добавляем бонусы от экипировки (будет реализовано)
    // const equipment = await character.getEquippedItems();
    // bonus += this.getEquipmentBonus(equipment, stat);

    return bonus;
  }

  // Текст для особых эффектов
  static getSpecialEffectText(effect) {
    const texts = {
      cursed: '💀 Вы прокляты!',
      dragon_enemy: '🐉 Драконы считают вас врагом!',
      demon_mark: '😈 На вас метка демона!',
      madness: '🌀 Вы охвачены безумием!',
      soul_trapped: '👻 Ваша душа в ловушке!',
      water_breathing: '💨 Вы можете дышать под водой!',
      fire_vulnerability: '🔥 Уязвимость к огню!',
      demon_servant: '👹 У вас есть демон-слуга!'
    };
    return texts[effect] || `❓ Особый эффект: ${effect}`;
  }

  // Форматирование результатов для отображения
  static formatCombatResults(results) {
    let text = '';

    // Урон
    if (results.damage) {
      text += `\n💔 **Получен урон:** ${results.damage.total} (${results.damage.formula})`;
      text += `\n❤️ **HP:** ${results.damage.currentHP}/${results.damage.maxHP}`;
      
      if (results.damage.isDead) {
        text += '\n\n☠️ **ВЫ МЕРТВЫ!** Требуется воскрешение!';
      }
    }

    // Эффекты
    if (results.effects.length > 0) {
      text += '\n\n**Получены эффекты:**';
      for (const effect of results.effects) {
        text += `\n${effect.text}`;
        if (effect.duration && effect.duration > 0) {
          text += ` (${effect.duration} часов)`;
        } else if (effect.duration === -1) {
          text += ' (постоянно)';
        }
      }
    }

    return text;
  }
}

module.exports = CombatSystem;