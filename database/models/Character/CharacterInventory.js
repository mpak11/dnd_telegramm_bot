// Методы работы с инвентарем персонажа

const db = require("../../index");

class CharacterInventory {
  // Получить инвентарь
  async getInventory() {
    const items = await db.all(
      `
      SELECT i.*, inv.quantity, inv.equipped
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE inv.character_id = ?
      ORDER BY i.rarity DESC, i.name
    `,
      [this.id]
    );

    return items;
  }

  // Добавить предмет в инвентарь
  async addItem(itemId, quantity = 1) {
    const existing = await db.get(
      "SELECT * FROM inventory WHERE character_id = ? AND item_id = ?",
      [this.id, itemId]
    );

    if (existing) {
      await db.run(
        "UPDATE inventory SET quantity = quantity + ? WHERE id = ?",
        [quantity, existing.id]
      );
    } else {
      await db.run(
        "INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)",
        [this.id, itemId, quantity]
      );
    }
  }

  // Удалить предмет из инвентаря
  async removeItem(itemId, quantity = 1) {
    const existing = await db.get(
      "SELECT * FROM inventory WHERE character_id = ? AND item_id = ?",
      [this.id, itemId]
    );

    if (!existing) {
      throw new Error("Предмет не найден в инвентаре");
    }

    if (existing.quantity <= quantity) {
      // Удаляем полностью
      await db.run("DELETE FROM inventory WHERE id = ?", [existing.id]);
    } else {
      // Уменьшаем количество
      await db.run(
        "UPDATE inventory SET quantity = quantity - ? WHERE id = ?",
        [quantity, existing.id]
      );
    }
  }

  // Проверить наличие предмета
  async hasItem(itemId, quantity = 1) {
    const item = await db.get(
      "SELECT quantity FROM inventory WHERE character_id = ? AND item_id = ?",
      [this.id, itemId]
    );

    return item && item.quantity >= quantity;
  }

  // Получить экипированные предметы
  async getEquippedItems() {
    const items = await db.all(
      `
      SELECT i.*, inv.equipped_slot
      FROM inventory inv
      JOIN items i ON inv.item_id = i.id
      WHERE inv.character_id = ? AND inv.equipped = 1
    `,
      [this.id]
    );

    return items;
  }
}

CharacterInventory.prototype = {};

module.exports = CharacterInventory;