// utils/itemGenerator.js
// Продвинутый генератор предметов с характеристиками и описаниями

const config = require("../config/config");

class ItemGenerator {
  constructor() {
    // Префиксы для названий предметов
    this.prefixes = {
      common: ["Простой", "Обычный", "Старый", "Потертый", "Ученический"],
      uncommon: [
        "Качественный",
        "Прочный",
        "Закаленный",
        "Искусный",
        "Мастерский",
      ],
      rare: [
        "Редкий",
        "Превосходный",
        "Зачарованный",
        "Усиленный",
        "Благословенный",
      ],
      epic: [
        "Эпический",
        "Героический",
        "Легендарный",
        "Древний",
        "Могущественный",
      ],
      legendary: [
        "Божественный",
        "Мифический",
        "Артефактный",
        "Уникальный",
        "Священный",
      ],
    };

    // Базовые типы оружия
    this.weaponTypes = {
      // Одноручное
      sword: { name: "Меч", damage: "1d8", type: "slash", twoHanded: false },
      axe: { name: "Топор", damage: "1d8", type: "slash", twoHanded: false },
      mace: { name: "Булава", damage: "1d6", type: "blunt", twoHanded: false },
      dagger: {
        name: "Кинжал",
        damage: "1d4",
        type: "pierce",
        twoHanded: false,
      },
      shortsword: {
        name: "Короткий меч",
        damage: "1d6",
        type: "pierce",
        twoHanded: false,
      },
      spear: {
        name: "Копье",
        damage: "1d8",
        type: "pierce",
        twoHanded: false,
        reach: true,
      },
      whip: {
        name: "Кнут",
        damage: "1d4",
        type: "slash",
        twoHanded: false,
        finesse: true,
      },
      wand: {
        name: "Жезл",
        damage: "1d4",
        type: "magic",
        twoHanded: false,
        spellFocus: true,
      },

      // Двуручное
      greatsword: {
        name: "Двуручный меч",
        damage: "2d6",
        type: "slash",
        twoHanded: true,
      },
      greataxe: {
        name: "Секира",
        damage: "1d12",
        type: "slash",
        twoHanded: true,
      },
      staff: {
        name: "Посох",
        damage: "1d6",
        type: "blunt",
        twoHanded: true,
        spellFocus: true,
      },
      halberd: {
        name: "Алебарда",
        damage: "1d10",
        type: "slash",
        twoHanded: true,
        reach: true,
      },

      // Дальнобойное
      bow: { name: "Лук", damage: "1d8", type: "ranged", twoHanded: true },
      crossbow: {
        name: "Арбалет",
        damage: "1d10",
        type: "ranged",
        twoHanded: true,
      },
      sling: { name: "Праща", damage: "1d4", type: "ranged", twoHanded: false },
    };

    // Базовые типы брони
    this.armorTypes = {
      cloth: { name: "Тканевая броня", defense: 1, weight: "light" },
      leather: { name: "Кожаная броня", defense: 2, weight: "light" },
      studded: { name: "Клепаная броня", defense: 3, weight: "medium" },
      chainmail: { name: "Кольчуга", defense: 5, weight: "medium" },
      plate: { name: "Латы", defense: 8, weight: "heavy" },
    };

    // Типы аксессуаров
    this.accessoryTypes = {
      cloak: ["Плащ", "Мантия", "Накидка"],
      head: ["Шлем", "Корона", "Капюшон", "Шапка", "Диадема"],
      gloves: ["Перчатки", "Рукавицы", "Наручи"],
      boots: ["Сапоги", "Ботинки", "Поножи"],
      shield: ["Щит", "Баклер", "Павеза"],
      ring: ["Кольцо", "Перстень", "Печатка"],
      amulet: ["Амулет", "Медальон", "Талисман"],
      belt: ["Пояс", "Кушак", "Ремень"],
      trinket: ["Безделушка", "Талисман", "Фигурка"],
    };

    // Материалы для генерации
    this.materials = {
      common: ["железо", "бронза", "медь", "дерево", "кость"],
      uncommon: ["сталь", "серебро", "закаленная кожа", "дубовое дерево"],
      rare: ["мифрил", "адамантин", "драконья кожа", "эльфийская сталь"],
      epic: ["титан", "орихалк", "звездный металл", "кристалл душ"],
      legendary: [
        "божественная сталь",
        "металл пустоты",
        "сплав вечности",
        "первородный камень",
      ],
    };

    this.uniqueLegendaryItems = [
      {
        name: "Клинок Скорби",
        description:
          "Этот меч жаждет крови и медленно поглощает душу владельца",
        type: "weapon",
        rarity: "legendary",
        slot_type: "weapon_main",
        weapon_type: "slash",
        stats_bonus: {
          damage: 15,
          lifesteal: 0.3,
          curse: true,
          hp_drain: -1, // -1 HP в час
        },
        requirements: {
          level: 8,
          alignment: "evil",
        },
        value_gold: 0, // нельзя продать
        weight: 6,
        is_two_handed: 0,
        is_unique: 1,
      },
      {
        name: "Сфера Исцеления",
        description: "Древний артефакт, излучающий целительную ауру",
        type: "accessory",
        rarity: "legendary",
        slot_type: "trinket",
        stats_bonus: {
          wisdom: 5,
          party_heal: 5, // лечит всю группу
          aura_radius: 10,
          mp_regen: 5,
        },
        requirements: {
          level: 10,
          class: "CLERIC",
        },
        value_gold: 25000,
        weight: 2,
        is_unique: 1,
      },
      {
        name: "Кольцо Трех Желаний",
        description: "Исполняет желания, но требует огромную цену",
        type: "accessory",
        rarity: "legendary",
        slot_type: "ring",
        stats_bonus: {
          all_stats: 3,
          wish_charges: 3,
          curse: true,
        },
        requirements: {
          level: 9,
        },
        value_gold: 100000,
        weight: 0.1,
        is_unique: 1,
      },
    ];

    // Зачарования
    this.enchantments = {
      weapon: {
        common: [
          { name: "Острый", stats: { damage: 1 } },
          { name: "Сбалансированный", stats: { accuracy: 1 } },
        ],
        uncommon: [
          { name: "Пламенный", stats: { damage: 2, fire_damage: 1 } },
          { name: "Ледяной", stats: { damage: 2, ice_damage: 1 } },
          { name: "Кровожадный", stats: { damage: 3, lifesteal: 0.1 } },
        ],
        rare: [
          {
            name: "Убийца драконов",
            stats: { damage: 5, dragon_slayer: true },
          },
          { name: "Святой", stats: { damage: 4, holy_damage: 3 } },
          { name: "Проклятый", stats: { damage: 6, cursed: true } },
        ],
        epic: [
          { name: "Разрушитель", stats: { damage: 8, armor_penetration: 50 } },
          { name: "Вампирский", stats: { damage: 6, lifesteal: 0.25 } },
        ],
        legendary: [
          {
            name: "Божественный",
            stats: { damage: 10, all_stats: 2, holy_damage: 5 },
          },
          { name: "Хаоса", stats: { damage: 12, random_damage: "1d12" } },
        ],
      },
      armor: {
        common: [
          { name: "Укрепленный", stats: { defense: 1 } },
          { name: "Легкий", stats: { dexterity: 1 } },
        ],
        uncommon: [
          { name: "Стойкий", stats: { defense: 2, constitution: 1 } },
          { name: "Магический", stats: { defense: 1, intelligence: 2 } },
        ],
        rare: [
          { name: "Драконий", stats: { defense: 4, fire_resistance: 50 } },
          { name: "Теневой", stats: { defense: 3, stealth: 20 } },
        ],
        epic: [
          { name: "Непробиваемый", stats: { defense: 6, damage_reduction: 2 } },
          { name: "Регенерирующий", stats: { defense: 5, hp_regen: 2 } },
        ],
        legendary: [
          {
            name: "Непобедимого",
            stats: { defense: 10, all_stats: 2, immunity: "physical" },
          },
        ],
      },
      accessory: {
        common: [
          { name: "Прочный", stats: { hp_max: 5 } },
          { name: "Ловкий", stats: { dexterity: 1 } },
        ],
        uncommon: [
          { name: "Мудрый", stats: { wisdom: 2, mp_max: 10 } },
          { name: "Силы", stats: { strength: 2 } },
        ],
        rare: [
          { name: "Героический", stats: { all_stats: 1 } },
          { name: "Защитный", stats: { defense: 2, magic_resistance: 20 } },
        ],
        epic: [
          { name: "Титана", stats: { strength: 3, constitution: 3 } },
          { name: "Архимага", stats: { intelligence: 4, mp_max: 50 } },
        ],
        legendary: [
          {
            name: "Божества",
            stats: { all_stats: 3, divine_protection: true },
          },
        ],
      },
    };
  }

  // Генерировать случайное оружие
  generateWeapon(rarity = "common", level = 1) {
    const typeKeys = Object.keys(this.weaponTypes);
    const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const weaponBase = this.weaponTypes[typeKey];

    const material = this.getRandomMaterial(rarity);
    const enchantment = this.getRandomEnchantment("weapon", rarity);

    const prefix = this.getRandomPrefix(rarity);
    const name = `${prefix} ${material} ${weaponBase.name}${
      enchantment ? " " + enchantment.name : ""
    }`;

    // Базовые характеристики
    const stats = {
      damage: weaponBase.damage,
      damage_bonus: 0,
      ...enchantment?.stats,
    };

    // Увеличиваем урон в зависимости от редкости
    const rarityDamageBonus = {
      common: 0,
      uncommon: 1,
      rare: 2,
      epic: 3,
      legendary: 5,
    };
    stats.damage_bonus = (stats.damage_bonus || 0) + rarityDamageBonus[rarity];

    const weight = weaponBase.twoHanded ? 10 : 5;
    const value =
      this.calculateValue(rarity, level) * (weaponBase.twoHanded ? 1.5 : 1);

    const description = this.generateWeaponDescription(
      weaponBase,
      material,
      enchantment,
      rarity
    );

    return {
      name: name.trim(),
      type: "weapon",
      slot: "weapon_main",
      rarity,
      weight,
      value,
      stats,
      two_handed: weaponBase.twoHanded,
      weapon_type: weaponBase.type,
      description,
      requirements: this.generateRequirements(rarity, level, "weapon"),
    };
  }

  // Генерировать броню
  generateArmor(rarity = "common", level = 1) {
    const typeKeys = Object.keys(this.armorTypes);
    const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const armorBase = this.armorTypes[typeKey];

    const material = this.getRandomMaterial(rarity);
    const enchantment = this.getRandomEnchantment("armor", rarity);

    const prefix = this.getRandomPrefix(rarity);
    const name = `${prefix} ${armorBase.name}${
      enchantment ? " " + enchantment.name : ""
    }`;

    const stats = {
      defense: armorBase.defense,
      ...enchantment?.stats,
    };

    // Увеличиваем защиту в зависимости от редкости
    const rarityDefenseBonus = {
      common: 0,
      uncommon: 1,
      rare: 3,
      epic: 5,
      legendary: 8,
    };
    stats.defense = stats.defense + rarityDefenseBonus[rarity];

    const weight =
      armorBase.weight === "heavy"
        ? 20
        : armorBase.weight === "medium"
        ? 10
        : 5;
    const value = this.calculateValue(rarity, level) * 1.2;

    const description = this.generateArmorDescription(
      armorBase,
      material,
      enchantment,
      rarity
    );

    return {
      name: name.trim(),
      type: "armor",
      slot: "armor",
      rarity,
      weight,
      value,
      stats,
      armor_type: armorBase.weight,
      description,
      requirements: this.generateRequirements(rarity, level, "armor"),
    };
  }

  // Генерировать аксессуар
  generateAccessory(slot, rarity = "common", level = 1) {
    const types = this.accessoryTypes[slot];
    const type = types[Math.floor(Math.random() * types.length)];

    const material = this.getRandomMaterial(rarity);
    const enchantment = this.getRandomEnchantment("accessory", rarity);

    const prefix = this.getRandomPrefix(rarity);
    const name = `${prefix} ${type}${
      enchantment ? " " + enchantment.name : ""
    }`;

    const stats = enchantment?.stats || {};

    // Добавляем бонусы для щита
    if (slot === "shield") {
      stats.defense = (stats.defense || 0) + Math.floor(level / 5) + 2;
      stats.block_chance =
        10 + (rarity === "legendary" ? 15 : rarity === "epic" ? 10 : 5);
    }

    const weight = slot === "shield" ? 8 : 2;
    const value = this.calculateValue(rarity, level);

    const description = this.generateAccessoryDescription(
      type,
      material,
      enchantment,
      rarity
    );

    return {
      name: name.trim(),
      type: slot === "shield" ? "shield" : "accessory",
      slot,
      rarity,
      weight,
      value,
      stats,
      description,
      requirements: this.generateRequirements(rarity, level, "accessory"),
    };
  }

  // Генерировать расходник
  generateConsumable(rarity = "common") {
    const consumables = {
      common: [
        {
          name: "Малое зелье лечения",
          effects: { hp: 20 },
          description: "Восстанавливает 20 HP",
        },
        {
          name: "Слабое зелье маны",
          effects: { mp: 15 },
          description: "Восстанавливает 15 MP",
        },
      ],
      uncommon: [
        {
          name: "Зелье лечения",
          effects: { hp: 50 },
          description: "Восстанавливает 50 HP",
        },
        {
          name: "Зелье силы",
          effects: { strength: 2, duration: 2 },
          description: "+2 к Силе на 2 часа",
        },
        {
          name: "Зелье скорости",
          effects: { dexterity: 2, duration: 2 },
          description: "+2 к Ловкости на 2 часа",
        },
      ],
      rare: [
        {
          name: "Большое зелье лечения",
          effects: { hp: 100 },
          description: "Восстанавливает 100 HP",
        },
        {
          name: "Эликсир героя",
          effects: { all_stats: 1, duration: 4 },
          description: "+1 ко всем характеристикам на 4 часа",
        },
        {
          name: "Зелье невидимости",
          effects: { invisibility: 10 },
          description: "Невидимость на 10 минут",
        },
      ],
      epic: [
        {
          name: "Эликсир полного исцеления",
          effects: { hp_full: true },
          description: "Полностью восстанавливает HP",
        },
        {
          name: "Зелье титана",
          effects: { strength: 5, constitution: 5, duration: 6 },
          description: "+5 к Силе и Телосложению на 6 часов",
        },
      ],
      legendary: [
        {
          name: "Эликсир воскрешения",
          effects: { resurrect: true },
          description: "Воскрешает мертвого персонажа",
        },
        {
          name: "Зелье божественности",
          effects: { all_stats: 3, hp_full: true, mp_full: true },
          description: "Полное восстановление и +3 ко всем характеристикам",
        },
      ],
    };

    const items = consumables[rarity] || consumables.common;
    const item = items[Math.floor(Math.random() * items.length)];

    return {
      ...item,
      type: "consumable",
      rarity,
      weight: 0.5,
      value: this.calculateValue(rarity, 1) * 0.5,
    };
  }

  generateUniqueLegendary() {
    if (this.uniqueLegendaryItems.length === 0) return null;

    const index = Math.floor(Math.random() * this.uniqueLegendaryItems.length);
    const legendary = { ...this.uniqueLegendaryItems[index] };

    // Добавляем уникальный ID для отслеживания
    legendary.unique_id = `legendary_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return legendary;
  }

  // Вспомогательные методы
  getRandomPrefix(rarity) {
    const prefixes = this.prefixes[rarity];
    return prefixes[Math.floor(Math.random() * prefixes.length)];
  }

  getRandomMaterial(rarity) {
    const materials = this.materials[rarity] || this.materials.common;
    return materials[Math.floor(Math.random() * materials.length)];
  }

  getRandomEnchantment(type, rarity) {
    const enchantments = this.enchantments[type]?.[rarity];
    if (!enchantments || Math.random() > this.getEnchantmentChance(rarity)) {
      return null;
    }
    return enchantments[Math.floor(Math.random() * enchantments.length)];
  }

  getEnchantmentChance(rarity) {
    const chances = {
      common: 0.1,
      uncommon: 0.3,
      rare: 0.6,
      epic: 0.9,
      legendary: 1.0,
    };
    return chances[rarity] || 0;
  }

  calculateValue(rarity, level) {
    const baseValues = {
      common: 10,
      uncommon: 50,
      rare: 200,
      epic: 1000,
      legendary: 5000,
    };
    return Math.floor(baseValues[rarity] * (1 + level * 0.1));
  }

  generateRequirements(rarity, level, type) {
    const requirements = {};

    // Уровневые требования
    const levelReqs = {
      common: 1,
      uncommon: Math.max(1, level - 2),
      rare: Math.max(3, level),
      epic: Math.max(5, level + 2),
      legendary: Math.max(8, level + 3),
    };
    requirements.level = levelReqs[rarity];

    // Требования к характеристикам для тяжелого снаряжения
    if (type === "weapon" && rarity !== "common") {
      if (Math.random() > 0.5) {
        requirements.strength = 10 + Math.floor(levelReqs[rarity] / 2);
      }
    }

    if (type === "armor" && ["epic", "legendary"].includes(rarity)) {
      requirements.constitution = 12 + Math.floor(levelReqs[rarity] / 3);
    }

    return requirements;
  }

  // Генерация описаний
  generateWeaponDescription(base, material, enchantment, rarity) {
    let desc = `${base.name} из ${material}.`;

    if (enchantment) {
      const enchantDescs = {
        Острый: "Лезвие заточено до совершенства.",
        Пламенный: "Оружие окутано магическим пламенем.",
        Ледяной: "От оружия веет леденящим холодом.",
        Святой: "Оружие сияет божественным светом.",
        Проклятый: "Темная аура окружает это оружие.",
        Вампирский: "Оружие жаждет крови врагов.",
        Божественный: "Благословение богов лежит на этом оружии.",
        Хаоса: "Оружие пульсирует непредсказуемой энергией.",
      };
      desc += ` ${
        enchantDescs[enchantment.name] || "Оружие зачаровано древней магией."
      }`;
    }

    if (base.twoHanded) {
      desc += " Требует обе руки для использования.";
    }

    return desc;
  }

  generateArmorDescription(base, material, enchantment, rarity) {
    let desc = `${base.name}`;

    if (material && rarity !== "common") {
      desc += ` усилена ${material}`;
    }

    desc += ".";

    if (enchantment) {
      const enchantDescs = {
        Укрепленный: "Дополнительные пластины усиливают защиту.",
        Легкий: "Зачарована для уменьшения веса.",
        Стойкий: "Магия укрепляет владельца.",
        Драконий: "Чешуя дракона вплетена в броню.",
        Теневой: "Броня сливается с тенями.",
        Непробиваемый: "Практически неуязвима для обычного оружия.",
        Непобедимого: "Легендарная броня героев прошлого.",
      };
      desc += ` ${
        enchantDescs[enchantment.name] || "Броня излучает магическую ауру."
      }`;
    }

    return desc;
  }

  generateAccessoryDescription(type, material, enchantment, rarity) {
    let desc = `${type}`;

    if (material && rarity !== "common") {
      desc += ` из ${material}`;
    }

    if (enchantment) {
      desc += `, наделенный магической силой`;
    }

    desc += ".";

    if (type.includes("Щит")) {
      desc += " Может блокировать атаки.";
    }

    return desc;
  }

  // Главный метод генерации
  generateItem(rarity = "common", level = 1, type = null) {
    // Шанс на уникальный легендарный предмет
    if (rarity === "legendary" && Math.random() < 0.3) {
      const unique = this.generateUniqueLegendary();
      if (unique) return unique;
    }

    // Остальная логика остается прежней...
    if (!type) {
      const types = ["weapon", "armor", "accessory", "consumable"];
      const weights = [30, 25, 30, 15]; // Увеличили вес аксессуаров

      let random = Math.random() * 100;
      for (let i = 0; i < types.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          type = types[i];
          break;
        }
      }
    }

    switch (type) {
      case "weapon":
        return this.generateWeapon(rarity, level);

      case "armor":
        return this.generateArmor(rarity, level);

      case "accessory":
        // Расширенный выбор слотов для аксессуаров
        const slots = [
          "cloak",
          "head",
          "gloves",
          "boots",
          "ring",
          "amulet",
          "belt",
          "trinket",
        ];
        const slot = slots[Math.floor(Math.random() * slots.length)];
        return this.generateAccessory(slot, rarity, level);

      case "shield":
        return this.generateAccessory("shield", rarity, level);

      case "consumable":
        return this.generateConsumable(rarity);

      default:
        return this.generateWeapon(rarity, level);
    }
  }
}

module.exports = new ItemGenerator();
