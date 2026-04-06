import { MiddlewareFn } from "telegraf";

import { AppServices } from "../../app/services";
import { BotContext } from "../../types/bot";

export function createUserMiddleware(services: AppServices): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    if (ctx.from) {
      ctx.state.currentUser = await services.userService.syncTelegramUser({
        telegramId: String(ctx.from.id),
        username: ctx.from.username,
        firstName: ctx.from.first_name,
      });
    }

    await next();
  };
}
