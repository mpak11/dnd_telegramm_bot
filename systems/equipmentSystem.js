// systems/equipmentSystem.js
const db = require('../database');
const { log } = require('../utils/logger');

class EquipmentSystem {
  constructor() {
    // Определение всех слотов экипировки
    this.slots = {
      // Основные слоты
      weapon_main: { name: 'Основное оружие', types: ['weapon'] },
      weapon_off: { name: 'Второе оружие/Щит', types: ['weapon', 'shield'] },
      armor: { name: 'Броня', types: ['armor'] },
      head: { name: 'Голова', types: ['accessory'] },
      cloak: { name: 'Плащ', types: ['accessory'] },
      gloves: { name: 'Перчатки', types: ['accessory'] },
      boots: { name: 'Обувь', types: ['accessory'] },
      belt: { name: 'Пояс', types: ['accessory'] },
      
      // Украшения
      ring1: { name: 'Кольцо 1', types: ['accessory'] },
      ring2: { name: 'Кольцо 2', types: ['accessory'] },
      amulet: { name: 'Амулет', types: ['accessory'] },
      trinket: { name: 'Аксессуар', types: ['accessory'] }
    };
  }

  // Получить всю экипировку персонажа
  async getEquipment(characterId) {
    const equipment = {};
    
    const rows = await db.all(`
      SELECT ce.*, i.*, ce.slot_name as equipped_slot
      FROM character_equipment ce
      JOIN items i ON ce.item_id = i.id
      WHERE ce.character_id = ?
    `, [characterId]);
    
    for (const row of rows) {
      equipment[row.equipped_slot] = {
        id: row.item_id,
        name: row.name,
        type: row.type,
        rarity: row.rarity,
        stats_bonus: row.stats_bonus ? JSON.parse(row.stats_bonus) : {},
        effects: row.effects ? JSON.parse(row.effects) : {}
      };
    }
    
    return equipment;
  }

  // Экипировать предмет
  async equipItem(characterId, itemId) {
    // Получаем информацию о предмете
    const item = await db.get(`
      SELECT i.*, inv.id as inventory_id
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE inv.character_id = ? AND inv.item_id = ?
    `, [characterId, itemId]);
    
    if (!item) {
      throw new Error('Предмет не найден в инвентаре');
    }
    
    // Определяем подходящий слот
    const slot = this.findSlotForItem(item);
    if (!slot) {
      throw new Error('Не могу найти подходящий слот для этого предмета');
    }
    
    // Проверяем требования
    await this.checkRequirements(characterId, item);
    
    // Проверяем двуручное оружие
    if (item.is_two_handed) {
      await this.handleTwoHandedWeapon(characterId);
    }
    
    // Снимаем текущий предмет в слоте (если есть)
    const currentItem = await db.get(
      'SELECT item_id FROM character_equipment WHERE character_id = ? AND slot_name = ?',
      [characterId, slot]
    );
    
    if (currentItem) {
      await this.unequipItem(characterId, currentItem.item_id, false);
    }
    
    // Экипируем новый предмет
    await db.run(
      'INSERT OR REPLACE INTO character_equipment (character_id, slot_name, item_id) VALUES (?, ?, ?)',
      [characterId, slot, itemId]
    );
    
    // Обновляем статистику
    await this.trackItemUsage(itemId, 'equipped');
    
    log(`Персонаж ${characterId} экипировал ${item.name} в слот ${slot}`);
    
    return {
      success: true,
      item: item.name,
      slot: this.slots[slot].name
    };
  }

  // Снять предмет
  async unequipItem(characterId, itemId, trackStats = true) {
    const equipment = await db.get(
      'SELECT * FROM character_equipment WHERE character_id = ? AND item_id = ?',
      [characterId, itemId]
    );
    
    if (!equipment) {
      throw new Error('Предмет не экипирован');
    }
    
    // Удаляем из экипировки
    await db.run(
      'DELETE FROM character_equipment WHERE character_id = ? AND item_id = ?',
      [characterId, itemId]
    );
    
    if (trackStats) {
      await this.trackItemUsage(itemId, 'unequipped');
    }
    
    return { success: true };
  }

  // Найти подходящий слот для предмета
  findSlotForItem(item) {
    // Для оружия
    if (item.type === 'weapon') {
      return 'weapon_main';
    }
    
    // Для щитов
    if (item.type === 'shield') {
      return 'weapon_off';
    }
    
    // Для брони
    if (item.type === 'armor') {
      return 'armor';
    }
    
    // Для аксессуаров проверяем slot_type
    if (item.type === 'accessory' && item.slot_type) {
      // Для колец проверяем свободный слот
      if (item.slot_type === 'ring') {
        return this.findFreeRingSlot();
      }
      
      return item.slot_type;
    }
    
    return null;
  }

  // Найти свободный слот для кольца
  async findFreeRingSlot(characterId) {
    const ring1 = await db.get(
      'SELECT 1 FROM character_equipment WHERE character_id = ? AND slot_name = ?',
      [characterId, 'ring1']
    );
    
    if (!ring1) return 'ring1';
    
    const ring2 = await db.get(
      'SELECT 1 FROM character_equipment WHERE character_id = ? AND slot_name = ?',
      [characterId, 'ring2']
    );
    
    if (!ring2) return 'ring2';
    
    // Если оба слота заняты, заменяем первое кольцо
    return 'ring1';
  }

  // Обработка двуручного оружия
  async handleTwoHandedWeapon(characterId) {
    // Снимаем оружие из второй руки
    const offHand = await db.get(
      'SELECT item_id FROM character_equipment WHERE character_id = ? AND slot_name = ?',
      [characterId, 'weapon_off']
    );
    
    if (offHand) {
      await this.unequipItem(characterId, offHand.item_id, false);
    }
  }

  // Проверка требований
  async checkRequirements(characterId, item) {
    if (!item.requirements) return true;
    
    const character = await db.get('SELECT * FROM characters WHERE id = ?', [characterId]);
    const requirements = JSON.parse(item.requirements);
    
    // Проверяем уровень
    if (requirements.level && character.level < requirements.level) {
      throw new Error(`Требуется ${requirements.level} уровень (у вас ${character.level})`);
    }
    
    // Проверяем класс
    if (requirements.class && character.class !== requirements.class) {
      throw new Error(`Только для класса ${requirements.class}`);
    }
    
    // Проверяем характеристики
    const stats = ['strength', 'dexterity', 'intelligence', 'wisdom', 'constitution', 'charisma'];
    for (const stat of stats) {
      if (requirements[stat] && character[stat] < requirements[stat]) {
        const statNames = {
          strength: 'Сила',
          dexterity: 'Ловкость',
          intelligence: 'Интеллект',
          wisdom: 'Мудрость',
          constitution: 'Телосложение',
          charisma: 'Харизма'
        };
        throw new Error(`Требуется ${statNames[stat]} ${requirements[stat]} (у вас ${character[stat]})`);
      }
    }
    
    return true;
  }

  // Рассчитать общие бонусы от экипировки
  async calculateEquipmentBonuses(characterId) {
    const equipment = await this.getEquipment(characterId);
    const bonuses = {
      stats: {
        strength: 0,
        dexterity: 0,
        intelligence: 0,
        wisdom: 0,
        constitution: 0,
        charisma: 0
      },
      combat: {
        damage: 0,
        defense: 0,
        hp_max: 0,
        mp_max: 0
      },
      resistances: {},
      special: []
    };
    
    for (const [slot, item] of Object.entries(equipment)) {
      if (item.stats_bonus) {
        // Суммируем бонусы к характеристикам
        for (const [stat, value] of Object.entries(item.stats_bonus)) {
          if (bonuses.stats[stat] !== undefined) {
            bonuses.stats[stat] += value;
          } else if (bonuses.combat[stat] !== undefined) {
            bonuses.combat[stat] += value;
          } else if (stat.includes('resistance')) {
            bonuses.resistances[stat] = (bonuses.resistances[stat] || 0) + value;
          } else if (stat === 'all_stats') {
            // Бонус ко всем характеристикам
            for (const s of Object.keys(bonuses.stats)) {
              bonuses.stats[s] += value;
            }
          } else {
            // Специальные эффекты
            bonuses.special.push({ stat, value, item: item.name });
          }
        }
      }
    }
    
    return bonuses;
  }

  // Отслеживание статистики использования
  async trackItemUsage(itemId, action) {
    const column = `times_${action}`;
    
    // Проверяем, есть ли запись
    const exists = await db.get('SELECT 1 FROM item_statistics WHERE item_id = ?', [itemId]);
    
    if (!exists) {
      await db.run('INSERT INTO item_statistics (item_id) VALUES (?)', [itemId]);
    }
    
    await db.run(
      `UPDATE item_statistics SET ${column} = ${column} + 1 WHERE item_id = ?`,
      [itemId]
    );
  }

  // Получить полную информацию об экипировке для отображения
  async getEquipmentDisplay(characterId) {
    const equipment = await this.getEquipment(characterId);
    const bonuses = await this.calculateEquipmentBonuses(characterId);
    
    let display = '🛡️ **Экипировка:**\n\n';
    
    // Отображаем каждый слот
    for (const [slotKey, slotInfo] of Object.entries(this.slots)) {
      const item = equipment[slotKey];
      if (item) {
        const rarityEmoji = this.getRarityEmoji(item.rarity);
        display += `**${slotInfo.name}:** ${rarityEmoji} ${item.name}\n`;
      } else {
        display += `**${slotInfo.name}:** _пусто_\n`;
      }
    }
    
    // Отображаем общие бонусы
    display += '\n📊 **Бонусы от экипировки:**\n';
    
    // Характеристики
    const hasStatBonuses = Object.values(bonuses.stats).some(v => v !== 0);
    if (hasStatBonuses) {
      display += '\n**Характеристики:**\n';
      for (const [stat, value] of Object.entries(bonuses.stats)) {
        if (value !== 0) {
          const sign = value > 0 ? '+' : '';
          const statNames = {
            strength: 'Сила',
            dexterity: 'Ловкость',
            intelligence: 'Интеллект',
            wisdom: 'Мудрость',
            constitution: 'Телосложение',
            charisma: 'Харизма'
          };
          display += `• ${statNames[stat]}: ${sign}${value}\n`;
        }
      }
    }
    
    // Боевые параметры
    const hasCombatBonuses = Object.values(bonuses.combat).some(v => v !== 0);
    if (hasCombatBonuses) {
      display += '\n**Боевые параметры:**\n';
      if (bonuses.combat.damage) display += `• Урон: +${bonuses.combat.damage}\n`;
      if (bonuses.combat.defense) display += `• Защита: +${bonuses.combat.defense}\n`;
      if (bonuses.combat.hp_max) display += `• Макс. HP: +${bonuses.combat.hp_max}\n`;
      if (bonuses.combat.mp_max) display += `• Макс. MP: +${bonuses.combat.mp_max}\n`;
    }
    
    // Сопротивления
    if (Object.keys(bonuses.resistances).length > 0) {
      display += '\n**Сопротивления:**\n';
      for (const [resist, value] of Object.entries(bonuses.resistances)) {
        display += `• ${resist}: ${value}%\n`;
      }
    }
    
    // Особые эффекты
    if (bonuses.special.length > 0) {
      display += '\n**Особые эффекты:**\n';
      for (const effect of bonuses.special) {
        display += `• ${effect.stat}: ${effect.value} (${effect.item})\n`;
      }
    }
    
    return display;
  }

  getRarityEmoji(rarity) {
    const emojis = {
      common: '⚪',
      uncommon: '🟢',
      rare: '🔵',
      epic: '🟣',
      legendary: '🟠'
    };
    return emojis[rarity] || '⚪';
  }
}

module.exports = new EquipmentSystem();