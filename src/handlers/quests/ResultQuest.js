// Результат квеста.

async function handleQuestRoll(ctx) {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
        await ctx.answerCbQuery("🎲 Бросаем кубик...");
    } catch (error) {
        // Игнорируем ошибку answerCbQuery
    }

    try {
        // Получаем персонажа
        const character = await Character.findActive(userId, chatId);
        if (!character) {
            await ctx.editMessageText("❌ Персонаж не найден!");
            return;
        }

        // Проверяем квест
        const quest = await questSystem.getActiveQuest(chatId);
        if (!quest) {
            await ctx.editMessageText("❌ Квест уже завершен или истек!");
            return;
        }

        // Бросаем кубик
        const roll = Math.floor(Math.random() * 20) + 1;

        // Анимация броска
        const diceEmojis = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
        let lastDice = null;

        for (let i = 0; i < 3; i++) {
            let randomDice;
            // Гарантируем, что выбираем другой эмодзи
            do {
                randomDice = diceEmojis[Math.floor(Math.random() * diceEmojis.length)];
            } while (randomDice === lastDice && diceEmojis.length > 1);

            lastDice = randomDice;

            try {
                await ctx.editMessageText(`${randomDice} Бросаем кубик...`);
            } catch (error) {
                // Если ошибка из-за одинакового текста, просто пропускаем
                if (!error.message.includes("message is not modified")) {
                    throw error;
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Выполняем квест
        const result = await questSystem.executeQuest(character, roll);

        if (!result.success) {
            await ctx.editMessageText(`❌ ${result.message}`);
            return;
        }

        // Формируем сообщение с результатом
        const config = require("../config/config");
        const statConfig = config.STATS[result.statUsed];
        const criticalText =
            roll === 20
                ? "⚡ КРИТИЧЕСКИЙ УСПЕХ! ⚡\n"
                : roll === 1
                    ? "💀 КРИТИЧЕСКИЙ ПРОВАЛ! 💀\n"
                    : "";

        let message = `🎯 **${result.questTitle}**\n\n`;
        message += criticalText;
        message += `🎲 Бросок: **${roll}**\n`;
        message += `${statConfig.emoji} Модификатор ${statConfig.name}: ${result.statModifier >= 0 ? "+" : ""
            }${result.statModifier}\n`;
        message += `📊 Итого: **${result.totalRoll}**\n\n`;

        message += `${result.questResult.result_text}\n\n`;

        message += `**Результаты:**\n`;
        if (result.xpGained > 0) {
            message += `✨ Опыт: +${result.xpGained} XP\n`;
        }
        if (result.xpGained > 0) {
            message += `✨ Опыт: +${result.xpGained} XP\n`;
        }

        // Показываем золото отдельно
        if (result.goldGained > 0) {
            if (result.lootGold > 0) {
                message += `💰 Золото: +${result.goldGained - result.lootGold
                    } (квест) +${result.lootGold} (добыча) = **+${result.goldGained}**\n`;
            } else {
                message += `💰 Золото: +${result.goldGained}\n`;
            }
        } else if (result.goldGained < 0) {
            message += `💸 Потеряно золота: ${Math.abs(result.goldGained)}\n`;
        }

        // Показываем найденные предметы
        if (result.lootItems && result.lootItems.length > 0) {
            message += `\n🎁 **Найденные предметы:**\n`;

            const rarityEmojis = {
                common: "⚪",
                uncommon: "🟢",
                rare: "🔵",
                epic: "🟣",
                legendary: "🟠",
            };

            for (const item of result.lootItems) {
                const emoji = rarityEmojis[item.rarity] || "❓";
                message += `${emoji} ${item.name}\n`;
            }
        }

        if (result.damageDealt > 0) {
            message += `💔 Урон: -${result.damageDealt} HP (${result.characterHp}/${result.characterMaxHp})\n`;
        }

        if (result.levelUp) {
            message += `\n🎉 **НОВЫЙ УРОВЕНЬ! ${result.levelUp.from} → ${result.levelUp.to}**\n`;

            if (result.levelUp.abilityPointsGained > 0) {
                message += `💎 **Получено ${result.levelUp.abilityPointsGained} очка улучшения!** Используйте /improve\n`;
            }
        }

        // Проверяем смерть персонажа
        if (result.isDead) {
            message += `\n☠️ **ПЕРСОНАЖ ПОГИБ!** ☠️\n`;
            message += `\n_${character.name} пал смертью храбрых, выполняя опасный квест._\n`;
            message += `_Покойся с миром, отважный ${character.getClassInfo()}._\n\n`;
            message += `Используйте /create для создания нового персонажа.`;
        }
        await ctx.editMessageText(message, { parse_mode: "Markdown" });

        log(
            `${character.name} выполнил квест "${result.questTitle}" с результатом ${result.totalRoll}`
        );
    } catch (error) {
        log(`Ошибка выполнения квеста: ${error.message}`, "error");

        try {
            await ctx.editMessageText(
                "❌ Произошла ошибка при выполнении квеста.\nПопробуйте еще раз через несколько секунд.",
                { parse_mode: "Markdown" }
            );
        } catch (editError) {
            // Если не можем отредактировать сообщение, отправляем новое
            await ctx.reply(
                "❌ Произошла ошибка при выполнении квеста.\nПопробуйте еще раз через несколько секунд.",
                { parse_mode: "Markdown" }
            );
        }
    }
}