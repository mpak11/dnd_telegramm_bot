const db = require('../database');
const { log } = require('../utils/logger');

class AdvancedMerchantSystem {
  constructor() {
    // Конфигурация торговцев
    this.merchants = {
      1: {
        name: 'Гарольд',
        title: 'Торговец общими товарами',
        specialization: 'general',
        personality: 'friendly',
        baseMarkup: 1.2, // 20% наценка
        greetings: {
          friendly: [
            'Добро пожаловать, друг мой! Какие товары вас интересуют?',
            'Рад видеть вас снова! У меня есть отличные предложения!'
          ],
          neutral: [
            'Добро пожаловать в мою лавку.',
            'Чем могу помочь?'
          ],
          unfriendly: [
            'Что вам нужно?',
            'Покупаете или просто смотрите?'
          ]
        },
        specialEvents: {
          firstVisit: 'Новое лицо! Добро пожаловать! Для новых клиентов у меня есть скидка!',
          bigSpender: 'О, мой лучший клиент! Для вас всегда особые цены!',
          levelUp: 'Поздравляю с новым уровнем! Взгляните на товары для опытных искателей приключений!'
        }
      },
      2: {
        name: 'Мерлин',
        title: 'Мастер зелий',
        specialization: 'potions',
        personality: 'eccentric',
        baseMarkup: 1.3,
        greetings: {
          friendly: [
            'Ах, мой любимый подопытный... то есть, клиент!',
            'Готовы испытать мои новейшие творения?'
          ],
          neutral: [
            'Нужны зелья? У меня есть всё... почти всё не взрывается.',
            'Осторожно с фиолетовыми - они еще экспериментальные.'
          ],
          unfriendly: [
            'Не трогайте ничего без разрешения!',
            'Если что-то взорвется - платить будете вы.'
          ]
        }
      },
      3: {
        name: 'Торин',
        title: 'Мастер-оружейник',
        specialization: 'weapons',
        personality: 'gruff',
        baseMarkup: 1.25,
        canCraft: true,
        greetings: {
          friendly: [
            'Хорошая сталь для хорошего воина!',
            'Мои клинки никогда не подводят!'
          ],
          neutral: [
            'Нужно оружие? У меня лучшее в городе.',
            'Смотрите, но не хватайте лезвия.'
          ],
          unfriendly: [
            'Не вижу в вас воина.',
            'Мое оружие не для всяких.'
          ]
        }
      },
      4: {
        name: 'Эльза',
        title: 'Ювелир',
        specialization: 'accessories',
        personality: 'sophisticated',
        baseMarkup: 1.5,
        greetings: {
          friendly: [
            'Какая честь! Позвольте показать мои лучшие творения!',
            'Для такого уважаемого клиента у меня есть особые украшения!'
          ],
          neutral: [
            'Добро пожаловать. У меня только изысканные вещи.',
            'Каждое украшение - произведение искусства.'
          ],
          unfriendly: [
            'Уверены, что можете себе позволить мои товары?',
            'Это не рыночная лавка, здесь только премиум.'
          ]
        }
      }
    };
  }

  // Инициализация торговцев
  async initialize() {
    for (const [id, merchant] of Object.entries(this.merchants)) {
      await this.createMerchant(id, merchant);
    }
  }

  // Создать торговца
  async createMerchant(id, merchantData) {
    const existing = await db.get('SELECT id FROM merchants WHERE id = ?', [id]);
    if (existing) return;
    
    await db.run(`
      INSERT INTO merchants (id, name, description, location, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [
      id,
      merchantData.name,
      merchantData.title,
      'Главная площадь'
    ]);
    
    // Заполняем инвентарь в зависимости от специализации
    await this.stockMerchant(id, merchantData.specialization);
  }

  // Заполнить инвентарь торговца
  async stockMerchant(merchantId, specialization) {
    let itemTypes = [];
    
    switch(specialization) {
      case 'general':
        itemTypes = ['consumable', 'weapon', 'armor'];
        break;
      case 'potions':
        itemTypes = ['consumable'];
        break;
      case 'weapons':
        itemTypes = ['weapon', 'shield'];
        break;
      case 'accessories':
        itemTypes = ['accessory'];
        break;
    }
    
    const items = await db.all(`
      SELECT id FROM items 
      WHERE type IN (${itemTypes.map(() => '?').join(',')})
      AND rarity IN ('common', 'uncommon')
      AND is_unique = 0
      LIMIT 20
    `, itemTypes);
    
    for (const item of items) {
      await db.run(`
        INSERT OR IGNORE INTO merchant_inventory (merchant_id, item_id, quantity)
        VALUES (?, ?, ?)
      `, [merchantId, item.id, -1]); // -1 = бесконечное количество
    }
  }

  // Получить репутацию персонажа с торговцем
  async getReputation(characterId, merchantId) {
    const rep = await db.get(`
      SELECT * FROM merchant_reputation
      WHERE character_id = ? AND merchant_id = ?
    `, [characterId, merchantId]);
    
    if (!rep) {
      // Создаем новую запись репутации
      await db.run(`
        INSERT INTO merchant_reputation (character_id, merchant_id, reputation)
        VALUES (?, ?, 0)
      `, [characterId, merchantId]);
      
      return {
        reputation: 0,
        total_spent: 0,
        total_sold: 0,
        special_flags: {}
      };
    }
    
    return {
      ...rep,
      special_flags: rep.special_flags ? JSON.parse(rep.special_flags) : {}
    };
  }

  // Получить настроение торговца
  getMerchantMood(reputation) {
    const moods = {
      veryhappy: { min: 100, emoji: '😊', priceModifier: 0.9 },
      happy: { min: 50, emoji: '🙂', priceModifier: 0.95 },
      neutral: { min: -20, emoji: '😐', priceModifier: 1.0 },
      unhappy: { min: -50, emoji: '😒', priceModifier: 1.1 },
      angry: { min: -100, emoji: '😠', priceModifier: 1.2 },
      furious: { min: -200, emoji: '🤬', priceModifier: 1.5, refuseService: true }
    };
    
    for (const [mood, config] of Object.entries(moods)) {
      if (reputation >= config.min) {
        return { mood, ...config };
      }
    }
    
    return moods.furious;
  }

  // Получить приветствие торговца
  async getMerchantGreeting(characterId, merchantId) {
    const merchant = this.merchants[merchantId];
    if (!merchant) return 'Привет, путник.';
    
    const rep = await this.getReputation(characterId, merchantId);
    const mood = this.getMerchantMood(rep.reputation);
    
    // Проверяем специальные события
    const character = await db.get('SELECT * FROM characters WHERE id = ?', [characterId]);
    
    // Первый визит
    if (!rep.special_flags.firstVisit) {
      await this.updateSpecialFlag(characterId, merchantId, 'firstVisit', true);
      return merchant.specialEvents?.firstVisit || merchant.greetings.neutral[0];
    }
    
    // Большой спендер
    if (rep.total_spent > 5000 && !rep.special_flags.bigSpender) {
      await this.updateSpecialFlag(characterId, merchantId, 'bigSpender', true);
      await this.changeReputation(characterId, merchantId, 20);
      return merchant.specialEvents?.bigSpender || 'Рад видеть такого щедрого клиента!';
    }
    
    // Обычное приветствие в зависимости от настроения
    const greetingType = mood.mood.includes('happy') ? 'friendly' : 
                        mood.mood.includes('angry') ? 'unfriendly' : 'neutral';
    
    const greetings = merchant.greetings[greetingType];
    return greetings[Math.floor(Math.random() * greetings.length)] + ` ${mood.emoji}`;
  }

  // Получить цены с учетом репутации
  async getPricesForCharacter(characterId, merchantId, items) {
    const merchant = this.merchants[merchantId];
    const rep = await this.getReputation(characterId, merchantId);
    const mood = this.getMerchantMood(rep.reputation);
    
    if (mood.refuseService) {
      throw new Error(`${merchant.name} отказывается с вами торговать! ${mood.emoji}`);
    }
    
    const pricesWithMarkup = items.map(item => ({
      ...item,
      buyPrice: Math.floor(item.value_gold * merchant.baseMarkup * mood.priceModifier),
      sellPrice: Math.floor(item.value_gold * 0.5 * (2 - mood.priceModifier))
    }));
    
    return pricesWithMarkup;
  }

  // Купить предмет
  async buyItem(characterId, merchantId, itemId, quantity = 1) {
    const character = await db.get('SELECT * FROM characters WHERE id = ?', [characterId]);
    const item = await db.get('SELECT * FROM items WHERE id = ?', [itemId]);
    const merchant = this.merchants[merchantId];
    
    if (!character || !item || !merchant) {
      throw new Error('Неверные данные');
    }
    
    // Проверяем наличие в инвентаре торговца
    const stock = await db.get(`
      SELECT * FROM merchant_inventory
      WHERE merchant_id = ? AND item_id = ?
    `, [merchantId, itemId]);
    
    if (!stock) {
      throw new Error('У торговца нет этого предмета');
    }
    
    // Получаем цену с учетом репутации
    const [priceData] = await this.getPricesForCharacter(characterId, merchantId, [item]);
    const totalPrice = priceData.buyPrice * quantity;
    
    if (character.gold < totalPrice) {
      throw new Error(`Недостаточно золота! Нужно ${totalPrice}, у вас ${character.gold}`);
    }
    
    // Начинаем транзакцию
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Списываем золото
      await db.run(
        'UPDATE characters SET gold = gold - ? WHERE id = ?',
        [totalPrice, characterId]
      );
      
      // Добавляем предмет в инвентарь
      const existing = await db.get(
        'SELECT * FROM inventory WHERE character_id = ? AND item_id = ?',
        [characterId, itemId]
      );
      
      if (existing) {
        await db.run(
          'UPDATE inventory SET quantity = quantity + ? WHERE id = ?',
          [quantity, existing.id]
        );
      } else {
        await db.run(
          'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)',
          [characterId, itemId, quantity]
        );
      }
      
      // Обновляем репутацию и статистику
      await this.updatePurchaseStats(characterId, merchantId, totalPrice);
      await this.trackItemUsage(itemId, 'bought');
      
      await db.run('COMMIT');
      
      // Комментарий торговца
      const comments = [
        'Отличный выбор!',
        'Это вам пригодится!',
        'Спасибо за покупку!',
        'Приходите еще!'
      ];
      
      return {
        success: true,
        item: item.name,
        price: totalPrice,
        comment: comments[Math.floor(Math.random() * comments.length)]
      };
      
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  // Продать предмет
  async sellItem(characterId, merchantId, itemId, quantity = 1) {
    const item = await db.get('SELECT * FROM items WHERE id = ?', [itemId]);
    const merchant = this.merchants[merchantId];
    
    // Проверяем наличие в инвентаре персонажа
    const inventory = await db.get(
      'SELECT * FROM inventory WHERE character_id = ? AND item_id = ?',
      [characterId, itemId]
    );
    
    if (!inventory || inventory.quantity < quantity) {
      throw new Error('У вас нет столько предметов');
    }
    
    // Получаем цену продажи
    const [priceData] = await this.getPricesForCharacter(characterId, merchantId, [item]);
    const totalPrice = priceData.sellPrice * quantity;
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Добавляем золото
      await db.run(
        'UPDATE characters SET gold = gold + ? WHERE id = ?',
        [totalPrice, characterId]
      );
      
      // Убираем предмет из инвентаря
      if (inventory.quantity === quantity) {
        await db.run('DELETE FROM inventory WHERE id = ?', [inventory.id]);
      } else {
        await db.run(
          'UPDATE inventory SET quantity = quantity - ? WHERE id = ?',
          [quantity, inventory.id]
        );
      }
      
      // Обновляем статистику
      await this.updateSaleStats(characterId, merchantId, totalPrice);
      await this.trackItemUsage(itemId, 'sold');
      
      await db.run('COMMIT');
      
      return {
        success: true,
        item: item.name,
        price: totalPrice,
        comment: 'Сделка заключена!'
      };
      
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  }

  // Обновить статистику покупок
  async updatePurchaseStats(characterId, merchantId, amount) {
    await db.run(`
      UPDATE merchant_reputation
      SET total_spent = total_spent + ?,
          last_interaction = CURRENT_TIMESTAMP
      WHERE character_id = ? AND merchant_id = ?
    `, [amount, characterId, merchantId]);
    
    // Увеличиваем репутацию за покупки
    const repGain = Math.floor(amount / 100); // 1 репутация за каждые 100 золота
    if (repGain > 0) {
      await this.changeReputation(characterId, merchantId, repGain);
    }
  }

  // Обновить статистику продаж
  async updateSaleStats(characterId, merchantId, amount) {
    await db.run(`
      UPDATE merchant_reputation
      SET total_sold = total_sold + ?,
          last_interaction = CURRENT_TIMESTAMP
      WHERE character_id = ? AND merchant_id = ?
    `, [amount, characterId, merchantId]);
    
    // Небольшое увеличение репутации за продажи
    const repGain = Math.floor(amount / 200);
    if (repGain > 0) {
      await this.changeReputation(characterId, merchantId, repGain);
    }
  }

  // Изменить репутацию
  async changeReputation(characterId, merchantId, amount) {
    await db.run(`
      UPDATE merchant_reputation
      SET reputation = reputation + ?
      WHERE character_id = ? AND merchant_id = ?
    `, [amount, characterId, merchantId]);
    
    log(`Репутация персонажа ${characterId} с торговцем ${merchantId} изменена на ${amount}`);
  }

  // Обновить специальный флаг
  async updateSpecialFlag(characterId, merchantId, flag, value) {
    const rep = await this.getReputation(characterId, merchantId);
    const flags = rep.special_flags;
    flags[flag] = value;
    
    await db.run(`
      UPDATE merchant_reputation
      SET special_flags = ?
      WHERE character_id = ? AND merchant_id = ?
    `, [JSON.stringify(flags), characterId, merchantId]);
  }

  // Отследить использование предмета
  async trackItemUsage(itemId, action) {
    const column = `times_${action}`;
    
    const exists = await db.get(
      'SELECT 1 FROM item_statistics WHERE item_id = ?',
      [itemId]
    );
    
    if (!exists) {
      await db.run('INSERT INTO item_statistics (item_id) VALUES (?)', [itemId]);
    }
    
    await db.run(
      `UPDATE item_statistics SET ${column} = ${column} + 1 WHERE item_id = ?`,
      [itemId]
    );
  }

  // Получить инвентарь торговца для отображения
  async getMerchantInventory(merchantId, characterId) {
    const items = await db.all(`
      SELECT i.*, mi.quantity, mi.price_modifier
      FROM merchant_inventory mi
      JOIN items i ON mi.item_id = i.id
      WHERE mi.merchant_id = ?
      ORDER BY i.type, i.rarity, i.name
    `, [merchantId]);
    
    // Добавляем цены с учетом репутации
    const itemsWithPrices = await this.getPricesForCharacter(characterId, merchantId, items);
    
    return itemsWithPrices;
  }
}

module.exports = new AdvancedMerchantSystem();