// Утилита для красивого логирования

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const symbols = {
  info: '📝',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  debug: '🔍'
};

function getTimestamp() {
  const now = new Date();
  return now.toTimeString().slice(0, 8); // HH:MM:SS
}

function log(message, level = 'info') {
  const timestamp = getTimestamp();
  const symbol = symbols[level] || '';
  
  let color = colors.white;
  switch(level) {
    case 'success':
      color = colors.green;
      break;
    case 'warning':
      color = colors.yellow;
      break;
    case 'error':
      color = colors.red;
      break;
    case 'debug':
      color = colors.cyan;
      break;
  }
  
  console.log(
    `${colors.bright}[${timestamp}]${colors.reset} ${symbol} ${color}${message}${colors.reset}`
  );
}

// Специальные функции для разных типов логов
function logQuest(message) {
  log(`[QUEST] ${message}`, 'info');
}

function logCharacter(message) {
  log(`[CHAR] ${message}`, 'info');
}

function logItem(message) {
  log(`[ITEM] ${message}`, 'info');
}

function logDatabase(message) {
  log(`[DB] ${message}`, 'debug');
}

module.exports = {
  log,
  logQuest,
  logCharacter,
  logItem,
  logDatabase,
};