// database/seeders/items.js
// Заполнение базы данных базовыми предметами

const db = require('../index');

async function seedItems() {
  console.log('🌱 Заполнение базы данных предметами...');

  // Расходники
  const consumables = [
    // Обычные
    {
      name: 'Малое зелье лечения',
      description: 'Восстанавливает небольшое количество здоровья',
      type: 'consumable',
      rarity: 'common',
      effects: JSON.stringify({ hp: 20 }),
      value_gold: 25,
      weight: 0.5
    },
    {
      name: 'Хлеб',
      description: 'Простая еда, восстанавливает немного здоровья',
      type: 'consumable',
      rarity: 'common',
      effects: JSON.stringify({ hp: 10 }),
      value_gold: 5,
      weight: 0.2
    },
    {
      name: 'Бинты',
      description: 'Грубые бинты для перевязки ран',
      type: 'consumable',
      rarity: 'common',
      effects: JSON.stringify({ hp: 15 }),
      value_gold: 10,
      weight: 0.1
    },
    
    // Необычные
    {
      name: 'Зелье лечения',
      description: 'Восстанавливает среднее количество здоровья',
      type: 'consumable',
      rarity: 'uncommon',
      effects: JSON.stringify({ hp: 50 }),
      value_gold: 75,
      weight: 0.5
    },
    {
      name: 'Зелье силы',
      description: 'Временно увеличивает силу',
      type: 'consumable',
      rarity: 'uncommon',
      effects: JSON.stringify({ strength: 2, duration: 2 }),
      value_gold: 100,
      weight: 0.5
    },
    {
      name: 'Зелье ловкости',
      description: 'Временно увеличивает ловкость',
      type: 'consumable',
      rarity: 'uncommon',
      effects: JSON.stringify({ dexterity: 2, duration: 2 }),
      value_gold: 100,
      weight: 0.5
    },
    {
      name: 'Противоядие',
      description: 'Излечивает от большинства ядов',
      type: 'consumable',
      rarity: 'uncommon',
      effects: JSON.stringify({ cure_poison: true }),
      value_gold: 50,
      weight: 0.3
    },
    
    // Редкие
    {
      name: 'Большое зелье лечения',
      description: 'Восстанавливает большое количество здоровья',
      type: 'consumable',
      rarity: 'rare',
      effects: JSON.stringify({ hp: 100 }),
      value_gold: 200,
      weight: 0.5
    },
    {
      name: 'Эликсир выносливости',
      description: 'Увеличивает максимальное здоровье на время',
      type: 'consumable',
      rarity: 'rare',
      effects: JSON.stringify({ hp_max: 20, duration: 4 }),
      value_gold: 300,
      weight: 0.5
    },
    {
      name: 'Зелье невидимости',
      description: 'Делает невидимым на короткое время',
      type: 'consumable',
      rarity: 'rare',
      effects: JSON.stringify({ invisibility: 10 }),
      value_gold: 500,
      weight: 0.3
    }
  ];

  // Базовое оружие
  const weapons = [
    // Обычное
    {
      name: 'Ржавый меч',
      description: 'Старый меч, покрытый ржавчиной',
      type: 'weapon',
      rarity: 'common',
      slot_type: 'weapon_main',
      weapon_type: 'slash',
      stats_bonus: JSON.stringify({ damage: 0 }),
      value_gold: 10,
      weight: 3,
      is_two_handed: 0
    },
    {
      name: 'Простой кинжал',
      description: 'Небольшой кинжал для ближнего боя',
      type: 'weapon',
      rarity: 'common',
      slot_type: 'weapon_main',
      weapon_type: 'pierce',
      stats_bonus: JSON.stringify({ damage: 0 }),
      value_gold: 5,
      weight: 1,
      is_two_handed: 0
    },
    {
      name: 'Дубина',
      description: 'Грубо обработанная деревянная дубина',
      type: 'weapon',
      rarity: 'common',
      slot_type: 'weapon_main',
      weapon_type: 'blunt',
      stats_bonus: JSON.stringify({ damage: 0 }),
      value_gold: 8,
      weight: 4,
      is_two_handed: 0
    },
    
    // Необычное
    {
      name: 'Стальной меч',
      description: 'Хорошо сбалансированный стальной меч',
      type: 'weapon',
      rarity: 'uncommon',
      slot_type: 'weapon_main',
      weapon_type: 'slash',
      stats_bonus: JSON.stringify({ damage: 2 }),
      value_gold: 50,
      weight: 3.5,
      is_two_handed: 0
    },
    {
      name: 'Боевой топор',
      description: 'Тяжелый топор для рубящих ударов',
      type: 'weapon',
      rarity: 'uncommon',
      slot_type: 'weapon_main',
      weapon_type: 'slash',
      stats_bonus: JSON.stringify({ damage: 3 }),
      value_gold: 60,
      weight: 5,
      is_two_handed: 0
    },
    {
      name: 'Короткий лук',
      description: 'Легкий лук для стрельбы на средние дистанции',
      type: 'weapon',
      rarity: 'uncommon',
      slot_type: 'weapon_main',
      weapon_type: 'ranged',
      stats_bonus: JSON.stringify({ damage: 1, dexterity: 1 }),
      value_gold: 75,
      weight: 2,
      is_two_handed: 1
    },
    
    // Редкое
    {
      name: 'Пылающий меч',
      description: 'Меч, лезвие которого охвачено магическим пламенем',
      type: 'weapon',
      rarity: 'rare',
      slot_type: 'weapon_main',
      weapon_type: 'slash',
      stats_bonus: JSON.stringify({ damage: 4, fire_damage: 2 }),
      requirements: JSON.stringify({ level: 5 }),
      value_gold: 300,
      weight: 3.5,
      is_two_handed: 0
    },
    {
      name: 'Морозный клинок',
      description: 'Клинок, покрытый вечным льдом',
      type: 'weapon',
      rarity: 'rare',
      slot_type: 'weapon_main',
      weapon_type: 'slash',
      stats_bonus: JSON.stringify({ damage: 4, ice_damage: 2 }),
      requirements: JSON.stringify({ level: 5 }),
      value_gold: 300,
      weight: 3.5,
      is_two_handed: 0
    }
  ];

  // Базовая броня
  const armors = [
    // Обычная
    {
      name: 'Потрепанная кожаная броня',
      description: 'Старая кожаная броня со следами износа',
      type: 'armor',
      rarity: 'common',
      slot_type: 'armor',
      armor_type: 'light',
      stats_bonus: JSON.stringify({ defense: 1 }),
      value_gold: 15,
      weight: 5
    },
    {
      name: 'Тканевая роба',
      description: 'Простая роба из грубой ткани',
      type: 'armor',
      rarity: 'common',
      slot_type: 'armor',
      armor_type: 'light',
      stats_bonus: JSON.stringify({ defense: 0, intelligence: 1 }),
      value_gold: 10,
      weight: 2
    },
    
    // Необычная
    {
      name: 'Укрепленная кожаная броня',
      description: 'Кожаная броня с металлическими заклепками',
      type: 'armor',
      rarity: 'uncommon',
      slot_type: 'armor',
      armor_type: 'light',
      stats_bonus: JSON.stringify({ defense: 3 }),
      value_gold: 75,
      weight: 8
    },
    {
      name: 'Кольчуга',
      description: 'Броня из переплетенных металлических колец',
      type: 'armor',
      rarity: 'uncommon',
      slot_type: 'armor',
      armor_type: 'medium',
      stats_bonus: JSON.stringify({ defense: 5 }),
      requirements: JSON.stringify({ strength: 12 }),
      value_gold: 150,
      weight: 20
    },
    
    // Редкая
    {
      name: 'Чешуйчатая броня дракона',
      description: 'Броня, сделанная из чешуи дракона',
      type: 'armor',
      rarity: 'rare',
      slot_type: 'armor',
      armor_type: 'medium',
      stats_bonus: JSON.stringify({ defense: 7, fire_resistance: 25 }),
      requirements: JSON.stringify({ level: 6, strength: 14 }),
      value_gold: 500,
      weight: 25
    }
  ];

  // Аксессуары
  const accessories = [
    // Щиты
    {
      name: 'Деревянный щит',
      description: 'Простой щит из дерева',
      type: 'shield',
      rarity: 'common',
      slot_type: 'weapon_off',
      stats_bonus: JSON.stringify({ defense: 2, block_chance: 10 }),
      value_gold: 20,
      weight: 5
    },
    {
      name: 'Железный щит',
      description: 'Прочный щит из железа',
      type: 'shield',
      rarity: 'uncommon',
      slot_type: 'weapon_off',
      stats_bonus: JSON.stringify({ defense: 4, block_chance: 15 }),
      value_gold: 100,
      weight: 10
    },
    
    // Головные уборы
    {
      name: 'Кожаный капюшон',
      description: 'Капюшон из мягкой кожи',
      type: 'accessory',
      rarity: 'common',
      slot_type: 'head',
      stats_bonus: JSON.stringify({ defense: 1 }),
      value_gold: 10,
      weight: 0.5
    },
    {
      name: 'Железный шлем',
      description: 'Простой шлем из железа',
      type: 'accessory',
      rarity: 'uncommon',
      slot_type: 'head',
      stats_bonus: JSON.stringify({ defense: 2 }),
      value_gold: 50,
      weight: 3
    },
    {
      name: 'Колпак мага',
      description: 'Остроконечный колпак, усиливающий магию',
      type: 'accessory',
      rarity: 'uncommon',
      slot_type: 'head',
      stats_bonus: JSON.stringify({ intelligence: 2, wisdom: 1 }),
      value_gold: 75,
      weight: 0.3
    },
    
    // Перчатки
    {
      name: 'Кожаные перчатки',
      description: 'Простые перчатки из кожи',
      type: 'accessory',
      rarity: 'common',
      slot_type: 'gloves',
      stats_bonus: JSON.stringify({ dexterity: 1 }),
      value_gold: 15,
      weight: 0.2
    },
    {
      name: 'Перчатки силы',
      description: 'Зачарованные перчатки, увеличивающие силу',
      type: 'accessory',
      rarity: 'rare',
      slot_type: 'gloves',
      stats_bonus: JSON.stringify({ strength: 3 }),
      value_gold: 200,
      weight: 0.5
    },
    
    // Сапоги
    {
      name: 'Кожаные сапоги',
      description: 'Удобные сапоги для путешествий',
      type: 'accessory',
      rarity: 'common',
      slot_type: 'boots',
      stats_bonus: JSON.stringify({ dexterity: 1 }),
      value_gold: 20,
      weight: 1
    },
    {
      name: 'Сапоги скорости',
      description: 'Легкие сапоги, увеличивающие скорость',
      type: 'accessory',
      rarity: 'uncommon',
      slot_type: 'boots',
      stats_bonus: JSON.stringify({ dexterity: 2 }),
      value_gold: 100,
      weight: 0.8
    },
    
    // Плащи
    {
      name: 'Дорожный плащ',
      description: 'Плотный плащ для защиты от непогоды',
      type: 'accessory',
      rarity: 'common',
      slot_type: 'cloak',
      stats_bonus: JSON.stringify({ defense: 1 }),
      value_gold: 15,
      weight: 2
    },
    {
      name: 'Плащ невидимости',
      description: 'Магический плащ, скрывающий владельца',
      type: 'accessory',
      rarity: 'rare',
      slot_type: 'cloak',
      stats_bonus: JSON.stringify({ dexterity: 2, stealth: 20 }),
      requirements: JSON.stringify({ level: 5 }),
      value_gold: 400,
      weight: 1
    },
    
    // Сумки
    {
      name: 'Холщовая сумка',
      description: 'Простая сумка для переноски вещей',
      type: 'accessory',
      rarity: 'common',
      slot_type: 'bag',
      stats_bonus: JSON.stringify({ carry_capacity: 20 }),
      value_gold: 25,
      weight: 1
    },
    {
      name: 'Рюкзак путешественника',
      description: 'Вместительный рюкзак для дальних путешествий',
      type: 'accessory',
      rarity: 'uncommon',
      slot_type: 'bag',
      stats_bonus: JSON.stringify({ carry_capacity: 50 }),
      value_gold: 100,
      weight: 2
    }
  ];

  // Легендарные предметы (уникальные)
  const legendaryItems = [
    {
      name: 'Экскалибур',
      description: 'Легендарный меч короля Артура, сияющий божественным светом',
      type: 'weapon',
      rarity: 'legendary',
      slot_type: 'weapon_main',
      weapon_type: 'slash',
      stats_bonus: JSON.stringify({ 
        damage: 10, 
        all_stats: 2, 
        holy_damage: 5,
        leadership: true 
      }),
      requirements: JSON.stringify({ level: 10, alignment: 'good' }),
      value_gold: 10000,
      weight: 4,
      is_two_handed: 0,
      is_unique: 1
    },
    {
      name: 'Посох Архимага',
      description: 'Древний посох первого архимага, пульсирующий чистой магической энергией',
      type: 'weapon',
      rarity: 'legendary',
      slot_type: 'weapon_main',
      weapon_type: 'magic',
      stats_bonus: JSON.stringify({ 
        damage: 5,
        intelligence: 5,
        wisdom: 5,
        mp_max: 100,
        spell_power: 50
      }),
      requirements: JSON.stringify({ level: 10, class: 'MAGE' }),
      value_gold: 15000,
      weight: 3,
      is_two_handed: 1,
      is_unique: 1
    },
    {
      name: 'Броня Непобедимого',
      description: 'Мифическая броня, выкованная богами для защиты избранного героя',
      type: 'armor',
      rarity: 'legendary',
      slot_type: 'armor',
      armor_type: 'heavy',
      stats_bonus: JSON.stringify({ 
        defense: 15,
        all_stats: 3,
        damage_reduction: 5,
        immunity: 'critical'
      }),
      requirements: JSON.stringify({ level: 10, strength: 18 }),
      value_gold: 20000,
      weight: 30,
      is_unique: 1
    },
    {
      name: 'Кольцо Всевластия',
      description: 'Единое кольцо, способное подчинять волю других',
      type: 'accessory',
      rarity: 'legendary',
      slot_type: 'ring',
      stats_bonus: JSON.stringify({ 
        all_stats: 5,
        invisibility: true,
        corruption: 1
      }),
      requirements: JSON.stringify({ level: 8 }),
      value_gold: 50000,
      weight: 0.1,
      is_unique: 1
    }
  ];

  // Вставляем все предметы
  const allItems = [
    ...consumables,
    ...weapons,
    ...armors,
    ...accessories,
    ...legendaryItems
  ];

  let inserted = 0;
  
  for (const item of allItems) {
    try {
      // Проверяем, нет ли уже такого предмета
      const existing = await db.get(
        'SELECT id FROM items WHERE name = ?',
        [item.name]
      );
      
      if (!existing) {
        await db.run(
          `INSERT INTO items (
            name, description, type, rarity, effects, requirements, 
            value_gold, slot_type, weight, is_two_handed, weapon_type, 
            armor_type, stats_bonus, is_unique
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.name,
            item.description,
            item.type,
            item.rarity,
            item.effects || null,
            item.requirements || null,
            item.value_gold,
            item.slot_type || null,
            item.weight || 0,
            item.is_two_handed || 0,
            item.weapon_type || null,
            item.armor_type || null,
            item.stats_bonus || null,
            item.is_unique || 0
          ]
        );
        inserted++;
      }
    } catch (error) {
      console.error(`Ошибка при вставке предмета ${item.name}:`, error.message);
    }
  }

  console.log(`✅ Вставлено ${inserted} новых предметов`);

  // Заполняем инвентарь торговца базовыми расходниками
  const merchant = await db.get('SELECT id FROM merchants WHERE id = 1');
  if (merchant) {
    console.log('🏪 Заполнение инвентаря торговца...');
    
    // Добавляем все расходники обычной и необычной редкости
    const shopItems = await db.all(
      `SELECT id FROM items 
       WHERE type = 'consumable' AND rarity IN ('common', 'uncommon')
       AND id NOT IN (SELECT item_id FROM merchant_inventory WHERE merchant_id = 1)`
    );
    
    for (const item of shopItems) {
      await db.run(
        'INSERT INTO merchant_inventory (merchant_id, item_id, quantity) VALUES (?, ?, ?)',
        [1, item.id, -1] // -1 = бесконечное количество
      );
    }
    
    console.log(`✅ Добавлено ${shopItems.length} товаров в магазин`);
  }
}

// Если файл запущен напрямую
if (require.main === module) {
  seedItems()
    .then(() => {
      console.log('✅ Заполнение базы данных завершено!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Ошибка:', error);
      process.exit(1);
    });
}

module.exports = seedItems;