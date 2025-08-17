// Главный класс персонажа

const db = require("../../index");
const config = require("../../../config/config");

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

  // Добавить золото (базовый метод остается здесь)
  async addGold(amount) {
    this.gold = Math.max(0, this.gold + amount);
    await db.run("UPDATE characters SET gold = ? WHERE id = ?", [
      this.gold,
      this.id,
    ]);
  }

  // Удалить персонажа (деактивировать)
  async delete() {
    await db.run("UPDATE characters SET is_active = 0 WHERE id = ?", [this.id]);
  }
}

// Функция для копирования методов
function copyMethods(target, source) {
  Object.getOwnPropertyNames(source.prototype).forEach(name => {
    if (name !== 'constructor') {
      const descriptor = Object.getOwnPropertyDescriptor(source.prototype, name);
      Object.defineProperty(target.prototype, name, descriptor);
    }
  });
}

// Импортируем и применяем миксины
const CharacterStats = require('./CharacterStats');
const CharacterInventory = require('./CharacterInventory');
const CharacterCombat = require('./CharacterCombat');
const CharacterProgression = require('./CharacterProgression');
const CharacterDisplay = require('./CharacterDisplay');

// Копируем методы
copyMethods(Character, CharacterStats);
copyMethods(Character, CharacterInventory);
copyMethods(Character, CharacterCombat);
copyMethods(Character, CharacterProgression);
copyMethods(Character, CharacterDisplay);

// Применяем статические методы
const CharacterFactory = require('./CharacterFactory');
Character.create = CharacterFactory.create;
Character.rollStats = CharacterFactory.rollStats;
Character.findActive = CharacterFactory.findActive;
Character.findById = CharacterFactory.findById;
Character.findActiveAlive = CharacterFactory.findActiveAlive;
Character.findLast = CharacterFactory.findLast;

// Статический метод getStatModifier из CharacterStats
Character.getStatModifier = CharacterStats.getStatModifier;

module.exports = Character;