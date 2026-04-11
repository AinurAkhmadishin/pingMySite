import { session, Telegraf } from "telegraf";

import { AppServices } from "../app/services";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { BotContext } from "../types/bot";
import { registerCommands } from "./commands/register-commands";
import { registerActionHandlers } from "./handlers/actions";
import { registerPaymentHandlers } from "./handlers/payments";
import { registerTextHandlers } from "./handlers/text";
import { createUserMiddleware } from "./middlewares/user";

export function createBot(services: AppServices): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

  bot.use(
    session({
      defaultSession: () => ({}),
    }),
  );
  bot.use(createUserMiddleware(services));

  registerCommands(bot, services);
  registerActionHandlers(bot, services);
  registerPaymentHandlers(bot, services);
  registerTextHandlers(bot, services);

  bot.catch(async (error, ctx) => {
    logger.error({ err: error, updateId: ctx.update.update_id }, "Telegram bot error");

    try {
      await ctx.reply("Произошла ошибка при обработке команды. Попробуйте еще раз.");
    } catch (replyError) {
      logger.error({ err: replyError }, "Failed to send bot error reply");
    }
  });

  return bot;
}

export async function startBot(services: AppServices): Promise<{ close: () => Promise<void> }> {
  const bot = createBot(services);

  if (env.BOT_POLLING) {
    await bot.launch({
      dropPendingUpdates: false,
    });

    logger.info("Telegram bot started in polling mode");
  }

  return {
    close: async () => {
      bot.stop("shutdown");
    },
  };
}
