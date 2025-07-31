-- Схема базы данных D&D Bot v2.0

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    telegram_username TEXT,
    first_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица персонажей
CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    chat_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    race TEXT DEFAULT 'human',
    class TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    hp_current INTEGER,
    hp_max INTEGER,
    gold INTEGER DEFAULT 0,
    
    -- Характеристики
    strength INTEGER DEFAULT 10,
    dexterity INTEGER DEFAULT 10,
    intelligence INTEGER DEFAULT 10,
    wisdom INTEGER DEFAULT 10,
    constitution INTEGER DEFAULT 10,
    charisma INTEGER DEFAULT 10,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Уникальный индекс для активных персонажей
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_character 
ON characters(user_id, chat_id) 
WHERE is_active = 1;

-- Таблица предметов (справочник)
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- weapon, armor, consumable, misc, artifact
    rarity TEXT NOT NULL, -- common, uncommon, rare, epic, legendary
    
    -- Эффекты предмета (JSON)
    effects TEXT, -- например: {"hp": 50, "strength": 2}
    
    -- Требования (JSON)
    requirements TEXT, -- например: {"level": 5, "class": "warrior"}
    
    value_gold INTEGER DEFAULT 0,
    is_unique BOOLEAN DEFAULT 0, -- для легендарных предметов
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица инвентаря
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    equipped BOOLEAN DEFAULT 0,
    obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (character_id) REFERENCES characters(id),
    FOREIGN KEY (item_id) REFERENCES items(id)
);

-- Таблица уникальных предметов (легендарные)
CREATE TABLE IF NOT EXISTS unique_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    chat_id INTEGER NOT NULL,
    owner_character_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (item_id) REFERENCES items(id),
    FOREIGN KEY (owner_character_id) REFERENCES characters(id),
    UNIQUE(item_id, chat_id) -- Один легендарный предмет на чат
);

-- Таблица квестов (справочник)
CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL, -- easy, medium, hard, epic, legendary
    stat_check TEXT NOT NULL, -- strength, dexterity, intelligence, wisdom, constitution, charisma
    min_level INTEGER DEFAULT 1, -- минимальный уровень для получения квеста
    
    -- Награды
    xp_reward INTEGER NOT NULL,
    gold_reward INTEGER NOT NULL,
    
    -- Возможные предметы (JSON массив ID предметов)
    possible_items TEXT, -- например: [1, 2, 3]
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица результатов квестов
CREATE TABLE IF NOT EXISTS quest_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quest_id INTEGER NOT NULL,
    roll_range TEXT NOT NULL, -- например: "20", "15-19", "1"
    result_text TEXT NOT NULL,
    is_success BOOLEAN NOT NULL,
    
    -- Награды/штрафы для этого результата
    xp_modifier REAL DEFAULT 1.0, -- множитель опыта
    gold_modifier REAL DEFAULT 1.0, -- множитель золота
    effects TEXT, -- временные эффекты (JSON)
    damage TEXT, -- урон если есть (например: "1d8", "2d6")
    
    FOREIGN KEY (quest_id) REFERENCES quests(id)
);

-- Таблица активных квестов
CREATE TABLE IF NOT EXISTS active_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    quest_id INTEGER NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    completed BOOLEAN DEFAULT 0,
    
    FOREIGN KEY (quest_id) REFERENCES quests(id)
);

-- Таблица истории квестов
CREATE TABLE IF NOT EXISTS quest_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    quest_id INTEGER NOT NULL,
    roll_result INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    xp_gained INTEGER,
    gold_gained INTEGER,
    items_gained TEXT, -- JSON массив
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (character_id) REFERENCES characters(id),
    FOREIGN KEY (quest_id) REFERENCES quests(id)
);

-- Таблица ежедневных лимитов
CREATE TABLE IF NOT EXISTS daily_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    date DATE NOT NULL,
    quests_given INTEGER DEFAULT 0,
    
    UNIQUE(chat_id, date)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_characters_user_chat ON characters(user_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_inventory_character ON inventory(character_id);
CREATE INDEX IF NOT EXISTS idx_unique_items_chat ON unique_items(chat_id);
CREATE INDEX IF NOT EXISTS idx_active_quests_chat ON active_quests(chat_id);
CREATE INDEX IF NOT EXISTS idx_quest_history_character ON quest_history(character_id);
CREATE INDEX IF NOT EXISTS idx_daily_limits_chat_date ON daily_limits(chat_id, date);