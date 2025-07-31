// Скрипт для добавления новых квестов и предметов
// Использование: node scripts/addContent.js

require('dotenv').config();
const db = require('../database');
const AdminCommands = require('../utils/adminCommands');

async function main() {
  try {
    // Подключаемся к БД
    await db.connect();
    await db.initialize();

    // Примеры новых предметов
    const newItems = [
      {
        name: 'Кольцо невидимости',
        description: 'Делает владельца невидимым на короткое время',
        type: 'misc',
        rarity: 'epic',
        effects: {
          dexterity: 5,
          charisma: -2 // невидимок не любят
        },
        requirements: {
          level: 7
        },
        value_gold: 10000,
        is_unique: 0
      },
      {
        name: 'Молот грома',
        description: 'Легендарное оружие бога грома',
        type: 'weapon',
        rarity: 'legendary',
        effects: {
          damage: 30,
          strength: 8,
          thunder_damage: 10
        },
        requirements: {
          level: 10,
          strength: 18
        },
        value_gold: 100000,
        is_unique: 1 // только один в чате
      }
    ];

    // Примеры новых квестов
    const newQuests = [
      {
        title: 'Турнир гладиаторов',
        description: 'Арена ждет новых чемпионов! Проверка силы!',
        difficulty: 'medium',
        stat_check: 'strength',
        xp_reward: 180,
        gold_reward: 120,
        results: [
          {
            range: '20',
            text: '🏆 ВЫ - НОВЫЙ ЧЕМПИОН! Толпа скандирует ваше имя! Получите титул и легендарное оружие!',
            success: true,
            xp_modifier: 3.0,
            gold_modifier: 10.0,
            effects: { charisma: 3, title: 'Чемпион арены', duration: -1 }
          },
          {
            range: '15-19',
            text: '⚔️ Великолепная победа! Вы в финале турнира!',
            success: true,
            xp_modifier: 2.0,
            gold_modifier: 3.0
          },
          {
            range: '10-14',
            text: '💪 Вы победили, но получили рану (1d6 урона).',
            success: true,
            xp_modifier: 1.0,
            gold_modifier: 1.0,
            damage: '1d6'
          },
          {
            range: '5-9',
            text: '🩸 Противник оказался сильнее. Вы проиграли и ранены (2d6 урона).',
            success: false,
            xp_modifier: 0.5,
            gold_modifier: 0,
            damage: '2d6'
          },
          {
            range: '2-4',
            text: '💀 Вас унесли на носилках. 3d6 урона и позор (-2 к Харизме на неделю).',
            success: false,
            xp_modifier: 0.2,
            gold_modifier: 0,
            damage: '3d6',
            effects: { charisma: -2, duration: 168 }
          },
          {
            range: '1',
            text: '☠️ ФАТАЛИТИ! Вас едва спасли лекари. 4d8 урона и вечный шрам (-1 к Харизме навсегда)!',
            success: false,
            xp_modifier: 0.1,
            gold_modifier: 0,
            damage: '4d8',
            effects: { charisma: -1, duration: -1 }
          }
        ]
      }
    ];

    // Добавляем предметы
    console.log('\n📦 Добавление предметов...');
    for (const item of newItems) {
      try {
        const id = await AdminCommands.addItem(item);
        console.log(`✅ Добавлен: ${item.name} (ID: ${id})`);
      } catch (error) {
        console.error(`❌ Ошибка: ${error.message}`);
      }
    }

    // Добавляем квесты
    console.log('\n📜 Добавление квестов...');
    for (const quest of newQuests) {
      try {
        const id = await AdminCommands.addQuest(quest);
        console.log(`✅ Добавлен: ${quest.title} (ID: ${id})`);
      } catch (error) {
        console.error(`❌ Ошибка: ${error.message}`);
      }
    }

    // Показываем статистику
    const itemCount = await db.get('SELECT COUNT(*) as count FROM items');
    const questCount = await db.get('SELECT COUNT(*) as count FROM quests');
    
    console.log('\n📊 Статистика БД:');
    console.log(`Всего предметов: ${itemCount.count}`);
    console.log(`Всего квестов: ${questCount.count}`);

    await db.close();
    console.log('\n✅ Готово!');
    
  } catch (error) {
    console.error('Критическая ошибка:', error);
    process.exit(1);
  }
}

// Запускаем если вызван напрямую
if (require.main === module) {
  main();
}

module.exports = { main };