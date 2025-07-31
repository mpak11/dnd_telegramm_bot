// Примеры квестов для разных уровней персонажей

module.exports = {
  // Квесты для начального уровня (1-4)
  beginnerQuests: [
    {
      title: 'Волки у деревни',
      description: 'Стая волков нападает на овец. Защитите стадо! Киньте 1d20!',
      difficulty: 'easy',
      stat_check: 'strength',
      min_level: 1,
      xp_reward: 50,
      gold_reward: 25,
      results: [
        { range: '20', text: '⚔️ Вы убили вожака стаи! Волки разбежались, а пастух дарит вам овцу!', success: true, xp_modifier: 2.0, gold_modifier: 3.0 },
        { range: '15-19', text: '💪 Волки отогнаны! Деревня благодарна.', success: true, xp_modifier: 1.5, gold_modifier: 1.5 },
        { range: '10-14', text: '✅ Вы защитили стадо, но укушены (1d4 урона).', success: true, xp_modifier: 1.0, gold_modifier: 1.0, damage: '1d4' },
        { range: '5-9', text: '🐺 Волки утащили овцу и покусали вас (1d6 урона).', success: false, xp_modifier: 0.5, gold_modifier: 0, damage: '1d6' },
        { range: '2-4', text: '💀 Стая окружила вас! 2d4 урона и позор.', success: false, xp_modifier: 0.2, gold_modifier: 0, damage: '2d4' },
        { range: '1', text: '☠️ Вожак прыгнул вам на горло! 3d4 урона и шрам на всю жизнь!', success: false, xp_modifier: 0.1, gold_modifier: 0, damage: '3d4', effects: { charisma: -1, duration: -1 } }
      ]
    }
  ],

  // Квесты для среднего уровня (5-8) 
  midGameQuests: [
    {
      title: 'Логово василиска',
      description: 'В пещере поселился василиск! Его взгляд обращает в камень! Киньте 1d20!',
      difficulty: 'hard',
      stat_check: 'wisdom',
      min_level: 5,
      xp_reward: 400,
      gold_reward: 300,
      results: [
        { range: '25-30', text: '🏆 Вы ослепили василиска и добили его! Его кровь - мощный алхимический ингредиент!', success: true, xp_modifier: 3.0, gold_modifier: 5.0 },
        { range: '20-24', text: '⚔️ Используя зеркальный щит, вы победили монстра!', success: true, xp_modifier: 2.0, gold_modifier: 3.0 },
        { range: '15-19', text: '💪 Василиск мертв, но вы частично окаменели (1d8 урона, -1 Ловкость на день).', success: true, xp_modifier: 1.5, gold_modifier: 2.0, damage: '1d8', effects: { dexterity: -1, duration: 24 } },
        { range: '10-14', text: '😰 Вы ранили его и сбежали. 2d6 урона от его когтей.', success: false, xp_modifier: 1.0, gold_modifier: 0.5, damage: '2d6' },
        { range: '2-9', text: '🗿 Ваши ноги окаменели! 3d8 урона и -2 к Ловкости на 3 дня!', success: false, xp_modifier: 0.5, gold_modifier: 0, damage: '3d8', effects: { dexterity: -2, duration: 72 } },
        { range: '1', text: '☠️ ВЫ ОБРАТИЛИСЬ В КАМЕНЬ! Только дорогое заклинание спасет вас (теряете всё золото)!', success: false, xp_modifier: 0.1, gold_modifier: -1.0, effects: { all_stats: -3, duration: 168 } }
      ]
    }
  ],

  // Эпические квесты (9-10 уровень)
  epicQuests: [
    {
      title: 'Древний дракон Фаэлгор',
      description: 'Пробудился Фаэлгор Пожиратель! Весь мир в опасности! Киньте 1d20!',
      difficulty: 'legendary',
      stat_check: 'strength',
      min_level: 9,
      xp_reward: 2000,
      gold_reward: 5000,
      results: [
        { range: '35-40', text: '⚡ ВЫ - ДРАКОНОУБИЙЦА! Фаэлгор пал, его сокровища ваши! Вы стали ЛЕГЕНДОЙ!', success: true, xp_modifier: 5.0, gold_modifier: 20.0, effects: { all_stats: 2, title: 'Драконоубийца', duration: -1 } },
        { range: '30-34', text: '🗡️ Невероятно! Дракон тяжело ранен и улетел! Вы спасли королевство!', success: true, xp_modifier: 3.0, gold_modifier: 10.0, effects: { charisma: 5, duration: -1 } },
        { range: '25-29', text: '🛡️ Вы выжили в битве с драконом! Это уже подвиг! Но дракон жив...', success: true, xp_modifier: 2.0, gold_modifier: 5.0, damage: '2d10' },
        { range: '20-24', text: '🔥 Драконье пламя! Вы едва укрылись! 4d10 огненного урона!', success: false, xp_modifier: 1.5, gold_modifier: 2.0, damage: '4d10', effects: { fire_vulnerability: true, duration: 168 } },
        { range: '10-19', text: '💀 Дракон играл с вами как кот с мышью! 6d10 урона и вечное проклятие!', success: false, xp_modifier: 1.0, gold_modifier: 0, damage: '6d10', effects: { cursed: true, all_stats: -2, duration: -1 } },
        { range: '2-9', text: '☠️ Вас проглотили и выплюнули! 8d10 урона! Чудом живы!', success: false, xp_modifier: 0.5, gold_modifier: -0.5, damage: '8d10', effects: { all_stats: -3, duration: 336 } },
        { range: '1', text: '💀💀💀 ИСПЕПЕЛЕНЫ ДРАКОНЬИМ ДЫХАНИЕМ! Воскрешение стоит 10000 золота и вы теряете уровень!', success: false, xp_modifier: -0.5, gold_modifier: -1.0, damage: '10d10', effects: { level_loss: true, all_stats: -5, duration: -1 } }
      ]
    },
    {
      title: 'Портал в Бездну',
      description: 'Демоны прорываются в наш мир! Закройте портал! Киньте 1d20!',
      difficulty: 'epic',
      stat_check: 'intelligence',
      min_level: 8,
      xp_reward: 1500,
      gold_reward: 2000,
      results: [
        { range: '30-35', text: '✨ Вы не только закрыли портал, но и подчинили демона-стража!', success: true, xp_modifier: 4.0, gold_modifier: 8.0, effects: { demon_servant: true, intelligence: 3, duration: -1 } },
        { range: '25-29', text: '🌟 Портал закрыт! Маги академии признают вас мастером!', success: true, xp_modifier: 2.5, gold_modifier: 5.0 },
        { range: '20-24', text: '⚡ Успех, но демоническая энергия обожгла разум (2d8 психического урона).', success: true, xp_modifier: 2.0, gold_modifier: 3.0, damage: '2d8' },
        { range: '15-19', text: '😈 Портал дестабилизирован, но не закрыт. 3d8 урона от демонов.', success: false, xp_modifier: 1.5, gold_modifier: 1.0, damage: '3d8' },
        { range: '5-14', text: '👹 Демоны прорвались! 5d8 урона и метка Бездны!', success: false, xp_modifier: 1.0, gold_modifier: 0, damage: '5d8', effects: { demon_mark: true, wisdom: -3, duration: -1 } },
        { range: '2-4', text: '🔥 Вас затянуло в Бездну! 7d10 урона и вечное безумие!', success: false, xp_modifier: 0.5, gold_modifier: 0, damage: '7d10', effects: { madness: true, intelligence: -5, wisdom: -5, duration: -1 } },
        { range: '1', text: '☠️ ДУША ПОГЛОЩЕНА БЕЗДНОЙ! Обычное воскрешение невозможно!', success: false, xp_modifier: 0, gold_modifier: -1.0, damage: '20d6', effects: { soul_trapped: true, duration: -1 } }
      ]
    }
  ]
};