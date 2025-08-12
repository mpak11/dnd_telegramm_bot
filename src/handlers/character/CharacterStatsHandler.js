// Управление статами персонажа.

// Показать детальную статистику
async function handleShowStats(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    const character = await Character.findActive(userId, chatId);

    if (!character) {
        await ctx.reply(
            "❌ У вас нет персонажа!\n\nИспользуйте /create для создания.",
            { parse_mode: "Markdown" }
        );
        return;
    }

    const classConfig = require("../config/config").CLASSES[character.class];
    const raceConfig = require("../config/config").RACES[character.race];

    let statsText = `📊 **Детальная статистика**\n\n`;
    statsText += `🎭 ${character.name}\n`;
    statsText += `${character.getFullTitle()} • ${character.level} уровень\n\n`;

    // Боевые характеристики
    statsText += `**⚔️ Боевые параметры:**\n`;
    statsText += `❤️ Здоровье: ${character.hp_current}/${character.hp_max}\n`;
    statsText += `🎯 Бонус мастерства: +${character.getProficiencyBonus()}\n`;
    statsText += `🗡️ Основная характеристика: ${classConfig.primaryStat}\n\n`;

    // Все характеристики с бонусами к броскам
    statsText += `**🎲 Модификаторы бросков:**\n`;
    const config = require("../config/config");
    for (const [stat, info] of Object.entries(config.STATS)) {
        const bonus = character.getRollBonus(stat);
        const isPrimary = classConfig.primaryStat === stat;
        statsText += `${info.emoji} ${info.name}: ${bonus >= 0 ? "+" : ""}${bonus}`;
        if (isPrimary) statsText += " ⭐";
        statsText += "\n";
    }

    // Прогресс
    statsText += `\n**📈 Прогресс:**\n`;
    statsText += `✨ Опыт: ${character.experience}\n`;
    statsText += `💰 Золото: ${character.gold}\n`;

    // Расовые особенности
    if (raceConfig.abilities.length > 0) {
        statsText += `\n**${raceConfig.emoji} Расовые способности:**\n`;
        for (const ability of raceConfig.abilities) {
            statsText += `• ${ability}\n`;
        }
    }

    await ctx.reply(statsText, { parse_mode: "Markdown" });
}