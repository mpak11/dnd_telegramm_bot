// systems/questScheduler.js
// Планировщик автоматической выдачи квестов

const schedule = require('node-schedule');
const db = require('../database');
const questSystem = require('./questSystem');
const { log, logQuest } = require('../utils/logger');

class QuestScheduler {
  constructor() {
    this.jobs = [];
    this.bot = null;
  }

  // Инициализация планировщика
  init(bot) {
    this.bot = bot;
    
    // Очистка истекших квестов каждый час
    this.jobs.push(
      schedule.scheduleJob('0 * * * *', async () => {
        await questSystem.cleanupExpiredQuests();
      })
    );

    // Выдача квестов в 10:00, 14:00 и 18:00 МСК
    const questTimes = ['0 10 * * *', '0 14 * * *', '0 18 * * *'];
    
    questTimes.forEach(time => {
      this.jobs.push(
        schedule.scheduleJob(time, async () => {
          await this.distributeQuests();
        })
      );
    });

    logQuest('Планировщик квестов запущен');
    log(`Квесты будут выдаваться в 10:00, 14:00 и 18:00 МСК`, 'info');
  }

  // Раздать квесты всем активным чатам
  async distributeQuests() {
    try {
      logQuest('Начинаем раздачу квестов...');

      // Получаем все чаты с активными персонажами
      const activeChats = await db.all(`
        SELECT DISTINCT chat_id 
        FROM characters 
        WHERE is_active = 1
      `);

      let distributed = 0;

      for (const chat of activeChats) {
        const canReceive = await questSystem.canReceiveQuest(chat.chat_id);
        
        if (canReceive.can) {
          const quest = await questSystem.assignQuest(chat.chat_id);
          
          if (quest && this.bot) {
            await this.notifyChat(chat.chat_id, quest);
            distributed++;
          }
        }
      }

      logQuest(`Раздано ${distributed} квестов`);

    } catch (error) {
      log(`Ошибка раздачи квестов: ${error.message}`, 'error');
    }
  }

  // Уведомить чат о новом квесте
  async notifyChat(chatId, quest) {
    try {
      const statInfo = this.getStatName(quest.stat_check);
      const difficultyEmoji = this.getDifficultyEmoji(quest.difficulty);
      
      const message = `
🎯 **НОВЫЙ КВЕСТ!**

${difficultyEmoji} **${quest.title}**
${quest.description}

📊 Проверка: ${statInfo.emoji} ${statInfo.name}
⏰ Время: 4 часа
💰 Награда: ${quest.xp_reward} XP, ${quest.gold_reward} золота

Используйте команду /quest чтобы попытаться выполнить!
`;

      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
      });

    } catch (error) {
      log(`Ошибка отправки уведомления в чат ${chatId}: ${error.message}`, 'error');
    }
  }

  // Получить название характеристики
  getStatName(stat) {
    const stats = {
      strength: { name: 'Сила', emoji: '💪' },
      dexterity: { name: 'Ловкость', emoji: '🏃' },
      intelligence: { name: 'Интеллект', emoji: '🧠' },
      wisdom: { name: 'Мудрость', emoji: '👁️' },
      constitution: { name: 'Телосложение', emoji: '🛡️' },
      charisma: { name: 'Харизма', emoji: '✨' }
    };
    return stats[stat] || { name: stat, emoji: '📊' };
  }

  // Получить эмодзи сложности
  getDifficultyEmoji(difficulty) {
    const emojis = {
      easy: '🟢',
      medium: '🟡', 
      hard: '🔴',
      epic: '🟣',
      legendary: '⭐'
    };
    return emojis[difficulty] || '❓';
  }

  // Остановить планировщик
  stop() {
    this.jobs.forEach(job => job.cancel());
    this.jobs = [];
    logQuest('Планировщик квестов остановлен');
  }
}

// Экспортируем singleton
module.exports = new QuestScheduler();