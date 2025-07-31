const db = require('../database');
const { log } = require('../utils/logger');

class TradeSystem {
  constructor() {
    this.activeTrades = new Map(); // Активные предложения обмена
    this.TRADE_TIMEOUT = 5 * 60 * 1000; // 5 минут на принятие
  }

  // Создать предложение обмена
  async createTradeOffer(fromCharacter, toCharacter, offer) {
    const tradeId = `${fromCharacter.id}_${toCharacter.id}_${Date.now()}`;
    
    // Проверяем, что у инициатора есть предлагаемые предметы
    const validation = await this.validateOffer(fromCharacter.id, offer.giving);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    // Создаем предложение
    const trade = {
      id: tradeId,
      from: {
        character: fromCharacter,
        giving: offer.giving || { items: [], gold: 0 }
      },
      to: {
        character: toCharacter,
        giving: offer.requesting || { items: [], gold: 0 }
      },
      createdAt: Date.now(),
      status: 'pending'
    };

    // Сохраняем в памяти
    this.activeTrades.set(tradeId, trade);

    // Автоматическая отмена через 5 минут
    setTimeout(() => {
      if (this.activeTrades.has(tradeId)) {
        this.cancelTrade(tradeId);
      }
    }, this.TRADE_TIMEOUT);

    return { success: true, tradeId, trade };
  }

  // Валидация предложения
  async validateOffer(characterId, offer) {
    // Проверяем золото
    if (offer.gold > 0) {
      const character = await db.get(
        'SELECT gold FROM characters WHERE id = ?',
        [characterId]
      );
      
      if (!character || character.gold < offer.gold) {
        return { valid: false, message: 'Недостаточно золота!' };
      }
    }

    // Проверяем предметы
    for (const item of offer.items) {
      const inventory = await db.get(`
        SELECT inv.quantity, i.name 
        FROM inventory inv
        JOIN items i ON inv.item_id = i.id
        WHERE inv.character_id = ? AND inv.item_id = ?
      `, [characterId, item.id]);

      if (!inventory || inventory.quantity < item.quantity) {
        return { 
          valid: false, 
          message: `Недостаточно предметов: ${inventory?.name || 'Неизвестный предмет'}` 
        };
      }
    }

    return { valid: true };
  }

  // Принять обмен
  async acceptTrade(tradeId, acceptingCharacterId) {
    const trade = this.activeTrades.get(tradeId);
    
    if (!trade) {
      return { success: false, message: 'Предложение обмена не найдено или истекло!' };
    }

    if (trade.to.character.id !== acceptingCharacterId) {
      return { success: false, message: 'Это предложение не для вас!' };
    }

    // Проверяем, что оба участника могут выполнить обмен
    const fromValidation = await this.validateOffer(trade.from.character.id, trade.from.giving);
    const toValidation = await this.validateOffer(trade.to.character.id, trade.to.giving);

    if (!fromValidation.valid) {
      this.cancelTrade(tradeId);
      return { success: false, message: `Инициатор: ${fromValidation.message}` };
    }

    if (!toValidation.valid) {
      this.cancelTrade(tradeId);
      return { success: false, message: `Вы: ${toValidation.message}` };
    }

    try {
      // Начинаем транзакцию
      await db.run('BEGIN TRANSACTION');

      // Передаем предметы и золото от первого ко второму
      await this.transferItems(
        trade.from.character.id, 
        trade.to.character.id, 
        trade.from.giving
      );

      // Передаем предметы и золото от второго к первому
      await this.transferItems(
        trade.to.character.id, 
        trade.from.character.id, 
        trade.to.giving
      );

      // Записываем в историю
      await db.run(`
        INSERT INTO trade_history (
          from_character_id, to_character_id,
          from_items, from_gold,
          to_items, to_gold,
          completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        trade.from.character.id,
        trade.to.character.id,
        JSON.stringify(trade.from.giving.items),
        trade.from.giving.gold,
        JSON.stringify(trade.to.giving.items),
        trade.to.giving.gold
      ]);

      await db.run('COMMIT');
      
      // Удаляем из активных
      this.activeTrades.delete(tradeId);

      log(`Обмен завершен между ${trade.from.character.name} и ${trade.to.character.name}`);

      return { 
        success: true, 
        trade,
        message: 'Обмен успешно завершен!' 
      };

    } catch (error) {
      await db.run('ROLLBACK');
      log(`Ошибка обмена: ${error.message}`, 'error');
      return { success: false, message: 'Ошибка при выполнении обмена!' };
    }
  }

  // Передать предметы
  async transferItems(fromId, toId, items) {
    // Передаем золото
    if (items.gold > 0) {
      await db.run(
        'UPDATE characters SET gold = gold - ? WHERE id = ?',
        [items.gold, fromId]
      );
      await db.run(
        'UPDATE characters SET gold = gold + ? WHERE id = ?',
        [items.gold, toId]
      );
    }

    // Передаем предметы
    for (const item of items.items) {
      // Уменьшаем количество у отправителя
      await db.run(`
        UPDATE inventory 
        SET quantity = quantity - ? 
        WHERE character_id = ? AND item_id = ?
      `, [item.quantity, fromId, item.id]);

      // Удаляем если количество = 0
      await db.run(
        'DELETE FROM inventory WHERE character_id = ? AND item_id = ? AND quantity <= 0',
        [fromId, item.id]
      );

      // Добавляем получателю
      const existing = await db.get(
        'SELECT * FROM inventory WHERE character_id = ? AND item_id = ?',
        [toId, item.id]
      );

      if (existing) {
        await db.run(
          'UPDATE inventory SET quantity = quantity + ? WHERE id = ?',
          [item.quantity, existing.id]
        );
      } else {
        await db.run(
          'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)',
          [toId, item.id, item.quantity]
        );
      }
    }
  }

  // Отменить обмен
  cancelTrade(tradeId) {
    const trade = this.activeTrades.get(tradeId);
    if (trade) {
      this.activeTrades.delete(tradeId);
      log(`Обмен ${tradeId} отменен`);
      return true;
    }
    return false;
  }

  // Получить активные предложения для персонажа
  getActiveTradesForCharacter(characterId) {
    const trades = [];
    
    for (const [id, trade] of this.activeTrades) {
      if (trade.from.character.id === characterId || 
          trade.to.character.id === characterId) {
        trades.push({ id, ...trade });
      }
    }

    return trades;
  }

  // Форматировать предложение для отображения
  formatTradeOffer(trade) {
    let message = `📦 **Предложение обмена**\n\n`;
    
    // От кого
    message += `**${trade.from.character.name} предлагает:**\n`;
    if (trade.from.giving.gold > 0) {
      message += `💰 ${trade.from.giving.gold} золота\n`;
    }
    for (const item of trade.from.giving.items) {
      message += `📦 ${item.name} x${item.quantity}\n`;
    }
    if (trade.from.giving.gold === 0 && trade.from.giving.items.length === 0) {
      message += `_Ничего_\n`;
    }

    message += `\n**В обмен на:**\n`;
    if (trade.to.giving.gold > 0) {
      message += `💰 ${trade.to.giving.gold} золота\n`;
    }
    for (const item of trade.to.giving.items) {
      message += `📦 ${item.name} x${item.quantity}\n`;
    }
    if (trade.to.giving.gold === 0 && trade.to.giving.items.length === 0) {
      message += `_Ничего_\n`;
    }

    const timeLeft = Math.ceil((this.TRADE_TIMEOUT - (Date.now() - trade.createdAt)) / 1000 / 60);
    message += `\n⏰ Осталось ${timeLeft} мин.`;

    return message;
  }
}

// Экспортируем singleton
module.exports = new TradeSystem();