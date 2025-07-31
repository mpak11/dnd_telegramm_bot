/**
 * Экранирует специальные символы для Telegram Markdown
 * @param {string} text - Текст для экранирования
 * @returns {string} - Экранированный текст
 */
function escapeMarkdown(text) {
  if (!text) return '';
  
  return text
    .replace(/_/g, '\\_')   // Подчеркивания
    .replace(/\*/g, '\\*')  // Звездочки
    .replace(/`/g, '\\`')   // Обратные кавычки
    .replace(/\[/g, '\\[')  // Квадратные скобки
    .replace(/\]/g, '\\]')  // Квадратные скобки
    .replace(/\(/g, '\\(')  // Круглые скобки
    .replace(/\)/g, '\\)')  // Круглые скобки
    .replace(/~/g, '\\~')   // Тильда
    .replace(/>/g, '\\>')   // Больше
    .replace(/#/g, '\\#')   // Решетка
    .replace(/\+/g, '\\+')  // Плюс
    .replace(/-/g, '\\-')   // Минус
    .replace(/=/g, '\\=')   // Равно
    .replace(/\|/g, '\\|')  // Вертикальная черта
    .replace(/\{/g, '\\{')  // Фигурная скобка
    .replace(/\}/g, '\\}')  // Фигурная скобка
    .replace(/\./g, '\\.')  // Точка
    .replace(/!/g, '\\!');  // Восклицательный знак
}

module.exports = {
  escapeMarkdown
};