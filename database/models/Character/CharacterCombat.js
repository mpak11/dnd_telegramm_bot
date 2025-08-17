// Боевые методы персонажа

const db = require("../../index");
const { log } = require("../../../utils/logger");

class CharacterCombat {
  // Изменить HP
  async modifyHP(amount) {
    this.hp_current = Math.max(0, Math.min(this.hp_max, this.hp_current + amount));

    // Проверяем смерть
    let isDead = false;
    if (this.hp_current <= 0) {
      isDead = true;
      this.is_active = 0;

      // Деактивируем персонажа
      await db.run(
        "UPDATE characters SET hp_current = ?, is_active = 0 WHERE id = ?",
        [this.hp_current, this.id]
      );

      // Логируем смерть
      log(`☠️ Персонаж ${this.name} (ID: ${this.id}) погиб!`, "warning");
    } else {
      // Обычное обновление HP
      await db.run("UPDATE characters SET hp_current = ? WHERE id = ?", [
        this.hp_current,
        this.id,
      ]);
    }

    return isDead;
  }

  // Проверка, жив ли персонаж
  isDead() {
    return this.hp_current <= 0 || !this.is_active;
  }

  // Воскрешение
  async resurrect(hpAmount = null) {
    const resurrectionHP = hpAmount || Math.floor(this.hp_max * 0.5);

    this.hp_current = Math.min(resurrectionHP, this.hp_max);
    this.is_active = 1;

    await db.run(
      "UPDATE characters SET hp_current = ?, is_active = 1 WHERE id = ?",
      [this.hp_current, this.id]
    );

    log(`✨ Персонаж ${this.name} воскрешен с ${this.hp_current} HP!`);
  }

  // Полное исцеление
  async fullHeal() {
    this.hp_current = this.hp_max;
    await db.run("UPDATE characters SET hp_current = ? WHERE id = ?", [
      this.hp_current,
      this.id,
    ]);
  }

  // Получить урон (с возможными сопротивлениями в будущем)
  async takeDamage(amount, damageType = 'physical') {
    // Здесь можно добавить логику сопротивлений
    return await this.modifyHP(-amount);
  }

  // Лечение
  async heal(amount) {
    return await this.modifyHP(amount);
  }
}

CharacterCombat.prototype = {};

module.exports = CharacterCombat;