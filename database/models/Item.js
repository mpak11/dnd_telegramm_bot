// Модель предметов

const db = require('../index');
const config = require('../../config/config');

class Item {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.type = data.type;
    this.rarity = data.rarity;
    this.effects = data.effects ? JSON.parse(data.effects) : {};
    this.requirements = data.requirements ? JSON.parse(data.requirements) : null;
    this.value_gold = data.value_gold;
    this.is_unique = data.is_unique;
  }

  // Найти предмет по ID
  static async findById(id) {
    const data = await db.get('SELECT * FROM items WHERE id = ?', [id]);
    return data ? new Item(data) : null;
  }

  // Найти все предметы
  static async findAll() {
    const items = await db.all('SELECT * FROM items ORDER BY rarity DESC, name');
    return items.map(item => new Item(item));
  }

  // Найти предметы по типу
  static async findByType(type) {
    const items = await db.all(
      'SELECT * FROM items WHERE type = ? ORDER BY rarity DESC, name',
      [type]
    );
    return items.map(item => new Item(item));
  }

  // Найти предметы по редкости
  static async findByRarity(rarity) {
    const items = await db.all(
      'SELECT * FROM items WHERE rarity = ? ORDER BY name',
      [rarity]
    );
    return items.map(item => new Item(item));
  }

  // Получить случайный предмет для награды
  static async getRandomLoot(difficulty, excludeLegendary = true) {
    // Веса выпадения в зависимости от сложности
    const lootTables = {
      easy: { common: 80, uncommon: 20, rare: 0, epic: 0, legendary: 0 },
      medium: { common: 50, uncommon: 35, rare: 15, epic: 0, legendary: 0 },
      hard: { common: 30, uncommon: 40, rare: 25, epic: 5, legendary: 0 },
      legendary: { common: 10, uncommon: 25, rare: 35, epic: 25, legendary: 5 }
    };

    const weights = lootTables[difficulty];
    if (!weights) return null;

    // Исключаем легендарные если нужно
    if (excludeLegendary) {
      weights.legendary = 0;
    }

    // Выбираем редкость
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    let selectedRarity = 'common';

    for (const [rarity, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        selectedRarity = rarity;
        break;
      }
    }

    // Получаем предметы этой редкости (исключая уникальные)
    const items = await db.all(
      'SELECT * FROM items WHERE rarity = ? AND is_unique = 0',
      [selectedRarity]
    );

    if (items.length === 0) return null;

    // Выбираем случайный
    const randomItem = items[Math.floor(Math.random() * items.length)];
    return new Item(randomItem);
  }

  // Проверить, может ли персонаж использовать предмет
  canBeUsedBy(character) {
    if (!this.requirements) return true;

    // Проверяем уровень
    if (this.requirements.level && character.level < this.requirements.level) {
      return false;
    }

    // Проверяем класс
    if (this.requirements.class && character.class !== this.requirements.class) {
      return false;
    }

    // Проверяем характеристики
    for (const [stat, value] of Object.entries(this.requirements)) {
      if (stat !== 'level' && stat !== 'class' && character[stat] < value) {
        return false;
      }
    }

    return true;
  }

  // Проверить, доступен ли уникальный предмет в чате
  static async isUniqueAvailable(itemId, chatId) {
    const existing = await db.get(
      'SELECT * FROM unique_items WHERE item_id = ? AND chat_id = ?',
      [itemId, chatId]
    );
    return !existing;
  }

  // Зарегистрировать уникальный предмет
  static async registerUnique(itemId, chatId, characterId) {
    await db.run(
      'INSERT INTO unique_items (item_id, chat_id, owner_character_id) VALUES (?, ?, ?)',
      [itemId, chatId, characterId]
    );
  }

  // Передать уникальный предмет
  static async transferUnique(itemId, chatId, newCharacterId) {
    await db.run(
      'UPDATE unique_items SET owner_character_id = ? WHERE item_id = ? AND chat_id = ?',
      [newCharacterId, itemId, chatId]
    );
  }

  // Форматирование для отображения
  getDisplay() {
    const rarityConfig = config.ITEM_RARITY[this.rarity.toUpperCase()];
    const typeEmoji = {
      weapon: '⚔️',
      armor: '🛡️',
      consumable: '🧪',
      misc: '📦',
      artifact: '💎'
    };

    return `${typeEmoji[this.type] || '❓'} ${rarityConfig.emoji} **${this.name}**`;
  }

  getFullDisplay() {
    let display = this.getDisplay() + '\n';
    display += `_${this.description}_\n`;
    
    // Эффекты
    if (Object.keys(this.effects).length > 0) {
      display += '\n**Эффекты:**\n';
      for (const [effect, value] of Object.entries(this.effects)) {
        display += `• ${this.formatEffect(effect, value)}\n`;
      }
    }

    // Требования
    if (this.requirements) {
      display += '\n**Требования:**\n';
      for (const [req, value] of Object.entries(this.requirements)) {
        display += `• ${this.formatRequirement(req, value)}\n`;
      }
    }

    display += `\n💰 Стоимость: ${this.value_gold} золота`;

    return display;
  }

  formatEffect(effect, value) {
    const effectNames = {
      hp: 'Здоровье',
      mp: 'Мана',
      damage: 'Урон',
      defense: 'Защита',
      strength: 'Сила',
      dexterity: 'Ловкость',
      intelligence: 'Интеллект',
      wisdom: 'Мудрость',
      constitution: 'Телосложение',
      charisma: 'Харизма',
      hp_max: 'Макс. здоровье',
      all_stats: 'Все характеристики',
      fire_damage: 'Урон огнем'
    };

    const sign = value > 0 ? '+' : '';
    return `${effectNames[effect] || effect}: ${sign}${value}`;
  }

  formatRequirement(req, value) {
    if (req === 'level') return `Уровень ${value}`;
    if (req === 'class') {
      const classConfig = config.CLASSES[value];
      return `Класс: ${classConfig.name}`;
    }
    
    const statConfig = config.STATS[req];
    if (statConfig) {
      return `${statConfig.name}: ${value}`;
    }
    
    return `${req}: ${value}`;
  }
}

module.exports = Item;