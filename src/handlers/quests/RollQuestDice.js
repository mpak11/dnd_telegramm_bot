// Выполнение квеста (бросок кубика) и получение результатов выполнения.

/ Получаем активный квест
const quest = await questSystem.getActiveQuest(chatId);
if (!quest) {
    // Проверяем, можем ли получить новый квест
    const canReceive = await questSystem.canReceiveQuest(chatId);

    if (canReceive.can) {
        // Пытаемся выдать новый квест
        const newQuest = await questSystem.assignQuest(chatId);
        if (newQuest) {
            await showQuestInfo(ctx, newQuest, character);
            return;
        }
    }

    await ctx.reply(
        `❌ Нет активного квеста!\n\n${canReceive.reason || "Ждите автоматической выдачи."
        }`,
        { parse_mode: "Markdown" }
    );
    return;
}

// Показываем информацию о квесте
await showQuestInfo(ctx, quest, character);
}

// Показать информацию о квесте с кнопкой броска
async function showQuestInfo(ctx, quest, character) {
    const config = require("../config/config");
    const statConfig = config.STATS[quest.stat_check];
    const timeLeft = Math.ceil(
        (new Date(quest.expires_at) - new Date()) / 1000 / 60
    );

    const difficultyEmoji = {
        easy: "🟢",
        medium: "🟡",
        hard: "🔴",
        epic: "🟣",
        legendary: "⭐",
    };

    // Получаем модификатор персонажа
    const statModifier = character.getRollBonus(quest.stat_check);
    const modSign = statModifier >= 0 ? "+" : "";

    const message = `
🎯 **АКТИВНЫЙ КВЕСТ**

${difficultyEmoji[quest.difficulty] || "❓"} **${quest.title}**
${quest.description}

📊 **Проверка:** ${statConfig.emoji} ${statConfig.name}
🎲 **Ваш модификатор:** ${modSign}${statModifier}
⏰ **Осталось времени:** ${timeLeft} мин
💰 **Базовая награда:** ${quest.xp_reward} XP, ${quest.gold_reward} золота

**Как это работает:**
• Вы бросите 1d20 ${modSign}${statModifier}
• Разные результаты дают разные награды
• 20 - критический успех!
• 1 - критический провал!
`;

    await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎲 Бросить кубик!", callback_data: "quest_roll" }],
            ],
        },
    });
}

